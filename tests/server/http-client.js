import { createQadsServer } from '../../server/app.js';
import { createFileStore } from '../../server/file-store.js';

/** Starts the Node API on a random port (memory store). */
export async function startServer(options = {}) {
  const server = await createQadsServer({
    store: createFileStore(null),
    allowedOrigins: ['http://localhost:5173'],
    iterations: 1_000,
    sleep: () => Promise.resolve(),
    log: () => {},
    ...options,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    server,
    base: `http://127.0.0.1:${String(port)}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Same interface as the in-process client of the contract suite, but over real HTTP with a cookie jar. */
export function httpClient(base) {
  let cookie = '';
  return {
    async init() {},
    async request(method, path, body, headers = {}) {
      const response = await fetch(`${base}/api/v1${path}`, {
        method,
        headers: {
          'x-requested-with': 'qads',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(cookie ? { cookie } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.includes('Max-Age=0') ? '' : setCookie.split(';')[0];
      const text = await response.text();
      return {
        status: response.status,
        body: text ? JSON.parse(text) : undefined,
        headers: Object.fromEntries(response.headers),
      };
    },
  };
}
