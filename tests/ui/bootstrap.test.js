import { describe, expect, it, vi } from 'vitest';

describe('WEB-BOOT start-up', () => {
  it('WEB-BOOT-01 starts with the local back-end and reacts to hash changes', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/products';
    const { start } = await import('../../src/main.js');
    const root = document.getElementById('app');
    const app = await start(root);
    expect(app.state.transport).toBe('local');
    expect(root.querySelector('[data-testid="view"]')?.getAttribute('data-state')).toBe('ready');
    window.location.hash = '#/privacy';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(root.querySelector('[data-view="privacy"]')).not.toBeNull());
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: revoke });
    app.deps.download('a.json', '{}');
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:x');
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    app.deps.print();
    expect(print).toHaveBeenCalled();
    expect(app.deps.randomId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('WEB-BOOT-02 keeps working in memory when localStorage is blocked', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/products';
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    try {
      const { start } = await import('../../src/main.js');
      const app = await start(document.getElementById('app'));
      expect(app.state.transport).toBe('local (mémoire)');
      expect(document.querySelectorAll('[data-testid^="product-card-"]').length).toBe(8);
    } finally {
      Object.defineProperty(window, 'localStorage', descriptor);
    }
  });

  it('WEB-BOOT-03 shows a loading message, then an explicit error instead of a blank page', async () => {
    const { showLoading, showBootError } = await import('../../src/ui/boot.js');
    const root = document.createElement('div');
    showLoading(root, ['en-US'], '?lang=fr');
    expect(root.textContent).toContain('Chargement');
    const { start } = await import('../../src/main.js');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = vi.spyOn(window, 'addEventListener').mockImplementation(() => {
      throw new Error('boom');
    });
    try {
      await expect(start(root)).resolves.toBeNull();
    } finally {
      failing.mockRestore();
    }
    expect(root.querySelector('[role="alert"] h1')?.textContent).toBe(
      'The application could not start',
    );
    expect(error).toHaveBeenCalled();
    showBootError(root, 'plain failure');
    expect(root.querySelector('pre')?.textContent).toBe('plain failure');
  });

  it('WEB-BOOT-04 does nothing without an #app element; runtime configuration', async () => {
    vi.resetModules();
    document.body.innerHTML = '';
    await expect(import('../../src/main.js')).resolves.toBeDefined();
    const { runtimeConfig, safeStorage } = await import('../../src/client/config.js');
    expect(runtimeConfig({ BASE_URL: '/qa-demo-store/' })).toEqual({
      mode: 'demo',
      basePath: '/qa-demo-store/',
      baseUrl: '/qa-demo-store/api/v1',
    });
    expect(runtimeConfig({ BASE_URL: '/', VITE_API_MODE: 'server' }).baseUrl).toBe(
      'http://localhost:3000/api/v1',
    );
    expect(
      runtimeConfig({ BASE_URL: '/', VITE_API_MODE: 'server', VITE_API_URL: 'http://api.test' })
        .baseUrl,
    ).toBe('http://api.test/api/v1');
    expect(
      safeStorage(() => {
        throw new Error('blocked');
      }),
    ).toBeNull();
  });

  it('WEB-BOOT-05 server mode uses fetch', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_MODE', 'server');
    document.body.innerHTML = '<div id="app"></div>';
    const answers = {
      '/meta': {
        demoMode: false,
        faultsEnabled: false,
        engineVersion: '2.0.0',
        rulesVersion: 'x',
        now: '2026-10-12T08:00:00.000Z',
        clockFrozen: false,
        scenario: 'default',
        deterministicIds: false,
      },
      '/auth/me': { user: null },
      '/products': { items: [], page: 1, totalPages: 1, total: 0, categories: [] },
    };
    const fetchMock = vi.fn((url) => {
      const path = new URL(url).pathname.replace('/api/v1', '');
      return Promise.resolve(new Response(JSON.stringify(answers[path] ?? {}), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { bootstrap } = await import('../../src/main.js');
      const app = await bootstrap(document.getElementById('app'));
      expect(app.state.transport).toBe('server');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/meta',
        expect.objectContaining({ credentials: 'include' }),
      );
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
