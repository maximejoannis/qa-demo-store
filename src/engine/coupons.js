import { EngineError } from './errors.js';
import { DEFAULT_RULES } from './rules.js';
import { parisDate } from './time.js';

/**
 * ENG-DISC-01: a coupon is valid until 23:59:59 Europe/Paris on its expiry day.
 * ENG-DISC-02: the minimum applies to merchandise after promotions.
 * @param {string} code
 * @param {number} merchandise Cents, after promotions.
 * @param {Date} now
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {{ code: string, type: string, value: number, minimum: number, expires: string }}
 */
export function validateCoupon(code, merchandise, now, rules = DEFAULT_RULES) {
  const normalized = code.trim().toUpperCase();
  const coupon = rules.coupons[normalized];
  if (!coupon) throw new EngineError('UNKNOWN_COUPON', 'Unknown coupon', { code: normalized });
  if (parisDate(now) > coupon.expires) {
    throw new EngineError('COUPON_EXPIRED', 'Coupon expired', {
      code: normalized,
      expires: coupon.expires,
    });
  }
  if (merchandise < coupon.minimum) {
    throw new EngineError('COUPON_MINIMUM_NOT_MET', 'Minimum purchase not reached', {
      code: normalized,
      minimum: coupon.minimum,
    });
  }
  return coupon;
}
