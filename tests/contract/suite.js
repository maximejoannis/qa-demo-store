import {
  KpisSchema,
  MetaSchema,
  MeResponseSchema,
  OrderListSchema,
  OrderSchema,
  ProblemSchema,
  ProductPageSchema,
  QuoteResponseSchema,
  ReturnQuoteSchema,
} from './shapes.js';
import { beforeAll, describe, expect, it } from 'vitest';

const FROZEN = '2026-10-12T10:00:00+02:00';

const body = (response) => response.body;

/**
 * PARITY: the same contract scenarios run against every adapter (in-process, in-page
 * fetcher, Node HTTP API). Same clock, same seed => same answers.
 */
export function paritySuite(label, setup) {
  describe(`PARITY ${label}`, () => {
    let client;
    let other;
    beforeAll(async () => {
      const makeClient = await setup();
      client = makeClient();
      await client.init();
      await client.request('POST', '/demo/clock', { now: FROZEN });
      await client.request('POST', '/demo/reset', { scenario: 'default' });
      other = makeClient();
    });
    it('PARITY-01 health and meta', async () => {
      const health = await client.request('GET', '/health');
      expect(health).toMatchObject({ status: 200, body: { status: 'ok' } });
      const meta = await client.request('GET', '/meta');
      expect(MetaSchema.parse(meta.body)).toMatchObject({
        demoMode: true,
        clockFrozen: true,
        now: '2026-10-12T08:00:00.000Z',
        scenario: 'default',
      });
    });
    it('PARITY-02 catalog page', async () => {
      const page = await client.request('GET', '/products?sort=price-asc&perPage=4&page=2');
      const parsed = ProductPageSchema.parse(page.body);
      expect(parsed).toMatchObject({ page: 2, totalPages: 5, total: 18 });
      expect(parsed.items.map((p) => p.id)).toEqual([9, 5, 18, 4]);
      expect(parsed.categories).toEqual([
        'Accessories',
        'Books',
        'Electronics',
        'Gaming',
        'Home',
        'Office',
        'Outdoor',
      ]);
    });
    it('PARITY-03 authentication', async () => {
      const bad = await client.request('POST', '/auth/login', {
        username: 'standard_user',
        password: 'nope',
      });
      expect(bad.status).toBe(401);
      expect(ProblemSchema.parse(bad.body).code).toBe('INVALID_CREDENTIALS');
      expect(bad.headers['content-type']).toContain('application/problem+json');
      const locked = await client.request('POST', '/auth/login', {
        username: 'locked_user',
        password: 'demo123',
      });
      expect(body(locked).code).toBe('ACCOUNT_LOCKED');
      const ok = await client.request('POST', '/auth/login', {
        username: 'standard_user',
        password: 'demo123',
      });
      expect(ok.status).toBe(200);
      const me = await client.request('GET', '/auth/me');
      expect(MeResponseSchema.parse(me.body).user?.username).toBe('standard_user');
    });
    it('PARITY-04 quote EX-01 (mixed VAT rates)', async () => {
      const quote = await client.request('POST', '/quotes', {
        lines: [
          { productId: 17, qty: 2 },
          { productId: 1, qty: 1 },
        ],
        shippingMethod: 'standard',
        destination: { country: 'FR' },
      });
      const parsed = QuoteResponseSchema.parse(quote.body);
      expect(parsed).toMatchObject({
        merchandise: 12979,
        total: 12979,
        totalHt: 11386,
        totalVat: 1593,
      });
      expect(parsed.vat).toEqual([
        { rateBp: 2000, ttc: 7999, ht: 6666, vat: 1333 },
        { rateBp: 550, ttc: 4980, ht: 4720, vat: 260 },
      ]);
      expect(parsed.delivery).toEqual({ from: '2026-10-15', to: '2026-10-19' });
    });
    it('PARITY-05 order, idempotent replay and ownership', async () => {
      const quote = body(
        await client.request('POST', '/quotes', {
          lines: [{ productId: 4, qty: 1 }],
          shippingMethod: 'express',
          destination: { country: 'FR' },
        }),
      );
      const payload = {
        quoteId: quote.quoteId,
        payment: { method: 'card', card: '4242424242424242' },
        shippingAddress: {
          firstName: 'Ada',
          lastName: 'Standard',
          address: '10 rue des Tests',
          city: 'Lyon',
          zip: '69001',
          country: 'FR',
        },
      };
      const first = await client.request('POST', '/orders', payload, {
        'Idempotency-Key': 'parity-order-0001',
      });
      expect(first.status).toBe(201);
      const order = OrderSchema.parse(first.body);
      expect(order).toMatchObject({
        status: 'Processing',
        invoiceNumber: 'FA-2026-000001',
        payment: { last4: '4242' },
      });
      expect(order.totals.total).toBe(3499 + 1290);
      const replay = await client.request('POST', '/orders', payload, {
        'Idempotency-Key': 'parity-order-0001',
      });
      expect(replay.status).toBe(200);
      expect(body(replay).id).toBe(order.id);
      const list = OrderListSchema.parse((await client.request('GET', '/orders')).body);
      expect(list.items.map((o) => o.id)).toContain(order.id);
      await other.init();
      await other.request('POST', '/auth/login', { username: 'premium_user', password: 'demo123' });
      const foreign = await other.request('GET', `/orders/${order.id}`);
      expect(foreign.status).toBe(404);
    });
    it('PARITY-06 declined card and validation errors', async () => {
      const quote = body(
        await client.request('POST', '/quotes', {
          lines: [{ productId: 6, qty: 1 }],
          shippingMethod: 'standard',
          destination: { country: 'FR' },
        }),
      );
      const declined = await client.request(
        'POST',
        '/orders',
        {
          quoteId: quote.quoteId,
          payment: { method: 'card', card: '4000000000000002' },
          shippingAddress: {
            firstName: 'A',
            lastName: 'B',
            address: '1 rue X',
            city: 'Paris',
            zip: '75001',
            country: 'FR',
          },
        },
        { 'Idempotency-Key': 'parity-order-0002' },
      );
      expect(declined.status).toBe(402);
      expect(body(declined).code).toBe('CARD_DECLINED');
      const invalid = await client.request('POST', '/quotes', {
        lines: [],
        shippingMethod: 'standard',
        destination: { country: 'FR' },
        price: 1,
      });
      expect(invalid.status).toBe(400);
      expect(ProblemSchema.parse(invalid.body).errors?.length).toBeGreaterThan(0);
    });
    it('PARITY-07 withdrawal on day 13 vs day 15', async () => {
      await client.request('POST', '/demo/reset', { scenario: 'order-history' });
      await client.request('POST', '/auth/login', {
        username: 'standard_user',
        password: 'demo123',
      });
      const lines = [{ productId: 1, qty: 1 }];
      const day13 = ReturnQuoteSchema.parse(
        (await client.request('POST', '/returns/quote', { orderId: 'ORD-HIST-0003', lines })).body,
      );
      expect(day13).toMatchObject({ eligible: true, deadline: '2026-10-13' });
      const day15 = ReturnQuoteSchema.parse(
        (await client.request('POST', '/returns/quote', { orderId: 'ORD-HIST-0002', lines })).body,
      );
      expect(day15).toMatchObject({ eligible: false, reason: 'DEADLINE_PASSED' });
    });
    it('PARITY-08 admin authorization and KPIs', async () => {
      const forbidden = await client.request('GET', '/admin/kpis?from=2026-09-01&to=2026-10-31');
      expect(forbidden.status).toBe(403);
      await client.request('POST', '/auth/login', { username: 'admin_user', password: 'admin123' });
      const kpis = KpisSchema.parse(
        (await client.request('GET', '/admin/kpis?from=2026-09-01&to=2026-10-31')).body,
      );
      expect(kpis.orders).toBe(6);
      expect(kpis.cancellationRateBp).toBe(1667);
    });
    it('PARITY-09 unknown route and method', async () => {
      expect((await client.request('GET', '/nope')).status).toBe(404);
      expect((await client.request('DELETE', '/health')).status).toBe(405);
    });
  });
}
