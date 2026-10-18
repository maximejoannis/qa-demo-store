import { parisDate } from './time.js';

/**
 * ENG-CAT-01: promotion prices apply between promoStart and promoEnd inclusive (Paris dates).
 * @param {import("./types.js").Product} product
 * @param {Date} now
 * @returns {number} Cents.
 */
export function effectivePrice(product, now) {
  if (!product.oldPrice || product.oldPrice <= product.price) return product.price;
  const today = parisDate(now);
  if (product.promoStart && today < product.promoStart) return product.oldPrice;
  if (product.promoEnd && today > product.promoEnd) return product.oldPrice;
  return product.price;
}

/** ENG-CAT-02: discount percentage displayed on a promoted product (rounded). */
export function promotionPercent(product, now) {
  const price = effectivePrice(product, now);
  return price < product.oldPrice
    ? Math.round(((product.oldPrice - price) / product.oldPrice) * 100)
    : 0;
}

export function searchProducts(list, term) {
  const needle = term.trim().toLowerCase();
  if (!needle) return [...list];
  return list.filter((product) =>
    [product.name, product.description, product.category, product.sku].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}

/**
 * ENG-CAT-03: price filters use the effective (promotional) price.
 * @template {import("./types.js").Product} T
 * @param {readonly T[]} list
 * @param {{ category?: string, min?: number | null, max?: number | null, inStock?: boolean, minRating?: number }} filters
 * @param {Date} now
 * @returns {T[]}
 */
export function filterProducts(list, filters, now) {
  const { category = '', min = null, max = null, inStock = false, minRating = 0 } = filters;
  return list.filter((product) => {
    const price = effectivePrice(product, now);
    return (
      (!category || product.category === category) &&
      (min === null || price >= min) &&
      (max === null || price <= max) &&
      (!inStock || product.stock > 0) &&
      product.rating >= minRating
    );
  });
}

export const SORT_KEYS = ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'rating', 'new'];

/**
 * @template {import("./types.js").Product} T
 * @param {readonly T[]} list
 * @param {string} key One of SORT_KEYS.
 * @param {Date} now
 * @returns {T[]}
 */
export function sortProducts(list, key, now) {
  const price = (product) => effectivePrice(product, now);
  const byName = (a, b) => a.name.localeCompare(b.name, 'en');
  const comparators = {
    'name-asc': byName,
    'name-desc': (a, b) => byName(b, a),
    'price-asc': (a, b) => price(a) - price(b) || byName(a, b),
    'price-desc': (a, b) => price(b) - price(a) || byName(a, b),
    rating: (a, b) => b.rating - a.rating || byName(a, b),
    new: (a, b) => Number(b.isNew) - Number(a.isNew) || byName(a, b),
  };
  return [...list].sort(comparators[key]);
}

/**
 * @template T
 * @param {readonly T[]} list
 * @param {number} page
 * @param {number} perPage
 * @returns {{ items: T[], page: number, totalPages: number, total: number }}
 */
export function paginate(list, page, perPage) {
  const size = Number.isInteger(perPage) && perPage > 0 ? perPage : 8;
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const current = Number.isInteger(page) ? Math.min(Math.max(page, 1), totalPages) : 1;
  return {
    items: list.slice((current - 1) * size, current * size),
    page: current,
    totalPages,
    total: list.length,
  };
}

/** ENG-CAT-04: customer reviews replace the seeded rating as soon as one exists. */
export function productRating(product, reviews) {
  const own = reviews.filter((review) => review.productId === product.id);
  if (!own.length) return { rating: product.rating, count: product.reviews };
  const average = own.reduce((sum, review) => sum + review.rating, 0) / own.length;
  return { rating: Math.round(average * 10) / 10, count: own.length };
}

export const LOW_STOCK = 5;

export const stockLevel = (stock) => (stock <= 0 ? 'out' : stock <= LOW_STOCK ? 'low' : 'in');
