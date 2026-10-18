import { EngineError } from './errors.js';
import { divideHalfUp, sumCents } from './money.js';
import { DEFAULT_RULES } from './rules.js';
import { addDays, daysBetween, parisDate } from './time.js';

/**
 * ENG-RET-01: 14-day withdrawal period from delivery (Code de la consommation, L221-18).
 * ENG-RET-02: refund of the amount actually paid per line, net of the allocated discount.
 * ENG-RET-03: for a full return, initial shipping is refunded up to the standard rate (L221-24).
 * ENG-RET-04: loyalty points earned on returned items are revoked pro rata.
 * @param {{ status: string, deliveredAt: string | null, lines: { productId: number, qty: number, net: number }[], merchandiseNet: number, shippingPaid: number, standardShippingCost: number, loyaltyPointsEarned: number }} order
 * @param {{ productId: number, qty: number }[]} selection
 * @param {Date} now
 * @param {typeof DEFAULT_RULES} [rules]
 */
export function quoteReturn(order, selection, now, rules = DEFAULT_RULES) {
  const empty = {
    lines: [],
    merchandiseRefund: 0,
    shippingRefund: 0,
    total: 0,
    pointsToRevoke: 0,
    fullReturn: false,
  };
  if (order.status !== 'Delivered' || !order.deliveredAt) {
    return { eligible: false, reason: 'NOT_DELIVERED', deadline: null, ...empty };
  }
  const deadline = addDays(order.deliveredAt, rules.returns.withdrawalDays);
  if (daysBetween(order.deliveredAt, parisDate(now)) > rules.returns.withdrawalDays) {
    return { eligible: false, reason: 'DEADLINE_PASSED', deadline, ...empty };
  }
  const seen = new Set();
  const selected = selection.filter((item) => item.qty > 0);
  if (!selected.length) {
    throw new EngineError('RETURN_INVALID_LINES', 'Select at least one item to return');
  }
  const lines = selected.map((item) => {
    const line = order.lines.find((candidate) => candidate.productId === item.productId);
    if (!line || seen.has(item.productId) || !Number.isInteger(item.qty) || item.qty > line.qty) {
      throw new EngineError('RETURN_INVALID_LINES', 'Invalid return line', {
        productId: item.productId,
      });
    }
    seen.add(item.productId);
    const refund = item.qty === line.qty ? line.net : divideHalfUp(line.net * item.qty, line.qty);
    return { productId: item.productId, qty: item.qty, refund };
  });
  const merchandiseRefund = sumCents(lines.map((line) => line.refund));
  const fullReturn = order.lines.every(
    (line) => lines.find((item) => item.productId === line.productId)?.qty === line.qty,
  );
  const shippingRefund = fullReturn ? Math.min(order.shippingPaid, order.standardShippingCost) : 0;
  const pointsToRevoke =
    order.merchandiseNet > 0
      ? Math.min(
          order.loyaltyPointsEarned,
          Math.ceil((order.loyaltyPointsEarned * merchandiseRefund) / order.merchandiseNet),
        )
      : 0;
  return {
    eligible: true,
    reason: null,
    deadline,
    lines,
    merchandiseRefund,
    shippingRefund,
    total: merchandiseRefund + shippingRefund,
    pointsToRevoke,
    fullReturn,
  };
}
