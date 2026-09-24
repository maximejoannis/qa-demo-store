import { describe, it, expect } from 'vitest';
import { computeTotals, money } from '../src/pricing/pricing.js';
import { validateCoupon, COUPONS } from '../src/coupons/coupons.js';
import { shippingCost, FREE_THRESHOLD } from '../src/shipping/shipping.js';
import { pay } from '../src/payment/payment.js';

const lines = [
  { unitPrice: 1000, qty: 2 },
  { unitPrice: 550, qty: 1 },
];
describe('pricing', () => {
  it('empty cart is all zero even with shipping', () =>
    expect(computeTotals({ lines: [], shippingCost: 490 })).toEqual({
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
    }));
  it('sums lines with shipping and 20% tax', () =>
    expect(computeTotals({ lines, shippingCost: 490 })).toEqual({
      subtotal: 2550,
      discount: 0,
      shipping: 490,
      tax: 510,
      total: 3550,
    }));
  it('percent coupon', () =>
    expect(computeTotals({ lines, coupon: COUPONS.WELCOME10 })).toEqual({
      subtotal: 2550,
      discount: 255,
      shipping: 0,
      tax: 459,
      total: 2754,
    }));
  it('fixed coupon is capped at subtotal', () =>
    expect(computeTotals({ lines, coupon: COUPONS.SAVE20 }).discount).toBe(2000));
  it('fixed coupon never goes below zero', () =>
    expect(computeTotals({ lines, coupon: { type: 'fixed', value: 9999 } }).total).toBe(0));
  it('free shipping coupon', () =>
    expect(computeTotals({ lines, coupon: COUPONS.FREESHIP, shippingCost: 490 }).shipping).toBe(0));
  it('rounds tax to whole cents', () =>
    expect(computeTotals({ lines: [{ unitPrice: 333, qty: 1 }] })).toMatchObject({
      tax: 67,
      total: 400,
    }));
  it('formats money', () => expect(money(1234)).toBe('€12.34'));
});
describe('coupons', () => {
  const now = new Date('2026-01-01');
  it('accepts valid coupon, trimmed and case-insensitive', () =>
    expect(validateCoupon(' welcome10 ', 100, now).ok).toBe(true));
  it('rejects unknown and empty codes', () => {
    expect(validateCoupon('NOPE', 100, now).error).toBe('Unknown coupon');
    expect(validateCoupon(null, 100, now).ok).toBe(false);
  });
  it('rejects expired coupon', () =>
    expect(validateCoupon('OLD5', 100, now).error).toBe('Coupon expired'));
  it('enforces minimum purchase at the boundary', () => {
    expect(validateCoupon('SAVE20', 9999, now).ok).toBe(false);
    expect(validateCoupon('SAVE20', 10000, now).ok).toBe(true);
  });
  it('uses the current date by default', () => expect(validateCoupon('OLD5', 100).ok).toBe(false));
});
describe('shipping', () => {
  it('standard has free threshold', () => {
    expect(shippingCost('standard', FREE_THRESHOLD - 1)).toBe(490);
    expect(shippingCost('standard', FREE_THRESHOLD)).toBe(0);
  });
  it('express and pickup', () => {
    expect(shippingCost('express', 99999)).toBe(1290);
    expect(shippingCost('pickup', 0)).toBe(0);
  });
  it('unknown method throws', () =>
    expect(() => shippingCost('drone', 0)).toThrow('Unknown shipping method'));
});
describe('payment (deterministic)', () => {
  it('accepts pay on delivery and the demo card, ignoring spaces', () => {
    expect(pay('pod').ok).toBe(true);
    expect(pay('card', '4242 4242 4242 4242').ok).toBe(true);
  });
  it.each([
    ['4000000000000002', 'declined'],
    ['4000000000000069', 'expired'],
    ['4000000000000119', 'error'],
    ['1234', 'invalid'],
  ])('card %s -> %s', (n, code) => expect(pay('card', n).code).toBe(code));
  it('rejects unknown method and missing card', () => {
    expect(pay('crypto').code).toBe('method');
    expect(pay('card').code).toBe('invalid');
  });
});
