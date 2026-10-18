import { describe, expect, it } from 'vitest';
import { address, directClient, loggedIn, placeOrder, quoteBody } from './harness.js';

describe('API-CHK quotes and orders', () => {
  it('API-CHK-01 anonymous quotes cannot redeem loyalty points', async () => {
    const client = directClient();
    await client.init();
    expect((await client.request('POST', '/quotes', quoteBody())).status).toBe(200);
    expect(
      (await client.request('POST', '/quotes', quoteBody({ loyaltyPointsToRedeem: 100 }))).body,
    ).toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(
      (await client.request('POST', '/quotes', quoteBody({ lines: [{ productId: 9, qty: 1 }] })))
        .body,
    ).toMatchObject({ status: 409, code: 'OUT_OF_STOCK' });
    expect(
      (await client.request('POST', '/quotes', quoteBody({ couponCode: 'OLD5' }))).body,
    ).toMatchObject({ status: 422, code: 'COUPON_EXPIRED' });
  });
  it('API-CHK-02 premium_user redeems loyalty points and gets them back on cancel', async () => {
    const client = await loggedIn('premium_user');
    const order = await placeOrder(client, quoteBody({ loyaltyPointsToRedeem: 200 }));
    expect(order.status).toBe(201);
    expect(order.body.totals.total).toBe(12979 - 1000);
    expect((await client.request('GET', '/me/loyalty')).body).toMatchObject({
      balance: 420,
      tier: 'silver',
    });
    const cancelled = await client.request('POST', `/orders/${order.body.id}/cancel`);
    expect(cancelled.body).toMatchObject({ status: 'Cancelled' });
    expect((await client.request('GET', '/me/loyalty')).body).toMatchObject({ balance: 620 });
    expect((await client.request('POST', `/orders/${order.body.id}/cancel`)).body).toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });
  it('API-CHK-03 rejects missing idempotency keys, foreign, used and expired quotes', async () => {
    const client = await loggedIn();
    const quote = (await client.request('POST', '/quotes', quoteBody())).body;
    const payload = {
      quoteId: quote.quoteId,
      payment: { method: 'pod' },
      shippingAddress: address,
    };
    expect((await client.request('POST', '/orders', payload)).body).toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
    expect(
      (
        await client.request(
          'POST',
          '/orders',
          { ...payload, quoteId: 'Q-unknown-1' },
          { 'Idempotency-Key': 'key-00000001' },
        )
      ).body,
    ).toMatchObject({ code: 'QUOTE_NOT_FOUND' });
    const pod = await client.request('POST', '/orders', payload, {
      'Idempotency-Key': 'key-00000002',
    });
    expect(pod.body).toMatchObject({ payment: { method: 'pod', last4: null } });
    expect(
      (await client.request('POST', '/orders', payload, { 'Idempotency-Key': 'key-00000003' }))
        .body,
    ).toMatchObject({ code: 'QUOTE_ALREADY_USED' });
    const premium = await loggedIn('premium_user', 'demo123', client.deps);
    const foreign = (await client.request('POST', '/quotes', quoteBody())).body;
    expect(
      (
        await premium.request(
          'POST',
          '/orders',
          { ...payload, quoteId: foreign.quoteId },
          { 'Idempotency-Key': 'key-00000004' },
        )
      ).body,
    ).toMatchObject({ code: 'QUOTE_NOT_FOUND' });
    const late = (await client.request('POST', '/quotes', quoteBody())).body;
    await client.request('POST', '/demo/clock', { now: '2026-10-12T10:15:00+02:00' });
    expect(
      (
        await client.request(
          'POST',
          '/orders',
          { ...payload, quoteId: late.quoteId },
          { 'Idempotency-Key': 'key-00000005' },
        )
      ).body,
    ).toMatchObject({ code: 'QUOTE_EXPIRED' });
  });
  it('API-CHK-04 detects price changes between quote and order', async () => {
    const client = await loggedIn();
    const quote = (await client.request('POST', '/quotes', quoteBody())).body;
    const admin = await loggedIn('admin_user', 'admin123', client.deps);
    await admin.request('PATCH', '/admin/products/17', { price: 2590 });
    const order = await client.request(
      'POST',
      '/orders',
      { quoteId: quote.quoteId, payment: { method: 'pod' }, shippingAddress: address },
      { 'Idempotency-Key': 'key-00000006' },
    );
    expect(order.body).toMatchObject({
      status: 409,
      code: 'PRICE_CHANGED',
      details: { previousTotal: 12979, total: 13179 },
    });
  });
  it('API-CHK-05 installments and payment outcomes', async () => {
    const client = await loggedIn();
    const three = await placeOrder(client, quoteBody(), { installments: 3 }, 'key-00000010');
    expect(three.body.installmentPlan?.map((i) => i.amount)).toEqual([4327, 4326, 4326]);
    const small = await placeOrder(
      client,
      quoteBody({ lines: [{ productId: 6, qty: 1 }] }),
      { installments: 4 },
      'key-00000011',
    );
    expect(small.body).toMatchObject({ code: 'INSTALLMENTS_NOT_AVAILABLE' });
    const pod = await placeOrder(
      client,
      quoteBody(),
      { installments: 3, payment: { method: 'pod' } },
      'key-00000012',
    );
    expect(pod.body).toMatchObject({ code: 'INSTALLMENTS_NOT_AVAILABLE' });
    for (const [card, code, status] of [
      ['4000000000000069', 'CARD_EXPIRED', 402],
      ['4000000000000119', 'PAYMENT_PROVIDER_ERROR', 502],
      ['1234', 'INVALID_CARD', 422],
      [undefined, 'INVALID_CARD', 422],
    ]) {
      const response = await placeOrder(
        client,
        quoteBody(),
        { payment: { method: 'card', card } },
        `key-card-${code}${String(status)}`,
      );
      expect(response).toMatchObject({ status, body: { code } });
    }
    const plan = await client.request('POST', '/installments/simulate', { total: 10001, count: 3 });
    expect(plan.body).toMatchObject({
      installments: [
        { amount: 3335, dueDate: '2026-10-12' },
        { amount: 3333, dueDate: '2026-11-12' },
        { amount: 3333 },
      ],
    });
    expect(
      (await client.request('POST', '/installments/simulate', { total: 500, count: 3 })).body,
    ).toMatchObject({ code: 'INSTALLMENTS_AMOUNT_OUT_OF_RANGE' });
  });
  it('API-ORD-01 invoice, returns and refunds with loyalty and stock effects', async () => {
    const client = await loggedIn();
    const placed = (await placeOrder(client)).body;
    const invoice = await client.request('GET', `/orders/${placed.id}/invoice`);
    expect(invoice.body).toMatchObject({
      seller: { name: expect.stringContaining('fictive') },
      issuedAt: '2026-10-12',
      order: { invoiceNumber: 'FA-2026-000001' },
    });
    const early = await client.request('POST', '/returns', {
      orderId: placed.id,
      lines: [{ productId: 1, qty: 1 }],
    });
    expect(early.body).toMatchObject({
      code: 'RETURN_NOT_ALLOWED',
      details: { reason: 'NOT_DELIVERED' },
    });
    const admin = await loggedIn('admin_user', 'admin123', client.deps);
    await admin.request('PATCH', `/admin/orders/${placed.id}/status`, { status: 'Shipped' });
    const delivered = await admin.request('PATCH', `/admin/orders/${placed.id}/status`, {
      status: 'Delivered',
    });
    expect(delivered.body).toMatchObject({ status: 'Delivered', deliveredAt: '2026-10-12' });
    expect((await client.request('GET', '/me/loyalty')).body).toMatchObject({ balance: 129 });
    const quote = await client.request('POST', '/returns/quote', {
      orderId: placed.id,
      lines: [{ productId: 17, qty: 1 }],
    });
    expect(quote.body).toMatchObject({ eligible: true, total: 2490, pointsToRevoke: 25 });
    const requested = await client.request('POST', '/returns', {
      orderId: placed.id,
      lines: [{ productId: 17, qty: 1 }],
      reason: 'Too many copies',
    });
    expect(requested).toMatchObject({
      status: 201,
      body: { status: 'ReturnRequested', return: { total: 2490, reason: 'Too many copies' } },
    });
    const stockBefore = (await client.request('GET', '/products/17')).body.product.stock;
    const refunded = await admin.request('PATCH', `/admin/orders/${placed.id}/status`, {
      status: 'Refunded',
    });
    expect(refunded.body).toMatchObject({ status: 'Refunded' });
    expect((await client.request('GET', '/products/17')).body.product.stock).toBe(stockBefore + 1);
    expect((await client.request('GET', '/me/loyalty')).body).toMatchObject({ balance: 104 });
    expect(
      (await admin.request('PATCH', '/admin/orders/ORD-NOPE/status', { status: 'Shipped' })).status,
    ).toBe(404);
  });
  it('API-ORD-02 refund requires a return request', async () => {
    const admin = await loggedIn('admin_user', 'admin123');
    await admin.request('POST', '/demo/reset', { scenario: 'order-history' });
    await admin.request('POST', '/auth/login', { username: 'admin_user', password: 'admin123' });
    const forged = await admin.deps.store.get('orders', 'ORD-HIST-0003');
    await admin.deps.store.put('orders', {
      ...forged,
      id: 'ORD-FORGED',
      status: 'ReturnRequested',
      return: null,
    });
    expect(
      (await admin.request('PATCH', '/admin/orders/ORD-FORGED/status', { status: 'Refunded' }))
        .body,
    ).toMatchObject({ code: 'NO_RETURN_REQUEST' });
  });
});
