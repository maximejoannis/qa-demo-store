import { afterEach } from 'vitest';
import { setI18nFaults, setLang } from '../../src/i18n/index.js';

afterEach(() => {
  setLang('fr');
  setI18nFaults({ rawKeyPrefixes: [], usDates: false });
  if (typeof document !== 'undefined') document.body.innerHTML = '';
});
