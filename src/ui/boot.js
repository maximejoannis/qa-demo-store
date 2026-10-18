import { html, mount } from './core/html.js';
import { detectLang, setLang, t } from '../i18n/index.js';

/** Shown immediately, while the demo back-end initialises (it can take a few seconds). */
export function showLoading(root, languages, search) {
  setLang(detectLang([new URLSearchParams(search).get('lang'), ...languages]));
  mount(root, html`<p class="boot" role="status" aria-live="polite">${t('app.loading')}</p>`);
}

/** Start-up failure: explain what to do instead of leaving a blank page. */
export function showBootError(root, error) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  mount(
    root,
    html`<div class="boot boot--error" role="alert">
      <h1>${t('app.bootErrorTitle')}</h1>
      <p>${t('app.bootErrorText')}</p>
      <pre>${detail}</pre>
    </div>`,
  );
}
