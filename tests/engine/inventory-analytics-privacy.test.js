import { describe, expect, it } from 'vitest';
import {
  computeKpis,
  consentExpired,
  reorderSuggestions,
  retentionDeadline,
  retentionPlan,
} from '../../src/engine/index.js';
import { paris } from './fixtures.js';

const now = paris('2026-10-11T12:00:00');

describe('ENG-INV reorder suggestions', () => {
  it('ENG-INV-01 ENG-INV-02 flags products under the reorder point and suggests quantities', () => {
    const products = [
      { id: 1, name: 'A', stock: 2, active: true },
      { id: 2, name: 'B', stock: 0, active: true },
      { id: 3, name: 'C', stock: 50, active: true },
      { id: 4, name: 'D', stock: 0, active: false },
    ];
    const orders = [
      {
        date: '2026-10-01',
        status: 'Delivered',
        lines: [
          { productId: 1, qty: 20 },
          { productId: 3, qty: 30 },
        ],
      },
      { date: '2026-09-12', status: 'Processing', lines: [{ productId: 1, qty: 10 }] },
      { date: '2026-09-11', status: 'Delivered', lines: [{ productId: 1, qty: 100 }] },
      { date: '2026-10-05', status: 'Cancelled', lines: [{ productId: 1, qty: 100 }] },
      { date: '2026-10-12', status: 'Processing', lines: [{ productId: 1, qty: 100 }] },
    ];
    expect(reorderSuggestions(products, orders, now)).toEqual([
      { productId: 2, name: 'B', stock: 0, averageDailySales: 0, reorderPoint: 0, suggestedQty: 5 },
      {
        productId: 1,
        name: 'A',
        stock: 2,
        averageDailySales: 1,
        reorderPoint: 10,
        suggestedQty: 38,
      },
    ]);
  });
});

const sample = [
  {
    date: '2026-10-01',
    status: 'Delivered',
    total: 12000,
    totalHt: 10000,
    refunded: 0,
    lines: [{ productId: 1, name: 'A', category: 'X', qty: 2, net: 12000 }],
  },
  {
    date: '2026-10-02',
    status: 'Refunded',
    total: 6000,
    totalHt: 5000,
    refunded: 3000,
    lines: [{ productId: 2, name: 'B', category: 'Y', qty: 1, net: 6000 }],
  },
  {
    date: '2026-10-03',
    status: 'Cancelled',
    total: 9999,
    totalHt: 8333,
    refunded: 0,
    lines: [{ productId: 3, name: 'C', category: 'Z', qty: 9, net: 9999 }],
  },
  {
    date: '2026-10-04',
    status: 'Processing',
    total: 0,
    totalHt: 0,
    refunded: 0,
    lines: [{ productId: 1, name: 'A', category: 'X', qty: 1, net: 0 }],
  },
  { date: '2026-09-01', status: 'Delivered', total: 50000, totalHt: 41667, refunded: 0, lines: [] },
];

describe('ENG-KPI admin indicators', () => {
  it('ENG-KPI-01 excludes cancelled orders and subtracts refunds', () => {
    const kpis = computeKpis(sample, '2026-10-01', '2026-10-31');
    expect(kpis).toMatchObject({
      orders: 4,
      revenueTtc: 15000,
      revenueHt: 12500,
      averageBasket: 5000,
      cancellationRateBp: 2500,
      returnRateBp: 5000,
    });
    expect(kpis.topProducts).toEqual([
      { productId: 1, name: 'A', qty: 3, revenue: 12000 },
      { productId: 2, name: 'B', qty: 1, revenue: 6000 },
    ]);
    expect(kpis.revenueByCategory).toEqual([
      { category: 'X', revenue: 12000 },
      { category: 'Y', revenue: 6000 },
    ]);
  });
  it('ENG-KPI-02 returns zeros for an empty period', () => {
    expect(computeKpis(sample, '2030-01-01', '2030-01-31')).toMatchObject({
      orders: 0,
      revenueTtc: 0,
      averageBasket: 0,
      cancellationRateBp: 0,
      returnRateBp: 0,
      topProducts: [],
    });
  });
});

describe('ENG-PRIV retention', () => {
  it('ENG-PRIV-01 computes deadlines per category', () => {
    expect(retentionDeadline('account', '2023-10-11')).toEqual({
      dueDate: '2026-10-10',
      action: 'anonymize',
    });
    expect(retentionDeadline('order', '2016-10-11')).toEqual({
      dueDate: '2026-10-11',
      action: 'delete',
    });
    expect(retentionDeadline('order', '2024-02-29')).toEqual({
      dueDate: '2034-02-28',
      action: 'delete',
    });
    expect(retentionDeadline('consentProof', '2026-01-01')).toEqual({
      dueDate: '2031-07-02',
      action: 'delete',
    });
    expect(retentionDeadline('technicalLog', '2026-01-01').dueDate).toBe('2027-01-01');
    expect(retentionDeadline('guestCart', '2026-10-01').dueDate).toBe('2026-10-31');
    expect(retentionDeadline('stockAlert', '2026-01-01').dueDate).toBe('2027-01-01');
  });
  it('ENG-PRIV-02 marks records due on or after the deadline', () => {
    const plan = retentionPlan(
      [
        { category: 'account', id: 'u1', referenceDate: '2023-10-11' },
        { category: 'account', id: 'u2', referenceDate: '2023-10-13' },
      ],
      now,
    );
    expect(plan.map((d) => [d.id, d.due])).toEqual([
      ['u1', true],
      ['u2', false],
    ]);
  });
  it('ENG-PRIV-03 asks for consent again after 6 months', () => {
    expect(consentExpired('2026-04-12', now)).toBe(true);
    expect(consentExpired('2026-04-13', now)).toBe(false);
  });
});

describe('ENG-KPI-03 deterministic rankings', () => {
  it('ENG-KPI-03 breaks ties by revenue, then product id, then category name', () => {
    const line = (productId, qty, net, category) => ({
      productId,
      name: `P${String(productId)}`,
      category,
      qty,
      net,
    });
    const kpis = computeKpis(
      [
        {
          date: '2026-10-01',
          status: 'Processing',
          total: 400,
          totalHt: 333,
          refunded: 0,
          lines: [line(3, 1, 100, 'B'), line(2, 1, 100, 'A'), line(1, 1, 200, 'C')],
        },
      ],
      '2026-10-01',
      '2026-10-01',
    );
    expect(kpis.topProducts.map((p) => p.productId)).toEqual([1, 2, 3]);
    expect(kpis.revenueByCategory.map((c) => c.category)).toEqual(['C', 'A', 'B']);
  });
});
