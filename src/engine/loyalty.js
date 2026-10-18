import { EngineError } from './errors.js';
import { DEFAULT_RULES } from './rules.js';
import { daysBetween, parisDate } from './time.js';

const SIGN = { earn: 1, restore: 1, redeem: -1, revoke: -1 };

/**
 * @param {readonly import("./types.js").LoyaltyEntry[]} entries
 * @returns {number}
 */
export function loyaltyBalance(entries) {
  return Math.max(
    0,
    entries.reduce((sum, entry) => sum + SIGN[entry.type] * entry.points, 0),
  );
}

/** Points earned (net of revocations) over the rolling window, used for the tier. */
export function rollingEarnedPoints(entries, now, rules = DEFAULT_RULES) {
  const today = parisDate(now);
  const total = entries
    .filter((entry) => entry.type === 'earn' || entry.type === 'revoke')
    .filter((entry) => {
      const age = daysBetween(entry.date, today);
      return age >= 0 && age < rules.loyalty.windowDays;
    })
    .reduce((sum, entry) => sum + SIGN[entry.type] * entry.points, 0);
  return Math.max(0, total);
}

/**
 * ENG-LOY-02: Bronze 0-499, Silver 500-1499, Gold >= 1500 points over 365 rolling days.
 * @param {number} rollingPoints
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {import("./types.js").LoyaltyTier}
 */
export function tierFor(rollingPoints, rules = DEFAULT_RULES) {
  let tier = 'bronze';
  for (const step of rules.loyalty.tiers) if (rollingPoints >= step.minPoints) tier = step.tier;
  return tier;
}

export function nextTier(rollingPoints, rules = DEFAULT_RULES) {
  const upcoming = rules.loyalty.tiers.find((step) => step.minPoints > rollingPoints);
  return upcoming
    ? { tier: upcoming.tier, missingPoints: upcoming.minPoints - rollingPoints }
    : null;
}

/**
 * ENG-LOY-01: 1 point per whole euro paid on merchandise, multiplied by the tier factor.
 * @param {number} merchandisePaid Cents.
 * @param {import("./types.js").LoyaltyTier} tier
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {number}
 */
export function pointsEarned(merchandisePaid, tier, rules = DEFAULT_RULES) {
  const base = Math.floor(merchandisePaid / rules.loyalty.centsPerPoint);
  const multiplier = rules.loyalty.tiers.find((step) => step.tier === tier)?.multiplierBp ?? 10000;
  return Math.floor((base * multiplier) / 10000);
}

/**
 * ENG-LOY-03: 100 points = 5 EUR, multiples of 100, capped at 30 % of merchandise.
 * @param {number} points
 * @param {number} balance
 * @param {number} merchandiseAfterCoupon Cents.
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {number} Cents.
 */
export function redemptionValue(points, balance, merchandiseAfterCoupon, rules = DEFAULT_RULES) {
  if (points === 0) return 0;
  const { redeemStep, redeemValuePerStep, maxRedeemShareBp } = rules.loyalty;
  if (!Number.isInteger(points) || points < 0 || points % redeemStep !== 0) {
    throw new EngineError('LOYALTY_INVALID_POINTS', 'Points must be a multiple of the step', {
      step: redeemStep,
    });
  }
  if (points > balance) {
    throw new EngineError('LOYALTY_INSUFFICIENT_BALANCE', 'Not enough points', { balance });
  }
  const value = (points / redeemStep) * redeemValuePerStep;
  const cap = Math.floor((merchandiseAfterCoupon * maxRedeemShareBp) / 10000);
  if (value > cap) {
    throw new EngineError('LOYALTY_REDEEM_TOO_HIGH', 'Redemption exceeds the allowed share', {
      cap,
      maxPoints: Math.floor(cap / redeemValuePerStep) * redeemStep,
    });
  }
  return value;
}
