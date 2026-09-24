// @vitest-environment jsdom
import { expect, it } from 'vitest';

it('completes checkout, shows confirmation, stores order details, and protects admin', async () => {
  localStorage.clear();
  location.hash = '#/products';
  document.body.innerHTML = '<div id="app"></div>';
  await import('../src/main.js');
  const $ = (query) => document.querySelector(query);
  const navigate = (hash) => {
    location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const submit = (form) =>
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  $('[data-testid="product-add-cart-3"]').click();
  navigate('#/login');
  $('[name="username"]').value = 'standard_user';
  $('[name="password"]').value = 'demo123';
  submit($('[data-form="login"]'));
  navigate('#/checkout');
  const address = $('[data-form="checkoutStep"]');
  for (const key of ['firstName', 'lastName', 'address', 'city', 'zip', 'country'])
    address.elements[key].value = `Demo ${key}`;
  submit(address);
  expect($('main').textContent).toContain('Shipping');
  submit($('[data-form="checkoutStep"]'));
  $('[name="card"]').value = '4242424242424242';
  submit($('[data-form="checkoutStep"]'));
  expect($('[data-testid="place-order"]')).not.toBeNull();
  submit($('[data-form="checkoutStep"]'));
  expect($('[data-testid="order-confirmation"]')).not.toBeNull();
  const id = $('[data-testid="order-number"]').textContent;
  navigate(`#/orders/${id}`);
  expect($('main').textContent).toContain('4K Action Camera');
  navigate('#/admin');
  expect($('main').textContent).toContain('Access denied');
});
