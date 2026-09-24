import { describe, it, expect } from 'vitest';
import { createStorage, createMemoryBackend } from '../src/storage/storage.js';
import { seedIfNeeded, resetDemoData } from '../src/storage/seed.js';
import { PRODUCTS } from '../src/data/products.js';

describe('storage', () => {
  it('round-trips values and supports fallback', () => {
    const s = createStorage(createMemoryBackend());
    expect(s.get('a')).toBeNull();
    expect(s.get('a', 5)).toBe(5);
    expect(s.set('a', { x: 1 })).toBe(true);
    expect(s.get('a')).toEqual({ x: 1 });
    s.remove('a');
    expect(s.get('a')).toBeNull();
  });
  it('recovers from corrupted JSON', () => {
    const b = createMemoryBackend();
    b.setItem('qads:k', '{bad');
    expect(createStorage(b).get('k', 'fb')).toBe('fb');
  });
  it('reports write failures', () => {
    const b = {
      ...createMemoryBackend(),
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(createStorage(b).set('k', 1)).toBe(false);
  });
  it('reset only clears app keys', () => {
    const b = createMemoryBackend();
    b.setItem('other', '1');
    const s = createStorage(b);
    s.set('a', 1);
    s.reset();
    expect(s.get('a')).toBeNull();
    expect(b.getItem('other')).toBe('1');
  });
});
describe('seed & reset demo data', () => {
  it('seeds once and deterministically', () => {
    const s = createStorage(createMemoryBackend());
    expect(seedIfNeeded(s)).toBe(true);
    expect(seedIfNeeded(s)).toBe(false);
    expect(s.get('products')).toEqual(PRODUCTS);
  });
  it('reset restores the initial state', () => {
    const s = createStorage(createMemoryBackend());
    seedIfNeeded(s);
    s.set('orders', [{ id: 'X' }]);
    s.set('products', []);
    resetDemoData(s);
    expect(s.get('orders')).toEqual([]);
    expect(s.get('products')).toEqual(PRODUCTS);
  });
  it('repairs missing seeded data after a corrupt value', () => {
    const backend = createMemoryBackend();
    const store = createStorage(backend);
    seedIfNeeded(store);
    backend.setItem('qads:products', '{invalid');
    expect(seedIfNeeded(store)).toBe(true);
    expect(store.get('products')).toEqual(PRODUCTS);
  });
  it('migrates legacy products without losing stock, price or orders', () => {
    const store = createStorage(createMemoryBackend());
    seedIfNeeded(store);
    store.set(
      'products',
      PRODUCTS.map((item) => {
        const product = Object.fromEntries(
          Object.entries(item).filter(
            ([key]) => !['image', 'promoStart', 'promoEnd'].includes(key),
          ),
        );
        return product.id === 1 ? { ...product, stock: 2, price: 3456 } : product;
      }),
    );
    store.set('orders', [{ id: 'ORD-1001' }]);
    expect(seedIfNeeded(store)).toBe(true);
    expect(store.get('products')[0]).toMatchObject({
      image: 'products/product-1.svg',
      stock: 2,
      price: 3456,
    });
    expect(store.get('orders')).toEqual([{ id: 'ORD-1001' }]);
    expect(seedIfNeeded(store)).toBe(false);
  });
});
