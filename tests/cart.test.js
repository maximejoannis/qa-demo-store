import { describe, it, expect } from 'vitest';
import { addToCart, setQuantity, removeFromCart, cartCount, cartLines } from '../src/cart/cart.js';
import { stockLevel, hasStock, adjustStock } from '../src/inventory/inventory.js';

const p = { id: 1, name: 'A', price: 100, stock: 3, active: true };
describe('cart', () => {
  it('adds and increments', () => {
    const c1 = addToCart([], p).cart;
    expect(addToCart(c1, p, 2).cart).toEqual([{ id: 1, qty: 3 }]);
    expect(addToCart([{ id: 2, qty: 1 }], p).cart).toHaveLength(2);
  });
  it.each([0, -1, 1.5, 'a'])('rejects invalid quantity %s', (q) =>
    expect(addToCart([], p, q).error).toBe('Invalid quantity'),
  );
  it('rejects unavailable products', () => {
    expect(addToCart([], null).ok).toBe(false);
    expect(addToCart([], { ...p, active: false }).ok).toBe(false);
    expect(addToCart([], { ...p, stock: 0 }).ok).toBe(false);
  });
  it('rejects exceeding stock', () =>
    expect(addToCart([{ id: 1, qty: 3 }], p).error).toBe('Not enough stock'));
  it('sets quantity, removes on 0, validates', () => {
    const c = [{ id: 1, qty: 1 }];
    expect(setQuantity(c, p, 2).cart[0].qty).toBe(2);
    expect(setQuantity(c, p, 0).cart).toEqual([]);
    expect(setQuantity(c, p, -1).ok).toBe(false);
    expect(setQuantity(c, p, 9).ok).toBe(false);
  });
  it('removes, counts and builds lines', () => {
    expect(removeFromCart([{ id: 1, qty: 1 }], 1)).toEqual([]);
    expect(
      cartCount([
        { id: 1, qty: 2 },
        { id: 2, qty: 3 },
      ]),
    ).toBe(5);
    expect(
      cartLines(
        [
          { id: 1, qty: 2 },
          { id: 9, qty: 1 },
        ],
        [p],
      ),
    ).toEqual([{ id: 1, qty: 2, name: 'A', unitPrice: 100 }]);
  });
});
describe('inventory', () => {
  it('classifies stock levels', () => {
    expect([0, 3, 5, 6].map(stockLevel)).toEqual(['out', 'low', 'low', 'in']);
  });
  it('checks and adjusts stock', () => {
    const ps = [
      { id: 1, stock: 2 },
      { id: 2, stock: 1 },
    ];
    expect(hasStock(ps, [{ id: 1, qty: 2 }])).toBe(true);
    expect(hasStock(ps, [{ id: 1, qty: 3 }])).toBe(false);
    expect(hasStock(ps, [{ id: 7, qty: 1 }])).toBe(false);
    expect(adjustStock(ps, [{ id: 1, qty: 2 }], -1)).toEqual([
      { id: 1, stock: 0 },
      { id: 2, stock: 1 },
    ]);
  });
});
