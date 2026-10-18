import { attr, html } from '../core/html.js';
import { href } from '../core/router.js';
import { webFault } from '../faults.js';
import { money, percent, t } from '../../i18n/index.js';
import { TID } from '../testids.js';

export const BASE_URL = import.meta.env.BASE_URL;

export const image = (product, eager = false) =>
  html`<img
    class="product-image"
    src="${BASE_URL}${product.image}"
    alt="${t('product.imageAlt', { name: product.name })}"
    width="640"
    height="400"
    ${attr('loading', eager ? null : 'lazy')}
  />`;

export function priceTag(state, product) {
  const lowContrast = webFault(state, 'FAULT-A11Y-03') ? ' price--faint' : '';
  return html`<p class="price${lowContrast}" data-testid="${TID.productPrice(product.id)}">
    <span>${money(product.effectivePrice)}</span>
    ${product.promotionPercent ? html`<s>${money(product.oldPrice)}</s> <span class="badge badge--sale">−${product.promotionPercent} %</span>` : ''}
  </p>`;
}

const STOCK_CLASS = { out: 'stock--out', low: 'stock--low', in: 'stock--in' };

export const stockLabel = (product) =>
  html`<p class="stock ${STOCK_CLASS[product.stockLevel]}">${t(`stock.${product.stockLevel}`)}</p>`;

export function productCard(state, product) {
  const saved = state.data.wishlistIds?.includes(product.id) ?? false;
  const comparing = state.compare.includes(product.id);
  return html`<article class="card product-card" data-testid="${TID.productCard(product.id)}">
    <a class="card__media" href="${href('products', product.id)}" tabindex="-1"
      >${image(product)}</a
    >
    ${product.badge ? html`<span class="badge">${t(`badge.${product.badge}`)}</span>` : ''}
    <h3 class="card__title"><a href="${href('products', product.id)}">${product.name}</a></h3>
    <p class="muted">
      ${t(`category.${product.category}`)} · ★ ${product.rating} (${product.reviewCount})
    </p>
    ${priceTag(state, product)} ${stockLabel(product)}
    <div class="card__actions">
      <button
        class="btn"
        type="button"
        data-act="add"
        data-id="${product.id}"
        data-testid="${TID.productAddCart(product.id)}"
        ${attr('disabled', product.stockLevel === 'out')}
      >
        ${t('product.addToCart')}
      </button>
      <button
        class="btn btn--ghost"
        type="button"
        data-act="wish"
        data-id="${product.id}"
        data-testid="${TID.productAddWishlist(product.id)}"
        aria-pressed="${String(saved)}"
        aria-label="${t(saved ? 'product.unsaveFor' : 'product.saveFor', { name: product.name })}"
      >
        ${saved ? '♥' : '♡'}
      </button>
      <button
        class="btn btn--ghost"
        type="button"
        data-act="compare"
        data-id="${product.id}"
        data-testid="${TID.productCompare(product.id)}"
        aria-pressed="${String(comparing)}"
      >
        ${t(comparing ? 'compare.remove' : 'compare.add')}
      </button>
    </div>
  </article>`;
}

export const emptyState = (title, detail, action = true) =>
  html`<div class="empty" data-state="empty">
    <h2>${title}</h2>
    <p>${detail}</p>
    ${action ? html`<a class="btn" href="${href('products')}">${t('common.continueShopping')}</a>` : ''}
  </div>`;

export function problemText(state, problem) {
  if (!problem) return '';
  if (webFault(state, 'FAULT-ERR-02')) return 'Error';
  const key = `error.${problem.code}`;
  const translated = t(
    key,
    Object.fromEntries(
      Object.entries(problem.details ?? {}).map(([k, v]) => [
        k,
        typeof v === 'number' && /total|minimum|cap/i.test(k) ? money(v) : String(v),
      ]),
    ),
  );
  return translated === key ? problem.title : translated;
}

export const errorBox = (state, problem) =>
  problem
    ? html`<p class="alert alert--error" role="alert">${problemText(state, problem)}</p>`
    : html``;

/** Field with an explicit label (FAULT-A11Y-01 removes the label for a11y_user). */
export function field(state, options) {
  const idAttr = `f-${options.name}`;
  const input = html`<input
    id="${idAttr}"
    name="${options.name}"
    type="${options.type ?? 'text'}"
    value="${options.value ?? ''}"
    ${attr('data-testid', options.testid)}${attr('required', options.required ?? false)}${attr('autocomplete', options.autocomplete)}${attr('aria-describedby', options.hint ? `${idAttr}-hint` : null)}${options.extra ?? ''}
  />`;
  const hint = options.hint
    ? html`<small id="${idAttr}-hint" class="muted">${options.hint}</small>`
    : '';
  if (webFault(state, 'FAULT-A11Y-01'))
    return html`<div class="field"><span>${options.label}</span>${input}${hint}</div>`;
  return html`<div class="field">
    <label for="${idAttr}"
      >${options.label}${options.required ? html` <span aria-hidden="true">*</span>` : ''}</label
    >${input}${hint}
  </div>`;
}

export const options = (items, selected) =>
  html`${items.map(([value, label]) => html`<option value="${value}" ${attr('selected', String(value) === String(selected))}>${label}</option>`)}`;

export function summary(quote) {
  const row = (key, label, value, strong = false) =>
    html`<div class="summary__row" data-testid="${TID.summaryLine(key)}">
      <dt>${label}</dt>
      <dd>
        ${strong ? html`<strong${attr('data-testid', key === 'total' ? TID.cartTotal : null)}>${value}</strong>` : value}
      </dd>
    </div>`;
  return html`<dl class="summary">
    ${row('merchandise', t('summary.merchandise'), money(quote.merchandise))}
    ${quote.discount ? row('discount', t('summary.discount'), `−${money(quote.discount)}`) : ''}
    ${quote.loyaltyDiscount ? row('loyalty', t('summary.loyalty'), `−${money(quote.loyaltyDiscount)}`) : ''}
    ${row('shipping', t('summary.shipping'), quote.shipping ? money(quote.shipping) : t('summary.free'))}
    ${row('total', t('summary.total'), money(quote.total), true)}
    ${row('ht', t('summary.totalHt'), money(quote.totalHt))}
    ${quote.vat.map(
      (line) =>
        html`<div class="summary__row summary__row--vat" data-testid="${TID.vatLine(line.rateBp)}">
          <dt>${t('summary.vat', { rate: percent(line.rateBp) })}</dt>
          <dd>${money(line.vat)}</dd>
        </div>`,
    )}
  </dl>`;
}

export const quoteSummary = (quote) =>
  summary({ ...quote, discount: quote.coupon?.discount ?? 0, shipping: quote.shipping.net });
