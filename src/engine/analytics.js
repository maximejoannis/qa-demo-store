import { divideHalfUp, sumCents } from './money.js';

/**
 * ENG-KPI-01: revenue excludes cancelled orders and subtracts refunds (HT pro rata).
 * ENG-KPI-02: rates are expressed in basis points (10000 = 100 %).
 * @param {{ date: string, status: string, total: number, totalHt: number, refunded: number, lines: { productId: number, name: string, category: string, qty: number, net: number }[] }[]} orders
 * @param {string} from IsoDate.
 * @param {string} to IsoDate.
 */
export function computeKpis(orders, from, to) {
  const inPeriod = orders.filter((order) => order.date >= from && order.date <= to);
  const kept = inPeriod.filter((order) => order.status !== 'Cancelled');
  const revenueTtc = sumCents(kept.map((order) => order.total - order.refunded));
  const revenueHt = sumCents(
    kept.map(
      (order) =>
        order.totalHt -
        (order.total > 0 ? divideHalfUp(order.refunded * order.totalHt, order.total) : 0),
    ),
  );
  const cancelled = inPeriod.length - kept.length;
  const returnable = kept.filter((order) =>
    ['Delivered', 'ReturnRequested', 'Refunded'].includes(order.status),
  );
  const returned = returnable.filter((order) => order.status !== 'Delivered').length;
  const products = new Map();
  const categories = new Map();
  for (const order of kept) {
    for (const line of order.lines) {
      const current = products.get(line.productId) ?? {
        productId: line.productId,
        name: line.name,
        qty: 0,
        revenue: 0,
      };
      current.qty += line.qty;
      current.revenue += line.net;
      products.set(line.productId, current);
      categories.set(line.category, (categories.get(line.category) ?? 0) + line.net);
    }
  }
  return {
    from,
    to,
    orders: inPeriod.length,
    revenueTtc,
    revenueHt,
    averageBasket: kept.length ? divideHalfUp(revenueTtc, kept.length) : 0,
    cancellationRateBp: inPeriod.length ? divideHalfUp(cancelled * 10000, inPeriod.length) : 0,
    returnRateBp: returnable.length ? divideHalfUp(returned * 10000, returnable.length) : 0,
    topProducts: [...products.values()]
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue || a.productId - b.productId)
      .slice(0, 5),
    revenueByCategory: [...categories.entries()]
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue || a.category.localeCompare(b.category)),
  };
}
