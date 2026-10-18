import { describe, expect, it } from 'vitest';
import { directClient, FROZEN_NOW, loggedIn, makeDeps } from './harness.js';

const register = {
  firstName: 'Nina',
  lastName: 'New',
  email: 'Nina@Example.test',
  username: 'nina_new',
  password: 'secret123',
  confirm: 'secret123',
  terms: true,
  newsletter: true,
};

describe('API-AUTH authentication and accounts', () => {
  it('API-AUTH-01 registers, opens a session and records newsletter consent', async () => {
    const client = directClient();
    await client.init();
    const created = await client.request('POST', '/auth/register', register);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      user: { username: 'nina_new', role: 'customer', faultProfile: null },
    });
    expect(client.token).toMatch(/^[a-f0-9]{64}$/);
    const consents = await client.deps.store.list('consents');
    expect(consents.map((c) => c.kind)).toEqual(['newsletter']);
    const stored = await client.deps.store.get('users', 'nina_new');
    expect(stored?.passwordHash).toMatch(/^pbkdf2\$/);
    expect(stored?.passwordHash).not.toContain('secret123');
    expect(stored?.email).toBe('nina@example.test');
  });
  it('API-AUTH-02 rejects duplicates and weak passwords', async () => {
    const client = directClient();
    await client.init();
    const taken = await client.request('POST', '/auth/register', {
      ...register,
      username: 'Standard_User',
    });
    expect(taken.body).toMatchObject({ code: 'USERNAME_TAKEN' });
    const email = await client.request('POST', '/auth/register', {
      ...register,
      email: 'standard.user@example.test',
    });
    expect(email.body).toMatchObject({ code: 'EMAIL_TAKEN' });
    const weak = await client.request('POST', '/auth/register', {
      ...register,
      password: 'abcdefgh',
      confirm: 'abcdefgh',
    });
    expect(weak.status).toBe(400);
    const mismatch = await client.request('POST', '/auth/register', {
      ...register,
      confirm: 'other1234',
    });
    expect(mismatch.body).toMatchObject({ errors: [{ path: 'confirm', message: 'mismatch' }] });
    const terms = await client.request('POST', '/auth/register', { ...register, terms: false });
    expect(terms.status).toBe(400);
    const noNewsletter = await client.request('POST', '/auth/register', {
      ...register,
      newsletter: undefined,
      username: 'nina2',
      email: 'n2@example.test',
    });
    expect(noNewsletter.status).toBe(201);
  });
  it('API-AUTH-03 locks the account for 15 minutes after 5 failures', async () => {
    const client = directClient();
    await client.init();
    await client.request('POST', '/demo/clock', { now: FROZEN_NOW });
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await client.request('POST', '/auth/login', {
        username: 'premium_user',
        password: 'wrong',
      });
      expect(response.body).toMatchObject({ details: { remainingAttempts: 5 - attempt } });
    }
    const fifth = await client.request('POST', '/auth/login', {
      username: 'premium_user',
      password: 'wrong',
    });
    expect(fifth.body).toMatchObject({ details: { remainingAttempts: 0 } });
    const locked = await client.request('POST', '/auth/login', {
      username: 'premium_user',
      password: 'demo123',
    });
    expect(locked.status).toBe(423);
    await client.request('POST', '/demo/clock', { now: '2026-10-12T10:16:00+02:00' });
    const later = await client.request('POST', '/auth/login', {
      username: 'premium_user',
      password: 'demo123',
    });
    expect(later.status).toBe(200);
  });
  it('API-AUTH-04 unknown users, logout and expired sessions', async () => {
    const client = await loggedIn();
    expect(
      (await client.request('POST', '/auth/login', { username: 'ghost', password: 'x' })).status,
    ).toBe(401);
    const token = client.token;
    expect((await client.request('POST', '/auth/logout')).status).toBe(204);
    expect(client.token).toBeNull();
    expect((await client.request('GET', '/auth/me')).body).toEqual({ user: null });
    client.token = token;
    expect((await client.request('GET', '/orders')).status).toBe(401);
    client.token = 'not-a-token';
    expect((await client.request('GET', '/auth/me')).body).toEqual({ user: null });
    const again = await loggedIn();
    await again.request('POST', '/demo/clock', { now: '2026-10-13T10:00:00+02:00' });
    expect((await again.request('GET', '/auth/me')).body).toEqual({ user: null });
    expect((await again.request('POST', '/auth/logout')).status).toBe(204);
  });
});

