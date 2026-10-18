import { describe, expect, it } from 'vitest';
import { faultActive, FAULTS } from '../../src/backend/index.js';
import { loggedIn, makeDeps, placeOrder, quoteBody } from './harness.js';

describe('FAULT deliberate defects are scoped to their account', () => {
  it('FAULT-00 registry and global switch', () => {
    expect(FAULTS.map((fault) => fault.id)).toContain('FAULT-RND-02');
    expect(faultActive('FAULT-PRB-01', { faultProfile: 'problem' }, { faultsEnabled: true })).toBe(
      true,
    );
    expect(faultActive('FAULT-PRB-01', { faultProfile: 'problem' }, { faultsEnabled: false })).toBe(
      false,
    );
    expect(faultActive('FAULT-PRB-01', { faultProfile: 'glitch' }, { faultsEnabled: true })).toBe(
      false,
    );
    expect(faultActive('FAULT-PRB-01', null, { faultsEnabled: true })).toBe(false);
    expect(faultActive('FAULT-UNKNOWN', { faultProfile: 'problem' }, { faultsEnabled: true })).toBe(
      false,
    );
  });
  it('FAULT-PRB-01 FAULT-PRB-02 problem_user gets an inverted price sort and swapped images', async () => {
    const problem = await loggedIn('problem_user');
    const standard = await loggedIn('standard_user', 'demo123', problem.deps);
    const faulty = (await problem.request('GET', '/products?sort=price-asc&perPage=48')).body;
    const correct = (await standard.request('GET', '/products?sort=price-asc&perPage=48')).body;
    expect(faulty.items.map((p) => p.id)).toEqual([...correct.items.map((p) => p.id)].reverse());
    expect(faulty.items.find((p) => p.id === 2)?.image).toBe('products/product-5.svg');
    expect(correct.items.find((p) => p.id === 2)?.image).toBe('products/product-2.svg');
    expect((await problem.request('GET', '/products/5')).body.product.image).toBe(
      'products/product-2.svg',
    );
    expect((await problem.request('GET', '/me')).status).toBe(405);
  });
  it('FAULT-GLT-01 FAULT-GLT-02 glitch_user is slow and can double order', async () => {
    const delays = [];
    const deps = makeDeps(
      {},
      {
        sleep: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
      },
    );
    const glitch = await loggedIn('glitch_user', 'demo123', deps);
    expect(delays).toEqual([3000]);
    await glitch.request('POST', '/quotes', quoteBody());
    expect(delays).toEqual([3000, 3000]);
    const first = (await placeOrder(glitch, quoteBody(), {}, 'same-key-0001')).body;
    const second = (await placeOrder(glitch, quoteBody(), {}, 'same-key-0001')).body;
    expect(second.id).not.toBe(first.id);
    const standard = await loggedIn('standard_user', 'demo123', deps);
    const a = (await placeOrder(standard, quoteBody(), {}, 'same-key-0002')).body;
    const b = (await placeOrder(standard, quoteBody(), {}, 'same-key-0002')).body;
    expect(b.id).toBe(a.id);
    expect(delays).toHaveLength(4);
  });
  it('FAULT-ERR-01 error_user always gets a generic 500 when ordering', async () => {
    const client = await loggedIn('error_user');
    const response = await placeOrder(client);
    expect(response).toMatchObject({ status: 500, body: { code: 'ERROR', title: 'Error' } });
  });
  it('FAULT-RND-01 FAULT-RND-02 rounding_user gets inconsistent amounts', async () => {
    const rounding = await loggedIn('rounding_user');
    const standard = await loggedIn('standard_user', 'demo123', rounding.deps);
    const body = quoteBody({ couponCode: 'WELCOME10' });
    const faulty = (await rounding.request('POST', '/quotes', body)).body;
    const correct = (await standard.request('POST', '/quotes', body)).body;
    expect(correct.coupon?.discount).toBe(1298);
    expect(faulty.coupon?.discount).toBe(1297);
    expect(faulty.total).toBe(correct.total + 1);
    expect(faulty.totalHt + faulty.totalVat).toBe(faulty.total);
    expect(faulty.totalVat).not.toBe(correct.totalVat);
    const single = quoteBody({ lines: [{ productId: 1, qty: 1 }] });
    expect((await rounding.request('POST', '/quotes', single)).body).toMatchObject({
      total: 7999,
      totalVat: 1333,
    });
    const order = await placeOrder(rounding, body);
    expect(order.status).toBe(201);
  });
  it('FAULT-WEB profiles are exposed to the UI only when faults are enabled', async () => {
    const enabled = await loggedIn('a11y_user');
    expect((await enabled.request('GET', '/auth/me')).body).toMatchObject({
      user: { faultProfile: 'a11y' },
    });
    const disabled = await loggedIn('a11y_user', 'demo123', makeDeps({ faultsEnabled: false }));
    expect((await disabled.request('GET', '/auth/me')).body).toMatchObject({
      user: { faultProfile: null },
    });
  });
});
