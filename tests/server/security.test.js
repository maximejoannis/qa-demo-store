import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRateLimiter, parseCookies, SESSION_COOKIE } from '../../server/app.js';
import { createFileStore } from '../../server/file-store.js';
import { placeOrder } from '../backend/harness.js';
import { httpClient, startServer } from './http-client.js';

let running;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

const raw = (path, init = {}) => fetch(`${running.base}/api/v1${path}`, init);

describe('Node API security', () => {
  it('SRV-01 health answers with security headers and no-store', async () => {
    running = await startServer();
    const response = await raw('/health');
    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('SRV-02 login sets an HttpOnly SameSite=Strict cookie, logout clears it', async () => {
    running = await startServer();
    const response = await raw('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'qads' },
      body: JSON.stringify({ username: 'standard_user', password: 'demo123' }),
    });
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[a-f0-9]{64}`));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(response.headers.get('x-session-token')).toBeNull();
    const session = cookie.split(';')[0];
    const me = await (await raw('/auth/me', { headers: { cookie: session } })).json();
    expect(me.user.username).toBe('standard_user');
    const logout = await raw('/auth/logout', {
      method: 'POST',
      headers: { cookie: session, 'x-requested-with': 'qads' },
    });
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('SRV-03 a write without the anti-CSRF header is refused', async () => {
    running = await startServer();
    const response = await raw('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'standard_user', password: 'demo123' }),
    });
    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect((await response.json()).code).toBe('CSRF_HEADER_MISSING');
  });

  it('SRV-04 CORS: allowed origin echoed, unknown origin refused, preflight 204', async () => {
    running = await startServer();
    const ok = await raw('/health', { headers: { origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(ok.headers.get('access-control-allow-credentials')).toBe('true');
    const evil = await raw('/health', { headers: { origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
    const preflight = await raw('/orders', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-headers')).toContain('x-requested-with');
  });

  it('SRV-05 body over 100 KB -> 413, invalid JSON -> 400, wrong type -> 415', async () => {
    running = await startServer();
    const headers = { 'content-type': 'application/json', 'x-requested-with': 'qads' };
    const big = await raw('/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username: 'x'.repeat(110 * 1024), password: 'a' }),
    }).catch(() => null);
    if (big) expect(big.status).toBe(413);
    const broken = await raw('/auth/login', { method: 'POST', headers, body: '{oops' });
    expect(broken.status).toBe(400);
    const text = await raw('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'x-requested-with': 'qads' },
      body: 'hello',
    });
    expect(text.status).toBe(415);
  });

  it('SRV-06 login is rate limited per IP (429 + Retry-After)', async () => {
    running = await startServer({ loginLimit: 2 });
    const attempt = () =>
      raw('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-requested-with': 'qads' },
        body: JSON.stringify({ username: 'standard_user', password: 'wrong' }),
      });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const third = await attempt();
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBe('60');
  });

  it('SRV-07 global rate limit and unknown routes', async () => {
    running = await startServer({ globalLimit: 1 });
    expect((await raw('/health')).status).toBe(200);
    expect((await raw('/health')).status).toBe(429);
    await running.close();
    running = await startServer();
    expect((await fetch(`${running.base}/nope`)).status).toBe(404);
    expect(
      (await raw('/health', { method: 'DELETE', headers: { 'x-requested-with': 'qads' } })).status,
    ).toBe(405);
  });

  it('SRV-08 IDOR: a user cannot read the order of another user', async () => {
    running = await startServer();
    const alice = httpClient(running.base);
    await alice.request('POST', '/demo/reset', { scenario: 'default' });
    await alice.request('POST', '/auth/login', { username: 'standard_user', password: 'demo123' });
    const order = await placeOrder(alice);
    expect(order.status).toBe(201);
    const bob = httpClient(running.base);
    await bob.request('POST', '/auth/login', { username: 'premium_user', password: 'demo123' });
    const stolen = await bob.request('GET', `/orders/${String(order.body.id)}`);
    expect([403, 404]).toContain(stolen.status);
    const anonymous = await httpClient(running.base).request('GET', '/orders');
    expect(anonymous.status).toBe(401);
  });

  it('SRV-09 demo routes disappear when demo mode is off', async () => {
    running = await startServer({ demoMode: false });
    const client = httpClient(running.base);
    expect((await client.request('POST', '/demo/reset', { scenario: 'default' })).status).toBe(404);
  });
});

describe('server helpers', () => {
  it('SRV-10 parseCookies and the fixed-window limiter', () => {
    expect(parseCookies('a=1; b = 2; broken; =x')).toEqual({ a: '1', b: '2' });
    expect(parseCookies()).toEqual({});
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
    expect(limiter('ip')).toBe(true);
    expect(limiter('ip')).toBe(false);
    now = 1000;
    expect(limiter('ip')).toBe(true);
  });

  it('SRV-11 the file store persists atomically and survives a corrupted file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qads-'));
    try {
      const file = join(dir, 'sub', 'db.json');
      const store = createFileStore(file);
      await store.transaction(async () => {
        await store.put('things', { id: 'a', value: 1 });
      });
      expect(JSON.parse(readFileSync(file, 'utf8')).things.a).toBe('{"id":"a","value":1}');
      const reloaded = createFileStore(file);
      expect(await reloaded.get('things', 'a')).toEqual({ id: 'a', value: 1 });
      await reloaded.transaction(async () => {
        await reloaded.delete('things', 'a');
      });
      expect(await createFileStore(file).get('things', 'a')).toBeNull();
      writeFileSync(file, '{corrupted');
      expect(await createFileStore(file).get('things', 'a')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
