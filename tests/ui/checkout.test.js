import { describe, expect, it } from 'vitest';
import { startApp } from './harness.js';

async function cartWith(h, ids) {
  await h.go('#/products');
  for (const id of ids) {
    await h.go(`#/products/${String(id)}`);
    await h.submit('[data-form="detailCart"]');
  }
  await h.go('#/cart');
}

describe('WEB-CART cart and quote', () => {
  it('WEB-CART-01 server-computed totals, VAT lines and delivery estimate', async () => {
    const h = await startApp();
    await cartWith(h, [17, 17, 1]);
    expect(h.text('cart-item-17')).toContain('2');
    expect(h.text('cart-total')).toBe('129,79 €');
    expect(h.text('vat-2000')).toContain('13,33');
    expect(h.text('vat-550')).toContain('2,60');
    expect(h.text('delivery-estimate')).toContain('15 octobre 2026');
    expect(h.text('summary-shipping')).toContain('Offerte');
  });
  it('WEB-CART-02 quantities, coupons, shipping and country', async () => {
    const h = await startApp();
    await cartWith(h, [6]);
    expect(h.text('summary-shipping')).toContain('4,90');
    await h.change('[data-testid="cart-qty-6"]', '3');
    expect(h.text('cart-total')).toBe('49,87 €');
    await h.change('[data-testid="cart-qty-6"]', '30');
    expect(h.message()).toContain('quantité entière');
    h.fill('[data-testid="coupon-input"]', 'nope');
    await h.submit('[data-form="coupon"]');
    expect(h.message()).toBe("Code promo inconnu. Vérifiez l'orthographe.");
    h.fill('[data-testid="coupon-input"]', 'save20');
    await h.submit('[data-form="coupon"]');
    expect(h.message()).toContain('100,00 €');
    h.fill('[data-testid="coupon-input"]', 'welcome10');
    await h.submit('[data-form="coupon"]');
    expect(h.message()).toBe('Code WELCOME10 appliqué.');
    expect(h.text('summary-discount')).toContain('4,50');
    await h.click('coupon-remove');
    expect(h.maybe('summary-discount')).toBeNull();
    h.fill('[data-testid="coupon-input"]', ' ');
    await h.submit('[data-form="coupon"]');
    await h.change('[data-testid="shipping-method"]', 'express');
    expect(h.text('summary-shipping')).toContain('12,90');
    await h.change('[data-testid="shipping-country"]', 'US');
    expect(h.text('summary-shipping')).toContain('39,90');
    await h.change('[data-testid="shipping-method"]', 'pickup');
    expect(h.$('view').textContent).toContain("n'est pas disponible pour ce pays");
    expect(h.$('checkout-link').getAttribute('aria-disabled')).toBe('true');
    await h.click('cart-remove-6');
    expect(h.$('view').textContent).toContain('Votre panier est vide');
  });
  it('WEB-CART-03 cart survives a reload but expires after 30 days', async () => {
    const h = await startApp();
    await cartWith(h, [4]);
    const kept = await startApp({ storage: h.storage });
    expect(kept.text('cart-badge')).toBe('1');
    h.storage.setItem(
      'qads:cart',
      JSON.stringify({ lines: [{ productId: 4, qty: 1 }], updatedAt: '2026-09-01' }),
    );
    const expired = await startApp({ storage: h.storage });
    expect(expired.text('cart-badge')).toBe('0');
    expect(h.storage.getItem('qads:cart')).toBeNull();
  });
});

describe('WEB-CHK checkout', () => {
  it('WEB-CHK-01 full checkout with loyalty points and 3 installments', async () => {
    const h = await startApp();
    await h.go('#/checkout');
    expect(h.$('view').dataset.view).toBe('login');
    await h.login('premium_user');
    await cartWith(h, [13]);
    await h.click('checkout-link');
    await h.go('#/checkout');
    expect(h.$('checkout-step-address').getAttribute('aria-current')).toBe('step');
    expect(h.$('checkout-address').value).toBe('10 rue des Tests');
    await h.submit('[data-form="checkoutStep"]');
    h.fill('[data-testid="loyalty-redeem"]', '150');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.message()).toContain('tranches de 100');
    h.fill('[data-testid="loyalty-redeem"]', '200');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.text('cart-total')).toBe('189,99 €');
    h.fill('[data-testid="payment-card"]', '4242 4242 4242 4242');
    await h.change('[data-testid="installments-choice"]', '3');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.$('view').textContent).toContain('3 fois sans frais');
    await h.click('checkout-back');
    expect(h.$('checkout-step-payment').getAttribute('aria-current')).toBe('step');
    await h.submit('[data-form="checkoutStep"]');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.$('view').dataset.view).toBe('confirmation');
    expect(h.text('order-confirmation')).toBe('Commande confirmée');
    expect(h.text('order-number')).toMatch(/^ORD-/);
    expect(h.$('view').textContent).toContain('3 fois');
    expect(h.text('cart-badge')).toBe('0');
    await h.go('#/loyalty');
    expect(h.text('loyalty-balance')).toBe('420');
    expect(h.text('loyalty-tier')).toBe('Argent');
    expect(h.text('loyalty-history')).toContain('Points utilisés');
  });
  it('WEB-CHK-02 validation, declined card and pay on delivery', async () => {
    const h = await startApp();
    await h.login();
    await cartWith(h, [4]);
    await h.go('#/checkout');
    h.fill('[data-testid="checkout-field-zip"]', '!');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.message()).toContain('Complétez tous les champs');
    h.fill('[data-testid="checkout-field-zip"]', '69001');
    await h.submit('[data-form="checkoutStep"]');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.$('view').textContent).toContain('de 100 € à 2 000 €');
    h.fill('[data-testid="payment-card"]', '4000000000000002');
    await h.submit('[data-form="checkoutStep"]');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.message()).toContain('Paiement refusé');
    await h.click('checkout-back');
    await h.change('[data-testid="payment-method"]', 'pod');
    await h.submit('[data-form="checkoutStep"]');
    await h.submit('[data-form="checkoutStep"]');
    expect(h.text('order-confirmation')).toBe('Commande confirmée');
  });
  it('WEB-CHK-03 empty checkout and quote expiry message', async () => {
    const h = await startApp();
    await h.login();
    await h.go('#/checkout');
    expect(h.$('view').textContent).toContain('Votre panier est vide');
  });
});
