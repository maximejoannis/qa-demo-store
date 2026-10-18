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

/** Thin, exception-safe wrapper around localStorage (unavailable in some private modes). */
export class Persisted {
  storage;
  constructor(storage) {
    this.storage = storage;
  }
  read(key, fallback) {
    try {
      const raw = this.storage?.getItem(`qads:${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  write(key, value) {
    try {
      this.storage?.setItem(`qads:${key}`, JSON.stringify(value));
    } catch {
      // Ignored: preferences then last for the current page only.
    }
  }
  remove(key) {
    try {
      this.storage?.removeItem(`qads:${key}`);
    } catch {
      // Ignored.
    }
  }
}
