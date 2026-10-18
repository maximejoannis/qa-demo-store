import { describe, expect, it } from 'vitest';
import { computeQuote, DEFAULT_RULES } from '../../src/engine/index.js';
import { paris, product } from './fixtures.js';

const now = paris('2026-10-11T12:00:00');

const headphones = product({ id: 1, price: 7999, weightGrams: 300 });

const book = product({
  id: 20,
  name: 'QA Handbook',
  category: 'Books',
  price: 2490,
  weightGrams: 400,
});

const desk = product({ id: 14, name: 'Desk Organizer', category: 'Office', price: 1999 });

const quote = (overrides = {}) =>
  computeQuote({
    lines: [
      { product: book, qty: 2 },
      { product: headphones, qty: 1 },
    ],
    shippingMethod: 'standard',
    country: 'FR',
    now,
    ...overrides,
  });

const errorCode = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return null;
};

describe('ENG-VAT prices TTC with VAT breakdown per rate', () => {
  it('ENG-VAT-01 ENG-VAT-02 mixed basket 20 % + 5.5 % (example EX-01)', () => {
    const q = quote();
    expect(q.merchandise).toBe(12979);
    expect(q.shipping).toMatchObject({ gross: 0, net: 0, zone: 'FR', weightGrams: 1100 });
    expect(q.vat).toEqual([
      { rateBp: 2000, ttc: 7999, ht: 6666, vat: 1333 },
      { rateBp: 550, ttc: 4980, ht: 4720, vat: 260 },
    ]);
    expect(q).toMatchObject({ totalHt: 11386, totalVat: 1593, total: 12979 });
    expect(q.engineVersion).toBe('2.0.0');
    expect(q.rulesVersion).toBe(DEFAULT_RULES.version);
  });
  it('ENG-VAT-03 shipping follows the goods rates pro rata (example EX-02)', () => {
    const q = quote({
      lines: [
        { product: headphones, qty: 1 },
        { product: book, qty: 1 },
      ],
      country: 'DE',
    });
    expect(q.shipping).toMatchObject({ zone: 'EU', gross: 990, net: 990 });
    expect(q.vat).toEqual([
      { rateBp: 2000, ttc: 8754, ht: 7295, vat: 1459 },
      { rateBp: 550, ttc: 2725, ht: 2583, vat: 142 },
    ]);
    expect(q.total).toBe(11479);
    expect(q.totalHt + q.totalVat).toBe(q.total);
  });
});

describe('ENG-DISC order-level discounts', () => {
  it('ENG-DISC-03 ENG-DISC-06 percent coupon on merchandise, allocated pro rata (example EX-03)', () => {
    const q = quote({ couponCode: 'welcome10' });
    expect(q.coupon).toEqual({
      code: 'WELCOME10',
      type: 'percent',
      discount: 1298,
      shippingDiscount: 0,
    });
    expect(q.lines.map((l) => [l.discount, l.net])).toEqual([
      [498, 4482],
      [800, 7199],
    ]);
    expect(q.vat).toEqual([
      { rateBp: 2000, ttc: 7199, ht: 5999, vat: 1200 },
      { rateBp: 550, ttc: 4482, ht: 4248, vat: 234 },
    ]);
    expect(q.total).toBe(11681);
  });
  it('ENG-DISC-02 SAVE20 refused at 99.99 and accepted at 100.00 (example EX-04)', () => {
    const at = (price) => () =>
      computeQuote({
        lines: [{ product: product({ price }), qty: 1 }],
        couponCode: 'SAVE20',
        shippingMethod: 'standard',
        country: 'FR',
        now,
      });
    expect(errorCode(at(9999))).toBe('COUPON_MINIMUM_NOT_MET');
    const q = at(10000)();
    expect(q.coupon?.discount).toBe(2000);
    expect(q.total).toBe(8000);
  });
  it('ENG-DISC-04 fixed discount is capped at merchandise and shipping stays due', () => {
    const rules = {
      ...DEFAULT_RULES,
      coupons: {
        BIG: {
          code: 'BIG',
          type: 'fixed',
          value: 99999,
          minimum: 0,
          expires: '2099-12-31',
        },
      },
    };
    const q = computeQuote(
      {
        lines: [{ product: desk, qty: 1 }],
        couponCode: 'BIG',
        shippingMethod: 'standard',
        country: 'FR',
        now,
      },
      rules,
    );
    expect(q.coupon?.discount).toBe(1999);
    expect(q.merchandiseNet).toBe(0);
    expect(q.shipping.net).toBe(490);
    expect(q.vat).toEqual([{ rateBp: 2000, ttc: 490, ht: 408, vat: 82 }]);
    expect(q.total).toBe(490);
  });
  it('ENG-DISC-05 FREESHIP removes shipping up to the standard rate', () => {
    const standard = computeQuote({
      lines: [{ product: desk, qty: 1 }],
      couponCode: 'FREESHIP',
      shippingMethod: 'standard',
      country: 'FR',
      now,
    });
    expect(standard.shipping).toMatchObject({ gross: 490, discount: 490, net: 0 });
    expect(standard.total).toBe(1999);
    const express = computeQuote({
      lines: [{ product: headphones, qty: 1 }],
      couponCode: 'FREESHIP',
      shippingMethod: 'express',
      country: 'FR',
      now,
    });
    expect(express.shipping).toMatchObject({ gross: 1290, discount: 490, net: 800 });
    expect(express.coupon).toMatchObject({ type: 'shipping', discount: 0, shippingDiscount: 490 });
  });
  it('ENG-SHIP-02 standard shipping is free in France from 50 EUR after discounts', () => {
    const below = computeQuote({
      lines: [{ product: product({ price: 4999 }), qty: 1 }],
      shippingMethod: 'standard',
      country: 'FR',
      now,
    });
    expect(below.shipping.net).toBe(490);
    const at = computeQuote({
      lines: [{ product: product({ price: 5000 }), qty: 1 }],
      shippingMethod: 'standard',
      country: 'FR',
      now,
    });
    expect(at.shipping.net).toBe(0);
    const afterCoupon = computeQuote({
      lines: [{ product: product({ price: 5500 }), qty: 1 }],
      couponCode: 'WELCOME10',
      shippingMethod: 'standard',
      country: 'FR',
      now,
    });
    expect(afterCoupon.merchandiseNet).toBe(4950);
    expect(afterCoupon.shipping.net).toBe(490);
    const express = computeQuote({
      lines: [{ product: headphones, qty: 1 }],
      shippingMethod: 'express',
      country: 'FR',
      now,
    });
    expect(express.shipping.net).toBe(1290);
    expect(express.vat).toEqual([{ rateBp: 2000, ttc: 9289, ht: 7741, vat: 1548 }]);
    const world = computeQuote({
      lines: [{ product: headphones, qty: 1 }],
      shippingMethod: 'standard',
      country: 'US',
      now,
    });
    expect(world.standardShippingCost).toBe(1990);
    expect(world.delivery).toEqual({ from: '2026-10-21', to: '2026-10-30' });
  });
});

