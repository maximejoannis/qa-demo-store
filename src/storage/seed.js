import { PRODUCTS } from '../data/products.js';
import { initialAccounts } from '../auth/account.js';
export function seedIfNeeded(store) {
  const products = store.get('products');
  if (store.get('seeded') && Array.isArray(products) && Array.isArray(store.get('users'))) {
    // Older demo installations stored products before local illustrations existed.
    // Preserve edited stock/prices and orders while adding missing catalog fields.
    const migrated = products.map((product) => {
      const original = PRODUCTS.find((candidate) => candidate.id === product.id);
      if (!original) return product;
      return {
        ...original,
        ...product,
        image: product.image || original.image,
        promoStart: product.promoStart ?? original.promoStart,
        promoEnd: product.promoEnd ?? original.promoEnd,
      };
    });
    if (JSON.stringify(migrated) !== JSON.stringify(products)) {
      store.set('products', migrated);
      return true;
    }
    return false;
  }
  store.set('products', PRODUCTS);
  store.set('cart', []);
  store.set('orders', []);
  store.set('users', initialAccounts());
  store.set('profiles', {});
  store.set('wishlist', {});
  store.set('reviews', []);
  store.set('preferences', { theme: 'light', sort: 'name-asc', perPage: 8 });
  store.set('seeded', true);
  return true;
}
export function resetDemoData(store) {
  store.reset();
  seedIfNeeded(store);
}
