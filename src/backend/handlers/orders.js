import { ReturnQuoteRequestSchema, ReturnRequestSchema } from '../schemas.js';
import { quoteReturn } from '../../engine/index.js';
import { SELLER } from '../catalog-data.js';
import { orderDto } from '../dto.js';
import { ApiError } from '../errors.js';
import { ok, parse } from '../router.js';
import { changeStatus } from '../services.js';
import { C } from '../types.js';

/** Ownership check: another customer's order is reported as missing (no enumeration). */
export async function ownedOrder(ctx, id) {
  const user = ctx.requireUser();
  const order = await ctx.store.get(C.orders, id);
  if (!order || (order.userId !== user.id && user.role !== 'admin')) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }
  return order;
}

/** Newest first, identifier as tie-breaker (orders created in the same millisecond). */
export const byNewest = (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

const returnable = (order) => ({
  status: order.status,
  deliveredAt: order.deliveredAt,
  lines: order.lines,
  merchandiseNet: order.merchandiseNet,
  shippingPaid: order.totals.shipping,
  standardShippingCost: order.standardShippingCost,
  loyaltyPointsEarned: order.loyaltyPointsEarned,
});

export const orderRoutes = [
  {
    method: 'GET',
    path: '/orders',
    auth: 'user',
    tag: 'orders',
    summary: 'My orders, newest first',
    response: 'OrderListSchema',
    async handler(ctx) {
      const user = ctx.requireUser();
      const orders = (await ctx.store.list(C.orders))
        .filter((order) => order.userId === user.id)
        .sort(byNewest);
      return ok({ items: orders.map(orderDto) });
    },
  },
  {
    method: 'GET',
    path: '/orders/:id',
    auth: 'user',
    tag: 'orders',
    summary: 'Order detail (owner or admin only)',
    response: 'OrderSchema',
    handler: async (ctx, { params }) => ok(orderDto(await ownedOrder(ctx, String(params.id)))),
  },
  {
    method: 'POST',
    path: '/orders/:id/cancel',
    auth: 'user',
    tag: 'orders',
    summary: 'Cancel an order that has not shipped yet',
    response: 'OrderSchema',
    async handler(ctx, { params }) {
      const order = await ownedOrder(ctx, String(params.id));
      return ok(orderDto(await changeStatus(ctx, order, 'Cancelled')));
    },
  },
  {
    method: 'GET',
    path: '/orders/:id/invoice',
    auth: 'user',
    tag: 'orders',
    summary: 'Invoice data (sequential number, VAT breakdown, legal mentions)',
    async handler(ctx, { params }) {
      const order = await ownedOrder(ctx, String(params.id));
      return ok({ seller: SELLER, issuedAt: order.date.slice(0, 10), order: orderDto(order) });
    },
  },
  {
    method: 'POST',
    path: '/returns/quote',
    auth: 'user',
    tag: 'orders',
    summary: 'Withdrawal eligibility and refund amount (14 days)',
    request: 'ReturnQuoteRequestSchema',
    response: 'ReturnQuoteSchema',
    async handler(ctx, { body }) {
      const input = parse(ReturnQuoteRequestSchema, body);
      const order = await ownedOrder(ctx, input.orderId);
      return ok(quoteReturn(returnable(order), input.lines, ctx.now));
    },
  },
  {
    method: 'POST',
    path: '/returns',
    auth: 'user',
    tag: 'orders',
    summary: 'Request a return (order becomes ReturnRequested)',
    request: 'ReturnRequestSchema',
    response: 'OrderSchema',
    status: 201,
    async handler(ctx, { body }) {
      const input = parse(ReturnRequestSchema, body);
      const order = await ownedOrder(ctx, input.orderId);
      const refund = quoteReturn(returnable(order), input.lines, ctx.now);
      if (!refund.eligible) {
        throw new ApiError(422, 'RETURN_NOT_ALLOWED', 'This order can no longer be returned', {
          details: { reason: refund.reason, deadline: refund.deadline },
        });
      }
      const updated = {
        ...order,
        status: 'ReturnRequested',
        return: {
          requestedAt: ctx.now.toISOString(),
          reason: input.reason,
          lines: refund.lines,
          total: refund.total,
          shippingRefund: refund.shippingRefund,
          pointsToRevoke: refund.pointsToRevoke,
        },
      };
      await ctx.store.put(C.orders, updated);
      return ok(orderDto(updated), 201);
    },
  },
];
