import {
  DemoClockRequestSchema,
  DemoIdsRequestSchema,
  DemoResetRequestSchema,
} from '../schemas.js';
import { DEFAULT_RULES, ENGINE_VERSION } from '../../engine/index.js';
import { ok, parse } from '../router.js';
import { seedScenario } from '../seed.js';
import { C } from '../types.js';

export const systemRoutes = [
  {
    method: 'GET',
    path: '/health',
    auth: 'public',
    tag: 'system',
    summary: 'Liveness probe',
    handler: () => Promise.resolve(ok({ status: 'ok' })),
  },
  {
    method: 'GET',
    path: '/meta',
    auth: 'public',
    tag: 'system',
    summary: 'Execution context for testers (mode, clock, scenario, versions)',
    response: 'MetaSchema',
    async handler(ctx) {
      const clock = await ctx.store.get(C.meta, 'clock');
      const scenario = await ctx.store.get(C.meta, 'scenario');
      const ids = await ctx.store.get(C.meta, 'ids');
      return ok({
        demoMode: ctx.deps.config.demoMode,
        faultsEnabled: ctx.deps.config.faultsEnabled,
        engineVersion: ENGINE_VERSION,
        rulesVersion: DEFAULT_RULES.version,
        now: ctx.now.toISOString(),
        clockFrozen: Boolean(clock?.frozenAt),
        scenario: scenario?.name ?? 'default',
        deterministicIds: typeof ids?.seed === 'number',
      });
    },
  },
  {
    method: 'POST',
    path: '/demo/reset',
    auth: 'public',
    demoOnly: true,
    tag: 'demo',
    summary: 'Reset all data to a named scenario (keeps the clock setting)',
    request: 'DemoResetRequestSchema',
    async handler(ctx, { body }) {
      const input = parse(DemoResetRequestSchema, body ?? {});
      const clock = await ctx.store.get(C.meta, 'clock');
      const ids = await ctx.store.get(C.meta, 'ids');
      await seedScenario(ctx.deps, input.scenario, ctx.now);
      if (clock) await ctx.store.put(C.meta, clock);
      if (ids) await ctx.store.put(C.meta, { ...ids, counter: 0 });
      return { status: 200, body: { scenario: input.scenario }, session: null };
    },
  },
  {
    method: 'POST',
    path: '/demo/clock',
    auth: 'public',
    demoOnly: true,
    tag: 'demo',
    summary: 'Freeze the clock at a given instant',
    request: 'DemoClockRequestSchema',
    async handler(ctx, { body }) {
      const input = parse(DemoClockRequestSchema, body);
      const frozenAt = new Date(input.now).toISOString();
      await ctx.store.put(C.meta, { id: 'clock', frozenAt });
      return ok({ now: frozenAt, clockFrozen: true });
    },
  },
  {
    method: 'DELETE',
    path: '/demo/clock',
    auth: 'public',
    demoOnly: true,
    tag: 'demo',
    summary: 'Back to real time',
    async handler(ctx) {
      await ctx.store.delete(C.meta, 'clock');
      return ok({ now: ctx.deps.realNow().toISOString(), clockFrozen: false });
    },
  },
  {
    method: 'POST',
    path: '/demo/ids',
    auth: 'public',
    demoOnly: true,
    tag: 'demo',
    summary: 'Deterministic identifiers (seed) or random ones (null)',
    request: 'DemoIdsRequestSchema',
    async handler(ctx, { body }) {
      const input = parse(DemoIdsRequestSchema, body);
      const seed = typeof input.seed === 'number' ? input.seed : null;
      await ctx.store.put(C.meta, { id: 'ids', seed, counter: 0 });
      return ok({ deterministicIds: seed !== null });
    },
  },
];
