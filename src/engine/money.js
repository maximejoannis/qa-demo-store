import { EngineError } from './errors.js';

export function assertCents(value, field = 'amount') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new EngineError('INVALID_AMOUNT', `${field} must be a non-negative integer of cents`, {
      field,
      value,
    });
  }
}

/**
 * Commercial rounding (half up) of numerator / denominator for non-negative integers.
 * Pure integer arithmetic: no floating point is involved.
 * @param {number} numerator
 * @param {number} denominator
 * @returns {number}
 */
export function divideHalfUp(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || numerator < 0) {
    throw new EngineError('INVALID_AMOUNT', 'numerator must be a non-negative safe integer', {
      numerator,
    });
  }
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new EngineError('INVALID_AMOUNT', 'denominator must be a positive safe integer', {
      denominator,
    });
  }
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

export const sumCents = (values) => values.reduce((total, value) => total + value, 0);

/**
 * Splits `total` across `weights` proportionally (floor), then assigns the rounding
 * remainder to the index designated by `remainderIndex` (largest weight by default).
 * Guarantees: result sums exactly to `total`, every share is >= 0.
 * @param {number} total Cents.
 * @param {readonly number[]} weights
 * @returns {number[]}
 */
export function allocateProRata(total, weights) {
  assertCents(total, 'total');
  const weightSum = sumCents(weights);
  if (weights.length === 0 || weightSum === 0) return weights.map(() => 0);
  const shares = weights.map((weight) => Math.floor((total * weight) / weightSum));
  const remainder = total - sumCents(shares);
  const target = weights.reduce(
    (best, weight, index, all) => (weight > all[best] ? index : best),
    0,
  );
  return shares.map((share, index) => (index === target ? share + remainder : share));
}
