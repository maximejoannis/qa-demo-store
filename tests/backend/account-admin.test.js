import { describe, expect, it } from 'vitest';
import { directClient, loggedIn, makeDeps, placeOrder, quoteBody } from './harness.js';

describe('API-ACC profile, loyalty and privacy rights', () => {
  it('API-ACC-01 reads and rectifies the profile', async () => {
    const client = await loggedIn();
    expect((await client.request('GET', '/me/profile')).body).toMatchObject({
      firstName: 'Ada',
      city: 'Lyon',
      newsletter: false,
    });
    const updated = await client.request('PUT', '/me/profile', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ADA@example.test',
      phone: '+33 6 00 00 00 00',
      address: '',
      city: '',
      zip: '',
      country: '',
    });
    expect(updated.body).toMatchObject({
      lastName: 'Lovelace',
      email: 'ada@example.test',
      address: '',
    });
    const partial = await client.request('PUT', '/me/profile', {
      firstName: 'Ada',
      lastName: 'L',
      email: 'ada@example.test',
      address: '1 rue X',
    });
    expect(partial.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ path: 'address', message: 'incomplete-address' }],
    });
    const badZip = await client.request('PUT', '/me/profile', {
      firstName: 'Ada',
      lastName: 'L',
      email: 'ada@example.test',
      address: '1 rue X',
      city: 'Paris',
      zip: '$$',
      country: 'France',
    });
    expect(badZip.body.errors.map((e) => e.path)).toEqual(['zip', 'country']);
    const taken = await client.request('PUT', '/me/profile', {
      firstName: 'Ada',
      lastName: 'L',
      email: 'premium.user@example.test',
    });
    expect(taken.body).toMatchObject({ code: 'EMAIL_TAKEN' });
    const full = await client.request('PUT', '/me/profile', {
      firstName: 'Ada',
      lastName: 'L',
      email: 'ada@example.test',
      address: '1 rue X',
      city: 'Paris',
      zip: '75001',
      country: 'fr',
    });
    expect(full.body).toMatchObject({ country: 'FR', phone: '' });
  });
  it('API-ACC-02 manages newsletter consent and visitor cookie proofs', async () => {
    const client = await loggedIn();
    expect((await client.request('GET', '/me/consents')).body).toEqual({ newsletter: false });
    expect((await client.request('PUT', '/me/consents', { newsletter: true })).body).toEqual({
      newsletter: true,
    });
    const visitor = await client.request('POST', '/consents', {
      visitorId: '0123456789abcdef0123',
      choices: { analytics: false, personalization: true },
      policyVersion: '2026-10',
    });
    expect(visitor).toMatchObject({ status: 201, body: { policyVersion: '2026-10' } });
    expect(
      (
        await client.request('POST', '/consents', {
          visitorId: 'x',
          choices: {},
          policyVersion: '1',
        })
      ).status,
    ).toBe(400);
  });
  it('API-ACC-03 exports every personal data item', async () => {
    const client = await loggedIn();
    await placeOrder(client);
    await client.request('POST', '/products/3/reviews', { rating: 4, comment: 'Nice one' });
    await client.request('POST', '/me/wishlist/2/toggle');
    await client.request('POST', '/products/9/stock-alerts', { consent: true });
    await client.request('PUT', '/me/consents', { newsletter: true });
    const exported = await client.request('GET', '/me/export');
    expect(exported.body).toMatchObject({
      format: 'qa-demo-store/export@1',
      account: { username: 'standard_user', email: 'standard.user@example.test' },
      orders: [{ invoiceNumber: 'FA-2026-000001' }],
      reviews: [{ productId: 3, rating: 4 }],
      wishlist: [2],
      stockAlerts: [{ productId: 9, notified: false }],
      consents: [{ kind: 'newsletter', choices: { newsletter: true } }],
      loyalty: { balance: 0, tier: 'bronze' },
    });
    expect(JSON.stringify(exported.body)).not.toContain('pbkdf2');
  });
  it('API-ACC-04 erases the account but keeps anonymized invoices', async () => {
    const client = await loggedIn();
    const order = (await placeOrder(client)).body;
    await client.request('POST', '/products/3/reviews', { rating: 4, comment: 'Nice one' });
    await client.request('POST', '/products/9/stock-alerts', { consent: true });
    await client.request('POST', '/me/wishlist/2/toggle');
    expect((await client.request('DELETE', '/me', { password: 'bad' })).body).toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect((await client.request('DELETE', '/me', { password: 'demo123' })).status).toBe(204);
    expect(client.token).toBeNull();
    const { store } = client.deps;
    expect(await store.get('users', 'standard_user')).toBeNull();
    expect(await store.get('wishlists', 'standard_user')).toBeNull();
    expect(await store.list('stockAlerts')).toEqual([]);
    const kept = await store.get('orders', order.id);
    expect(kept).toMatchObject({
      userId: null,
      username: expect.stringMatching(/^deleted-[a-f0-9]{8}$/),
      shippingAddress: { city: 'Lyon' },
    });
    expect((await store.list('reviews'))[0]?.author).toBe('Former customer');
    expect(
      (
        await client.request('POST', '/auth/login', {
          username: 'standard_user',
          password: 'demo123',
        })
      ).status,
    ).toBe(401);
  });
});

