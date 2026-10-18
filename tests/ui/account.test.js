import { describe, expect, it } from 'vitest';
import { startApp } from './harness.js';

describe('WEB-ORD orders, returns and invoices', () => {
  it('WEB-ORD-01 order history, cancel, return simulation and request', async () => {
    const h = await startApp();
    await h.api.post('/demo/reset', { scenario: 'order-history' });
    await h.login();
    await h.go('#/orders');
    expect(h.all('order-ORD-HIST')).toHaveLength(6);
    expect(h.text('order-status-ORD-HIST-0006')).toBe('En préparation');
    await h.click('order-cancel-ORD-HIST-0006');
    expect(h.text('order-status-ORD-HIST-0006')).toBe('Annulée');
    await h.go('#/orders/ORD-HIST-0002');
    h.fill('[data-testid="return-qty-1"]', '1');
    await h.click('return-quote');
    expect(h.text('return-result')).toContain('délai de rétractation de 14 jours est dépassé');
    await h.go('#/orders/ORD-HIST-0003');
    h.fill('[data-testid="return-qty-17"]', '1');
    await h.click('return-quote');
    expect(h.text('return-result')).toContain('Remboursement estimé : 24,90 €');
    await h.submit('[data-form="returnRequest"]');
    expect(h.message()).toBe('Demande de retour enregistrée.');
    expect(h.text('order-status-ORD-HIST-0003')).toBe('Retour demandé');
    await h.go('#/invoice/ORD-HIST-0003');
    expect(h.text('invoice')).toContain('FA-');
    expect(h.text('invoice')).toContain('fictive');
    await h.click('invoice-print');
    expect(h.print).toHaveBeenCalledOnce();
    await h.go('#/orders/ORD-NOPE');
    expect(h.$('view').dataset.state).toBe('error');
    await h.go('#/invoice/ORD-NOPE');
    await h.go('#/confirmation/ORD-NOPE');
    expect(h.message()).toBe('Commande introuvable.');
  });
  it('WEB-ORD-02 empty order list', async () => {
    const h = await startApp();
    await h.login();
    await h.go('#/orders');
    expect(h.$('view').dataset.state).toBe('empty');
  });
});

