// @vitest-environment jsdom
import { it, expect } from 'vitest';
it('renders the app shell and core flows', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await import('../src/main.js');
  const $ = (s) => document.querySelector(s);
  expect($('.logo').textContent).toBe('QA Demo Store');
  expect(document.querySelectorAll('[data-testid^="product-card-"]').length).toBe(8);
  $('[data-testid="product-add-cart-3"]').click();
  expect($('[data-testid="cart-badge"]').textContent).toBe('1');
  location.hash = '#/login';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect($('[data-testid="login-submit"]')).not.toBeNull();
  location.hash = '#/register';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  const registration = $('[data-form="register"]');
  for (const [name, value] of Object.entries({
    firstName: 'Ada',
    lastName: 'Test',
    email: 'ada@example.test',
    username: 'ada',
    password: 'demo1234',
    confirm: 'demo1234',
  }))
    registration.elements[name].value = value;
  registration.elements.terms.checked = true;
  registration.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  expect($('[data-testid="message"]').textContent).toContain('Account created');
  location.hash = '#/products/1';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect($('h1').textContent).toBe('Wireless Headphones');
  $('[data-act="wish"]').click();
  location.hash = '#/wishlist';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect($('[data-testid="product-card-1"]')).not.toBeNull();
});
