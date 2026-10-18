import './styles/main.css';
import { createBrowserStore, createLocalFetcher } from './backend/local-backend.js';
import { ApiClient } from './client/api-client.js';
import { runtimeConfig, safeStorage } from './client/config.js';
import { App } from './ui/app.js';
import { showBootError, showLoading } from './ui/boot.js';

/**
 * Composition root. In local mode (default, GitHub Pages) the back-end runs in the page and
 * persists in localStorage; in server mode the page calls the optional Node API.
 * @param {HTMLElement} root
 */
export async function bootstrap(root) {
  const { mode, basePath, baseUrl } = runtimeConfig(import.meta.env);
  let fetcher = (input, init) => window.fetch(input, init);
  let transport = 'server';
  if (mode === 'demo') {
    const { store, persistent } = createBrowserStore(safeStorage(() => window.localStorage));
    fetcher = await createLocalFetcher({ store, basePath, origin: window.location.origin });
    transport = persistent ? 'local' : 'local (mémoire)';
  }
  const api = new ApiClient({
    baseUrl,
    mode,
    fetcher,
    storage: safeStorage(() => window.sessionStorage),
  });
  const app = new App({
    root,
    api,
    transport,
    storage: safeStorage(() => window.localStorage),
    location: window.location,
    languages: navigator.languages,
    download: (filename, content) => {
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    print: () => window.print(),
    randomId: () => crypto.randomUUID(),
  });
  window.addEventListener('hashchange', () => {
    void app.navigate(window.location.hash);
  });
  await app.start();
  return app;
}

/**
 * Shows a loading message at once, and an explicit error page instead of a blank page.
 * @param {HTMLElement} root
 */
export async function start(root) {
  showLoading(root, navigator.languages, window.location.search);
  try {
    return await bootstrap(root);
  } catch (error) {
    console.error(error);
    showBootError(root, error);
    return null;
  }
}

const root = document.getElementById('app');
if (root) void start(root);
