import { describe, expect, it } from 'vitest';
import { startApp } from './harness.js';

describe('WEB-CAT catalog', () => {
  it('WEB-CAT-01 renders the catalog in French with v1 test ids', async () => {
    const h = await startApp();
    expect(document.documentElement.lang).toBe('fr');
    expect(h.root.querySelector('.logo')?.textContent).toBe('QA Demo Store');
    expect(h.all('product-card-')).toHaveLength(8);
    expect(h.$('view').dataset.state).toBe('ready');
    expect(h.text('consent-banner')).toContain('Tout refuser');
    expect(h.text('demo-banner')).toContain('Mode démo');
    expect(h.root.querySelector('h1')?.textContent).toBe('Boutique');
    expect(h.text('product-card-3')).toContain('Stock faible');
    expect(h.text('product-card-3')).not.toContain('Low stock');
  });
  it('WEB-CAT-02 searches, filters, sorts and paginates', async () => {
    const h = await startApp();
    h.fill('[data-testid="search-input"]', 'handbook');
    await h.submit('[data-form="search"]');
    expect(h.all('product-card-').map((card) => card.dataset.testid)).toEqual(['product-card-17']);
    await h.click('reset-filters');
    expect(h.all('product-card-')).toHaveLength(8);
    await h.change('[data-testid="sort-select"]', 'price-desc');
    expect(h.all('product-card-')[0]?.dataset.testid).toBe('product-card-13');
    h.fill('[data-testid="filter-min"]', '40');
    h.fill('[data-testid="filter-max"]', '60.5');
    h.check('[data-testid="filter-in-stock"]');
    await h.submit('[data-form="search"]');
    expect(h.all('product-card-').map((c) => c.dataset.testid)).toEqual([
      'product-card-12',
      'product-card-2',
      'product-card-11',
      'product-card-7',
    ]);
    await h.change('[data-testid="category-filter"]', 'Gaming');
    expect(h.all('product-card-')).toHaveLength(2);
    h.fill('[data-testid="search-input"]', 'zzz');
    await h.submit('[data-form="search"]');
    expect(h.$('view').dataset.state).toBe('empty');
    await h.click('reset-filters');
    await h.click('page-3');
    expect(h.$('page-3').getAttribute('aria-current')).toBe('page');
    expect(h.all('product-card-').length).toBeGreaterThan(0);
  });
  it('WEB-CAT-03 compare up to three products', async () => {
    const h = await startApp();
    for (const id of [3, 9, 18]) await h.click(`product-compare-${String(id)}`);
    await h.click('product-compare-15');
    expect(h.message()).toContain('3 produits au maximum');
    await h.go('#/compare');
    expect(h.$('compare-table').querySelectorAll('thead th')).toHaveLength(3);
    await h.click('compare-remove-9');
    expect(h.$('compare-table').querySelectorAll('thead th')).toHaveLength(2);
    await h.click('compare-remove-3');
    await h.click('compare-remove-18');
    expect(h.$('view').textContent).toContain('Aucun produit à comparer');
  });
  it('WEB-CAT-04 wishlist requires an account', async () => {
    const h = await startApp();
    await h.click('product-add-wishlist-3');
    expect(h.message()).toContain('Connectez-vous');
    await h.login();
    await h.go('#/products');
    await h.click('product-add-wishlist-3');
    expect(h.message()).toBe('Ajouté aux favoris.');
    expect(h.$('product-add-wishlist-3').getAttribute('aria-pressed')).toBe('true');
    await h.go('#/wishlist');
    expect(h.all('product-card-')).toHaveLength(1);
    await h.click('wishlist-move-3');
    expect(h.text('cart-badge')).toBe('1');
    expect(h.$('view').dataset.state).toBe('empty');
    expect(h.$('view').textContent).toContain('Aucun favori');
  });
});

describe('WEB-PDP product detail', () => {
  it('WEB-PDP-01 shows installments, adds to cart and posts a review', async () => {
    const h = await startApp();
    await h.go('#/products/13');
    expect(h.text('detail-title')).toBe('Ergonomic Chair');
    expect(h.$('view').textContent).toContain(
      'Ergonomic Chair : un indispensable de la catégorie bureau.',
    );
    expect(h.text('installment-3-1')).toContain('66,67');
    h.fill('[data-testid="detail-qty"]', '2');
    await h.submit('[data-form="detailCart"]');
    expect(h.text('cart-badge')).toBe('2');
    h.fill('[data-testid="detail-qty"]', '9');
    await h.submit('[data-form="detailCart"]');
    expect(h.message()).toContain('Stock insuffisant');
    h.fill('[data-testid="detail-qty"]', '0');
    await h.submit('[data-form="detailCart"]');
    expect(h.message()).toContain('quantité entière');
    expect(h.maybe('review-form')).toBeNull();
    await h.login();
    await h.go('#/products/13');
    h.fill('#comment', 'Very comfortable');
    await h.submit('[data-form="review"]');
    expect(h.message()).toBe('Merci pour votre avis.');
    expect(h.text('review-0')).toContain('Very comfortable');
    h.fill('#comment', 'Again');
    await h.submit('[data-form="review"]');
    expect(h.message()).toContain('déjà donné votre avis');
  });
  it('WEB-PDP-02 stock alert with explicit consent', async () => {
    const h = await startApp();
    await h.go('#/products/9');
    expect(h.$('view').textContent).toContain('Connectez-vous pour être prévenu');
    await h.login();
    await h.go('#/products/9');
    h.check('[name="consent"]');
    await h.submit('[data-form="stockAlert"]');
    expect(h.message()).toBe('Alerte enregistrée.');
    expect(h.$('view').textContent).toContain('Vous serez prévenu(e)');
  });
  it('WEB-PDP-03 unknown product shows the problem', async () => {
    const h = await startApp();
    await h.go('#/products/999');
    expect(h.$('view').dataset.state).toBe('error');
    expect(h.message()).toContain("n'existe pas");
  });
});
