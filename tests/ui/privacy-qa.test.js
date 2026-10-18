import { describe, expect, it } from 'vitest';
import { memoryStorage, startApp } from './harness.js';

describe('WEB-RGPD consent banner', () => {
  it('WEB-RGPD-01 reject is as easy as accept and stores a proof', async () => {
    const h = await startApp();
    const reject = h.$('consent-reject-all');
    const accept = h.$('consent-accept-all');
    expect(reject.className).toBe(accept.className);
    await h.click('consent-reject-all');
    expect(h.maybe('consent-banner')).toBeNull();
    expect(JSON.parse(h.storage.getItem('qads:consent') ?? '{}')).toMatchObject({
      analytics: false,
      personalization: false,
      date: '2026-10-12',
      version: '2026-10',
    });
    const proofs = await h.store.list('consents');
    expect(proofs).toHaveLength(1);
    expect(proofs[0]?.subject).toMatch(/^visitor-/);
    await h.go('#/products/3');
    await h.go('#/products');
    expect(h.maybe('recently-viewed')).toBeNull();
  });
  it('WEB-RGPD-02 personalisation enables recently viewed products; withdrawal clears them', async () => {
    const h = await startApp();
    await h.click('consent-customize');
    h.check('[name="personalization"]');
    await h.submit('[data-form="consent"]');
    expect(h.message()).toBe('Vos choix ont été enregistrés.');
    await h.go('#/products/3');
    await h.go('#/products/18');
    await h.go('#/products');
    expect(h.text('recently-viewed')).toContain('Automation Patterns');
    await h.click('consent-manage');
    expect(h.maybe('consent-banner')).not.toBeNull();
    await h.click('consent-accept-all');
    await h.click('consent-manage');
    await h.click('consent-reject-all');
    expect(h.storage.getItem('qads:recent')).toBeNull();
  });
  it('WEB-RGPD-03 the choice expires after 6 months', async () => {
    const storage = memoryStorage({
      'qads:consent': JSON.stringify({
        analytics: true,
        personalization: true,
        date: '2026-03-01',
        version: '2026-10',
      }),
    });
    const h = await startApp({ storage });
    expect(h.maybe('consent-banner')).not.toBeNull();
    expect(storage.getItem('qads:consent')).toBeNull();
    const fresh = await startApp({
      storage: memoryStorage({
        'qads:consent': JSON.stringify({
          analytics: false,
          personalization: false,
          date: '2026-10-01',
          version: '2026-10',
        }),
      }),
    });
    expect(fresh.maybe('consent-banner')).toBeNull();
  });
});

describe('WEB-QA testability tools', () => {
  it('WEB-QA-01 URL parameters: qa toolbar, frozen clock, deterministic ids, language', async () => {
    const h = await startApp({ search: '?qa=1&now=2026-12-31T23:59:30%2B01:00&seed=42&lang=en' });
    expect(document.documentElement.lang).toBe('en');
    expect(h.text('qa-info')).toContain('2026-12-31T22:59:30.000Z');
    expect(h.text('qa-info')).toContain('frozen');
    expect(h.text('qa-info')).toContain('in-page');
    await h.login();
    await h.go('#/products/4');
    await h.submit('[data-form="detailCart"]');
    await h.go('#/cart');
    await h.click('checkout-link');
    await h.go('#/checkout');
    await h.submit('[data-form="checkoutStep"]');
    await h.submit('[data-form="checkoutStep"]');
    await h.change('[data-testid="payment-method"]', 'pod');
    await h.submit('[data-form="checkoutStep"]');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.text('order-number')).toMatch(/^ORD-16-\d{6}$/);
    const off = await startApp({ search: '?seed=off' });
    expect(off.app.state.meta?.deterministicIds).toBe(false);
  });
  it('WEB-QA-02 toolbar: scenario, clock and network failures', async () => {
    const h = await startApp({ search: '?qa=1' });
    await h.change('[data-testid="qa-scenario"]', 'empty-catalog');
    await h.submit('[data-form="qaReset"]');
    expect(h.message()).toContain('empty-catalog');
    expect(h.$('view').dataset.state).toBe('empty');
    h.fill('[data-testid="qa-clock"]', '2027-01-01T09:00:00+01:00');
    await h.submit('[data-form="qaClock"]');
    expect(h.text('qa-info')).toContain('2027-01-01T08:00:00.000Z');
    h.fill('[data-testid="qa-clock"]', 'not-a-date');
    await h.submit('[data-form="qaClock"]');
    expect(h.message()).toContain('invalides');
    await h.click('qa-clock-real');
    expect(h.text('qa-info')).not.toContain('figée');
    h.fill('[data-testid="qa-fail"]', 'products:503, bad, quotes:200');
    h.fill('[data-testid="qa-latency"]', '5');
    await h.submit('[data-form="qaNetwork"]');
    expect(h.api.injection).toEqual({ latency: 5, fail: { products: 503 } });
    await h.go('#/products');
    expect(h.$('view').dataset.state).toBe('error');
    expect(h.message()).toBe("Panne simulée par la barre d'outils QA.");
    h.api.injection.fail = {};
    await h.click('reset-demo');
    expect(h.message()).toContain('Données de démo réinitialisées');
  });
  it('WEB-QA-03 network errors become a clear error state', async () => {
    const h = await startApp();
    h.api.injection.fail = { products: 0 };
    h.api.options.fetcher = () => Promise.reject(new TypeError('offline'));
    await h.go('#/products');
    expect(h.$('view').dataset.state).toBe('error');
    expect(h.message()).toContain('Le back-end ne répond pas');
  });
});

describe('WEB-FAULT deliberate web defects', () => {
  it('FAULT-PRB-03 problem_user loses the last name between checkout steps', async () => {
    const h = await startApp();
    await h.login('problem_user');
    await h.go('#/products/4');
    await h.submit('[data-form="detailCart"]');
    await h.go('#/checkout');
    await h.submit('[data-form="checkoutStep"]');
    await h.click('checkout-back');
    expect(h.$('checkout-field-lastName').value).toBe('');
  });
  it('FAULT-ERR-02 error_user only sees a generic error message', async () => {
    const h = await startApp();
    await h.login('error_user');
    await h.go('#/products/999');
    expect(h.message()).toBe('Error');
  });
  it('FAULT-A11Y-01 FAULT-A11Y-02 FAULT-A11Y-03 a11y_user gets unlabeled fields, no focus ring and faint prices', async () => {
    const h = await startApp();
    await h.login('a11y_user');
    expect(document.documentElement.classList.contains('fault-no-focus')).toBe(true);
    expect(h.root.querySelector('.price--faint')).not.toBeNull();
    await h.go('#/profile');
    expect(h.root.querySelector('label[for="f-firstName"]')).toBeNull();
  });
  it('FAULT-I18N-01 FAULT-I18N-02 i18n_user sees raw keys and US dates', async () => {
    const h = await startApp();
    await h.login('i18n_user');
    await h.go('#/products/4');
    await h.submit('[data-form="detailCart"]');
    await h.go('#/cart');
    expect(h.root.querySelector('h1')?.textContent).toBe('cart.title');
    expect(h.text('delivery-estimate')).toBe('cart.delivery');
    expect(h.root.querySelector('.site-footer')?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    await h.click('logout');
    await h.go('#/cart');
    expect(h.root.querySelector('h1')?.textContent).toBe('Panier');
  });
  it('FAULT-OFF faults disabled: problem accounts behave normally', async () => {
    const h = await startApp({ faultsEnabled: false });
    await h.login('a11y_user');
    expect(document.documentElement.classList.contains('fault-no-focus')).toBe(false);
  });
});