describe('ENG-LOY loyalty inside the quote', () => {
  it('ENG-LOY-03 redeems points after the coupon and earns on the net amount', () => {
    const q = computeQuote({
      lines: [{ product: headphones, qty: 1 }],
      shippingMethod: 'pickup',
      country: 'FR',
      loyalty: { balance: 500, tier: 'gold', redeem: 200 },
      now,
    });
    expect(q.loyaltyDiscount).toBe(1000);
    expect(q.loyaltyPointsRedeemed).toBe(200);
    expect(q.merchandiseNet).toBe(6999);
    expect(q.loyaltyPointsEarned).toBe(103);
    expect(q.delivery).toEqual({ from: '2026-10-12', to: '2026-10-12' });
  });
  it('ENG-LOY-01 earns at bronze rate without loyalty context', () => {
    expect(quote().loyaltyPointsEarned).toBe(129);
    const none = computeQuote({
      lines: [{ product: headphones, qty: 1 }],
      shippingMethod: 'standard',
      country: 'FR',
      loyalty: { balance: 0, tier: 'silver', redeem: 0 },
      now,
    });
    expect(none.loyaltyPointsRedeemed).toBe(0);
    expect(none.loyaltyPointsEarned).toBe(98);
  });
});

describe('ENG-QUOTE-01 input guards', () => {
  it.each([
    ['empty cart', { lines: [] }, 'INVALID_LINES'],
    [
      'too many lines',
      {
        lines: Array.from({ length: 51 }, (_, i) => ({
          product: product({ id: i + 100 }),
          qty: 1,
        })),
      },
      'INVALID_LINES',
    ],
    [
      'duplicate line',
      {
        lines: [
          { product: desk, qty: 1 },
          { product: desk, qty: 1 },
        ],
      },
      'INVALID_LINES',
    ],
    ['zero quantity', { lines: [{ product: desk, qty: 0 }] }, 'INVALID_QUANTITY'],
    ['decimal quantity', { lines: [{ product: desk, qty: 1.5 }] }, 'INVALID_QUANTITY'],
    [
      'quantity above 20',
      { lines: [{ product: product({ stock: 100 }), qty: 21 }] },
      'INVALID_QUANTITY',
    ],
    [
      'inactive product',
      { lines: [{ product: product({ active: false }), qty: 1 }] },
      'PRODUCT_UNAVAILABLE',
    ],
    ['stock exceeded', { lines: [{ product: product({ stock: 2 }), qty: 3 }] }, 'OUT_OF_STOCK'],
    ['negative price', { lines: [{ product: product({ price: -5 }), qty: 1 }] }, 'INVALID_AMOUNT'],
    ['pickup abroad', { country: 'DE', shippingMethod: 'pickup' }, 'SHIPPING_NOT_AVAILABLE'],
    ['invalid clock', { now: new Date(Number.NaN) }, 'INVALID_DATE'],
  ])('ENG-QUOTE-01 rejects %s', (_, overrides, code) => {
    expect(errorCode(() => quote(overrides))).toBe(code);
  });
  it('ENG-QUOTE-01 reports the available stock', () => {
    try {
      quote({ lines: [{ product: product({ stock: -1 }), qty: 1 }] });
    } catch (error) {
      expect(error.details).toEqual({ productId: 1, available: 0 });
    }
  });
});
