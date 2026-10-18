import { createWebCryptoPort, MemoryDocumentStore } from '../../src/backend/index.js';
import { createLocalFetcher } from '../../src/backend/local-backend.js';
import { paritySuite } from './suite.js';

/** Same suite through the fetch-compatible adapter used by the browser. */
paritySuite('local fetch adapter (browser mode)', async () => {
  const fetcher = await createLocalFetcher({
    store: new MemoryDocumentStore(),
    basePath: '/qa-demo-store/',
    origin: 'http://localhost',
    crypto: createWebCryptoPort({ iterations: 1000 }),
    seedPasswordIterations: 1000,
    realNow: () => new Date('2026-10-12T08:00:00Z'),
    sleep: () => Promise.resolve(),
  });
  return () => {
    let token = null;
    return {
      init: () => Promise.resolve(),
      async request(method, path, body, headers = {}) {
        const response = await fetcher(`/qa-demo-store/api/v1${path}`, {
          method,
          headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const session = response.headers.get('x-session-token');
        if (session !== null) token = session || null;
        const text = await response.text();
        return {
          status: response.status,
          body: text ? JSON.parse(text) : undefined,
          headers: Object.fromEntries(response.headers),
        };
      },
    };
  };
});
