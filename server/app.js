/**
 * Optional Node API (node:http only, no framework). Serves exactly the same routes as the
 * in-page back-end, plus the protections a real server needs: HttpOnly cookie session,
 * anti-CSRF header, CORS allow-list, rate limit, body size limit, security headers.
 */
import { createServer } from 'node:http';
import { createApi } from '../src/backend/api.js';
import { createWebCryptoPort } from '../src/backend/crypto.js';

export const SESSION_COOKIE = 'qads_session';
export const MAX_BODY_BYTES = 100 * 1024;

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-site',
};

const problemBody = (status, code, title) => ({ type: 'about:blank', title, status, code });

/** Fixed-window rate limiter, per key. */
export function createRateLimiter({ limit, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  return (key) => {
    const current = now();
    const entry = hits.get(key);
    if (!entry || current - entry.start >= windowMs) {
      hits.set(key, { start: current, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

export function parseCookies(header = '') {
  /** @type {Record<string, string>} */
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    const name = part.slice(0, Math.max(index, 0)).trim();
    if (name) cookies[name] = part.slice(index + 1).trim();
  }
  return cookies;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

/**
 * @param {{ store: import('../src/backend/store.js').MemoryDocumentStore,
 *   allowedOrigins?: string[], demoMode?: boolean, faultsEnabled?: boolean,
 *   iterations?: number, seedPasswordIterations?: number, secureCookie?: boolean,
 *   loginLimit?: number, globalLimit?: number, realNow?: () => Date,
 *   sleep?: (ms: number) => Promise<void>, log?: (event: string, data: object) => void }} options
 */
export async function createQadsServer(options) {
  const allowed = new Set(options.allowedOrigins ?? []);
  const api = createApi({
    store: options.store,
    crypto: createWebCryptoPort({ iterations: options.iterations ?? 100_000 }),
    config: {
      demoMode: options.demoMode ?? true,
      faultsEnabled: options.faultsEnabled ?? true,
      seedPasswordIterations: options.seedPasswordIterations ?? 1_000,
      sessionTtlMinutes: 480,
    },
    realNow: options.realNow ?? (() => new Date()),
    ...(options.sleep ? { sleep: options.sleep } : {}),
    log: options.log ?? ((event, data) => console.error(JSON.stringify({ event, ...data }))),
  });
  await api.init();
  const loginLimiter = createRateLimiter({ limit: options.loginLimit ?? 10, windowMs: 60_000 });
  const globalLimiter = createRateLimiter({ limit: options.globalLimit ?? 600, windowMs: 60_000 });

  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    const headers = { ...SECURITY_HEADERS };
    if (origin && allowed.has(origin)) {
      Object.assign(headers, {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type, x-requested-with, idempotency-key',
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
        vary: 'Origin',
      });
    }
    const send = (status, body, extra = {}) => {
      const isProblem = status >= 400;
      response.writeHead(status, {
        ...headers,
        ...(body === undefined
          ? {}
          : { 'content-type': isProblem ? 'application/problem+json' : 'application/json' }),
        ...extra,
      });
      response.end(body === undefined ? undefined : JSON.stringify(body));
    };

    const method = (request.method ?? 'GET').toUpperCase();
    const url = new URL(request.url ?? '/', 'http://localhost');
    const ip = request.socket.remoteAddress ?? 'unknown';

    if (origin && !allowed.has(origin)) {
      send(403, problemBody(403, 'ORIGIN_NOT_ALLOWED', 'Origin not allowed'));
      return;
    }
    if (method === 'OPTIONS') {
      send(204);
      return;
    }
    if (!globalLimiter(ip)) {
      send(429, problemBody(429, 'RATE_LIMITED', 'Too many requests'), { 'retry-after': '60' });
      return;
    }
    if (method !== 'GET' && method !== 'HEAD' && request.headers['x-requested-with'] !== 'qads') {
      send(403, problemBody(403, 'CSRF_HEADER_MISSING', 'Missing x-requested-with header'));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/v1/auth/login' && !loginLimiter(ip)) {
      send(429, problemBody(429, 'RATE_LIMITED', 'Too many login attempts'), {
        'retry-after': '60',
      });
      return;
    }

    let body;
    try {
      const raw = await readBody(request);
      if (raw) {
        if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) {
          send(415, problemBody(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON expected'));
          return;
        }
        body = JSON.parse(raw);
      }
    } catch (error) {
      if (error && error.status === 413) {
        send(413, problemBody(413, 'PAYLOAD_TOO_LARGE', 'Body larger than 100 KB'), {
          connection: 'close',
        });
      } else send(400, problemBody(400, 'BAD_REQUEST', 'The request was rejected'));
      return;
    }

    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE] ?? null;
    const lowered = Object.fromEntries(
      Object.entries(request.headers).map(([name, value]) => [name, String(value)]),
    );
    const result = await api.handle({
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: lowered,
      body,
      sessionToken: token,
    });
    const extra = { ...result.headers };
    if (result.session !== undefined) {
      const secure = options.secureCookie ? '; Secure' : '';
      extra['set-cookie'] = result.session
        ? `${SESSION_COOKIE}=${result.session}; HttpOnly; SameSite=Strict; Path=/${secure}; Max-Age=28800`
        : `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/${secure}; Max-Age=0`;
    }
    delete extra['content-type'];
    send(result.status, result.body, extra);
  });
}
