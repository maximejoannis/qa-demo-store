import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiProblem } from '../../src/client/api-client.js';
import { attr, escapeHtml, html, mount, SafeHtml } from '../../src/ui/core/html.js';
import { href, parseHash } from '../../src/ui/core/router.js';
import {
  detectLang,
  formatDate,
  hasKey,
  keysOf,
  money,
  percent,
  setI18nFaults,
  setLang,
  t,
} from '../../src/i18n/index.js';
import { Persisted } from '../../src/ui/state.js';
import { memoryStorage } from './harness.js';

describe('WEB-SEC-01 escape-by-default templating', () => {
  it('WEB-SEC-01 escapes every interpolation', () => {
    const evil = '<img src=x onerror="alert(1)">\'`&';
    expect(html`<p>${evil}</p>`.value).toBe(
      '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&#96;&amp;</p>',
    );
    expect(html`${[1, ' & ', null, undefined, false, html`<b>ok</b>`, [true]]}`.value).toBe(
      '1 &amp; <b>ok</b>true',
    );
    expect(attr('disabled', true).value).toBe(' disabled');
    expect(attr('title', '"x"').value).toBe(' title="&quot;x&quot;"');
    expect(attr('title', null).value).toBe('');
    expect(attr('title', false).value).toBe('');
    expect(String(new SafeHtml('<i>'))).toBe('<i>');
    expect(escapeHtml('a<b')).toBe('a&lt;b');
    const root = document.createElement('div');
    mount(root, html`<span>${evil}</span>`);
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toBe(evil);
  });
  it('WEB-SEC-02 a malicious product name from storage stays inert', () => {
    const root = document.createElement('div');
    mount(root, html`<h3><a href="#/products/1">${'<script>alert(1)</script>'}</a></h3>`);
    expect(root.querySelector('script')).toBeNull();
  });
});

describe('WEB-CORE router and i18n', () => {
  it('WEB-CORE-01 parses hash routes', () => {
    expect(parseHash('')).toEqual({ name: 'products', params: [] });
    expect(parseHash('#/orders/ORD%2042?x=1')).toEqual({ name: 'orders', params: ['ORD 42'] });
    expect(href('orders', 'ORD 42')).toBe('#/orders/ORD%2042');
  });
  it('WEB-I18N-01 detects language, translates and formats', () => {
    expect(detectLang([null, undefined, 'de-DE', 'en-US'])).toBe('en');
    expect(detectLang(['es'])).toBe('fr');
    setLang('en');
    expect(t('nav.cart')).toBe('Cart');
    expect(t('nav.logout', { username: 'ada' })).toBe('Sign out (ada)');
    expect(t('nav.logout')).toBe('Sign out ({username})');
    expect(t('missing.key')).toBe('missing.key');
    expect(money(123456)).toBe('€1,234.56');
    expect(formatDate('2026-10-12')).toBe('12 October 2026');
    expect(percent(550)).toBe('5.5%');
    setLang('fr');
    expect(money(123456).replace(/\s/g, ' ')).toBe('1 234,56 €');
    expect(formatDate('2026-10-11T22:30:00Z')).toBe('12 octobre 2026');
    setI18nFaults({ rawKeyPrefixes: ['nav.'], usDates: true });
    expect(t('nav.cart')).toBe('nav.cart');
    expect(formatDate('2026-10-12')).toBe('10/12/2026');
  });
  it('WEB-I18N-02 French and English dictionaries have the same keys and no empty value', () => {
    expect(keysOf('fr').sort()).toEqual(keysOf('en').sort());
    for (const key of keysOf('fr')) {
      expect(hasKey('en', key)).toBe(true);
      setLang('fr');
      expect(t(key).trim()).not.toBe('');
    }
  });
});

describe('WEB-CORE api client', () => {
  const response = (status, body, headers = {}) =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), { status, headers }),
    );
  it('WEB-CORE-02 sends the anti-CSRF header, stores the demo token and parses problems', async () => {
    const calls = [];
    const storage = memoryStorage();
    const replies = [
      response(200, { user: 1 }, { 'x-session-token': 'a'.repeat(64) }),
      response(200, { ok: true }),
      response(204, undefined, { 'x-session-token': '' }),
      response(409, { type: 'x', title: 'Nope', status: 409, code: 'CONFLICT' }),
    ];
    const client = new ApiClient({
      baseUrl: '/api/v1',
      mode: 'demo',
      storage,
      fetcher: (url, init) => {
        calls.push([url, init]);
        return replies.shift() ?? response(500, {});
      },
    });
    await client.post('/auth/login', { u: 1 });
    await client.get('/orders');
    await client.post('/auth/logout');
    await expect(client.patch('/x', {})).rejects.toBeInstanceOf(ApiProblem);
    expect(calls[0]?.[1].headers).toMatchObject({
      'x-requested-with': 'qads',
      'content-type': 'application/json',
    });
    expect(calls[1]?.[1].headers).toMatchObject({ authorization: `Bearer ${'a'.repeat(64)}` });
    expect(storage.getItem('qads2:session')).toBeNull();
    expect(calls[1]?.[1].credentials).toBe('same-origin');
    await client.put('/x', {}).catch((error) => expect(error.status).toBe(500));
    await client.delete('/x').catch(() => undefined);
  });
  it('WEB-CORE-03 server mode uses cookies, latency and failure injection', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const fetcher = vi.fn(() => response(200, { ok: 1 }));
    const client = new ApiClient({
      baseUrl: 'http://api.test/api/v1',
      mode: 'server',
      storage: null,
      fetcher,
      sleep,
    });
    client.injection.latency = 50;
    client.injection.fail = { quotes: 503 };
    await expect(client.post('/quotes?x=1', {})).rejects.toMatchObject({
      status: 503,
      problem: { code: 'INJECTED_FAILURE' },
    });
    await client.get('/health');
    expect(sleep).toHaveBeenCalledWith(50);
    expect(fetcher).toHaveBeenCalledWith(
      'http://api.test/api/v1/health',
      expect.objectContaining({ credentials: 'include' }),
    );
    const failing = new ApiClient({
      baseUrl: '',
      mode: 'demo',
      fetcher: () => Promise.reject(new Error('down')),
    });
    await expect(failing.get('/meta')).rejects.toMatchObject({
      problem: { code: 'NETWORK_ERROR' },
    });
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const resilient = new ApiClient({
      baseUrl: '',
      mode: 'demo',
      storage: broken,
      fetcher: () => response(200, {}, { 'x-session-token': 'b'.repeat(64) }),
    });
    await expect(resilient.get('/meta')).resolves.toEqual({});
    const timers = new ApiClient({ baseUrl: '', mode: 'demo', fetcher: () => response(200, {}) });
    timers.injection.latency = 1;
    await expect(timers.get('/meta')).resolves.toEqual({});
  });
  it('WEB-CORE-04 persisted storage tolerates broken backends', () => {
    const broken = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
      removeItem: () => {
        throw new Error('x');
      },
    };
    const persisted = new Persisted(broken);
    expect(persisted.read('a', 1)).toBe(1);
    expect(() => {
      persisted.write('a', 2);
      persisted.remove('a');
    }).not.toThrow();
    const none = new Persisted(null);
    expect(none.read('a', 'fallback')).toBe('fallback');
  });
});
