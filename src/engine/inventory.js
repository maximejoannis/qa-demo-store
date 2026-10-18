import { DEFAULT_RULES } from './rules.js';
import { daysBetween, parisDate } from './time.js';

/**
 * ENG-INV-01: reorder point = ceil(average daily sales x (lead time + safety days)).
 * ENG-INV-02: suggested quantity covers lead time + safety + 30 days; minimum order when out of stock.
 * Average daily sales use the last 30 days, cancelled orders excluded.
 * @param {{ id: number, name: string, stock: number, active: boolean }[]} products
 * @param {{ date: string, status: string, lines: { productId: number, qty: number }[] }[]} orders
 * @param {Date} now
 * @param {typeof DEFAULT_RULES} [rules]
 */
export function reorderSuggestions(products, orders, now, rules = DEFAULT_RULES) {
  const today = parisDate(now);
  const { windowDays, leadTimeDays, safetyDays, coverDays, minimumOrder } = rules.inventory;
  const sold = new Map();
  for (const order of orders) {
    const age = daysBetween(order.date, today);
    if (order.status === 'Cancelled' || age < 0 || age >= windowDays) continue;
    for (const line of order.lines)
      sold.set(line.productId, (sold.get(line.productId) ?? 0) + line.qty);
  }
  return products
    .filter((product) => product.active)
    .map((product) => {
      const averageDailySales = (sold.get(product.id) ?? 0) / windowDays;
      const reorderPoint = Math.ceil(averageDailySales * (leadTimeDays + safetyDays));
      const target = Math.ceil(averageDailySales * (leadTimeDays + safetyDays + coverDays));
      const suggestedQty =
        product.stock <= 0 && target === 0 ? minimumOrder : Math.max(0, target - product.stock);
      return {
        productId: product.id,
        name: product.name,
        stock: product.stock,
        averageDailySales: Math.round(averageDailySales * 100) / 100,
        reorderPoint,
        suggestedQty,
      };
    })
    .filter((item) => item.stock <= 0 || item.stock <= item.reorderPoint)
    .sort((a, b) => a.stock - b.stock || a.productId - b.productId);
}
