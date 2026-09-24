import './styles/main.css';
import { createStorage } from './storage/storage.js';
import { seedIfNeeded, resetDemoData } from './storage/seed.js';
import { login, can } from './auth/auth.js';
import { register, updateProfile } from './auth/account.js';
import { toggleWishlist, addReview, productRating } from './catalog/social.js';
import { updateProduct } from './admin/products.js';
import {
  searchProducts,
  filterProducts,
  sortProducts,
  paginate,
  SORT_LABELS,
} from './catalog/query.js';
import { CATEGORIES } from './data/products.js';
import { addToCart, setQuantity, removeFromCart, cartCount, cartLines } from './cart/cart.js';
import { validateCoupon } from './coupons/coupons.js';
import { METHODS, shippingCost } from './shipping/shipping.js';
import { computeTotals, money } from './pricing/pricing.js';
import { pay } from './payment/payment.js';
import { placeOrder, changeStatus, TRANSITIONS } from './orders/orders.js';
import { stockLevel } from './inventory/inventory.js';
import { effectivePrice, promotionPercent } from './promotions/promotions.js';

const store = createStorage(window.localStorage);
seedIfNeeded(store);
const checkoutDefaults = () => ({
  step: 0,
  address: '',
  city: '',
  zip: '',
  country: '',
  firstName: '',
  lastName: '',
  payment: 'card',
  card: '',
});
const readArray = (key) => {
  const value = store.get(key, []);
  return Array.isArray(value) ? value : [];
};
const readObject = (key, fallback = {}) => {
  const value = store.get(key, fallback);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
};
const KEYS = [
  'products',
  'cart',
  'orders',
  'user',
  'theme',
  'users',
  'profiles',
  'wishlist',
  'reviews',
  'preferences',
];
const fresh = () => ({
  products: readArray('products'),
  cart: readArray('cart'),
  orders: readArray('orders'),
  user: store.get('user'),
  theme: store.get('theme', 'light'),
  users: readArray('users'),
  profiles: readObject('profiles'),
  wishlist: readObject('wishlist'),
  reviews: readArray('reviews'),
  preferences: readObject('preferences', { theme: 'light', sort: 'name-asc', perPage: 8 }),
  checkout: {
    ...checkoutDefaults(),
    ...(readObject('profiles')[store.get('user')?.username] ?? {}),
  },
  coupon: null,
  ship: 'standard',
  msg: null,
  q: {
    search: '',
    category: '',
    min: '',
    max: '',
    inStock: false,
    minRating: 0,
    sort: readObject('preferences').sort ?? 'name-asc',
    page: 1,
    perPage: readObject('preferences').perPage ?? 8,
  },
});
let S = fresh();
const persist = () => KEYS.forEach((k) => store.set(k, S[k]));
const say = (text, error = false) => (S.msg = { text, error });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const LBL = { out: 'Out of stock', low: 'Low stock', in: 'In stock' };
const image = (p) =>
  `<img class="product-image" src="${import.meta.env.BASE_URL}${p.image || `products/product-${p.id}.svg`}" alt="Illustration of ${esc(p.name)}" loading="lazy">`;
