import { createApi, createWebCryptoPort, MemoryDocumentStore } from '../../src/backend/index.js';

export const FROZEN_NOW = '2026-10-12T10:00:00+02:00';

export function makeDeps(overrides = {}, extra = {}) {
  return {
    store: new MemoryDocumentStore(),
    crypto: createWebCryptoPort({ iterations: 1000 }),
    config: {
      demoMode: true,
      faultsEnabled: true,
      seedPasswordIterations: 1000,
      sessionTtlMinutes: 480,
      ...overrides,
    },
    realNow: () => new Date(FROZEN_NOW),
    sleep: () => Promise.resolve(),
    ...extra,
  };
}

/** In-process client: the session token travels like a bearer token. */
export function directClient(deps = makeDeps(), shared) {
  const api = shared ?? createApi(deps);
  const client = {
    deps,
    token: null,
    async init() {
      await api.init();
    },
    async request(method, path, body, headers = {}) {
      const [pathname, search = ''] = path.split('?');
      const response = await api.handle({
        method,
        path: `/api/v1${pathname ?? ''}`,
        query: Object.fromEntries(new URLSearchParams(search)),
        headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
        body,
        sessionToken: client.token,
      });
      if (response.session !== undefined) client.token = response.session;
      return { status: response.status, body: response.body, headers: response.headers ?? {} };
    },
  };
  return client;
}

export async function loggedIn(username = 'standard_user', password = 'demo123', deps) {
  const client = directClient(deps);
  await client.init();
  await client.request('POST', '/demo/clock', { now: FROZEN_NOW });
  const login = await client.request('POST', '/auth/login', { username, password });
  if (login.status !== 200)
    throw new Error(`login failed for ${username}: ${JSON.stringify(login.body)}`);
  return client;
}

export const quoteBody = (overrides = {}) => ({
  lines: [
    { productId: 17, qty: 2 },
    { productId: 1, qty: 1 },
  ],
  shippingMethod: 'standard',
  destination: { country: 'FR' },
  ...overrides,
});

export const address = {
  firstName: 'Ada',
  lastName: 'Standard',
  address: '10 rue des Tests',
  city: 'Lyon',
  zip: '69001',
  country: 'FR',
};

export async function placeOrder(client, quote = quoteBody(), extra = {}, key = 'order-key-0001') {
  const q = await client.request('POST', '/quotes', quote);
  const body = q.body;
  return client.request(
    'POST',
    '/orders',
    {
      quoteId: body.quoteId,
      payment: { method: 'card', card: '4242 4242 4242 4242' },
      shippingAddress: address,
      ...extra,
    },
    { 'Idempotency-Key': key },
  );
}
