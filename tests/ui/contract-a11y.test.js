import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { declaredPatterns, V1_TESTIDS } from '../../src/ui/testids.js';
import { startApp } from './harness.js';

const seen = new Set();

const violations = [];

function observe(h) {
  const collect = (root) => {
    root
      .querySelectorAll('[data-testid]')
      .forEach((element) => seen.add(element.getAttribute('data-testid') ?? ''));
  };
  collect(h.root);
  new MutationObserver(() => {
    collect(h.root);
  }).observe(h.root, { childList: true, subtree: true });
}

async function audit(h, label) {
  const result = await axe.run(h.root, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    resultTypes: ['violations'],
  });
  for (const violation of result.violations) {
    if (violation.impact === 'serious' || violation.impact === 'critical') {
      violations.push(
        `${label}: ${violation.id} (${violation.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')})`,
      );
    }
  }
}

describe('WEB-CONTRACT data-testid contract and accessibility tour', () => {
  it('WEB-CONTRACT-01 every declared data-testid is rendered and axe finds no serious issue', async () => {
    const h = await startApp({ search: '?qa=1' });
    observe(h);
    await audit(h, 'catalog');
    await h.click('consent-customize');
    await h.click('consent-accept-all');
    await h.click('message-dismiss');
    await h.change('[data-testid="per-page-select"]', '4');
    await h.click('page-2');
    await h.click('product-compare-7');
    await h.click('product-compare-13');
    await h.go('#/compare');
    await audit(h, 'compare');
    await h.go('#/products/13');
    await audit(h, 'product');
    await h.submit('[data-form="detailCart"]');
    await h.go('#/products/17');
    await h.submit('[data-form="detailCart"]');
    await h.go('#/products');
    await h.go('#/cart');
    await audit(h, 'cart');
    h.fill('[data-testid="coupon-input"]', 'WELCOME10');
    await h.submit('[data-form="coupon"]');
    await h.go('#/register');
    await audit(h, 'register');
    await h.go('#/login');
    await audit(h, 'login');
    await h.login('premium_user');
    await h.go('#/products/9');
    await audit(h, 'product-out-of-stock');
    await h.go('#/products/13');
    h.fill('#comment', 'Solid chair');
    await h.submit('[data-form="review"]');
    await h.click('product-add-wishlist-13');
    await h.go('#/products');
    await h.go('#/wishlist');
    await audit(h, 'wishlist');
    await h.go('#/checkout');
    await audit(h, 'checkout');
    await h.submit('[data-form="checkoutStep"]');
    await h.submit('[data-form="checkoutStep"]');
    h.fill('[data-testid="payment-card"]', '4242424242424242');
    await h.click('checkout-back');
    await h.submit('[data-form="checkoutStep"]');
    h.fill('[data-testid="payment-card"]', '4242424242424242');
    await h.submit('[data-form="checkoutStep"]');
    await h.submit('[data-form="checkoutStep"]');
    await audit(h, 'confirmation');
    await h.go('#/orders');
    await audit(h, 'orders');
    await h.go('#/loyalty');
    await h.go('#/profile');
    await audit(h, 'profile');
    await h.go('#/preferences');
    await audit(h, 'preferences');
    await h.go('#/my-data');
    await audit(h, 'my-data');
    await h.go('#/privacy');
    await audit(h, 'privacy');
    await h.click('qa-clock-real');
    await h.api.post('/demo/reset', { scenario: 'order-history' });
    await h.login();
    await h.go('#/orders/ORD-HIST-0003');
    h.fill('[data-testid="return-qty-1"]', '1');
    await h.click('return-quote');
    await audit(h, 'order-detail');
    await h.go('#/invoice/ORD-HIST-0003');
    await audit(h, 'invoice');
    await h.api.post('/demo/reset', { scenario: 'low-stock' });
    await h.login('admin_user', 'admin123');
    await h.go('#/admin');
    await h.click('admin-purge');
    h.fill('[data-testid="kpi-from"]', '2026-01-01');
    await audit(h, 'admin');
    await h.api.post('/demo/reset', { scenario: 'order-history' });
    await h.login('admin_user', 'admin123');
    await h.go('#/admin');
    h.fill('[data-testid="kpi-from"]', '2026-01-01');
    await h.submit('[data-form="kpiPeriod"]');
    await audit(h, 'admin-with-data');
    const missing = declaredPatterns().filter((pattern) => {
      const regex = new RegExp(
        `^${pattern
          .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
          .replace('\\{id\\}', '.+')
          .replace('{id}', '.+')}$`,
      );
      return ![...seen].some((testid) => regex.test(testid));
    });
    expect(missing).toEqual([]);
    expect(violations).toEqual([]);
  }, 60_000);
  it('WEB-CONTRACT-02 every v1 data-testid is still declared', () => {
    const declared = declaredPatterns();
    expect(V1_TESTIDS.filter((testid) => !declared.includes(testid))).toEqual([]);
  });
});

describe('WEB-A11Y the accessibility check catches the deliberate a11y_user defects', () => {
  it('FAULT-A11Y-01 axe reports unlabeled form fields for a11y_user only', async () => {
    const h = await startApp();
    await h.login('a11y_user');
    await h.go('#/profile');
    const faulty = await axe.run(h.root, { runOnly: ['label'] });
    expect(faulty.violations.map((v) => v.id)).toContain('label');
    await h.click('logout');
    await h.login();
    await h.go('#/profile');
    const clean = await axe.run(h.root, { runOnly: ['label'] });
    expect(clean.violations).toEqual([]);
  });
});
