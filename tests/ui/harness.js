import { createWebCryptoPort, MemoryDocumentStore } from '../../src/backend/index.js';
import { vi } from 'vitest';
import { App } from '../../src/ui/app.js';
import { ApiClient } from '../../src/client/api-client.js';
import { createLocalFetcher } from '../../src/backend/local-backend.js';

/** Native DOM events (no testing library needed). */
const fire = {
  click: (element) =>
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
  submit: (form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  change: (element) => element.dispatchEvent(new Event('change', { bubbles: true })),
};

export const FROZEN = '2026-10-12T10:00:00+02:00';

export function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => map.delete(key),
    setItem: (key, value) => map.set(key, value),
  };
}

export async function startApp(options = {}) {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app');
  const store = options.store ?? new MemoryDocumentStore();
  const handler = await createLocalFetcher({
    origin: 'http://localhost',
    store,
    basePath: '/qa-demo-store/',
    crypto: createWebCryptoPort({ iterations: 1000 }),
    seedPasswordIterations: 1000,
    faultsEnabled: options.faultsEnabled ?? true,
    realNow: () => new Date(FROZEN),
    sleep: () => Promise.resolve(),
  });
  const api = new ApiClient({
    baseUrl: '/qa-demo-store/api/v1',
    mode: 'demo',
    fetcher: handler,
    storage: memoryStorage(),
    sleep: () => Promise.resolve(),
  });
  const storage = options.storage ?? memoryStorage();
  const location = { hash: options.hash ?? '#/products', search: options.search ?? '' };
  const download = vi.fn();
  const print = vi.fn();
  let counter = 0;
  const app = new App({
    root,
    api,
    transport: 'in-page',
    storage,
    location,
    languages: options.languages ?? ['fr-FR'],
    download,
    print,
    randomId: () => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`,
  });
  await app.start();
  const settle = async () => {
    for (let round = 0; round < 20; round += 1) {
      await app.idle();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  const $ = (testid) => {
    const element = root.querySelector(`[data-testid="${testid}"]`);
    if (!element)
      throw new Error(
        `Missing data-testid="${testid}" in view ${root.querySelector('[data-view]')?.getAttribute('data-view') ?? '?'}`,
      );
    return element;
  };
  const h = {
    app,
    root,
    api,
    store,
    storage,
    location,
    download,
    print,
    settle,
    async go(hash) {
      location.hash = hash;
      await app.navigate(hash);
      await settle();
    },
    $,
    maybe: (testid) => root.querySelector(`[data-testid="${testid}"]`),
    all: (prefix) => [...root.querySelectorAll(`[data-testid^="${prefix}"]`)],
    async click(testid) {
      fire.click($(testid));
      await settle();
    },
    async clickSelector(selector) {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      fire.click(element);
      await settle();
    },
    fill(selector, value) {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      element.value = value;
    },
    check(selector, checked = true) {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      element.checked = checked;
    },
    async submit(selector) {
      const form = root.querySelector(selector);
      if (!form) throw new Error(`Missing ${selector}`);
      fire.submit(form);
      await settle();
    },
    async change(selector, value) {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      element.value = value;
      fire.change(element);
      await settle();
    },
    text: (testid) => $(testid).textContent.replace(/\s+/g, ' ').trim(),
    message: () =>
      root
        .querySelector('[data-testid="message"]')
        ?.textContent.replace('×', '')
        .replace(/\s+/g, ' ')
        .trim() ?? '',
    async login(username = 'standard_user', password = 'demo123') {
      await h.go('#/login');
      h.fill('[data-testid="login-username"]', username);
      h.fill('[data-testid="login-password"]', password);
      await h.submit('[data-form="login"]');
    },
  };
  await settle();
  await api.post('/demo/clock', { now: FROZEN });
  return h;
}