describe('API-ADM administration', () => {
  it('API-ADM-01 lists and edits products', async () => {
    const admin = await loggedIn('admin_user', 'admin123');
    expect((await admin.request('GET', '/admin/products')).body.items).toHaveLength(18);
    expect((await admin.request('PATCH', '/admin/products/1', {})).status).toBe(400);
    expect((await admin.request('PATCH', '/admin/products/1', { price: 0 })).status).toBe(400);
    expect(
      (await admin.request('PATCH', '/admin/products/1', { price: 6999, stock: 3 })).body,
    ).toMatchObject({ price: 6999, stock: 3, stockLevel: 'low' });
    expect((await admin.request('PATCH', '/admin/products/77', { stock: 3 })).status).toBe(404);
    const customer = await loggedIn('standard_user', 'demo123', admin.deps);
    expect((await customer.request('GET', '/admin/products')).status).toBe(403);
    expect((await directClient(admin.deps).request('GET', '/admin/products')).status).toBe(401);
  });
  it('API-ADM-02 lists orders, enforces the state machine and validates periods', async () => {
    const admin = await loggedIn('admin_user', 'admin123');
    await admin.request('POST', '/demo/reset', { scenario: 'order-history' });
    await admin.request('POST', '/auth/login', { username: 'admin_user', password: 'admin123' });
    const orders = (await admin.request('GET', '/admin/orders')).body;
    expect(orders.items.map((o) => o.id)).toEqual([
      'ORD-HIST-0006',
      'ORD-HIST-0005',
      'ORD-HIST-0004',
      'ORD-HIST-0003',
      'ORD-HIST-0002',
      'ORD-HIST-0001',
    ]);
    expect(
      (await admin.request('PATCH', '/admin/orders/ORD-HIST-0004/status', { status: 'Shipped' }))
        .body,
    ).toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
    expect(
      (await admin.request('GET', '/admin/kpis?from=2026-10-31&to=2026-10-01')).body,
    ).toMatchObject({ code: 'INVALID_PERIOD' });
    expect((await admin.request('GET', '/admin/kpis?from=nope&to=2026-10-01')).status).toBe(400);
  });
  it('API-ADM-03 suggests restocking', async () => {
    const admin = await loggedIn('admin_user', 'admin123');
    await admin.request('POST', '/demo/reset', { scenario: 'low-stock' });
    await admin.request('POST', '/auth/login', { username: 'admin_user', password: 'admin123' });
    const reorder = (await admin.request('GET', '/admin/inventory/reorder')).body;
    expect(reorder.items.map((item) => item.productId)).toEqual([4, 8, 12, 16]);
    expect(reorder.items[0]?.suggestedQty).toBe(5);
  });
  it('API-ADM-04 purge applies retention rules and is idempotent', async () => {
    const admin = await loggedIn('admin_user', 'admin123');
    await admin.request('POST', '/demo/reset', { scenario: 'rgpd-expired' });
    await admin.request('POST', '/auth/login', { username: 'admin_user', password: 'admin123' });
    await admin.request('POST', '/demo/clock', { now: '2026-10-12T10:20:00+02:00' });
    const expiredQuote = await admin.request('POST', '/quotes', quoteBody());
    expect(expiredQuote.status).toBe(200);
    await admin.request('POST', '/demo/clock', { now: '2026-10-12T11:00:00+02:00' });
    const first = await admin.request('POST', '/admin/privacy/purge');
    expect(first.body).toMatchObject({
      accountsAnonymized: 1,
      ordersDeleted: 1,
      consentProofsDeleted: 1,
      logsDeleted: 1,
      stockAlertsDeleted: 1,
      expiredQuotesDeleted: 1,
    });
    expect(await admin.deps.store.get('users', 'dormant_user')).toBeNull();
    const second = await admin.request('POST', '/admin/privacy/purge');
    expect(second.body).toMatchObject({
      accountsAnonymized: 0,
      ordersDeleted: 0,
      consentProofsDeleted: 0,
      stockAlertsDeleted: 0,
      expiredQuotesDeleted: 0,
    });
    await admin.request('POST', '/demo/clock', { now: '2026-10-13T11:00:00+02:00' });
    expect(
      (
        await directClient(admin.deps).request('POST', '/auth/login', {
          username: 'admin_user',
          password: 'admin123',
        })
      ).status,
    ).toBe(200);
  });
  it('API-ADM-05 expired sessions are purged', async () => {
    const admin = await loggedIn('admin_user', 'admin123');
    const other = await loggedIn('standard_user', 'demo123', admin.deps);
    expect(other.token).not.toBeNull();
    await admin.request('POST', '/demo/clock', { now: '2026-10-12T17:30:00+02:00' });
    const result = await admin.request('POST', '/admin/privacy/purge');
    expect(result.body).toMatchObject({ expiredSessionsDeleted: 0 });
    await admin.request('POST', '/demo/clock', { now: '2026-10-12T19:00:00+02:00' });
    expect((await admin.request('POST', '/admin/privacy/purge')).status).toBe(401);
    await admin.request('POST', '/auth/login', { username: 'admin_user', password: 'admin123' });
    expect((await admin.request('POST', '/admin/privacy/purge')).body).toMatchObject({
      expiredSessionsDeleted: 2,
    });
  });
});

