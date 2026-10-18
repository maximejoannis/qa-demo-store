export const product = (overrides = {}) => ({
  id: 1,
  sku: 'SKU-1000',
  name: 'Wireless Headphones',
  description: 'Headphones',
  category: 'Electronics',
  price: 7999,
  oldPrice: 0,
  promoStart: null,
  promoEnd: null,
  stock: 25,
  weightGrams: 300,
  rating: 4.6,
  reviews: 120,
  badge: '',
  isNew: false,
  image: 'products/product-1.svg',
  active: true,
  ...overrides,
});

/** Instant at a given Paris wall-clock time (handles CET/CEST). */
export const paris = (local) => {
  const guess = new Date(`${local}Z`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(guess)
    .find((part) => part.type === 'timeZoneName')?.value;
  const offset = Number(/GMT([+-]\d+)/.exec(parts ?? '')?.[1] ?? 0);
  return new Date(guess.getTime() - offset * 3_600_000);
};