describe('WEB-ACC accounts', () => {
  it('WEB-ACC-01 login errors, redirect after login and logout', async () => {
    const h = await startApp();
    await h.go('#/profile');
    expect(h.$('view').dataset.view).toBe('login');
    h.fill('[data-testid="login-username"]', 'locked_user');
    h.fill('[data-testid="login-password"]', 'demo123');
    await h.submit('[data-form="login"]');
    expect(h.message()).toContain('verrouillé');
    h.fill('[data-testid="login-username"]', 'standard_user');
    h.fill('[data-testid="login-password"]', 'demo123');
    await h.submit('[data-form="login"]');
    expect(h.$('view').dataset.view).toBe('profile');
    expect(h.message()).toBe('Bienvenue Ada !');
    await h.click('logout');
    expect(h.$('view').dataset.view).toBe('login');
    await h.go('#/admin');
    await h.login();
    await h.go('#/admin');
    expect(h.$('view').dataset.view).toBe('forbidden');
    await h.go('#/nowhere');
    expect(h.$('view').textContent).toContain('Page introuvable');
  });
  it('WEB-ACC-02 registration', async () => {
    const h = await startApp();
    await h.go('#/register');
    const values = {
      firstName: 'Nina',
      lastName: 'New',
      email: 'nina@example.test',
      username: 'nina',
      password: 'secret123',
      confirm: 'secret999',
    };
    for (const [name, value] of Object.entries(values))
      h.fill(`[data-testid="register-${name}"]`, value);
    h.check('[data-testid="register-terms"]');
    await h.submit('[data-form="register"]');
    expect(h.message()).toContain('Certains champs sont invalides');
    h.fill('[data-testid="register-confirm"]', 'secret123');
    h.check('[data-testid="register-newsletter"]');
    await h.submit('[data-form="register"]');
    expect(h.message()).toBe('Compte créé, vous êtes connecté(e).');
    expect(h.text('logout')).toContain('nina');
  });
  it('WEB-ACC-03 profile, preferences and language', async () => {
    const h = await startApp();
    await h.login();
    await h.go('#/profile');
    h.fill('[data-testid="profile-zip"]', '');
    await h.submit('[data-form="profile"]');
    expect(h.message()).toContain('Certains champs');
    h.fill('[data-testid="profile-zip"]', '75001');
    h.fill('[data-testid="profile-lastName"]', 'Lovelace');
    await h.submit('[data-form="profile"]');
    expect(h.message()).toBe('Profil enregistré.');
    await h.go('#/preferences');
    await h.change('#pref-theme', 'dark');
    await h.change('#pref-lang', 'en');
    await h.change('#pref-sort', 'price-asc');
    h.check('[name="qa"]');
    await h.submit('[data-form="preferences"]');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('en');
    expect(h.maybe('qa-toolbar')).not.toBeNull();
    expect(JSON.parse(h.storage.getItem('qads:prefs') ?? '{}')).toMatchObject({
      lang: 'en',
      theme: 'dark',
      sort: 'price-asc',
      qa: true,
    });
    await h.click('lang-fr');
    expect(h.message()).toBe('Preferences saved.');
    await h.click('theme-toggle');
    expect(h.message()).toBe('Mode clair activé');
    await h.click('message-dismiss');
    expect(h.maybe('message')).toBeNull();
  });
  it('WEB-ACC-04 my data: export, newsletter consent and deletion', async () => {
    const h = await startApp();
    await h.login();
    await h.go('#/my-data');
    await h.click('my-data-export');
    expect(h.download).toHaveBeenCalledWith(
      'qa-demo-store-export-2026-10-12.json',
      expect.stringContaining('"format": "qa-demo-store/export@1"'),
    );
    h.check('[data-testid="my-data-newsletter"]');
    await h.submit('[data-form="newsletter"]');
    expect(h.message()).toBe('Consentement mis à jour.');
    expect(h.$('my-data-newsletter').checked).toBe(true);
    h.fill('[data-testid="my-data-delete-password"]', 'wrong');
    await h.submit('[data-form="deleteAccount"]');
    expect(h.message()).toContain('Identifiant ou mot de passe incorrect');
    h.fill('[data-testid="my-data-delete-password"]', 'demo123');
    await h.submit('[data-form="deleteAccount"]');
    expect(h.message()).toBe('Votre compte a été supprimé.');
    expect(h.maybe('logout')).toBeNull();
    await h.go('#/privacy');
    expect(h.$('view').textContent).toContain('Durées de conservation');
  });
  it('WEB-ACC-05 loyalty page for a gold customer', async () => {
    const h = await startApp();
    await h.api.post('/demo/reset', { scenario: 'loyalty-gold' });
    await h.login();
    await h.go('#/loyalty');
    expect(h.text('loyalty-tier')).toBe('Or');
    expect(h.$('view').textContent).toContain('Niveau maximal atteint');
  });
});

describe('WEB-ADM administration', () => {
  it('WEB-ADM-01 dashboard, product edit, status change and purge', async () => {
    const h = await startApp();
    await h.api.post('/demo/reset', { scenario: 'order-history' });
    await h.login('admin_user', 'admin123');
    await h.go('#/admin');
    expect(h.text('kpi-orders')).toContain('3');
    h.fill('[data-testid="kpi-from"]', '2026-09-01');
    await h.submit('[data-form="kpiPeriod"]');
    expect(h.text('kpi-orders')).toContain('6');
    expect(h.$('kpi-chart').querySelector('svg title')?.textContent).toBe(
      "Chiffre d'affaires par catégorie",
    );
    h.fill('[data-testid="admin-stock-9"]', '12');
    h.fill('[data-testid="admin-price-9"]', '25.5');
    await h.submit('[data-testid="admin-product-9"] form');
    expect(h.message()).toBe('Produit enregistré.');
    expect(h.$('admin-price-9').value).toBe('25.50');
    await h.clickSelector('[data-testid="admin-order-ORD-HIST-0005"] [data-next="Delivered"]');
    expect(h.text('admin-status-ORD-HIST-0005')).toBe('Livrée');
    await h.click('admin-purge');
    expect(h.text('admin-purge-result')).toContain('Comptes anonymisés : 0');
    h.fill('[data-testid="kpi-from"]', '2026-12-01');
    await h.submit('[data-form="kpiPeriod"]');
    expect(h.message()).toContain('date de début');
  });
  it('WEB-ADM-02 restocking list in the low-stock scenario', async () => {
    const h = await startApp();
    await h.api.post('/demo/reset', { scenario: 'low-stock' });
    await h.login('admin_user', 'admin123');
    await h.go('#/admin');
    expect(h.all('reorder-').length).toBeGreaterThan(0);
    expect(h.$('view').textContent).toContain('Aucune vente sur la période');
  });
});
