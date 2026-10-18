import { consentExpired, daysBetween, parisDate } from '../engine/index.js';
import { ApiProblem } from '../client/api-client.js';
import { mount } from './core/html.js';
import { href, parseHash, PROTECTED } from './core/router.js';
import { webFault } from './faults.js';
import { detectLang, getLang, setI18nFaults, setLang, t } from '../i18n/index.js';
import { CONSENT_VERSION, defaultCatalog, emptyCheckout, Persisted } from './state.js';
import { adminView } from './views/admin.js';
import {
  forbiddenView,
  loginView,
  loyaltyView,
  myDataView,
  notFoundView,
  preferencesView,
  privacyView,
  profileView,
  registerView,
  wishlistView,
} from './views/account.js';
import { catalogView, compareView, productView } from './views/catalog.js';
import { cartView, checkoutView, confirmationView } from './views/checkout.js';
import { problemText } from './views/components.js';
import { layout } from './views/layout.js';
import { invoiceView, orderDetailView, ordersView } from './views/orders.js';

const MAX_COMPARE = 3;

const MAX_RECENT = 4;

const VIEWS = {
  products: (state) => (state.route.params[0] ? productView(state) : catalogView(state)),
  cart: cartView,
  checkout: checkoutView,
  confirmation: confirmationView,
  orders: (state) => (state.route.params[0] ? orderDetailView(state) : ordersView(state)),
  invoice: invoiceView,
  login: loginView,
  register: registerView,
  wishlist: wishlistView,
  profile: profileView,
  loyalty: loyaltyView,
  preferences: preferencesView,
  'my-data': myDataView,
  privacy: privacyView,
  compare: compareView,
  admin: adminView,
  forbidden: forbiddenView,
};

const formEntries = (form) => {
  const values = new Map();
  new FormData(form).forEach((value, key) => {
    values.set(key, typeof value === 'string' ? value : value.name);
  });
  return values;
};

/** Reads a submitted form: missing fields (unchecked boxes) read as ''. */
const formValues = (form) => {
  const values = formEntries(form);
  return (name) => values.get(name) ?? '';
};

const eurosToCents = (value) => {
  if (value.trim() === '') return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
};

