import { describe, it, expect } from 'vitest';
import { PRODUCTS } from '../src/data/products.js';
import { searchProducts, filterProducts, sortProducts, paginate } from '../src/catalog/query.js';

describe('search', () => {
  it('matches name ignoring case and spaces', () =>
    expect(searchProducts(PRODUCTS, '  HEADPHONES ').length).toBeGreaterThan(0));
  it('matches SKU', () => expect(searchProducts(PRODUCTS, 'sku-1003')).toHaveLength(1));
  it('returns all for empty or null term', () => {
    expect(searchProducts(PRODUCTS, '')).toHaveLength(PRODUCTS.length);
    expect(searchProducts(PRODUCTS, null)).toHaveLength(PRODUCTS.length);
  });
  it('returns nothing when no match', () => expect(searchProducts(PRODUCTS, 'zzzz')).toEqual([]));
});
describe('filters', () => {
  it('combines all criteria', () => {
    const r = filterProducts(PRODUCTS, {
      category: 'Gaming',
      min: 1000,
      max: 9000,
      inStock: true,
      minRating: 4.5,
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.category === 'Gaming' && p.price <= 9000 && p.rating >= 4.5)).toBe(
      true,
    );
  });
  it('defaults return everything', () =>
    expect(filterProducts(PRODUCTS)).toHaveLength(PRODUCTS.length));
  it('inStock excludes sold-out products', () =>
    expect(filterProducts(PRODUCTS, { inStock: true }).some((p) => p.stock === 0)).toBe(false));
  it('boundary prices are inclusive', () =>
    expect(filterProducts(PRODUCTS, { min: 1499, max: 1499 })).toHaveLength(1));
});
describe('sorting', () => {
  it('A-Z and Z-A', () => {
    expect(sortProducts(PRODUCTS, 'name-asc')[0].name).toBe('4K Action Camera');
    expect(sortProducts(PRODUCTS, 'name-desc')[0].name).toBe('Wireless Headphones');
  });
  it('price both directions', () => {
    expect(sortProducts(PRODUCTS, 'price-asc')[0].price).toBe(1499);
    expect(sortProducts(PRODUCTS, 'price-desc')[0].price).toBe(19999);
  });
  it('rating and newest', () => {
    expect(sortProducts(PRODUCTS, 'rating')[0].rating).toBe(4.8);
    expect(sortProducts(PRODUCTS, 'new')[0].isNew).toBe(true);
  });
  it('unknown key falls back and input is not mutated', () => {
    const copy = [...PRODUCTS];
    expect(sortProducts(PRODUCTS, 'nope')[0].name).toBe('4K Action Camera');
    expect(PRODUCTS).toEqual(copy);
  });
});
describe('pagination', () => {
  it('first page', () =>
    expect(paginate(PRODUCTS, 1)).toMatchObject({ page: 1, totalPages: 2, total: 16 }));
  it('clamps too-high and too-low pages', () => {
    expect(paginate(PRODUCTS, 99).page).toBe(2);
    expect(paginate(PRODUCTS, 0).page).toBe(1);
  });
  it('invalid page falls back to 1', () => expect(paginate(PRODUCTS, 'x').page).toBe(1));
  it('empty catalog', () => expect(paginate([], 1)).toMatchObject({ items: [], totalPages: 1 }));
});
