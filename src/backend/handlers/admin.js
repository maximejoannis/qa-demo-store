import { AdminProductPatchSchema, AdminStatusPatchSchema, KpiQuerySchema } from '../schemas.js';
import { computeKpis, parisDate, reorderSuggestions, retentionPlan } from '../../engine/index.js';
import { orderDto, productDto } from '../dto.js';
import { ApiError } from '../errors.js';
import { ok, parse } from '../router.js';
import { changeStatus } from '../services.js';
import { eraseUser } from './account.js';
import { byNewest } from './orders.js';
import { C } from '../types.js';

const DELETE_TARGETS = {
  order: [C.orders, 'ordersDeleted'],
  consentProof: [C.consents, 'consentProofsDeleted'],
  technicalLog: [C.logs, 'logsDeleted'],
  stockAlert: [C.stockAlerts, 'stockAlertsDeleted'],
  guestCart: [C.logs, 'logsDeleted'],
};

export async function purge(ctx) {
  const users = await ctx.store.list(C.users);
  const orders = await ctx.store.list(C.orders);
  const consents = await ctx.store.list(C.consents);
  const logs = await ctx.store.list(C.logs);
  const alerts = await ctx.store.list(C.stockAlerts);
  const records = [
    ...users
      .filter((user) => user.role !== 'admin')
      .map((user) => ({
        category: 'account',
        id: user.id,
        referenceDate: user.lastActivityAt,
      })),
    ...orders.map((order) => ({
      category: 'order',
      id: order.id,
      referenceDate: parisDate(new Date(order.date)),
    })),
    ...consents.map((consent) => ({
      category: 'consentProof',
      id: consent.id,
      referenceDate: parisDate(new Date(consent.date)),
    })),
    ...logs.map((log) => ({
      category: 'technicalLog',
      id: log.id,
      referenceDate: parisDate(new Date(log.date)),
    })),
    ...alerts.map((alert) => ({
      category: 'stockAlert',
      id: alert.id,
      referenceDate: parisDate(new Date(alert.date)),
    })),
  ];
  const summary = {
    accountsAnonymized: 0,
    ordersDeleted: 0,
    consentProofsDeleted: 0,
    logsDeleted: 0,
    stockAlertsDeleted: 0,
    expiredQuotesDeleted: 0,
    expiredSessionsDeleted: 0,
  };
  for (const decision of retentionPlan(records, ctx.now).filter((item) => item.due)) {
    if (decision.category === 'account') {
      const user = users.find((candidate) => candidate.id === decision.id);
      if (user) await eraseUser(ctx, user);
      summary.accountsAnonymized += 1;
    } else {
      const [collection, key] = DELETE_TARGETS[decision.category];
      await ctx.store.delete(collection, decision.id);
      summary[key] += 1;
    }
  }
  const nowIso = ctx.now.toISOString();
  for (const quote of await ctx.store.list(C.quotes)) {
    if (quote.expiresAt < nowIso) {
      await ctx.store.delete(C.quotes, quote.id);
      summary.expiredQuotesDeleted += 1;
    }
  }
  for (const session of await ctx.store.list(C.sessions)) {
    if (session.expiresAt < nowIso) {
      await ctx.store.delete(C.sessions, session.id);
      summary.expiredSessionsDeleted += 1;
    }
  }
  return summary;
}

export const adminRoutes = [
  {
    method: 'GET',
    path: '/admin/products',
    auth: 'admin',
    tag: 'admin',
    summary: 'All products, including inactive ones',
    async handler(ctx) {
      const products = (await ctx.store.list(C.products)).sort((a, b) => a.id - b.id);
      return ok({ items: products.map((product) => productDto(product, ctx.now)) });
    },
  },
  {
    method: 'PATCH',
    path: '/admin/products/:id',
    auth: 'admin',
    tag: 'admin',
    summary: 'Update price (TTC cents), stock or availability',
    request: 'AdminProductPatchSchema',
    async handler(ctx, { params, body }) {
      const input = parse(AdminProductPatchSchema, body);
      const product = await ctx.product(Number(params.id));
      const updated = { ...product, ...input };
      await ctx.store.put(C.products, updated);
      if (product.stock <= 0 && updated.stock > 0) {
        for (const alert of await ctx.store.list(C.stockAlerts)) {
          if (alert.productId === product.id && !alert.notified)
            await ctx.store.put(C.stockAlerts, { ...alert, notified: true });
        }
      }
      return ok(productDto(updated, ctx.now));
    },
  },
  {
    method: 'GET',
    path: '/admin/orders',
    auth: 'admin',
    tag: 'admin',
    summary: 'All orders, newest first',
    async handler(ctx) {
      const orders = (await ctx.store.list(C.orders)).sort(byNewest);
      return ok({ items: orders.map(orderDto) });
    },
  },
  {
    method: 'PATCH',
    path: '/admin/orders/:id/status',
    auth: 'admin',
    tag: 'admin',
    summary: 'Change an order status (state machine enforced)',
    request: 'AdminStatusPatchSchema',
    async handler(ctx, { params, body }) {
      const input = parse(AdminStatusPatchSchema, body);
      const order = await ctx.store.get(C.orders, String(params.id));
      if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
      return ok(orderDto(await changeStatus(ctx, order, input.status)));
    },
  },
  {
    method: 'GET',
    path: '/admin/kpis',
    auth: 'admin',
    tag: 'admin',
    summary: 'Revenue, average basket, cancellation and return rates, top products',
    request: 'KpiQuerySchema',
    response: 'KpisSchema',
    async handler(ctx, { query }) {
      const input = parse(KpiQuerySchema, query);
      if (input.from > input.to)
        throw new ApiError(400, 'INVALID_PERIOD', 'The start date must precede the end date');
      const orders = await ctx.store.list(C.orders);
      return ok(
        computeKpis(
          orders.map((order) => ({
            date: parisDate(new Date(order.date)),
            status: order.status,
            total: order.totals.total,
            totalHt: order.totals.totalHt,
            refunded: order.refunded,
            lines: order.lines,
          })),
          input.from,
          input.to,
        ),
      );
    },
  },
  {
    method: 'GET',
    path: '/admin/inventory/reorder',
    auth: 'admin',
    tag: 'admin',
    summary: 'Products to restock with suggested quantities',
    async handler(ctx) {
      const products = await ctx.store.list(C.products);
      const orders = await ctx.store.list(C.orders);
      const sales = orders.map((order) => ({
        date: parisDate(new Date(order.date)),
        status: order.status,
        lines: order.lines,
      }));
      return ok({ items: reorderSuggestions(products, sales, ctx.now) });
    },
  },
  {
    method: 'POST',
    path: '/admin/privacy/purge',
    auth: 'admin',
    tag: 'privacy',
    summary: 'Apply the retention plan now (anonymize or delete due records)',
    handler: async (ctx) => ok(await purge(ctx)),
  },
];
