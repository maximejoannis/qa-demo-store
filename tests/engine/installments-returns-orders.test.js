import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  installmentsEligible,
  nextInvoiceNumber,
  quoteReturn,
  simulateInstallments,
  TRANSITIONS,
} from '../../src/engine/index.js';
import { paris } from './fixtures.js';

const errorCode = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return null;
};

describe('ENG-INST installments', () => {
  it('ENG-INST-02 ENG-INST-03 3 x 100.01 EUR puts the remainder on the first payment (example EX-05)', () => {
    const plan = simulateInstallments(10001, 3, '2026-01-31');
    expect(plan.installments).toEqual([
      { index: 1, dueDate: '2026-01-31', amount: 3335 },
      { index: 2, dueDate: '2026-02-28', amount: 3333 },
      { index: 3, dueDate: '2026-03-31', amount: 3333 },
    ]);
    expect(plan).toMatchObject({ count: 3, total: 10001, fees: 0 });
  });
  it('ENG-INST-01 accepts 3 or 4 payments between 100 and 2000 EUR', () => {
    expect(simulateInstallments(200000, 4, '2026-10-11').installments.map((i) => i.amount)).toEqual(
      [50000, 50000, 50000, 50000],
    );
    expect(installmentsEligible(9999)).toBe(false);
    expect(installmentsEligible(10000)).toBe(true);
    expect(errorCode(() => simulateInstallments(9999, 3, '2026-10-11'))).toBe(
      'INSTALLMENTS_AMOUNT_OUT_OF_RANGE',
    );
    expect(errorCode(() => simulateInstallments(200001, 3, '2026-10-11'))).toBe(
      'INSTALLMENTS_AMOUNT_OUT_OF_RANGE',
    );
    expect(errorCode(() => simulateInstallments(20000, 2, '2026-10-11'))).toBe(
      'INSTALLMENTS_INVALID_COUNT',
    );
    expect(errorCode(() => simulateInstallments(20000, 3, 'bad'))).toBe('INVALID_DATE');
  });
});

const order = {
  status: 'Delivered',
  deliveredAt: '2026-10-01',
  lines: [
    { productId: 20, qty: 2, net: 4482 },
    { productId: 1, qty: 1, net: 7199 },
  ],
  merchandiseNet: 11681,
  shippingPaid: 0,
  standardShippingCost: 590,
  loyaltyPointsEarned: 116,
};

describe('ENG-RET withdrawal and refunds', () => {
  it('ENG-RET-01 accepts a return on day 14 and refuses it on day 15 (example EX-06)', () => {
    const day14 = quoteReturn(order, [{ productId: 1, qty: 1 }], paris('2026-10-15T23:00:00'));
    expect(day14).toMatchObject({ eligible: true, deadline: '2026-10-15', reason: null });
    const day15 = quoteReturn(order, [{ productId: 1, qty: 1 }], paris('2026-10-16T08:00:00'));
    expect(day15).toMatchObject({ eligible: false, reason: 'DEADLINE_PASSED', total: 0 });
  });
  it('ENG-RET-01 requires a delivered order', () => {
    expect(
      quoteReturn({ ...order, status: 'Shipped' }, [], paris('2026-10-02T10:00:00')).reason,
    ).toBe('NOT_DELIVERED');
    expect(
      quoteReturn({ ...order, deliveredAt: null }, [], paris('2026-10-02T10:00:00')).reason,
    ).toBe('NOT_DELIVERED');
  });
  it('ENG-RET-02 ENG-RET-04 refunds the net paid amount pro rata and revokes points', () => {
    const q = quoteReturn(
      order,
      [
        { productId: 20, qty: 1 },
        { productId: 1, qty: 0 },
      ],
      paris('2026-10-05T10:00:00'),
    );
    expect(q.lines).toEqual([{ productId: 20, qty: 1, refund: 2241 }]);
    expect(q).toMatchObject({
      merchandiseRefund: 2241,
      shippingRefund: 0,
      total: 2241,
      pointsToRevoke: 23,
      fullReturn: false,
    });
  });
  it('ENG-RET-03 refunds shipping up to the standard rate on a full return', () => {
    const full = [
      { productId: 20, qty: 2 },
      { productId: 1, qty: 1 },
    ];
    const q = quoteReturn({ ...order, shippingPaid: 1290 }, full, paris('2026-10-05T10:00:00'));
    expect(q).toMatchObject({
      merchandiseRefund: 11681,
      shippingRefund: 590,
      total: 12271,
      pointsToRevoke: 116,
      fullReturn: true,
    });
    const cheap = quoteReturn({ ...order, shippingPaid: 0 }, full, paris('2026-10-05T10:00:00'));
    expect(cheap.shippingRefund).toBe(0);
    const zero = quoteReturn({ ...order, merchandiseNet: 0 }, full, paris('2026-10-05T10:00:00'));
    expect(zero.pointsToRevoke).toBe(0);
  });
  it('ENG-RET-02 rejects invalid selections', () => {
    const at = paris('2026-10-05T10:00:00');
    expect(errorCode(() => quoteReturn(order, [], at))).toBe('RETURN_INVALID_LINES');
    expect(errorCode(() => quoteReturn(order, [{ productId: 99, qty: 1 }], at))).toBe(
      'RETURN_INVALID_LINES',
    );
    expect(errorCode(() => quoteReturn(order, [{ productId: 1, qty: 2 }], at))).toBe(
      'RETURN_INVALID_LINES',
    );
    expect(errorCode(() => quoteReturn(order, [{ productId: 20, qty: 1.5 }], at))).toBe(
      'RETURN_INVALID_LINES',
    );
    expect(
      errorCode(() =>
        quoteReturn(
          order,
          [
            { productId: 1, qty: 1 },
            { productId: 1, qty: 1 },
          ],
          at,
        ),
      ),
    ).toBe('RETURN_INVALID_LINES');
  });
});

describe('ENG-ORD order lifecycle', () => {
  it('ENG-ORD-01 allows only the documented transitions', () => {
    expect(canTransition('Processing', 'Shipped')).toBe(true);
    expect(canTransition('Processing', 'Cancelled')).toBe(true);
    expect(canTransition('Shipped', 'Cancelled')).toBe(false);
    expect(canTransition('Delivered', 'ReturnRequested')).toBe(true);
    expect(canTransition('ReturnRequested', 'Refunded')).toBe(true);
    expect(TRANSITIONS.Refunded).toEqual([]);
    expect(() => assertTransition('Shipped', 'Delivered')).not.toThrow();
    expect(errorCode(() => assertTransition('Cancelled', 'Shipped'))).toBe('INVALID_TRANSITION');
  });
  it('ENG-ORD-02 numbers invoices sequentially per year', () => {
    expect(nextInvoiceNumber(null, 2026)).toBe('FA-2026-000001');
    expect(nextInvoiceNumber('FA-2026-000041', 2026)).toBe('FA-2026-000042');
    expect(nextInvoiceNumber('FA-2025-000999', 2026)).toBe('FA-2026-000001');
  });
});
