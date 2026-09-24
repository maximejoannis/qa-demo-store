import { adjustStock, hasStock } from '../inventory/inventory.js';
export const TRANSITIONS = {
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};
export function placeOrder({
  orders,
  products,
  user,
  lines,
  totals,
  now,
  shippingAddress = null,
  shippingMethod = null,
}) {
  if (!lines.length) return { ok: false, error: 'Cart is empty' };
  if (!hasStock(products, lines)) return { ok: false, error: 'Insufficient stock' };
  const order = {
    id: `ORD-${1001 + orders.length}`,
    date: now.toISOString(),
    user,
    lines,
    totals,
    shippingAddress,
    shippingMethod,
    status: 'Processing',
  };
  return {
    ok: true,
    order,
    orders: [order, ...orders],
    products: adjustStock(products, lines, -1),
  };
}
export function changeStatus(orders, products, id, next) {
  const o = orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: 'Order not found' };
  if (!TRANSITIONS[o.status].includes(next))
    return { ok: false, error: `Cannot change ${o.status} to ${next}` };
  return {
    ok: true,
    orders: orders.map((x) => (x.id === id ? { ...x, status: next } : x)),
    products: next === 'Cancelled' ? adjustStock(products, o.lines, 1) : products,
  };
}
