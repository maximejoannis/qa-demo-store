export const PROTECTED = {
  checkout: 'user',
  orders: 'user',
  confirmation: 'user',
  invoice: 'user',
  wishlist: 'user',
  profile: 'user',
  loyalty: 'user',
  'my-data': 'user',
  admin: 'admin',
};

export function parseHash(hash) {
  const parts = hash
    .replace(/^#\/?/, '')
    .replace(/\?.*$/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
  const [name = 'products', ...params] = parts;
  return { name, params };
}

export const href = (...parts) =>
  `#/${parts.map((part) => encodeURIComponent(String(part))).join('/')}`;
