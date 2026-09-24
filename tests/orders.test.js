import { describe, it, expect } from 'vitest';
import { placeOrder, changeStatus } from '../src/orders/orders.js';
import { login, can } from '../src/auth/auth.js';

const now = new Date('2026-01-01T00:00:00Z');
const products = [{ id: 1, stock: 5 }];
const lines = [{ id: 1, qty: 2 }];
const place = () =>
  placeOrder({ orders: [], products, user: 'u', lines, totals: { total: 1 }, now });
describe('orders', () => {
  it('places an order and decrements stock', () => {
    const r = place();
    expect(r.order).toMatchObject({ id: 'ORD-1001', status: 'Processing', user: 'u' });
    expect(r.products[0].stock).toBe(3);
  });
  it('rejects empty cart and insufficient stock', () => {
    expect(placeOrder({ orders: [], products, user: 'u', lines: [], totals: {}, now }).error).toBe(
      'Cart is empty',
    );
    expect(
      placeOrder({ orders: [], products, user: 'u', lines: [{ id: 1, qty: 9 }], totals: {}, now })
        .error,
    ).toBe('Insufficient stock');
  });
  it('rejects unavailable products and malformed quantities before stock mutation', () => {
    expect(
      placeOrder({
        orders: [],
        products: [{ id: 1, stock: 5, active: false }],
        user: 'u',
        lines,
        totals: {},
        now,
      }).ok,
    ).toBe(false);
    expect(
      placeOrder({ orders: [], products, user: 'u', lines: [{ id: 1, qty: -2 }], totals: {}, now })
        .ok,
    ).toBe(false);
  });
  it('cancelling a Processing order restores stock', () => {
    const r = place();
    const c = changeStatus(r.orders, r.products, 'ORD-1001', 'Cancelled');
    expect(c.orders[0].status).toBe('Cancelled');
    expect(c.products[0].stock).toBe(5);
  });
  it('follows Processing -> Shipped -> Delivered without restoring stock', () => {
    const r = place();
    const s = changeStatus(r.orders, r.products, 'ORD-1001', 'Shipped');
    const d = changeStatus(s.orders, s.products, 'ORD-1001', 'Delivered');
    expect(d.orders[0].status).toBe('Delivered');
    expect(d.products[0].stock).toBe(3);
  });
  it('refuses Shipped/Delivered -> Cancelled and unknown orders', () => {
    const r = place();
    const s = changeStatus(r.orders, r.products, 'ORD-1001', 'Shipped');
    expect(changeStatus(s.orders, s.products, 'ORD-1001', 'Cancelled').error).toContain(
      'Cannot change Shipped',
    );
    const d = changeStatus(s.orders, s.products, 'ORD-1001', 'Delivered');
    expect(changeStatus(d.orders, d.products, 'ORD-1001', 'Cancelled').ok).toBe(false);
    expect(changeStatus([], [], 'X', 'Shipped').error).toBe('Order not found');
  });
});
describe('auth & authorization', () => {
  it('logs in a valid user', () =>
    expect(login('standard_user', 'demo123')).toEqual({
      ok: true,
      user: { username: 'standard_user', role: 'customer' },
    }));
  it.each([
    ['', 'demo123', 'Username'],
    ['standard_user', '', 'Password'],
    ['standard_user', 'x', 'Invalid'],
    ['locked_user', 'demo123', 'locked'],
  ])('rejects %s / %s', (u, p, msg) => {
    const r = login(u, p);
    expect(r.ok).toBe(false);
    expect(r.error).toContain(msg);
  });
  it('customers cannot access admin', () => {
    expect(can('admin', 'admin')).toBe(true);
    expect(can('customer', 'admin')).toBe(false);
    expect(can('ghost', 'shop')).toBe(false);
  });
});
