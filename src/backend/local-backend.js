/**
 * "In the page" back-end used by `npm run dev` and GitHub Pages: the same routes as the
 * optional Node API, persisted in localStorage (or in memory when storage is blocked).
 */
import { createApi } from './api.js';
import { createWebCryptoPort } from './crypto.js';
import { MemoryDocumentStore } from './store.js';

export const DB_KEY = 'qads2:db';

/**
 * Store persisted as one JSON document in localStorage. Falls back to memory only when
 * storage is unavailable or full (private browsing, blocked cookies): the app still works.
 * @param {Pick<Storage, 'getItem' | 'setItem'> | null} storage
 * @returns {{ store: MemoryDocumentStore, persistent: boolean }}
 */
export function createBrowserStore(storage) {
  /** @type {Record<string, Record<string, string>>} */
  let mirror = {};
  let persistent = storage !== null;
  try {
    const raw = storage?.getItem(DB_KEY);
    mirror = raw ? JSON.parse(raw) : {};
  } catch {
    mirror = {};
    persistent = false;
  }
  const store = new MemoryDocumentStore({
    persist: (changes) => {
      for (const change of changes) {
        if (change.kind === 'clear') mirror = {};
        else if (change.kind === 'delete') delete mirror[change.collection]?.[change.id];
        else (mirror[change.collection] ??= {})[change.id] = change.json;
      }
      if (persistent) {
        try {
          storage?.setItem(DB_KEY, JSON.stringify(mirror));
        } catch {
          persistent = false;
        }
      }
      return Promise.resolve();
    },
  });
  for (const [collection, docs] of Object.entries(mirror)) {
    store.load(
      collection,
      Object.entries(docs).map(([id, json]) => ({ id, json })),
    );
  }
  return { store, persistent };
}

const json = (status, body, headers = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
  });

/**
 * Creates the local back-end and returns a `fetch`-compatible function.
 * @param {{ store: MemoryDocumentStore, basePath: string, origin: string, faultsEnabled?: boolean,
 *   crypto?: ReturnType<typeof createWebCryptoPort>, seedPasswordIterations?: number,
 *   realNow?: () => Date, sleep?: (ms: number) => Promise<void> }} options
 * @returns {Promise<(input: string, init?: RequestInit) => Promise<Response>>}
 */
export async function createLocalFetcher(options) {
  const api = createApi({
    store: options.store,
    crypto: options.crypto ?? createWebCryptoPort({ iterations: 10_000 }),
    config: {
      demoMode: true,
      faultsEnabled: options.faultsEnabled ?? true,
      // Demo passwords are public: few iterations keep the first start instantaneous.
      seedPasswordIterations: options.seedPasswordIterations ?? 1_000,
      sessionTtlMinutes: 480,
    },
    realNow: options.realNow ?? (() => new Date()),
    ...(options.sleep ? { sleep: options.sleep } : {}),
  });
  await api.init();
  const prefix = options.basePath.replace(/\/$/, '');

  return async (input, init = {}) => {
    const url = new URL(input, options.origin);
    let body;
    try {
      body = typeof init.body === 'string' && init.body ? JSON.parse(init.body) : undefined;
    } catch {
      return json(
        400,
        {
          type: 'about:blank',
          title: 'The request was rejected',
          status: 400,
          code: 'BAD_REQUEST',
        },
        { 'content-type': 'application/problem+json' },
      );
    }
    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([name, value]) => [
        name.toLowerCase(),
        String(value),
      ]),
    );
    const bearer = /^Bearer ([a-f0-9]{64})$/.exec(headers.authorization ?? '')?.[1] ?? null;
    const response = await api.handle({
      method: (init.method ?? 'GET').toUpperCase(),
      path: url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers,
      body,
      sessionToken: bearer,
    });
    const extra = { ...response.headers };
    if (response.session !== undefined) extra['x-session-token'] = response.session ?? '';
    return json(response.status, response.body, extra);
  };
}
