import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  allocateProRata,
  computeQuote,
  divideHalfUp,
  quoteReturn,
  simulateInstallments,
} from '../../src/engine/index.js';
import { paris, product } from './fixtures.js';

const now = paris('2026-10-11T12:00:00');

const categories = ['Electronics', 'Books', 'Home'];

const basket = fc.uniqueArray(
  fc.record({
    id: fc.integer({ min: 1, max: 500 }),
    price: fc.integer({ min: 1, max: 500_000 }),
    category: fc.constantFrom(...categories),
    weight: fc.integer({ min: 0, max: 5000 }),
    qty: fc.integer({ min: 1, max: 20 }),
  }),
  { minLength: 1, maxLength: 8, selector: (line) => line.id },
);

const quoteArb = fc.record({
  lines: basket,
  coupon: fc.constantFrom(null, 'WELCOME10', 'FREESHIP', 'SAVE20'),
  method: fc.constantFrom('standard', 'express'),
  country: fc.constantFrom('FR', 'DE', 'US'),
});

const run = (input) => {
  const lines = input.lines.map((line) => ({
    product: product({
      id: line.id,
      price: line.price,
      category: line.category,
      weightGrams: line.weight,
      stock: 100,
    }),
    qty: line.qty,
  }));
  const merch = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const coupon = input.coupon === 'SAVE20' && merch < 10000 ? null : input.coupon;
  return computeQuote({
    lines,
    couponCode: coupon,
    shippingMethod: input.method,
    country: input.country,
    now,
  });
};

describe('PROP monetary invariants (fast-check)', () => {
  it('PROP-01 total >= 0, discount <= merchandise, HT + VAT = TTC, VAT lines sum up', () => {
    fc.assert(
      fc.property(quoteArb, (input) => {
        const q = run(input);
        const couponDiscount = q.coupon?.discount ?? 0;
        expect(q.total).toBeGreaterThanOrEqual(0);
        expect(couponDiscount + q.loyaltyDiscount).toBeLessThanOrEqual(q.merchandise);
        expect(q.totalHt + q.totalVat).toBe(q.total);
        expect(q.vat.reduce((sum, line) => sum + line.ttc, 0)).toBe(q.total);
        expect(q.vat.reduce((sum, line) => sum + line.vat, 0)).toBe(q.totalVat);
        expect(q.lines.reduce((sum, line) => sum + line.net, 0)).toBe(q.merchandiseNet);
        expect(q.lines.every((line) => line.net >= 0 && line.discount >= 0)).toBe(true);
        expect(q.total).toBe(q.merchandiseNet + q.shipping.net);
        expect(q.shipping.net).toBeGreaterThanOrEqual(0);
        for (const line of q.vat) expect(line.ht).toBeLessThanOrEqual(line.ttc);
      }),
      { numRuns: 400 },
    );
  });
  it('PROP-02 installments always sum to the total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000, max: 200000 }),
        fc.constantFrom(3, 4),
        (total, count) => {
          const plan = simulateInstallments(total, count, '2026-01-31');
          expect(plan.installments.reduce((sum, i) => sum + i.amount, 0)).toBe(total);
          expect(plan.installments[0]?.amount).toBeGreaterThanOrEqual(
            plan.installments[1]?.amount ?? 0,
          );
        },
      ),
    );
  });
  it('PROP-03 pro rata allocation sums exactly and never goes negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 20 }),
        (total, weights) => {
          const shares = allocateProRata(total, weights);
          const weightSum = weights.reduce((a, b) => a + b, 0);
          expect(shares.reduce((a, b) => a + b, 0)).toBe(weightSum === 0 ? 0 : total);
          expect(shares.every((share) => share >= 0)).toBe(true);
        },
      ),
    );
  });
  it('PROP-04 a refund never exceeds what was paid', () => {
    fc.assert(
      fc.property(quoteArb, fc.integer({ min: 0, max: 20 }), (input, take) => {
        const q = run(input);
        const order = {
          status: 'Delivered',
          deliveredAt: '2026-10-05',
          lines: q.lines.map((line) => ({
            productId: line.productId,
            qty: line.qty,
            net: line.net,
          })),
          merchandiseNet: q.merchandiseNet,
          shippingPaid: q.shipping.net,
          standardShippingCost: q.standardShippingCost,
          loyaltyPointsEarned: q.loyaltyPointsEarned,
        };
        const selection = q.lines.map((line) => ({
          productId: line.productId,
          qty: Math.min(line.qty, take),
        }));
        if (selection.every((item) => item.qty === 0)) return;
        const refund = quoteReturn(order, selection, now);
        expect(refund.total).toBeLessThanOrEqual(q.total);
        expect(refund.pointsToRevoke).toBeLessThanOrEqual(q.loyaltyPointsEarned);
        for (const line of refund.lines) {
          const paid = order.lines.find((l) => l.productId === line.productId)?.net ?? 0;
          expect(line.refund).toBeLessThanOrEqual(paid);
        }
      }),
      { numRuns: 200 },
    );
  });
  it('PROP-05 half-up rounding stays within half a unit', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e9 }), fc.integer({ min: 1, max: 1e6 }), (n, d) => {
        const r = divideHalfUp(n, d);
        expect(Math.abs(r * d - n) * 2).toBeLessThanOrEqual(d);
      }),
    );
  });
});
