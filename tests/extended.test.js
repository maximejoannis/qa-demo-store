import { describe, expect, it } from 'vitest';
import { register, updateProfile, initialAccounts } from '../src/auth/account.js';
import { toggleWishlist, addReview, productRating } from '../src/catalog/social.js';
import { updateProduct } from '../src/admin/products.js';
import { PRODUCTS } from '../src/data/products.js';

const input = {
  firstName: 'Ada',
  lastName: 'Test',
  email: 'ada@example.test',
  username: 'ada',
  password: 'demo1234',
  confirm: 'demo1234',
  terms: 'on',
};
describe('accounts and profile', () => {
  it('registers and prevents duplicates', () => {
    const result = register(initialAccounts(), input);
    expect(result.ok).toBe(true);
    expect(result.user.role).toBe('customer');
    expect(register(result.users, input).error).toBe('Username already exists');
    expect(register(result.users, { ...input, username: 'other' }).error).toBe(
      'Email already exists',
    );
  });
  it.each([
    [{ firstName: '' }, 'Complete all required fields'],
    [{ email: 'wrong' }, 'Invalid email address'],
    [{ password: 'weak', confirm: 'weak' }, 'Password needs 8 characters, a letter and a number'],
    [{ confirm: 'different' }, 'Passwords do not match'],
    [{ terms: '' }, 'Accept the terms'],
  ])('rejects invalid registration %j', (change, error) =>
    expect(register(initialAccounts(), { ...input, ...change }).error).toBe(error),
  );
  it('validates and saves profile', () => {
    expect(updateProfile({}, 'ada', { ...input, email: 'invalid' }).ok).toBe(false);
    expect(updateProfile({}, 'ada', { ...input, firstName: '' }).ok).toBe(false);
    expect(updateProfile({}, 'ada', input).profiles.ada.firstName).toBe('Ada');
    expect(updateProfile({}, 'ada', { ...input, address: '1 Main St' }).error).toContain(
      'full delivery address',
    );
    expect(
      updateProfile({}, 'ada', {
        ...input,
        address: '1 Main St',
        city: 'Paris',
        zip: '?',
        country: 'France',
      }).error,
    ).toBe('Invalid postal code');
    expect(
      updateProfile({}, 'ada', {
        ...input,
        address: '1 Main St',
        city: 'Paris',
        zip: '75001',
        country: 'France',
      }).ok,
    ).toBe(true);
  });
});
describe('social and administration', () => {
  it('toggles favorites and protects unavailable products', () => {
    expect(toggleWishlist({}, null, PRODUCTS[0]).ok).toBe(false);
    expect(toggleWishlist({}, 'ada', { ...PRODUCTS[0], active: false }).ok).toBe(false);
    const added = toggleWishlist({}, 'ada', PRODUCTS[0]);
    expect(added.wishlist.ada).toEqual([1]);
    expect(toggleWishlist(added.wishlist, 'ada', PRODUCTS[0]).wishlist.ada).toEqual([]);
  });
  it('validates reviews and recalculates the rating', () => {
    expect(addReview([], '', 1, 5, 'Good').ok).toBe(false);
    expect(addReview([], 'ada', 1, 0, 'Good').ok).toBe(false);
    expect(addReview([], 'ada', 1, 5, 'No').ok).toBe(false);
    const reviews = addReview([], 'ada', 1, 5, 'Great').reviews;
    expect(productRating(PRODUCTS[0], reviews)).toEqual({ rating: '5.0', count: 1 });
    expect(productRating(PRODUCTS[1], reviews).rating).toBe(PRODUCTS[1].rating);
  });
  it('updates product fields with validation', () => {
    expect(updateProduct(PRODUCTS, 999, { stock: 1, price: 2 }).ok).toBe(false);
    expect(updateProduct(PRODUCTS, 1, { stock: -1, price: 2 }).ok).toBe(false);
    expect(updateProduct(PRODUCTS, 1, { stock: 1, price: 0 }).ok).toBe(false);
    const changed = updateProduct(PRODUCTS, 1, { stock: 3, price: '12.50', active: '' });
    expect(changed.products[0]).toMatchObject({ stock: 3, price: 1250, active: false });
    expect(changed.products[1]).toEqual(PRODUCTS[1]);
  });
});
