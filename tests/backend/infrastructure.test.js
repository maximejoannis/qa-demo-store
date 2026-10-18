import { EngineError } from '../../src/engine/index.js';
import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  createApi,
  createWebCryptoPort,
  hashPbkdf2,
  MemoryDocumentStore,
  Mutex,
  timingSafeEqualHex,
  toProblem,
  verifyPbkdf2,
} from '../../src/backend/index.js';
import { Context } from '../../src/backend/context.js';
import { matchRoute } from '../../src/backend/router.js';
import { makeDeps } from './harness.js';

describe('INFRA document store', () => {
  it('INFRA-01 copies documents and rolls back failed transactions', async () => {
    const store = new MemoryDocumentStore();
    await store.put('things', { id: 'a', value: 1 });
    const read = await store.get('things', 'a');
    if (read) read.value = 99;
    expect(await store.get('things', 'a')).toEqual({ id: 'a', value: 1 });
    await expect(
      store.transaction(async () => {
        await store.put('things', { id: 'b', value: 2 });
        await store.delete('things', 'a');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await store.list('things')).toEqual([{ id: 'a', value: 1 }]);
    expect(await store.get('missing', 'x')).toBeNull();
    expect(await store.list('missing')).toEqual([]);
    await store.delete('missing', 'x');
  });
  it('INFRA-02 persists committed changes in one batch and direct writes immediately', async () => {
    const batches = [];
    const store = new MemoryDocumentStore({
      persist: (changes) => {
        batches.push(changes);
        return Promise.resolve();
      },
    });
    store.load('things', [{ id: 'x', json: '{"id":"x"}' }]);
    await store.transaction(async () => {
      await store.put('things', { id: 1 });
      await store.delete('things', 'x');
    });
    await store.transaction(() => Promise.resolve('nothing'));
    await store.clear();
    expect(batches).toEqual([
      [
        { kind: 'put', collection: 'things', id: '1', json: '{"id":1}' },
        { kind: 'delete', collection: 'things', id: 'x' },
      ],
      [{ kind: 'clear' }],
    ]);
  });
  it('INFRA-03 serializes concurrent work', async () => {
    const mutex = new Mutex();
    const order = [];
    await Promise.all([
      mutex.run(async () => {
        order.push('a1');
        await Promise.resolve();
        order.push('a2');
      }),
      mutex
        .run(() => {
          order.push('b');
          return Promise.reject(new Error('x'));
        })
        .catch(() => order.push('b-failed')),
      mutex.run(() => {
        order.push('c');
        return Promise.resolve();
      }),
    ]);
    expect(order).toEqual(['a1', 'a2', 'b', 'b-failed', 'c']);
  });
});

describe('INFRA crypto port', () => {
  it('INFRA-04 hashes and verifies PBKDF2 passwords', async () => {
    const port = createWebCryptoPort({ iterations: 1000 });
    const hash = await port.hashPassword('secret123');
    expect(hash).toMatch(/^pbkdf2\$1000\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    expect(await port.verifyPassword('secret123', hash)).toBe(true);
    expect(await port.verifyPassword('secret124', hash)).toBe(false);
    expect(await verifyPbkdf2('x', 'scrypt$1$2$3')).toBe(false);
    expect(await verifyPbkdf2('x', 'pbkdf2$1000')).toBe(false);
    expect(await hashPbkdf2('a', 1000, '00')).toBe(await hashPbkdf2('a', 1000, '00'));
    expect(await port.sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(port.randomHex(4)).toMatch(/^[a-f0-9]{8}$/);
    expect(createWebCryptoPort().randomHex(1)).toHaveLength(2);
    expect(timingSafeEqualHex('ab', 'ab')).toBe(true);
    expect(timingSafeEqualHex('ab', 'ac')).toBe(false);
    expect(timingSafeEqualHex('ab', 'abc')).toBe(false);
  });
});

describe('INFRA errors, router and context', () => {
  it('INFRA-05 maps errors to RFC 9457 problems without leaking internals', () => {
    expect(toProblem(new ApiError(418, 'TEAPOT', 'No coffee'))).toMatchObject({
      status: 418,
      body: { code: 'TEAPOT', title: 'No coffee' },
    });
    expect(toProblem(new EngineError('INVALID_DATE', 'bad'))).toMatchObject({
      status: 400,
      body: { code: 'INVALID_DATE' },
    });
    const internal = toProblem(new Error('SQL secret details'));
    expect(internal).toMatchObject({ status: 500, body: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(internal)).not.toContain('secret');
  });
  it('INFRA-06 matches routes with parameters', () => {
    const handler = () => Promise.resolve({});
    const routes = [
      {
        method: 'GET',
        path: '/a/:id',
        auth: 'public',
        tag: 't',
        summary: 's',
        handler,
      },
      {
        method: 'POST',
        path: '/a/:id',
        auth: 'public',
        tag: 't',
        summary: 's',
        handler,
      },
    ];
    expect(matchRoute(routes, 'GET', '/a/x%20y')).toMatchObject({ params: { id: 'x y' } });
    expect(matchRoute(routes, 'PUT', '/a/1')).toEqual({ allowed: ['GET', 'POST'] });
    expect(matchRoute(routes, 'GET', '/b/1')).toBeNull();
  });
  it('INFRA-07 api guards: prefix, unexpected errors and logging', async () => {
    const log = vi.fn();
    const deps = makeDeps({}, { log });
    const api = createApi(deps);
    await api.init();
    await api.init();
    expect(
      await api.handle({
        method: 'GET',
        path: '/other',
        query: {},
        headers: {},
        body: undefined,
        sessionToken: null,
      }),
    ).toMatchObject({ status: 404 });
    deps.store.list = () => Promise.reject(new Error('disk failure'));
    const failed = await api.handle({
      method: 'GET',
      path: '/api/v1/products',
      query: {},
      headers: {},
      body: undefined,
      sessionToken: null,
    });
    expect(failed).toMatchObject({ status: 500, body: { code: 'INTERNAL_ERROR' } });
    expect(log).toHaveBeenCalledWith('request_failed', { route: '/products', error: 'Error' });
  });
  it('INFRA-08 identifiers and pseudonyms', async () => {
    const deps = makeDeps();
    const ctx = new Context(deps, new Date('2026-10-12T08:00:00Z'), null);
    expect(await ctx.newId('ORD-')).toMatch(/^ORD-[0-9A-Z]{10}$/);
    await deps.store.put('meta', { id: 'ids', seed: 7 });
    expect(await ctx.newId('X-')).toBe('X-7-000001');
    expect(await ctx.newId('X-')).toBe('X-7-000002');
    vi.useFakeTimers();
    const waiting = new Context({ ...deps, sleep: undefined }, new Date(), null).sleep(3000);
    vi.advanceTimersByTime(3000);
    await expect(waiting).resolves.toBeUndefined();
    vi.useRealTimers();
    expect(await ctx.pseudonym('standard_user')).toMatch(/^[a-f0-9]{16}$/);
    expect(() => ctx.requireUser()).toThrow(ApiError);
    await expect(ctx.product(404)).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    await ctx.log('event', null);
    expect((await deps.store.list('logs'))[0]?.subject).toBeNull();
  });
});
