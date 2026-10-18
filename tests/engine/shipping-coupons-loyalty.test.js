import { describe, expect, it } from 'vitest';
import {
  availableMethods,
  DEFAULT_RULES,
  deliveryWindow,
  loyaltyBalance,
  nextTier,
  pointsEarned,
  redemptionValue,
  rollingEarnedPoints,
  shippingCost,
  tierFor,
  validateCoupon,
  zoneFor,
} from '../../src/engine/index.js';
import { paris } from './fixtures.js';

const code = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return null;
};

describe('ENG-DISC-01 coupons', () => {
  const now = paris('2026-10-11T12:00:00');
  it('ENG-DISC-01 normalizes and validates the code', () => {
    expect(validateCoupon(' welcome10 ', 0, now).code).toBe('WELCOME10');
    expect(code(() => validateCoupon('NOPE', 0, now))).toBe('UNKNOWN_COUPON');
    expect(code(() => validateCoupon('OLD5', 0, now))).toBe('COUPON_EXPIRED');
  });
  it('ENG-DISC-01 expires at 23:59:59 Paris time on the expiry day', () => {
    const rules = {
      ...DEFAULT_RULES,
      coupons: {
        ...DEFAULT_RULES.coupons,
        LAST: {
          code: 'LAST',
          type: 'percent',
          value: 5,
          minimum: 0,
          expires: '2026-12-31',
        },
      },
    };
    expect(validateCoupon('LAST', 0, paris('2026-12-31T23:59:30'), rules).code).toBe('LAST');
    expect(code(() => validateCoupon('LAST', 0, paris('2027-01-01T00:00:10'), rules))).toBe(
      'COUPON_EXPIRED',
    );
  });
  it('ENG-DISC-02 enforces the minimum on merchandise', () => {
    expect(code(() => validateCoupon('SAVE20', 9999, now))).toBe('COUPON_MINIMUM_NOT_MET');
    expect(validateCoupon('SAVE20', 10000, now).value).toBe(2000);
  });
});

describe('ENG-SHIP-01 shipping costs and zones', () => {
  it('ENG-SHIP-01 maps countries to zones', () => {
    expect(zoneFor('fr')).toBe('FR');
    expect(zoneFor('MC')).toBe('FR');
    expect(zoneFor('DE')).toBe('EU');
    expect(zoneFor('US')).toBe('WORLD');
  });
  it('ENG-SHIP-01 adds a supplement per started kilogram', () => {
    expect(shippingCost('standard', 'FR', 1000)).toBe(490);
    expect(shippingCost('standard', 'FR', 1001)).toBe(590);
    expect(shippingCost('standard', 'FR', 2500)).toBe(690);
    expect(shippingCost('express', 'EU', 0)).toBe(2490);
    expect(shippingCost('express', 'WORLD', 3000)).toBe(5190);
    expect(shippingCost('pickup', 'FR', 9000)).toBe(0);
  });
  it('ENG-SHIP-01 rejects unknown or unavailable methods', () => {
    expect(code(() => shippingCost('drone', 'FR', 0))).toBe('UNKNOWN_SHIPPING_METHOD');
    expect(code(() => shippingCost('pickup', 'EU', 0))).toBe('SHIPPING_NOT_AVAILABLE');
    expect(availableMethods('FR')).toEqual(['standard', 'express', 'pickup']);
    expect(availableMethods('WORLD')).toEqual(['standard', 'express']);
  });
  it('ENG-SHIP-03 estimates delivery in business days', () => {
    // Friday 22 May 2026 before Whit Monday
    expect(deliveryWindow('standard', 'FR', paris('2026-05-22T10:00:00'))).toEqual({
      from: '2026-05-28',
      to: '2026-06-01',
    });
    expect(deliveryWindow('pickup', 'FR', paris('2026-10-10T10:00:00'))).toEqual({
      from: '2026-10-12',
      to: '2026-10-12',
    });
    expect(deliveryWindow('express', 'FR', paris('2026-10-12T10:00:00'))).toEqual({
      from: '2026-10-13',
      to: '2026-10-14',
    });
  });
});

describe('ENG-LOY loyalty programme', () => {
  const now = paris('2026-10-11T12:00:00');
  const entries = [
    { type: 'earn', points: 400, date: '2026-01-10', orderId: 'A' },
    { type: 'earn', points: 300, date: '2025-10-12', orderId: 'B' },
    { type: 'earn', points: 900, date: '2025-10-11', orderId: 'C' },
    { type: 'redeem', points: 200, date: '2026-02-01', orderId: 'D' },
    { type: 'revoke', points: 100, date: '2026-03-01', orderId: 'A' },
    { type: 'restore', points: 50, date: '2026-03-02', orderId: 'D' },
  ];
  it('ENG-LOY-04 computes the balance from the ledger', () => {
    expect(loyaltyBalance(entries)).toBe(1350);
    expect(loyaltyBalance([{ type: 'redeem', points: 10, date: '2026-01-01', orderId: 'X' }])).toBe(
      0,
    );
  });
  it('ENG-LOY-02 uses 365 rolling days for the tier', () => {
    expect(rollingEarnedPoints(entries, now)).toBe(600);
    expect(
      rollingEarnedPoints([{ type: 'earn', points: 10, date: '2027-01-01', orderId: 'F' }], now),
    ).toBe(0);
    expect(
      rollingEarnedPoints([{ type: 'revoke', points: 10, date: '2026-01-01', orderId: 'F' }], now),
    ).toBe(0);
    expect(tierFor(0)).toBe('bronze');
    expect(tierFor(499)).toBe('bronze');
    expect(tierFor(500)).toBe('silver');
    expect(tierFor(1499)).toBe('silver');
    expect(tierFor(1500)).toBe('gold');
    expect(nextTier(450)).toEqual({ tier: 'silver', missingPoints: 50 });
    expect(nextTier(1600)).toBeNull();
  });
  it('ENG-LOY-01 earns 1 point per whole euro times the tier multiplier', () => {
    expect(pointsEarned(9999, 'bronze')).toBe(99);
    expect(pointsEarned(10000, 'silver')).toBe(125);
    expect(pointsEarned(10000, 'gold')).toBe(150);
    expect(pointsEarned(99, 'gold')).toBe(0);
    const rules = { ...DEFAULT_RULES, loyalty: { ...DEFAULT_RULES.loyalty, tiers: [] } };
    expect(pointsEarned(1000, 'gold', rules)).toBe(10);
  });
  it('ENG-LOY-03 redeems by steps of 100 points up to 30 % of merchandise', () => {
    expect(redemptionValue(0, 0, 0)).toBe(0);
    expect(redemptionValue(200, 500, 10000)).toBe(1000);
    expect(redemptionValue(600, 600, 10000)).toBe(3000);
    expect(code(() => redemptionValue(150, 500, 10000))).toBe('LOYALTY_INVALID_POINTS');
    expect(code(() => redemptionValue(-100, 500, 10000))).toBe('LOYALTY_INVALID_POINTS');
    expect(code(() => redemptionValue(600, 500, 10000))).toBe('LOYALTY_INSUFFICIENT_BALANCE');
    expect(code(() => redemptionValue(700, 900, 10000))).toBe('LOYALTY_REDEEM_TOO_HIGH');
  });
});
