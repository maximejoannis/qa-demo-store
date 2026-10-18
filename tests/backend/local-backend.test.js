import { describe, expect, it } from 'vitest';
import { createWebCryptoPort } from '../../src/backend/index.js';
import { createBrowserStore, createLocalFetcher, DB_KEY } from '../../src/backend/local-backend.js';

function storage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), map };
}

const fetcherFor = (store) =>
  createLocalFetcher({
    store,
    basePath: '/qa-demo-store/',
    origin: 'http://localhost',
    crypto: createWebCryptoPort({ iterations: 1000 }),
  });

describe('LOCAL-BE in-page back-end', () => {
  it('LOCAL-BE-01 persists the database in localStorage and reloads it', async () => {
    const backing = storage();
    const first = createBrowserStore(backing);
    expect(first.persistent).toBe(true);
    const fetcher = await fetcherFor(first.store);
    await fetcher('/qa-demo-store/api/v1/demo/reset', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'low-stock' }),
    });
    await first.store.transaction(async () => {
      await first.store.delete('products', '1');
    });
    const saved = JSON.parse(backing.map.get(DB_KEY));
    expect(saved.meta.scenario).toContain('low-stock');
    expect(saved.products['1']).toBeUndefined();
    const second = createBrowserStore(backing);
    expect(await second.store.get('products', '2')).toMatchObject({ id: 2, stock: 2 });
  });

  it('LOCAL-BE-02 falls back to memory when storage is unreadable or full', async () => {
    const unreadable = createBrowserStore({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => undefined,
    });
    expect(unreadable.persistent).toBe(false);
    const full = createBrowserStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    await full.store.transaction(() => full.store.put('a', { id: 1 }));
    expect(await full.store.get('a', '1')).toEqual({ id: 1 });
    const none = createBrowserStore(null);
    expect(none.persistent).toBe(false);
    await none.store.transaction(() => none.store.clear());
  });

  it('LOCAL-BE-03 answers like an HTTP server: problems, sessions and paths outside the base', async () => {
    const fetcher = await fetcherFor(createBrowserStore(null).store);
    const bad = await fetcher('/qa-demo-store/api/v1/quotes', { method: 'POST', body: '{oops' });
    expect(bad.status).toBe(400);
    expect(bad.headers.get('content-type')).toContain('problem+json');
    const login = await fetcher('/qa-demo-store/api/v1/auth/login', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'standard_user', password: 'demo123' }),
    });
    const token = login.headers.get('x-session-token');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const me = await fetcher('http://localhost/qa-demo-store/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(await me.json()).toMatchObject({ user: { username: 'standard_user' } });
    const outside = await fetcher('/api/v1/health');
    expect(outside.status).toBe(200);
    const logout = await fetcher('/qa-demo-store/api/v1/auth/logout', { method: 'POST' });
    expect(logout.headers.get('x-session-token')).toBe('');
    expect(await logout.text()).toBe('');
  });
});
