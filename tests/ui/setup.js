import { afterEach } from 'vitest';
import { setI18nFaults, setLang } from '../../src/i18n/index.js';

// jsdom has no canvas: axe-core falls back silently instead of printing "Not implemented".
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null;
}

afterEach(() => {
  setLang('fr');
  setI18nFaults({ rawKeyPrefixes: [], usDates: false });
  if (typeof document !== 'undefined') document.body.innerHTML = '';
});