describe('API-CAT catalog, reviews, alerts and wishlist', () => {
  it('API-CAT-01 filters and searches', async () => {
    const client = directClient();
    await client.init();
    const books = await client.request(
      'GET',
      '/products?category=Books&inStock=true&minRating=4.5&search=a&min=2000&max=4000',
    );
    expect(books.body.items.map((p) => p.id)).toEqual([18, 17]);
    expect((await client.request('GET', '/products?sort=bogus')).status).toBe(400);
    expect((await client.request('GET', '/products?perPage=100')).status).toBe(400);
  });
  it('API-CAT-02 product detail and inactive products', async () => {
    const admin = await loggedIn('admin_user', 'admin123');
    await admin.request('PATCH', '/admin/products/2', { active: false });
    expect((await admin.request('GET', '/products/2')).status).toBe(200);
    const visitor = directClient(admin.deps);
    expect((await visitor.request('GET', '/products/2')).body).toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
    });
    expect((await visitor.request('GET', '/products/999')).status).toBe(404);
    const detail = await visitor.request('GET', '/products/1');
    expect(detail.body).toMatchObject({
      product: { id: 1, effectivePrice: 7999, promotionPercent: 20, vatBp: 2000 },
      reviews: [],
      stockAlert: false,
    });
  });
  it('API-CAT-03 one review per customer and product', async () => {
    const client = await loggedIn();
    const posted = await client.request('POST', '/products/3/reviews', {
      rating: 5,
      comment: 'Great camera',
    });
    expect(posted).toMatchObject({
      status: 201,
      body: { author: 'standard_user', rating: 5, date: '2026-10-12' },
    });
    expect(
      (await client.request('POST', '/products/3/reviews', { rating: 4, comment: 'Again' })).body,
    ).toMatchObject({ code: 'ALREADY_REVIEWED' });
    expect(
      (await client.request('POST', '/products/3/reviews', { rating: 6, comment: 'Too much' }))
        .status,
    ).toBe(400);
    const detail = await client.request('GET', '/products/3');
    expect(detail.body).toMatchObject({
      product: { rating: 5, reviewCount: 1 },
      reviews: [{ author: 'standard_user', comment: 'Great camera' }],
    });
    const list = await client.request('GET', '/products?search=camera');
    expect(list.body).toMatchObject({ items: [{ id: 3, rating: 5 }] });
  });
  it('API-CAT-04 stock alerts need consent and a sold-out product', async () => {
    const client = await loggedIn();
    expect(
      (await client.request('POST', '/products/9/stock-alerts', { consent: false })).status,
    ).toBe(400);
    expect(
      (await client.request('POST', '/products/1/stock-alerts', { consent: true })).body,
    ).toMatchObject({ code: 'PRODUCT_IN_STOCK' });
    expect(
      (await client.request('POST', '/products/9/stock-alerts', { consent: true })).status,
    ).toBe(201);
    expect(
      (await client.request('POST', '/products/9/stock-alerts', { consent: true })).body,
    ).toMatchObject({ code: 'ALERT_EXISTS' });
    expect((await client.request('GET', '/products/9')).body).toMatchObject({ stockAlert: true });
    const admin = await loggedIn('admin_user', 'admin123', client.deps);
    await admin.request('PATCH', '/admin/products/9', { stock: 4 });
    const alerts = await client.deps.store.list('stockAlerts');
    expect(alerts.every((alert) => alert.notified)).toBe(true);
  });
  it('API-CAT-05 toggles the wishlist', async () => {
    const client = await loggedIn();
    expect((await client.request('POST', '/me/wishlist/4/toggle')).body).toEqual({
      productId: 4,
      saved: true,
    });
    expect((await client.request('POST', '/me/wishlist/7/toggle')).body).toEqual({
      productId: 7,
      saved: true,
    });
    expect((await client.request('POST', '/me/wishlist/7/toggle')).body).toEqual({
      productId: 7,
      saved: false,
    });
    const list = await client.request('GET', '/me/wishlist');
    expect(list.body.items.map((p) => p.id)).toEqual([4]);
    expect((await directClient(makeDeps()).request('GET', '/me/wishlist')).status).toBe(401);
  });
});
