export function searchProducts(list, term) {
  const t = String(term ?? '')
    .trim()
    .toLowerCase();
  if (!t) return list;
  return list.filter((p) =>
    [p.name, p.description, p.category, p.sku].some((f) => f.toLowerCase().includes(t)),
  );
}
export function filterProducts(
  list,
  { category = '', min = null, max = null, inStock = false, minRating = 0 } = {},
) {
  return list.filter(
    (p) =>
      (!category || p.category === category) &&
      (min === null || p.price >= min) &&
      (max === null || p.price <= max) &&
      (!inStock || p.stock > 0) &&
      p.rating >= minRating,
  );
}
export const SORT_LABELS = {
  'name-asc': 'A → Z',
  'name-desc': 'Z → A',
  'price-asc': 'Price ↑',
  'price-desc': 'Price ↓',
  rating: 'Best rated',
  new: 'Newest',
};
const SORTS = {
  'name-asc': (a, b) => a.name.localeCompare(b.name),
  'name-desc': (a, b) => b.name.localeCompare(a.name),
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
  new: (a, b) => Number(b.isNew) - Number(a.isNew),
};
export const sortProducts = (list, key) => [...list].sort(SORTS[key] ?? SORTS['name-asc']);
export function paginate(list, page, perPage = 8) {
  const totalPages = Math.max(1, Math.ceil(list.length / perPage));
  const p = Number.isInteger(page) ? Math.min(Math.max(page, 1), totalPages) : 1;
  return {
    items: list.slice((p - 1) * perPage, p * perPage),
    page: p,
    totalPages,
    total: list.length,
  };
}