/** Application controller: routing, data loading, rendering and user actions. */
export class App {
  state;
  deps;
  persisted;
  afterLogin = href('products');
  pending = Promise.resolve();
  constructor(deps) {
    this.deps = deps;
    this.persisted = new Persisted(deps.storage);
    const prefs = this.persisted.read('prefs', {});
    const params = new URLSearchParams(deps.location.search);
    const lang = detectLang([params.get('lang'), prefs.lang, ...deps.languages]);
    setLang(lang);
    this.state = {
      route: parseHash(deps.location.hash),
      view: 'loading',
      data: {},
      problem: null,
      user: null,
      meta: null,
      transport: deps.transport,
      lang,
      theme: prefs.theme ?? 'light',
      message: null,
      cart: [],
      coupon: null,
      shippingMethod: 'standard',
      country: 'FR',
      redeemPoints: 0,
      quote: null,
      quoteProblem: null,
      checkout: emptyCheckout(),
      catalog: defaultCatalog(prefs.sort, prefs.perPage),
      consent: this.persisted.read('consent', null),
      consentOpen: false,
      consentCustomize: false,
      compare: [],
      recentlyViewed: this.persisted.read('recent', []),
      qa: {
        visible: params.get('qa') === '1' || prefs.qa === true,
        latency: Number(params.get('latency') ?? 0) || 0,
        fail: params.get('fail') ?? '',
      },
    };
    this.applyNetworkFaults();
  }
  /** Waits for the last action (tests and automation). */
  idle() {
    return this.pending;
  }
  async start() {
    const params = new URLSearchParams(this.deps.location.search);
    const now = params.get('now');
    const seed = params.get('seed');
    if (now) await this.safe(() => this.deps.api.post('/demo/clock', { now }));
    if (seed !== null)
      await this.safe(() =>
        this.deps.api.post('/demo/ids', { seed: seed === 'off' ? null : Number(seed) }),
      );
    await this.refreshSession();
    this.restoreCart();
    this.checkConsent();
    this.deps.root.addEventListener('click', (event) => {
      this.track(this.onClick(event));
    });
    this.deps.root.addEventListener('submit', (event) => {
      this.track(this.onSubmit(event));
    });
    this.deps.root.addEventListener('change', (event) => {
      this.track(this.onChange(event));
    });
    await this.navigate(this.deps.location.hash);
  }
  track(work) {
    this.pending = this.pending.then(() => work).catch(() => undefined);
  }
  async safe(work) {
    try {
      await work();
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }
  fail(error) {
    if (error instanceof ApiProblem) {
      this.state.problem = error.problem;
      this.say(problemText(this.state, error.problem), true);
      if (error.problem.code === 'AUTH_REQUIRED' && this.state.user) this.state.user = null;
      return;
    }
    this.say(t('error.INTERNAL_ERROR'), true);
  }
  say(text, error = false) {
    this.state.message = { text, error };
  }
  async refreshSession() {
    const [meta, me] = await Promise.all([
      this.deps.api.get('/meta').catch(() => null),
      this.deps.api.get('/auth/me').catch(() => ({ user: null })),
    ]);
    this.state.meta = meta;
    this.state.user = me.user;
    setI18nFaults({
      rawKeyPrefixes: webFault(this.state, 'FAULT-I18N-01') ? ['cart.', 'summary.'] : [],
      usDates: webFault(this.state, 'FAULT-I18N-02'),
    });
  }
  today() {
    return parisDate(this.state.meta ? new Date(this.state.meta.now) : new Date(0));
  }
  // ---------- persistence ----------
  restoreCart() {
    const saved = this.persisted.read('cart', null);
    if (!saved) return;
    if (this.state.meta && daysBetween(saved.updatedAt, this.today()) > 30) {
      this.persisted.remove('cart');
      return;
    }
    this.state.cart = saved.lines.filter(
      (line) => Number.isInteger(line.productId) && Number.isInteger(line.qty) && line.qty > 0,
    );
  }
  saveCart() {
    if (this.state.cart.length)
      this.persisted.write('cart', { lines: this.state.cart, updatedAt: this.today() });
    else this.persisted.remove('cart');
  }
  savePrefs() {
    this.persisted.write('prefs', {
      lang: this.state.lang,
      theme: this.state.theme,
      sort: this.state.catalog.sort,
      perPage: this.state.catalog.perPage,
      qa: this.state.qa.visible,
    });
  }
  checkConsent() {
    const consent = this.state.consent;
    if (
      consent &&
      this.state.meta &&
      (consent.version !== CONSENT_VERSION ||
        consentExpired(consent.date, new Date(this.state.meta.now)))
    ) {
      this.state.consent = null;
      this.persisted.remove('consent');
    }
  }
  applyNetworkFaults() {
    const fail = {};
    for (const rule of this.state.qa.fail.split(',')) {
      const [route, code] = rule.split(':');
      if (route?.trim() && Number(code) >= 400) fail[route.trim()] = Number(code);
    }
    this.deps.api.injection.fail = fail;
    this.deps.api.injection.latency = Math.min(30000, Math.max(0, this.state.qa.latency));
  }
  // ---------- routing & rendering ----------
  async navigate(hash) {
    const route = parseHash(hash);
    const required = PROTECTED[route.name];
    if (required && !this.state.user) {
      this.afterLogin = hash || href('products');
      this.state.route = { name: 'login', params: [] };
    } else if (required === 'admin' && this.state.user?.role !== 'admin') {
      this.state.route = { name: 'forbidden', params: [] };
    } else {
      this.state.route = route;
    }
    this.state.problem = null;
    this.state.data = {};
    this.state.view = 'loading';
    this.render(true);
    try {
      await this.load();
      this.state.view = this.state.data.empty ? 'empty' : 'ready';
    } catch (error) {
      this.state.view = 'error';
      this.fail(error);
    }
    this.render(true);
  }
  /** Renders the page. `keepForms` restores what the user typed (after a failed submission). */
  render(focusHeading = false, keepForms = false) {
    const doc = this.deps.root.ownerDocument;
    const typed = keepForms ? this.captureForms() : [];
    doc.documentElement.lang = this.state.lang;
    doc.documentElement.dataset.theme = this.state.theme;
    doc.documentElement.classList.toggle('fault-no-focus', webFault(this.state, 'FAULT-A11Y-02'));
    const active = doc.activeElement;
    const key = active?.getAttribute('data-testid') ?? (active?.id ? `#${active.id}` : null);
    const view = VIEWS[this.state.route.name] ?? notFoundView;
    mount(this.deps.root, layout(this.state, view(this.state)));
    for (const [selector, value] of typed) {
      const field = this.deps.root.querySelector(selector);
      if (!field) continue;
      if (field.type === 'checkbox') field.checked = value === 'on';
      else field.value = value;
    }
    if (focusHeading) {
      const heading = this.deps.root.querySelector('main h1');
      heading?.setAttribute('tabindex', '-1');
      if (this.state.view !== 'loading') heading?.focus();
    } else if (key) {
      const target = key.startsWith('#')
        ? doc.getElementById(key.slice(1))
        : this.deps.root.querySelector(`[data-testid="${key.replace(/"/g, '')}"]`);
      target?.focus();
    }
  }
  captureForms() {
    const fields = this.deps.root.querySelectorAll('form[data-form] [name]');
    return [...fields]
      .filter((field) => field.type !== 'hidden')
      .map((field) => [
        `form[data-form="${field.form?.dataset.form ?? ''}"] [name="${field.name}"]`,
        field.type === 'checkbox' ? (field.checked ? 'on' : '') : field.value,
      ]);
  }
  async load() {
    const { name, params } = this.state.route;
    const api = this.deps.api;
    const id = params[0];
    switch (name) {
      case 'products':
        if (id) await this.loadProduct(Number(id));
        else await this.loadCatalog();
        return;
      case 'cart':
        this.state.data.products = (await api.get('/products?perPage=48')).items;
        await this.refreshQuote();
        return;
      case 'checkout':
        await this.loadCheckout();
        return;
      case 'confirmation':
        this.state.data.order = await api.get(`/orders/${encodeURIComponent(id ?? '')}`);
        return;
      case 'orders':
        if (id) this.state.data.order = await api.get(`/orders/${encodeURIComponent(id)}`);
        else {
          const list = await api.get('/orders');
          this.state.data.orders = list.items;
          this.state.data.empty = !list.items.length;
        }
        return;
      case 'invoice':
        this.state.data.invoice = await api.get(`/orders/${encodeURIComponent(id ?? '')}/invoice`);
        return;
      case 'wishlist': {
        const list = await api.get('/me/wishlist');
        this.state.data.items = list.items;
        this.state.data.wishlistIds = list.items.map((p) => p.id);
        this.state.data.empty = !list.items.length;
        return;
      }
      case 'profile':
        this.state.data.profile = await api.get('/me/profile');
        return;
      case 'loyalty':
        this.state.data.loyalty = await api.get('/me/loyalty');
        return;
      case 'my-data':
        this.state.data.consents = await api.get('/me/consents');
        return;
      case 'compare':
        this.state.data.products = await Promise.all(
          this.state.compare.map(
            async (productId) => (await api.get(`/products/${String(productId)}`)).product,
          ),
        );
        this.state.data.empty = !this.state.compare.length;
        return;
      case 'admin':
        await this.loadAdmin();
        return;
      default:
        return;
    }
  }
  catalogPath() {
    const q = this.state.catalog;
    const search = new URLSearchParams({
      sort: q.sort,
      page: String(q.page),
      perPage: String(q.perPage),
    });
    if (q.search) search.set('search', q.search);
    if (q.category) search.set('category', q.category);
    const min = eurosToCents(q.min);
    const max = eurosToCents(q.max);
    if (min !== null) search.set('min', String(min));
    if (max !== null) search.set('max', String(max));
    if (q.inStock) search.set('inStock', 'true');
    if (q.minRating) search.set('minRating', String(q.minRating));
    return `/products?${search.toString()}`;
  }
  async loadCatalog() {
    const api = this.deps.api;
    const page = await api.get(this.catalogPath());
    this.state.data.page = page;
    this.state.data.empty = !page.items.length;
    if (this.state.user)
      this.state.data.wishlistIds = (await api.get('/me/wishlist')).items.map((p) => p.id);
    if (this.state.consent?.personalization && this.state.recentlyViewed.length) {
      const results = await Promise.allSettled(
        this.state.recentlyViewed.map((productId) => api.get(`/products/${String(productId)}`)),
      );
      this.state.data.recent = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value.product] : [],
      );
    }
  }
  async loadProduct(productId) {
    const detail = await this.deps.api.get(`/products/${String(productId)}`);
    this.state.data.detail = detail;
    const total = detail.product.effectivePrice;
    if (total >= 10000 && total <= 200000) {
      this.state.data.plans = await Promise.all(
        [3, 4].map((count) => this.deps.api.post('/installments/simulate', { total, count })),
      );
    }
    if (this.state.consent?.personalization) {
      this.state.recentlyViewed = [
        productId,
        ...this.state.recentlyViewed.filter((other) => other !== productId),
      ].slice(0, MAX_RECENT);
      this.persisted.write('recent', this.state.recentlyViewed);
    }
  }
  async loadCheckout() {
    const api = this.deps.api;
    const c = this.state.checkout;
    if (!c.firstName && !c.address) {
      const profile = await api.get('/me/profile');
      this.state.checkout = {
        ...c,
        firstName: profile.firstName,
        lastName: profile.lastName,
        address: profile.address,
        city: profile.city,
        zip: profile.zip,
        country: profile.country || this.state.country,
      };
    }
    this.state.data.loyalty = await api.get('/me/loyalty');
    await this.refreshQuote();
  }
  async loadAdmin() {
    const api = this.deps.api;
    const today = this.today();
    const period = this.state.data.period ?? {
      from: `${today.slice(0, 7)}-01`,
      to: today,
    };
    const [products, orders, kpis, reorder] = await Promise.all([
      api.get('/admin/products'),
      api.get('/admin/orders'),
      api.get(`/admin/kpis?from=${period.from}&to=${period.to}`),
      api.get('/admin/inventory/reorder'),
    ]);
    Object.assign(this.state.data, {
      products: products.items,
      orders: orders.items,
      kpis,
      reorder: reorder.items,
      period,
    });
  }
  async refreshQuote() {
    this.state.quote = null;
    this.state.quoteProblem = null;
    if (!this.state.cart.length) return;
    try {
      this.state.quote = await this.deps.api.post('/quotes', {
        lines: this.state.cart,
        couponCode: this.state.coupon,
        shippingMethod: this.state.shippingMethod,
        destination: {
          country:
            this.state.route.name === 'checkout' ? this.state.checkout.country : this.state.country,
        },
        loyaltyPointsToRedeem: this.state.route.name === 'checkout' ? this.state.redeemPoints : 0,
      });
    } catch (error) {
      if (!(error instanceof ApiProblem)) throw error;
      this.state.quoteProblem = error.problem;
    }
  }
  // ---------- events ----------
  async onClick(event) {
    const target = event.target?.closest('[data-act]');
    if (!target) return;
    const act = target.dataset.act ?? '';
    const id = target.dataset.id ?? '';
    const actions = {
      add: () => this.addToCart(Number(id), 1),
      wish: () => this.toggleWish(Number(id)),
      compare: () => this.toggleCompare(Number(id)),
      page: async () => {
        this.state.catalog.page = Number(id);
        await this.reload();
      },
      resetFilters: async () => {
        this.state.catalog = defaultCatalog(this.state.catalog.sort, this.state.catalog.perPage);
        await this.reload();
      },
      remove: () => this.setQty(Number(id), 0),
      removeCoupon: async () => {
        this.state.coupon = null;
        await this.refreshQuote();
      },
      checkoutBack: () => {
        this.state.checkout.step = Math.max(0, this.state.checkout.step - 1);
        return Promise.resolve();
      },
      cancel: () =>
        this.mutate(
          () => this.deps.api.post(`/orders/${encodeURIComponent(id)}/cancel`),
          t('orders.cancelled', { id }),
        ),
      status: () =>
        this.mutate(
          () =>
            this.deps.api.patch(`/admin/orders/${encodeURIComponent(id)}/status`, {
              status: target.dataset.next,
            }),
          t('admin.statusChanged', { id }),
        ),
      logout: () => this.logout(),
      theme: () => {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.savePrefs();
        this.say(t(this.state.theme === 'dark' ? 'nav.darkEnabled' : 'nav.lightEnabled'));
        return Promise.resolve();
      },
      lang: () => {
        this.setLanguage(id);
        return Promise.resolve();
      },
      dismiss: () => {
        this.state.message = null;
        return Promise.resolve();
      },
      reset: () => this.resetDemo(this.state.meta?.scenario ?? 'default'),
      consentAccept: () => this.saveConsent(true, true),
      consentReject: () => this.saveConsent(false, false),
      consentCustomize: () => {
        this.state.consentCustomize = true;
        return Promise.resolve();
      },
      consentManage: () => {
        this.state.consentOpen = true;
        this.state.consentCustomize = true;
        return Promise.resolve();
      },
      moveWish: async () => {
        await this.addToCart(Number(id), 1);
        await this.toggleWish(Number(id));
      },
      returnQuote: () => this.returnRequest(target.closest('form'), true),
      exportData: async () => {
        const data = await this.deps.api.get('/me/export');
        this.deps.download(
          `qa-demo-store-export-${this.today()}.json`,
          JSON.stringify(data, null, 2),
        );
        this.say(t('myData.exported'));
      },
      print: () => {
        this.deps.print();
        return Promise.resolve();
      },
      purge: async () => {
        this.state.data.purge = await this.deps.api.post('/admin/privacy/purge');
        this.say(t('admin.purged.done'));
      },
      qaClockReal: () => this.qaThen(() => this.deps.api.delete('/demo/clock')),
    };
    const action = actions[act];
    if (!action) return;
    event.preventDefault();
    if (!(await this.safe(action))) this.render();
    else this.render(false);
  }
  async onSubmit(event) {
    const form = event.target;
    const kind = form.dataset.form;
    if (!kind) return;
    event.preventDefault();
    const values = formValues(form);
    const handlers = {
      search: async () => {
        const min = values('min');
        const max = values('max');
        Object.assign(this.state.catalog, {
          search: values('search'),
          category: values('category'),
          min,
          max,
          inStock: values('inStock') === 'on',
          minRating: Number(values('minRating')),
          sort: values('sort'),
          perPage: Number(values('perPage')),
          page: 1,
        });
        await this.reload();
      },
      coupon: async () => {
        const code = values('code').trim().toUpperCase();
        if (!code) return;
        this.state.coupon = code;
        await this.refreshQuote();
        if (this.state.quoteProblem && /COUPON/.test(this.state.quoteProblem.code)) {
          this.say(problemText(this.state, this.state.quoteProblem), true);
          this.state.coupon = null;
          await this.refreshQuote();
        } else this.say(t('cart.couponApplied', { code }));
      },
      detailCart: () => this.addToCart(Number(values('id')), Number(values('qty'))),
      review: () =>
        this.mutate(
          () =>
            this.deps.api.post(`/products/${values('id')}/reviews`, {
              rating: Number(values('rating')),
              comment: values('comment'),
            }),
          t('product.reviewPosted'),
        ),
      stockAlert: () =>
        this.mutate(
          () =>
            this.deps.api.post(`/products/${values('id')}/stock-alerts`, {
              consent: values('consent') === 'on',
            }),
          t('product.alertSaved'),
        ),
      checkoutStep: () => this.checkoutStep(values),
      login: () => this.login(values('username'), values('password')),
      register: () => this.register(values),
      profile: () =>
        this.mutate(
          () =>
            this.deps.api.put('/me/profile', {
              firstName: values('firstName'),
              lastName: values('lastName'),
              email: values('email'),
              phone: values('phone'),
              address: values('address'),
              city: values('city'),
              zip: values('zip'),
              country: values('country'),
            }),
          t('profile.saved'),
        ),
      preferences: async () => {
        this.state.theme = values('theme') === 'dark' ? 'dark' : 'light';
        this.state.catalog.sort = values('sort');
        this.state.catalog.perPage = Number(values('perPage'));
        this.state.qa.visible = values('qa') === 'on';
        this.setLanguage(values('lang') === 'en' ? 'en' : 'fr');
        this.say(t('preferences.saved'));
        await Promise.resolve();
      },
      newsletter: () =>
        this.mutate(
          () => this.deps.api.put('/me/consents', { newsletter: values('newsletter') === 'on' }),
          t('myData.consentSaved'),
        ),
      deleteAccount: async () => {
        await this.deps.api.delete('/me', { password: values('password') });
        this.state.user = null;
        this.state.cart = [];
        this.saveCart();
        this.say(t('myData.deleted'));
        this.goTo(href('products'));
      },
      returnRequest: () => this.returnRequest(form, false),
      adminProduct: async () => {
        const price = eurosToCents(values('price'));
        await this.mutate(
          () =>
            this.deps.api.patch(`/admin/products/${values('id')}`, {
              stock: Number(values('stock')),
              active: values('active') === 'on',
              ...(price === null ? {} : { price }),
            }),
          t('admin.productSaved'),
        );
      },
      kpiPeriod: async () => {
        this.state.data.period = { from: values('from'), to: values('to') };
        await this.loadAdmin();
      },
      consent: () =>
        this.saveConsent(values('analytics') === 'on', values('personalization') === 'on'),
      qaReset: () => this.resetDemo(values('scenario')),
      qaClock: () =>
        this.qaThen(() => this.deps.api.post('/demo/clock', { now: values('now').trim() })),
      qaNetwork: () => {
        this.state.qa.latency = Number(values('latency')) || 0;
        this.state.qa.fail = values('fail');
        this.applyNetworkFaults();
        this.say(t('qa.applied'));
        return Promise.resolve();
      },
    };
    const handler = handlers[kind];
    if (!handler) return;
    const ok = await this.safe(handler);
    this.render(false, !ok || this.state.message?.error === true);
  }
  async onChange(event) {
    const input = event.target;
    const form = input.closest('form');
    if (input.dataset.qty !== undefined) {
      await this.safe(() => this.setQty(Number(input.dataset.qty), Number(input.value)));
    } else if (input.dataset.ship !== undefined || input.dataset.country !== undefined) {
      if (input.dataset.ship !== undefined) this.state.shippingMethod = input.value;
      else if (this.state.route.name === 'checkout') this.state.checkout.country = input.value;
      else this.state.country = input.value;
      await this.safe(() => this.refreshQuote());
    } else if (form?.dataset.form === 'search' && input instanceof HTMLSelectElement) {
      form.requestSubmit();
      return;
    } else return;
    this.render();
  }
  // ---------- use cases ----------
  /** Reloads the current view's data and recomputes its data-state. */
  async reload() {
    delete this.state.data.empty;
    await this.load();
    this.state.view = this.state.data.empty ? 'empty' : 'ready';
  }
  goTo(hash) {
    this.deps.location.hash = hash;
    this.track(this.navigate(hash));
  }
  async mutate(work, success) {
    await work();
    this.say(success);
    await this.reload();
  }
  async qaThen(work) {
    await work();
    await this.refreshSession();
    this.say(t('qa.applied'));
    await this.reload();
  }
  setLanguage(lang) {
    setLang(lang);
    this.state.lang = getLang();
    this.savePrefs();
  }
  async addToCart(productId, qty) {
    if (!Number.isInteger(qty) || qty < 1) {
      this.say(t('cart.invalidQuantity'), true);
      return;
    }
    const current = this.state.cart.find((line) => line.productId === productId);
    const next = (current?.qty ?? 0) + qty;
    const { product } = await this.deps.api.get(`/products/${String(productId)}`);
    if (product.stockLevel === 'out' || next > Math.min(20, product.stock)) {
      this.say(t('cart.notEnoughStock', { name: product.name }), true);
      return;
    }
    this.state.cart = current
      ? this.state.cart.map((line) =>
          line.productId === productId ? { ...line, qty: next } : line,
        )
      : [...this.state.cart, { productId, qty }];
    this.saveCart();
    this.say(t('cart.added', { name: product.name }));
  }
  async setQty(productId, qty) {
    if (!Number.isInteger(qty) || qty < 0 || qty > 20) {
      this.say(t('cart.invalidQuantity'), true);
      return;
    }
    this.state.cart =
      qty === 0
        ? this.state.cart.filter((line) => line.productId !== productId)
        : this.state.cart.map((line) => (line.productId === productId ? { ...line, qty } : line));
    this.saveCart();
    await this.refreshQuote();
    if (this.state.quoteProblem) this.say(problemText(this.state, this.state.quoteProblem), true);
  }
  async toggleWish(productId) {
    if (!this.state.user) {
      this.say(t('wishlist.signIn'), true);
      return;
    }
    const result = await this.deps.api.post(`/me/wishlist/${String(productId)}/toggle`);
    this.say(t(result.saved ? 'wishlist.saved' : 'wishlist.removed'));
    await this.reload();
  }
  async toggleCompare(productId) {
    if (this.state.compare.includes(productId))
      this.state.compare = this.state.compare.filter((other) => other !== productId);
    else if (this.state.compare.length >= MAX_COMPARE) {
      this.say(t('compare.full', { max: MAX_COMPARE }), true);
      return;
    } else this.state.compare = [...this.state.compare, productId];
    if (this.state.route.name === 'compare') await this.reload();
  }
  async checkoutStep(values) {
    const c = this.state.checkout;
    if (c.step === 0) {
      const required = ['firstName', 'lastName', 'address', 'city', 'zip'];
      if (
        required.some((name) => !values(name).trim()) ||
        !/^[\p{L}\p{N} -]{3,12}$/u.test(values('zip'))
      ) {
        this.say(t('checkout.missing'), true);
        return;
      }
      this.state.checkout = {
        ...c,
        firstName: values('firstName'),
        lastName: webFault(this.state, 'FAULT-PRB-03') ? '' : values('lastName'),
        address: values('address'),
        city: values('city'),
        zip: values('zip'),
        country: values('country'),
        step: 1,
      };
      await this.refreshQuote();
      return;
    }
    if (c.step === 1) {
      this.state.redeemPoints = Number(values('redeem')) || 0;
      await this.refreshQuote();
      if (this.state.quoteProblem) {
        this.say(problemText(this.state, this.state.quoteProblem), true);
        return;
      }
      c.step = 2;
      return;
    }
    if (c.step === 2) {
      Object.assign(c, {
        payment: values('payment') === 'pod' ? 'pod' : 'card',
        card: values('card'),
        installments: Number(values('installments')) || 1,
        step: 3,
      });
      return;
    }
    await this.placeOrder();
  }
  async placeOrder() {
    const c = this.state.checkout;
    await this.refreshQuote();
    if (!this.state.quote) {
      this.say(problemText(this.state, this.state.quoteProblem), true);
      return;
    }
    const order = await this.deps.api.post(
      '/orders',
      {
        quoteId: this.state.quote.quoteId,
        payment: c.payment === 'card' ? { method: 'card', card: c.card } : { method: 'pod' },
        shippingAddress: {
          firstName: c.firstName,
          lastName: c.lastName,
          address: c.address,
          city: c.city,
          zip: c.zip,
          country: c.country,
        },
        installments: c.installments,
      },
      { 'Idempotency-Key': `checkout-${this.deps.randomId()}` },
    );
    this.state.cart = [];
    this.state.coupon = null;
    this.state.redeemPoints = 0;
    this.state.checkout = emptyCheckout();
    this.saveCart();
    this.say(t('confirmation.message', { id: order.id }));
    this.goTo(href('confirmation', order.id));
  }
  async login(username, password) {
    const result = await this.deps.api.post('/auth/login', {
      username: username.trim(),
      password,
    });
    await this.refreshSession();
    this.state.checkout = emptyCheckout();
    this.say(t('login.welcome', { name: result.user.firstName }));
    this.goTo(this.afterLogin);
    this.afterLogin = href('products');
  }
  async register(values) {
    await this.deps.api.post('/auth/register', {
      firstName: values('firstName'),
      lastName: values('lastName'),
      email: values('email'),
      username: values('username'),
      password: values('password'),
      confirm: values('confirm'),
      terms: values('terms') === 'on',
      newsletter: values('newsletter') === 'on',
    });
    await this.refreshSession();
    this.say(t('register.done'));
    this.goTo(href('products'));
  }
  async logout() {
    await this.deps.api.post('/auth/logout');
    this.state.user = null;
    this.state.checkout = emptyCheckout();
    setI18nFaults({ rawKeyPrefixes: [], usDates: false });
    this.goTo(href('login'));
  }
  async resetDemo(scenario) {
    await this.deps.api.post('/demo/reset', { scenario });
    this.state.cart = [];
    this.state.coupon = null;
    this.state.compare = [];
    this.saveCart();
    await this.refreshSession();
    this.say(t('demo.resetDone', { scenario }));
    this.goTo(href('products'));
  }
  async saveConsent(analytics, personalization) {
    this.state.consent = {
      analytics,
      personalization,
      date: this.today(),
      version: CONSENT_VERSION,
    };
    this.state.consentOpen = false;
    this.state.consentCustomize = false;
    this.persisted.write('consent', this.state.consent);
    if (!personalization) {
      this.state.recentlyViewed = [];
      this.persisted.remove('recent');
    }
    let visitor = this.persisted.read('visitor', null);
    if (!visitor) {
      visitor = this.deps.randomId();
      this.persisted.write('visitor', visitor);
    }
    await this.deps.api
      .post('/consents', {
        visitorId: visitor,
        choices: { analytics, personalization },
        policyVersion: CONSENT_VERSION,
      })
      .catch(() => undefined);
    this.say(t('consent.saved'));
  }
  async returnRequest(form, simulateOnly) {
    if (!form) return;
    const values = formValues(form);
    const lines = [...formEntries(form)]
      .filter(([key]) => key.startsWith('qty-'))
      .map(([key, value]) => ({ productId: Number(key.slice(4)), qty: Number(value) || 0 }));
    const orderId = values('orderId');
    this.state.data.returnLines = lines;
    if (simulateOnly) {
      this.state.data.returnQuote = await this.deps.api.post('/returns/quote', { orderId, lines });
      return;
    }
    await this.mutate(
      () => this.deps.api.post('/returns', { orderId, lines, reason: values('reason') }),
      t('returns.done'),
    );
  }
}
