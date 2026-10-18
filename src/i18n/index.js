import en from './en.json';
import fr from './fr.json';

export const LANGS = ['fr', 'en'];

const DICTIONARIES = { fr, en };

let current = 'fr';

let faults = { rawKeyPrefixes: [], usDates: false };

export const getLang = () => current;

export const setLang = (lang) => {
  current = lang;
};

export const setI18nFaults = (value) => {
  faults = value;
};

export function detectLang(candidates) {
  for (const candidate of candidates) {
    const code = candidate?.slice(0, 2).toLowerCase();
    if (code === 'fr' || code === 'en') return code;
  }
  return 'fr';
}

/** Translates `key`, replacing {name} placeholders. Missing keys fall back to French, then to the key. */
export function t(key, params = {}) {
  if (faults.rawKeyPrefixes.some((prefix) => key.startsWith(prefix))) return key;
  const template = DICTIONARIES[current][key] ?? DICTIONARIES.fr[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

export const hasKey = (lang, key) => key in DICTIONARIES[lang];

export const keysOf = (lang) => Object.keys(DICTIONARIES[lang]);

const locale = () => (current === 'fr' ? 'fr-FR' : 'en-GB');

export const money = (cents) =>
  new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(cents / 100);

/** Formats an ISO date (YYYY-MM-DD) or an instant, always in Europe/Paris. */
export function formatDate(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(faults.usDates ? 'en-US' : locale(), {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: faults.usDates ? '2-digit' : 'long',
    day: '2-digit',
  }).format(date);
}

export const percent = (basisPoints) =>
  new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 2 }).format(
    basisPoints / 10000,
  );