describe('API-SYS demo endpoints and meta', () => {
  it('API-SYS-01 demo routes are hidden outside demo mode and the real clock is used', async () => {
    const deps = makeDeps({ demoMode: false }, { realNow: () => new Date('2026-10-20T08:00:00Z') });
    const client = directClient(deps);
    await client.init();
    expect((await client.request('POST', '/demo/reset', {})).status).toBe(404);
    expect((await client.request('GET', '/meta')).body).toMatchObject({
      demoMode: false,
      now: '2026-10-20T08:00:00.000Z',
      clockFrozen: false,
    });
  });
  it('API-SYS-02 clock, deterministic ids and scenarios', async () => {
    const client = directClient();
    await client.init();
    expect(
      (await client.request('POST', '/demo/clock', { now: '2026-12-31T23:59:30+01:00' })).body,
    ).toEqual({ now: '2026-12-31T22:59:30.000Z', clockFrozen: true });
    expect((await client.request('POST', '/demo/ids', { seed: 42 })).body).toEqual({
      deterministicIds: true,
    });
    expect(
      (await client.request('POST', '/demo/reset', { scenario: 'empty-catalog' })).body,
    ).toEqual({ scenario: 'empty-catalog' });
    expect((await client.request('GET', '/meta')).body).toMatchObject({
      scenario: 'empty-catalog',
      clockFrozen: true,
      deterministicIds: true,
    });
    expect((await client.request('GET', '/products')).body).toMatchObject({
      total: 0,
      items: [],
      categories: [],
    });
    await client.request('POST', '/demo/reset', {});
    await client.request('POST', '/auth/login', { username: 'standard_user', password: 'demo123' });
    const order = await placeOrder(client);
    expect(order.body).toMatchObject({ id: 'ORD-16-000002' });
    expect((await client.request('POST', '/demo/ids', { seed: null })).body).toEqual({
      deterministicIds: false,
    });
    expect((await client.request('DELETE', '/demo/clock')).body).toMatchObject({
      clockFrozen: false,
    });
    expect((await client.request('POST', '/demo/clock', { now: 'tomorrow' })).status).toBe(400);
  });
  it('API-SYS-04 reset without body nor previous settings', async () => {
    const client = directClient();
    await client.init();
    expect((await client.request('POST', '/demo/reset')).body).toEqual({ scenario: 'default' });
    await client.deps.store.delete('meta', 'scenario');
    expect((await client.request('GET', '/meta')).body).toMatchObject({
      scenario: 'default',
      clockFrozen: false,
      deterministicIds: false,
    });
  });
  it('API-SYS-03 loyalty-gold scenario', async () => {
    const client = directClient();
    await client.init();
    await client.request('POST', '/demo/clock', { now: '2026-10-12T10:00:00+02:00' });
    await client.request('POST', '/demo/reset', { scenario: 'loyalty-gold' });
    await client.request('POST', '/auth/login', { username: 'standard_user', password: 'demo123' });
    expect((await client.request('GET', '/me/loyalty')).body).toMatchObject({
      balance: 1600,
      tier: 'gold',
      next: null,
    });
  });
});
