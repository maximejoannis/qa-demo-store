import { html, mount } from './core/html.js';
import { TID } from './testids.js';
import { detectLang, setLang, t } from '../i18n/index.js';

/** Shown immediately, while the demo back-end initialises (it can take a few seconds). */
export function showLoading(root, languages, search) {
  setLang(detectLang([new URLSearchParams(search).get('lang'), ...languages]));
  mount(root, html`<p class="boot" role="status" aria-live="polite">${t('app.loading')}</p>`);
}

/** Start-up failure: explain what to do instead of leaving a blank page. */
/* c8 ignore next -- jsdom cannot reload; the injected reload is tested */
const reloadPage = () => window.location.reload();

export function showBootError(root, error, reload = reloadPage) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  mount(
    root,
    html`<div class="boot boot--error" role="alert">
      <h1>${t('app.bootErrorTitle')}</h1>
      <p>${t('app.bootErrorText')}</p>
      <pre>${detail}</pre>
      <button type="button" class="button" data-testid="${TID.bootReset}">
        ${t('app.bootReset')}
      </button>
    </div>`,
  );
  root.querySelector(`[data-testid="${TID.bootReset}"]`)?.addEventListener('click', () => {
    clearLocalData();
    reload();
  });
}

/** Removes every key of this application (v1 `qads:` and v2 `qads2:`) from browser storage. */
export function clearLocalData() {
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const area = storage();
      const keys = [];
      for (let index = 0; index < area.length; index += 1) {
        const key = area.key(index);
        if (key?.startsWith('qads')) keys.push(key);
      }
      keys.forEach((key) => area.removeItem(key));
    } catch {
      // Storage blocked: nothing to clear.
    }
  }
}
