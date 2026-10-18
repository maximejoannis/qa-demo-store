import { InstallmentsRequestSchema, OrderRequestSchema, QuoteRequestSchema } from '../schemas.js';
import { DEFAULT_RULES, installmentsEligible, simulateInstallments } from '../../engine/index.js';
import { orderDto } from '../dto.js';
import { ApiError } from '../errors.js';
import { faultActive, GLITCH_DELAY_MS } from '../faults.js';
import { pay } from '../payment.js';
import { ok, parse } from '../router.js';
import { createOrder, quoteFor } from '../services.js';
import { C } from '../types.js';

/**
 * Deliberate rounding defects for rounding_user (the engine stays correct):
 * FAULT-RND-01 percent coupon rounded down; FAULT-RND-02 VAT computed once on the total at 20 %.
 */
export function applyRoundingFaults(ctx, quote) {
  let result = quote;
  if (faultActive('FAULT-RND-01', ctx.user, ctx.deps.config) && quote.coupon?.type === 'percent') {
    const percent = DEFAULT_RULES.coupons[quote.coupon.code]?.value ?? 0;
    const floor = Math.floor((quote.merchandise * percent) / 100);
    const delta = quote.coupon.discount - floor;
    result = {
      ...result,
      coupon: { ...quote.coupon, discount: floor },
      total: quote.total + delta,
    };
  }
  if (faultActive('FAULT-RND-02', ctx.user, ctx.deps.config) && result.vat.length > 1) {
    const ht = Math.round(result.total / 1.2);
    result = { ...result, totalHt: ht, totalVat: result.total - ht };
  }
  return result;
}

export const checkoutRoutes = [
  {
    method: 'POST',
    path: '/quotes',
    auth: 'public',
    tag: 'checkout',
    summary: 'Authoritative quote computed by the engine (valid 15 minutes)',
    request: 'QuoteRequestSchema',
    response: 'QuoteResponseSchema',
    async handler(ctx, { body }) {
      const input = parse(QuoteRequestSchema, body);
      if (faultActive('FAULT-GLT-01', ctx.user, ctx.deps.config)) await ctx.sleep(GLITCH_DELAY_MS);
      const request = {
        lines: input.lines,
        couponCode: input.couponCode ?? null,
        shippingMethod: input.shippingMethod,
        country: input.destination.country,
        loyaltyPointsToRedeem: input.loyaltyPointsToRedeem,
      };
      const quote = applyRoundingFaults(ctx, await quoteFor(ctx, request, ctx.user));
      const record = {
        id: await ctx.newId('Q-', 16),
        userId: ctx.user?.id ?? null,
        request,
        quote,
        createdAt: ctx.now.toISOString(),
        expiresAt: new Date(ctx.now.getTime() + 15 * 60_000).toISOString(),
        used: false,
      };
      await ctx.store.put(C.quotes, record);
      return ok({ quoteId: record.id, expiresAt: record.expiresAt, ...quote });
    },
  },
  {
    method: 'POST',
    path: '/orders',
    auth: 'user',
    tag: 'checkout',
    summary: 'Place an order from a quote (Idempotency-Key header required)',
    request: 'OrderRequestSchema',
    response: 'OrderSchema',
    status: 201,
    async handler(ctx, { body, headers }) {
      const user = ctx.requireUser();
      const key = headers['idempotency-key'] ?? '';
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) {
        throw new ApiError(
          400,
          'IDEMPOTENCY_KEY_REQUIRED',
          'A valid Idempotency-Key header is required',
        );
      }
      const input = parse(OrderRequestSchema, body);
      const idempotencyId = `${user.id}:${key}`;
      if (!faultActive('FAULT-GLT-02', user, ctx.deps.config)) {
        const previous = await ctx.store.get(C.idempotency, idempotencyId);
        const existing = previous ? await ctx.store.get(C.orders, previous.orderId) : null;
        if (existing) return ok(orderDto(existing), 200);
      }
      if (faultActive('FAULT-ERR-01', user, ctx.deps.config)) {
        throw new ApiError(500, 'ERROR', 'Error');
      }
      const record = await ctx.store.get(C.quotes, input.quoteId);
      if (!record || (record.userId !== null && record.userId !== user.id)) {
        throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Quote not found');
      }
      if (record.used) throw new ApiError(409, 'QUOTE_ALREADY_USED', 'This quote was already used');
      if (record.expiresAt <= ctx.now.toISOString()) {
        throw new ApiError(409, 'QUOTE_EXPIRED', 'The quote expired, please review your cart');
      }
      // Recompute with current data: prices, promotions, stock and loyalty balance may have changed.
      const fresh = applyRoundingFaults(ctx, await quoteFor(ctx, record.request, user));
      if (fresh.total !== record.quote.total) {
        throw new ApiError(409, 'PRICE_CHANGED', 'Prices changed, please review your cart', {
          details: { previousTotal: record.quote.total, total: fresh.total },
        });
      }
      if (input.installments > 1) {
        if (input.payment.method !== 'card' || !installmentsEligible(fresh.total)) {
          throw new ApiError(
            422,
            'INSTALLMENTS_NOT_AVAILABLE',
            'Installments are not available for this order',
          );
        }
      }
      const payment = pay(input.payment.method, input.payment.card);
      const plan =
        input.installments > 1
          ? simulateInstallments(fresh.total, input.installments, ctx.today)
          : null;
      const order = await createOrder(ctx, {
        user,
        quote: fresh,
        shippingAddress: input.shippingAddress,
        payment: {
          method: input.payment.method,
          last4: payment.last4,
          installments: input.installments,
        },
        installmentPlan: plan?.installments ?? null,
      });
      await ctx.store.put(C.quotes, { ...record, used: true });
      await ctx.store.put(C.idempotency, { id: idempotencyId, orderId: order.id });
      await ctx.store.put(C.users, { ...user, lastActivityAt: ctx.today });
      await ctx.log('order_created', user.id);
      return ok(orderDto(order), 201);
    },
  },
  {
    method: 'POST',
    path: '/installments/simulate',
    auth: 'public',
    tag: 'checkout',
    summary: 'Simulate a 3 or 4 installment plan',
    request: 'InstallmentsRequestSchema',
    response: 'InstallmentPlanSchema',
    handler(ctx, { body }) {
      const input = parse(InstallmentsRequestSchema, body);
      return Promise.resolve(ok(simulateInstallments(input.total, input.count, ctx.today)));
    },
  },
];
