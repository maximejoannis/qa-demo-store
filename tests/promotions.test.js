import { describe, expect, it } from 'vitest';
import { effectivePrice, promotionPercent } from '../src/promotions/promotions.js';
import { cartLines } from '../src/cart/cart.js';

const item = {
  id: 1,
  name: 'Demo',
  price: 750,
  oldPrice: 1000,
  promoStart: '2026-01-01',
  promoEnd: '2026-01-31',
};
describe('dated promotions', () => {
  it('applies a discount at both date boundaries', () => {
    expect(effectivePrice(item, new Date('2026-01-01'))).toBe(750);
    expect(effectivePrice(item, new Date('2026-01-31'))).toBe(750);
    expect(promotionPercent(item, new Date('2026-01-15'))).toBe(25);
  });
  it('restores the original price before and after promotion', () => {
    expect(effectivePrice(item, new Date('2025-12-31'))).toBe(1000);
    expect(effectivePrice(item, new Date('2026-02-01'))).toBe(1000);
    expect(promotionPercent(item, new Date('2026-02-01'))).toBe(0);
  });
  it('does not discount ordinary products and uses price in cart lines', () => {
    expect(effectivePrice({ price: 500, oldPrice: 0 })).toBe(500);
    expect(effectivePrice({ price: 500, oldPrice: 300 })).toBe(500);
    expect(cartLines([{ id: 1, qty: 2 }], [item])[0].unitPrice).toBe(1000);
  });
});
