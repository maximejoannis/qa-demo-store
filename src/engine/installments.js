import { EngineError } from './errors.js';
import { assertCents } from './money.js';
import { DEFAULT_RULES } from './rules.js';
import { addMonthsClamped, assertIsoDate } from './time.js';

export function installmentsEligible(total, rules = DEFAULT_RULES) {
  return total >= rules.installments.min && total <= rules.installments.max;
}

/**
 * ENG-INST-01: 3 or 4 interest-free payments for totals between 100 and 2000 EUR.
 * ENG-INST-02: equal floor amounts, the remainder is added to the first payment.
 * ENG-INST-03: monthly due dates on the same day, clamped to the end of shorter months.
 * @param {number} total Cents.
 * @param {number} count 3 or 4.
 * @param {string} firstDate IsoDate.
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {{ count: number, total: number, fees: number, installments: { index: number, dueDate: string, amount: number }[] }}
 */
export function simulateInstallments(total, count, firstDate, rules = DEFAULT_RULES) {
  assertCents(total, 'total');
  assertIsoDate(firstDate);
  if (!rules.installments.counts.includes(count)) {
    throw new EngineError('INSTALLMENTS_INVALID_COUNT', 'Installments must be 3 or 4', {
      allowed: rules.installments.counts,
    });
  }
  if (!installmentsEligible(total, rules)) {
    throw new EngineError('INSTALLMENTS_AMOUNT_OUT_OF_RANGE', 'Amount out of range', {
      min: rules.installments.min,
      max: rules.installments.max,
    });
  }
  const base = Math.floor(total / count);
  const first = total - base * (count - 1);
  return {
    count,
    total,
    fees: 0,
    installments: Array.from({ length: count }, (_, index) => ({
      index: index + 1,
      dueDate: addMonthsClamped(firstDate, index),
      amount: index === 0 ? first : base,
    })),
  };
}
