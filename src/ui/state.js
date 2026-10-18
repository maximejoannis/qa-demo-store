export const CONSENT_VERSION = '2026-10';

export const emptyCheckout = () => ({
  step: 0,
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  zip: '',
  country: 'FR',
  payment: 'card',
  card: '',
  installments: 1,
});

export const defaultCatalog = (sort = 'name-asc', perPage = 8) => ({
  search: '',
  category: '',
  min: '',
  max: '',
  inStock: false,
  minRating: 0,
  sort,
  page: 1,
  perPage,
});

/**
 * Every key of this version starts with `qads2:`. v1 used `qads:` with other shapes
 * (same origin on localhost and GitHub Pages): a distinct prefix avoids reading them.
 */
export const STORAGE_PREFIX = 'qads2:';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Shape checks of what this version stores: anything else is discarded, never trusted. */
export const VALID = {
  prefs: isObject,
  consent: (value) =>
    isObject(value) &&
    typeof value.version === 'string' &&
    typeof value.date === 'string' &&
    !Number.isNaN(new Date(value.date).getTime()),
  recent: (value) => Array.isArray(value) && value.every((id) => Number.isInteger(id)),
  cart: (value) => isObject(value) && Array.isArray(value.lines) && isIsoDate(value.updatedAt),
  visitor: (value) => typeof value === 'string' && value.length > 0,
};

/** Thin, exception-safe wrapper around localStorage (unavailable in some private modes). */
export class Persisted {
  storage;
  constructor(storage) {
    this.storage = storage;
  }
  read(key, fallback) {
    try {
      const raw = this.storage?.getItem(`${STORAGE_PREFIX}${key}`);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      if (VALID[key] && !VALID[key](value)) {
        this.remove(key);
        return fallback;
      }
      return value;
    } catch {
      this.remove(key);
      return fallback;
    }
  }
  write(key, value) {
    try {
      this.storage?.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // Ignored: preferences then last for the current page only.
    }
  }
  remove(key) {
    try {
      this.storage?.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      // Ignored.
    }
  }
}
