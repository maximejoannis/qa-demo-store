import { describe, expect, it } from 'vitest';
import {
  effectivePrice,
  filterProducts,
  paginate,
  productRating,
  promotionPercent,
  searchProducts,
  sortProducts,
  SORT_KEYS,
  stockLevel,
} from '../../src/engine/index.js';
import { paris, product } from './fixtures.js';

const now = paris('2026-10-11T12:00:00');

const promo = product({
  id: 2,
  name: 'Mouse',
  price: 4999,
  oldPrice: 5999,
  promoStart: '2026-10-01',
  promoEnd: '2026-10-11',
  category: 'Gaming',
  rating: 4.2,
  isNew: true,
});

const plain = product({
  id: 3,
  name: 'Desk',
  price: 1999,
  category: 'Office',
  stock: 0,
  rating: 3.9,
});

const lamp = product({
  id: 4,
  name: 'Lamp',
  price: 4599,
  category: 'Home',
  sku: 'SKU-LAMP',
  rating: 4.6,
});

const list = [promo, plain, lamp];

describe('ENG-CAT-01 promotion window in Paris time', () => {
  it('ENG-CAT-01 applies the promotion between start and end inclusive', () => {
    expect(effectivePrice(promo, now)).toBe(4999);
    expect(effectivePrice(promo, paris('2026-10-11T23:59:00'))).toBe(4999);
    expect(effectivePrice(promo, paris('2026-10-12T00:00:30'))).toBe(5999);
    expect(effectivePrice(promo, paris('2026-09-30T23:59:00'))).toBe(5999);
  });
  it('ENG-CAT-01 ignores inconsistent or missing promotions', () => {
    expect(effectivePrice(plain, now)).toBe(1999);
    expect(effectivePrice(product({ price: 5000, oldPrice: 4000 }), now)).toBe(5000);
    expect(effectivePrice(product({ price: 5000, oldPrice: 6000 }), now)).toBe(5000);
  });
  it('ENG-CAT-02 computes the displayed discount percentage', () => {
    expect(promotionPercent(promo, now)).toBe(17);
    expect(promotionPercent(promo, paris('2026-12-01T10:00:00'))).toBe(0);
    expect(promotionPercent(plain, now)).toBe(0);
  });
});

describe('ENG-CAT-03 search, filters, sort and pagination', () => {
  it('ENG-CAT-03 searches name, description, category and sku', () => {
    expect(searchProducts(list, '  ')).toHaveLength(3);
    expect(searchProducts(list, 'GAMING').map((p) => p.id)).toEqual([2]);
    expect(searchProducts(list, 'sku-lamp').map((p) => p.id)).toEqual([4]);
    expect(searchProducts(list, 'zzz')).toEqual([]);
  });
  it('ENG-CAT-03 filters on effective price, stock, category and rating', () => {
    expect(filterProducts(list, {}, now)).toHaveLength(3);
    expect(filterProducts(list, { category: 'Home' }, now).map((p) => p.id)).toEqual([4]);
    expect(filterProducts(list, { min: 4999, max: 4999 }, now).map((p) => p.id)).toEqual([2]);
    expect(filterProducts(list, { inStock: true }, now).map((p) => p.id)).toEqual([2, 4]);
    expect(filterProducts(list, { minRating: 4.5 }, now).map((p) => p.id)).toEqual([4]);
  });
  it('ENG-CAT-03 sorts with every key and a stable tie-breaker', () => {
    const ids = (key) => sortProducts(list, key, now).map((p) => p.id);
    expect(ids('name-asc')).toEqual([3, 4, 2]);
    expect(ids('name-desc')).toEqual([2, 4, 3]);
    expect(ids('price-asc')).toEqual([3, 4, 2]);
    expect(ids('price-desc')).toEqual([2, 4, 3]);
    expect(ids('rating')).toEqual([4, 2, 3]);
    expect(ids('new')).toEqual([2, 3, 4]);
    const twins = [
      product({ id: 8, name: 'B', price: 100, rating: 4, isNew: false }),
      product({ id: 9, name: 'A', price: 100, rating: 4, isNew: false }),
    ];
    for (const key of SORT_KEYS.filter((k) => !k.startsWith('name'))) {
      expect(sortProducts(twins, key, now).map((p) => p.id)).toEqual([9, 8]);
    }
  });
  it('ENG-CAT-03 paginates with clamping', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(paginate(items, 2, 4)).toEqual({
      items: [4, 5, 6, 7],
      page: 2,
      totalPages: 3,
      total: 10,
    });
    expect(paginate(items, 99, 4).page).toBe(3);
    expect(paginate(items, -1, 4).page).toBe(1);
    expect(paginate(items, 1.5, 4).page).toBe(1);
    expect(paginate(items, 1, 0).items).toHaveLength(8);
    expect(paginate([], 1, 8)).toEqual({ items: [], page: 1, totalPages: 1, total: 0 });
  });
});

describe('ENG-CAT-04 ratings and stock levels', () => {
  it('ENG-CAT-04 uses customer reviews when available', () => {
    expect(productRating(lamp, [])).toEqual({ rating: 4.6, count: 120 });
    expect(
      productRating(lamp, [
        { productId: 4, rating: 5 },
        { productId: 4, rating: 4 },
        { productId: 2, rating: 1 },
      ]),
    ).toEqual({ rating: 4.5, count: 2 });
  });
  it('ENG-CAT-05 classifies stock levels', () => {
    expect(stockLevel(0)).toBe('out');
    expect(stockLevel(-2)).toBe('out');
    expect(stockLevel(5)).toBe('low');
    expect(stockLevel(6)).toBe('in');
  });
});
