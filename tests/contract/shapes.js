import { expect } from 'vitest';

/** Minimal response contracts: required top-level fields of each API answer. */
const shape = (keys) => ({
  parse(body) {
    expect(body).toBeTypeOf('object');
    for (const key of keys) expect(body, `missing "${key}"`).toHaveProperty(key);
    return body;
  },
});

export const ProblemSchema = shape(['type', 'title', 'status', 'code']);
export const MetaSchema = shape([
  'demoMode',
  'faultsEnabled',
  'engineVersion',
  'rulesVersion',
  'now',
  'clockFrozen',
  'scenario',
  'deterministicIds',
]);
export const MeResponseSchema = shape(['user']);
export const ProductPageSchema = shape(['items', 'page', 'totalPages', 'total', 'categories']);
export const QuoteResponseSchema = shape([
  'quoteId',
  'expiresAt',
  'engineVersion',
  'rulesVersion',
  'lines',
  'merchandise',
  'coupon',
  'merchandiseNet',
  'shipping',
  'vat',
  'totalHt',
  'totalVat',
  'total',
  'loyaltyPointsEarned',
  'delivery',
]);
export const OrderSchema = shape([
  'id',
  'date',
  'status',
  'invoiceNumber',
  'lines',
  'totals',
  'shippingAddress',
  'delivery',
  'payment',
]);
export const OrderListSchema = shape(['items']);
export const ReturnQuoteSchema = shape([
  'eligible',
  'reason',
  'deadline',
  'lines',
  'total',
  'pointsToRevoke',
]);
export const KpisSchema = shape([
  'from',
  'to',
  'orders',
  'revenueTtc',
  'revenueHt',
  'averageBasket',
  'cancellationRateBp',
  'returnRateBp',
  'topProducts',
  'revenueByCategory',
]);
