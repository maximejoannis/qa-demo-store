import { Context } from './context.js';
import { ApiError, problem, toProblem } from './errors.js';
import { accountRoutes } from './handlers/account.js';
import { adminRoutes, purge } from './handlers/admin.js';
import { authRoutes } from './handlers/auth.js';
import { catalogRoutes } from './handlers/catalog.js';
import { checkoutRoutes } from './handlers/checkout.js';
import { orderRoutes } from './handlers/orders.js';
import { systemRoutes } from './handlers/system.js';
import { matchRoute } from './router.js';
import { seedScenario } from './seed.js';
import { C } from './types.js';

export const API_PREFIX = '/api/v1';

export const ROUTES = [
  ...systemRoutes,
  ...authRoutes,
  ...catalogRoutes,
  ...checkoutRoutes,
  ...orderRoutes,
  ...accountRoutes,
  ...adminRoutes,
];

async function resolveNow(deps) {
  if (!deps.config.demoMode) return deps.realNow();
  const clock = await deps.store.get(C.meta, 'clock');
  return clock?.frozenAt ? new Date(clock.frozenAt) : deps.realNow();
}

async function resolveUser(deps, token, now) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await deps.store.get(C.sessions, await deps.crypto.sha256Hex(token));
  if (!session || session.expiresAt <= now.toISOString()) return null;
  return deps.store.get(C.users, session.userId);
}

export function createApi(deps) {
  return {
    async init() {
      await deps.store.transaction(async () => {
        const seeded = await deps.store.get(C.meta, 'scenario');
        if (!seeded) await seedScenario(deps, 'default', await resolveNow(deps));
      });
    },
    async handle(request) {
      if (!request.path.startsWith(API_PREFIX)) {
        return problem(404, 'NOT_FOUND', 'Unknown endpoint');
      }
      const path = request.path.slice(API_PREFIX.length) || '/';
      const match = matchRoute(ROUTES, request.method.toUpperCase(), path);
      if (!match || ('route' in match && match.route.demoOnly && !deps.config.demoMode)) {
        return problem(404, 'NOT_FOUND', 'Unknown endpoint');
      }
      if ('allowed' in match) {
        return {
          ...problem(405, 'METHOD_NOT_ALLOWED', 'Method not allowed'),
          headers: { 'content-type': 'application/problem+json', allow: match.allowed.join(', ') },
        };
      }
      const { route, params } = match;
      try {
        return await deps.store.transaction(async () => {
          const now = await resolveNow(deps);
          const user = await resolveUser(deps, request.sessionToken, now);
          const ctx = new Context(deps, now, user);
          if (route.auth === 'user') ctx.requireUser();
          if (route.auth === 'admin') ctx.requireAdmin();
          const result = await route.handler(ctx, {
            params,
            query: request.query,
            body: request.body,
            headers: request.headers,
            sessionToken: request.sessionToken,
          });
          const response = {
            status: result.status ?? 200,
            headers: { 'cache-control': 'no-store', ...result.headers },
          };
          if (result.body !== undefined) response.body = result.body;
          if (result.session !== undefined) response.session = result.session;
          return response;
        });
      } catch (error) {
        if (!(error instanceof ApiError))
          deps.log?.('request_failed', {
            route: route.path,
            error: error instanceof Error ? error.name : 'unknown',
          });
        return toProblem(error);
      }
    },
  };
}

/** Runs the retention plan outside HTTP (CLI `npm run privacy:purge`). */
export async function runPurge(deps) {
  return deps.store.transaction(async () => purge(new Context(deps, await resolveNow(deps), null)));
}