const PROTECTED = {
  checkout: 'shop',
  orders: 'orders:own',
  admin: 'admin',
  wishlist: 'shop',
  profile: 'shop',
  preferences: 'shop',
  confirmation: 'orders:own',
};
const route = () => {
  const r = location.hash.replace(/^#\//, '').split('/')[0] || 'products';
  return PROTECTED[r] && !(S.user && can(S.user.role, PROTECTED[r]))
    ? S.user
      ? 'forbidden'
      : 'login'
    : r;
};
const empty = (t, d) =>
  `<div class="empty"><h2>${t}</h2><p>${d}</p><a class="btn" href="#/products">Continue shopping</a></div>`;

const card = (p) => {
  const lv = stockLevel(p.stock);
  const rating = productRating(p, S.reviews);
  const discount = promotionPercent(p);
  return `<article class="card" data-testid="product-card-${p.id}">${image(p)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}<h3><a href="#/products/${p.id}">${esc(p.name)}</a></h3><p class="muted">${p.category} · ★ ${rating.rating} (${rating.count})</p><p class="price">${money(effectivePrice(p))} ${discount ? `<s>${money(p.oldPrice)}</s> <span class="sale">−${discount}%</span>` : ''}</p><p class="${lv}">${LBL[lv]}</p><button class="btn" data-act="add" data-id="${p.id}" data-testid="product-add-cart-${p.id}" ${lv === 'out' ? 'disabled' : ''}>Add to cart</button> <button class="btn ghost" data-act="wish" data-id="${p.id}" aria-label="Toggle wishlist for ${esc(p.name)}" data-testid="product-add-wishlist-${p.id}">${S.wishlist[S.user?.username]?.includes(p.id) ? '♥ Saved' : '♡ Save'}</button></article>`;
};
const opts = (pairs, cur) =>
  pairs
    .map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`)
    .join('');

const catalog = () => {
  const { search, category, min, max, inStock, minRating, sort, page, perPage } = S.q;
  const list = sortProducts(
    filterProducts(
      searchProducts(
        S.products.filter((p) => p.active),
        search,
      ),
      {
        category,
        min: min === '' ? null : Math.round(Number(min) * 100),
        max: max === '' ? null : Math.round(Number(max) * 100),
        inStock,
        minRating: Number(minRating),
      },
    ),
    sort,
  );
  const pg = paginate(list, page, Number(perPage));
  const pages = Array.from({ length: pg.totalPages }, (_, i) => i + 1);
  return `<h1>Products</h1><form class="bar" data-form="search" role="search"><label>Search<input name="search" value="${esc(search)}" data-testid="search-input"></label><button class="btn">Search</button><label>Category<select data-q="category" data-testid="category-filter">${opts([['', 'All'], ...CATEGORIES.map((c) => [c, c])], category)}</select></label><label>Min €<input type="number" min="0" step="0.01" data-q="min" value="${esc(min)}"></label><label>Max €<input type="number" min="0" step="0.01" data-q="max" value="${esc(max)}"></label><label>In stock<input type="checkbox" data-q="inStock" ${inStock ? 'checked' : ''}></label><label>Rating<select data-q="minRating">${opts(
    [
      [0, 'Any'],
      [3, '3+'],
      [4, '4+'],
      [5, '5'],
    ],
    Number(minRating),
  )}</select></label><label>Sort<select data-q="sort" data-testid="sort-select">${opts(Object.entries(SORT_LABELS), sort)}</select></label><label>Per page<select data-q="perPage">${opts(
    [
      [4, '4'],
      [8, '8'],
      [16, '16'],
    ],
    Number(perPage),
  )}</select></label><button type="button" class="btn ghost" data-act="resetFilters">Reset filters</button></form>${pg.items.length ? `<div class="grid">${pg.items.map(card).join('')}</div>` : empty('No products found', 'Try different filters.')}<nav class="pager" aria-label="Pagination">${pages.map((n) => `<button class="btn ghost" data-act="page" data-id="${n}" ${n === pg.page ? 'aria-current="page"' : ''}>${n}</button>`).join('')}</nav>`;
};
const totals = () => {
  const lines = cartLines(S.cart, S.products);
  const sub = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return {
    lines,
    t: computeTotals({ lines, coupon: S.coupon, shippingCost: shippingCost(S.ship, sub) }),
  };
};
const summary = (t) =>
  `<dl><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd><dt>Discount</dt><dd>-${money(t.discount)}</dd><dt>Shipping</dt><dd>${money(t.shipping)}</dd><dt>Tax (20%)</dt><dd>${money(t.tax)}</dd><dt>Total</dt><dd><strong data-testid="cart-total">${money(t.total)}</strong></dd></dl>`;
const shipSel = () =>
  `<label>Shipping<select data-ship data-testid="shipping-method" name="shipping">${opts(
    Object.values(METHODS).map((m) => [m.id, m.label]),
    S.ship,
  )}</select></label>`;

const cart = () => {
  const { lines, t } = totals();
  if (!lines.length) return empty('Your cart is empty', 'Add something you like.');
  const rows = lines
    .map(
      (l) =>
        `<tr data-testid="cart-item-${l.id}"><td>${esc(l.name)}</td><td>${money(l.unitPrice)}</td><td><input type="number" min="0" value="${l.qty}" data-qty="${l.id}" aria-label="Quantity for ${esc(l.name)}"></td><td><button class="btn ghost" data-act="remove" data-id="${l.id}">Remove</button></td></tr>`,
    )
    .join('');
  return `<h1>Cart</h1><div class="table-wrap"><table><tbody>${rows}</tbody></table></div><form class="bar" data-form="coupon"><label>Coupon<input name="code" data-testid="coupon-input"></label><button class="btn" data-testid="coupon-apply">Apply</button>${shipSel()}</form>${S.coupon ? `<p>Coupon ${S.coupon.code} applied</p>` : ''}${summary(t)}<a class="btn" href="#/checkout">Checkout</a>`;
};
const checkout = () => {
  const { lines, t } = totals();
  if (!lines.length) return empty('Your cart is empty', 'Nothing to check out.');
  const c = S.checkout;
  const labels = ['Address', 'Shipping', 'Payment', 'Review'];
  const field = (name, label) =>
    `<label>${label}<input name="${name}" value="${esc(c[name])}" required ${name === 'address' ? 'data-testid="checkout-address"' : ''}></label>`;
  const content = [
    ['firstName', 'lastName', 'address', 'city', 'zip', 'country']
      .map((name) => field(name, name))
      .join(''),
    shipSel(),
    `<label>Payment<select name="payment" data-testid="payment-method">${opts(
      [
        ['card', 'Demo Card'],
        ['pod', 'Pay on Delivery'],
      ],
      c.payment,
    )}</select></label><label>Demo card number (only for Demo Card)<input name="card" value="${esc(c.card)}"></label>`,
    `<p>Deliver to ${esc(c.firstName)} ${esc(c.lastName)}, ${esc(c.address)}, ${esc(c.city)} ${esc(c.zip)}, ${esc(c.country)}.</p><p>Shipping: ${esc(METHODS[S.ship].label)} · Payment: ${esc(c.payment)}</p>${summary(t)}`,
  ];
  return `<h1>Checkout</h1><p>Cart → ${labels.map((label, i) => (i === c.step ? `<strong>${label}</strong>` : label)).join(' → ')} → Confirmation</p><form class="form" data-form="checkoutStep">${content[c.step]}<div>${c.step ? '<button class="btn ghost" type="button" data-act="checkoutBack">Back</button> ' : ''}<button class="btn" ${c.step === 3 ? 'data-testid="place-order"' : ''}>${c.step === 3 ? 'Place order' : 'Continue'}</button></div></form>`;
};
const orders = () => {
  const mine = S.orders.filter((o) => o.user === S.user.username);
  if (!mine.length) return empty('No orders yet', 'Your orders will appear here.');
  return `<h1>My Orders</h1><div class="table-wrap"><table><thead><tr><th>Number</th><th>Date</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${mine.map((o) => `<tr data-testid="order-${o.id}"><td data-testid="order-number">${esc(o.id)}</td><td>${esc(o.date.slice(0, 10))}</td><td>${money(o.totals.total)}</td><td>${esc(o.status)}</td><td><a href="#/orders/${encodeURIComponent(o.id)}">Details</a> ${o.status === 'Processing' ? `<button class="btn ghost" data-act="cancel" data-id="${o.id}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
};
const orderDetail = () => {
  const id = decodeURIComponent(location.hash.split('/')[2] ?? '');
  const o = S.orders.find((item) => item.id === id && item.user === S.user.username);
  if (!o) return empty('Order not found', 'Browse your orders.');
  return `<h1>Order ${esc(o.id)}</h1><p>${esc(o.date.slice(0, 10))} · ${esc(o.status)}</p><ul>${o.lines.map((l) => `<li>${esc(l.name)} × ${l.qty} — ${money(l.unitPrice * l.qty)}</li>`).join('')}</ul>${o.shippingAddress ? `<p>Delivery: ${esc(o.shippingAddress.firstName)} ${esc(o.shippingAddress.lastName)}, ${esc(o.shippingAddress.address)}, ${esc(o.shippingAddress.city)} ${esc(o.shippingAddress.zip)}, ${esc(o.shippingAddress.country)} · ${esc(o.shippingMethod)}</p>` : ''}${summary(o.totals)}<a class="btn ghost" href="#/orders">Back to orders</a>`;
};
const confirmation = () => {
  const o = S.orders.find(
    (item) => item.id === location.hash.split('/')[2] && item.user === S.user?.username,
  );
  return o
    ? `<h1 data-testid="order-confirmation">Order confirmed</h1><p>Number: <strong data-testid="order-number">${esc(o.id)}</strong></p>${summary(o.totals)}<a class="btn" href="#/orders/${encodeURIComponent(o.id)}">View order</a>`
    : empty('Order not found', 'Browse your orders.');
};
const detail = () => {
  const p = S.products.find((x) => x.id === Number(location.hash.split('/')[2]) && x.active);
  if (!p) return empty('Product not found', 'Explore the catalog.');
  const reviews = S.reviews.filter((r) => r.productId === p.id);
  return `<h1>${esc(p.name)}</h1><div class="detail">${image(p)}<div><p>${esc(p.description)}</p><p>SKU ${esc(p.sku)} · ${esc(p.category)} · ${LBL[stockLevel(p.stock)]}</p><p class="price">${money(effectivePrice(p))} ${promotionPercent(p) ? `<s>${money(p.oldPrice)}</s>` : ''}</p><form data-form="detailCart"><input type="hidden" name="id" value="${p.id}"><label>Quantity<input type="number" name="qty" min="1" max="${p.stock}" value="1"></label><button class="btn" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button></form><button class="btn ghost" data-act="wish" data-id="${p.id}">♡ Save</button></div></div><h2>Reviews</h2>${reviews.length ? reviews.map((r) => `<p><strong>${esc(r.username)} · ★ ${r.rating}</strong> ${esc(r.comment)}</p>`).join('') : '<p>No new reviews yet.</p>'}<form class="form" data-form="review"><input type="hidden" name="id" value="${p.id}"><label>Rating<select name="rating">${opts(
    [
      [1, '1'],
      [2, '2'],
      [3, '3'],
      [4, '4'],
      [5, '5'],
    ],
    5,
  )}</select></label><label>Comment<textarea name="comment" minlength="3" maxlength="500" required></textarea></label><button class="btn">Post review</button></form>`;
};
const wishlistView = () => {
  const ids = S.wishlist[S.user.username] ?? [];
  const items = S.products.filter((p) => ids.includes(p.id));
  return `<h1>Wishlist</h1>${items.length ? `<div class="grid">${items.map((p) => `${card(p)}<button class="btn ghost" data-act="moveWish" data-id="${p.id}" ${!p.active || !p.stock ? 'disabled' : ''}>Move to cart</button>`).join('')}</div>` : empty('Your wishlist is empty', 'Save products you like.')}`;
};
const profile = () => {
  const p =
    S.profiles[S.user.username] ?? S.users.find((u) => u.username === S.user.username) ?? {};
  const fields = ['firstName', 'lastName', 'email', 'address', 'city', 'zip', 'country'];
  return `<h1>Profile</h1><form class="form" data-form="profile">${fields.map((f) => `<label>${f}<input name="${f}" value="${esc(p[f] ?? '')}" ${f === 'email' ? 'type="email"' : ''}></label>`).join('')}<button class="btn">Save profile</button></form>`;
};
const preferences = () =>
  `<h1>Preferences</h1><form class="form" data-form="preferences"><label>Theme<select name="theme">${opts(
    [
      ['light', 'Light'],
      ['dark', 'Dark'],
    ],
    S.theme,
  )}</select></label><label>Preferred sort<select name="sort">${opts(Object.entries(SORT_LABELS), S.preferences.sort)}</select></label><label>Products per page<select name="perPage">${opts(
    [
      [4, '4'],
      [8, '8'],
      [16, '16'],
    ],
    Number(S.preferences.perPage),
  )}</select></label><button class="btn">Save preferences</button></form>`;
const registerView = () =>
  `<h1>Register</h1><form class="form" data-form="register"><label>First name<input name="firstName" required></label><label>Last name<input name="lastName" required></label><label>Email<input name="email" type="email" required></label><label>Username<input name="username" required></label><label>Password<input name="password" type="password" minlength="8" required></label><label>Confirm password<input name="confirm" type="password" required></label><label><input name="terms" type="checkbox" required> Accept demo terms</label><button class="btn">Create account</button></form>`;
const admin = () =>
  `<h1>Admin</h1><h2>Products and stock</h2><div class="table-wrap"><table><tbody>${S.products.map((p) => `<tr data-testid="admin-product-${p.id}"><td>${esc(p.name)}</td><td><form data-form="adminProduct"><input type="hidden" name="id" value="${p.id}"><label>Stock<input type="number" min="0" name="stock" value="${p.stock}" data-testid="admin-stock-${p.id}"></label><label>Price €<input type="number" min="0.01" step="0.01" name="price" value="${(p.price / 100).toFixed(2)}"></label><label>Active<input type="checkbox" name="active" ${p.active ? 'checked' : ''}></label><button class="btn">Save</button></form></td></tr>`).join('')}</tbody></table></div><h2>Orders</h2><div class="table-wrap"><table><tbody>${S.orders.map((o) => `<tr><td>${o.id}</td><td>${o.status}</td><td>${TRANSITIONS[o.status].map((n) => `<button class="btn ghost" data-act="status" data-id="${o.id}" data-next="${n}">${n}</button>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>`;
const loginView = () =>
  `<h1>Sign in</h1><form class="form" data-form="login"><label>Username<input name="username" data-testid="login-username" autocomplete="username"></label><label>Password<input name="password" type="password" data-testid="login-password" autocomplete="current-password"></label><button class="btn" data-testid="login-submit">Login</button><p class="muted">Demo: standard_user / demo123 · admin_user / admin123 · locked_user / demo123</p></form>`;
const VIEWS = {
  products: () => (location.hash.split('/')[2] ? detail() : catalog()),
  cart,
  checkout,
  orders: () => (location.hash.split('/')[2] ? orderDetail() : orders()),
  confirmation,
  admin,
  login: loginView,
  register: registerView,
  wishlist: wishlistView,
  profile,
  preferences,
  forbidden: () => empty('Access denied', 'You do not have permission to open this page.'),
};

const render = () => {
  document.documentElement.dataset.theme = S.theme;
  const r = route();
  const a = (h, t) => `<a href="#/${h}" ${r === h ? 'aria-current="page"' : ''}>${t}</a>`;
  document.getElementById('app').innerHTML =
    `<header><a class="logo" href="#/products">QA Demo Store</a><nav aria-label="Main">${a('products', 'Shop')}${S.user ? a('wishlist', 'Wishlist') + a('profile', 'Profile') + a('preferences', 'Preferences') + a('orders', 'My Orders') : a('register', 'Register')}${S.user && can(S.user.role, 'admin') ? a('admin', 'Admin') : ''}${a('cart', `Cart <span data-testid="cart-badge">${cartCount(S.cart)}</span>`)}${S.user ? `<button class="btn ghost" data-act="logout">Logout (${esc(S.user.username)})</button>` : a('login', 'Login')}<button class="btn ghost" data-act="theme">${S.theme === 'dark' ? 'Light' : 'Dark'} mode</button></nav></header><main>${S.msg ? `<div class="msg ${S.msg.error ? 'error' : ''}" role="${S.msg.error ? 'alert' : 'status'}" data-testid="message">${esc(S.msg.text)} <button type="button" data-act="dismiss" aria-label="Dismiss notification">×</button></div>` : ''}${(VIEWS[r] ?? (() => empty('Page not found', 'This route does not exist.')))()}</main><footer><button class="btn ghost" data-act="reset" data-testid="reset-demo">Reset Demo Data</button><p>Demo project — all data is fictional.</p></footer>`;
};

const ACTIONS = {
  add: (id) => {
    const p = S.products.find((x) => x.id === +id);
    const r = addToCart(S.cart, p);
    if (r.ok) ((S.cart = r.cart), say(`${p.name} added to cart`));
    else say(r.error, true);
  },
  remove: (id) => ((S.cart = removeFromCart(S.cart, +id)), say('Product removed from cart')),
  wish: (id) => {
    const r = toggleWishlist(
      S.wishlist,
      S.user?.username,
      S.products.find((p) => p.id === +id),
    );
    if (r.ok) ((S.wishlist = r.wishlist), say('Wishlist updated'));
    else say(r.error, true);
  },
  moveWish: (id) => {
    const p = S.products.find((x) => x.id === +id);
    const r = addToCart(S.cart, p);
    if (!r.ok) return say(r.error, true);
    S.cart = r.cart;
    S.wishlist = toggleWishlist(S.wishlist, S.user.username, p).wishlist;
    say(`${p.name} moved to cart`);
  },
  page: (id) => (S.q.page = +id),
  checkoutBack: () => (S.checkout.step = Math.max(0, S.checkout.step - 1)),
  resetFilters: () => (S.q = fresh().q),
  theme: () => {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    S.preferences.theme = S.theme;
    say(`${S.theme === 'dark' ? 'Dark' : 'Light'} mode enabled`);
  },
  dismiss: () => (S.msg = null),
  logout: () => ((S.user = null), (location.hash = '#/login')),
  reset: () => (
    resetDemoData(store),
    (S = fresh()),
    (location.hash = '#/products'),
    say('Demo data restored')
  ),
  cancel: (id) => ACTIONS.status(id, { dataset: { next: 'Cancelled' } }),
  status: (id, b) => {
    if (b.dataset.next !== 'Cancelled' && !can(S.user?.role, 'admin'))
      return say('Access denied', true);
    if (
      b.dataset.next === 'Cancelled' &&
      !can(S.user?.role, 'admin') &&
      !S.orders.some((o) => o.id === id && o.user === S.user?.username)
    )
      return say('Access denied', true);
    const r = changeStatus(S.orders, S.products, id, b.dataset.next);
    if (r.ok)
      (Object.assign(S, { orders: r.orders, products: r.products }),
        say(`Order ${id}: ${b.dataset.next}`));
    else say(r.error, true);
  },
};
const FORMS = {
  search: (d) => Object.assign(S.q, { search: d.search, page: 1 }),
  login: (d) => {
    const r = login(d.username, d.password, S.users);
    if (!r.ok) return say(r.error, true);
    S.user = r.user;
    S.checkout = { ...checkoutDefaults(), ...(S.profiles[r.user.username] ?? {}) };
    say(`Welcome ${r.user.username}`);
    location.hash = '#/products';
  },
  register: (d) => {
    const r = register(S.users, d);
    if (!r.ok) return say(r.error, true);
    Object.assign(S, { users: r.users, user: r.user });
    say('Account created');
    location.hash = '#/profile';
  },
  profile: (d) => {
    const r = updateProfile(S.profiles, S.user.username, d);
    if (!r.ok) return say(r.error, true);
    S.profiles = r.profiles;
    S.checkout = { ...S.checkout, ...r.profiles[S.user.username] };
    say('Profile saved');
  },
  preferences: (d) => {
    if (
      !['light', 'dark'].includes(d.theme) ||
      !SORT_LABELS[d.sort] ||
      ![4, 8, 16].includes(Number(d.perPage))
    )
      return say('Invalid preferences', true);
    S.preferences = { theme: d.theme, sort: d.sort, perPage: Number(d.perPage) };
    S.theme = d.theme;
    Object.assign(S.q, { sort: d.sort, perPage: Number(d.perPage), page: 1 });
    say('Preferences saved');
  },
  adminProduct: (d) => {
    if (!can(S.user?.role, 'admin')) return say('Access denied', true);
    const r = updateProduct(S.products, d.id, d);
    if (!r.ok) return say(r.error, true);
    S.products = r.products;
    say('Product updated');
  },
  detailCart: (d) => {
    const p = S.products.find((x) => x.id === Number(d.id));
    const r = addToCart(S.cart, p, Number(d.qty));
    if (!r.ok) return say(r.error, true);
    S.cart = r.cart;
    say(`${p.name} added to cart`);
  },
  review: (d) => {
    const r = addReview(S.reviews, S.user?.username, Number(d.id), d.rating, d.comment);
    if (!r.ok) return say(r.error, true);
    S.reviews = r.reviews;
    say('Review posted');
  },
  coupon: (d) => {
    const r = validateCoupon(d.code, totals().t.subtotal);
    if (!r.ok) return say(r.error, true);
    S.coupon = r.coupon;
    say(`Coupon ${r.coupon.code} applied`);
  },
  checkoutStep: (d) => {
    if (S.checkout.step === 0) {
      if (
        ['firstName', 'lastName', 'address', 'city', 'zip', 'country'].some(
          (key) => !String(d[key] ?? '').trim(),
        )
      )
        return say('Please complete the address', true);
      Object.assign(S.checkout, d);
    }
    if (S.checkout.step === 1) S.ship = d.shipping;
    if (S.checkout.step === 2) Object.assign(S.checkout, d);
    if (S.checkout.step < 3) {
      S.checkout.step++;
      return;
    }
    const p = pay(S.checkout.payment, S.checkout.card);
    if (!p.ok) return say(p.error, true);
    const { lines, t } = totals();
    const r = placeOrder({
      orders: S.orders,
      products: S.products,
      user: S.user.username,
      lines,
      totals: t,
      shippingAddress: Object.fromEntries(
        ['firstName', 'lastName', 'address', 'city', 'zip', 'country'].map((key) => [
          key,
          S.checkout[key],
        ]),
      ),
      shippingMethod: S.ship,
      now: new Date(),
    });
    if (!r.ok) return say(r.error, true);
    Object.assign(S, {
      orders: r.orders,
      products: r.products,
      cart: [],
      coupon: null,
      checkout: fresh().checkout,
    });
    say(`Order ${r.order.id} confirmed`);
    location.hash = `#/confirmation/${r.order.id}`;
  },
};
document.addEventListener('click', (e) => {
  if (e.target.closest('a')) S.msg = null;
  const b = e.target.closest('[data-act]');
  if (!b) return;
  S.msg = null;
  ACTIONS[b.dataset.act](b.dataset.id, b);
  persist();
  render();
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  S.msg = null;
  FORMS[e.target.dataset.form]?.(Object.fromEntries(new FormData(e.target)));
  persist();
  render();
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.q) {
    Object.assign(S.q, { [t.dataset.q]: t.type === 'checkbox' ? t.checked : t.value, page: 1 });
    if (t.dataset.q === 'sort' || t.dataset.q === 'perPage')
      S.preferences[t.dataset.q] = t.dataset.q === 'perPage' ? Number(t.value) : t.value;
  } else if ('ship' in t.dataset) S.ship = t.value;
  else if (t.dataset.qty) {
    const r = setQuantity(
      S.cart,
      S.products.find((p) => p.id === +t.dataset.qty),
      Number(t.value),
    );
    if (r.ok) ((S.cart = r.cart), say('Cart quantity updated'));
    else say(r.error, true);
  } else return;
  persist();
  render();
});
window.addEventListener('hashchange', render);
render();
