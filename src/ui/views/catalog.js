import { attr, html } from '../core/html.js';
import { href } from '../core/router.js';
import { formatDate, money, t } from '../../i18n/index.js';
import { TID } from '../testids.js';
import {
  emptyState,
  errorBox,
  image,
  options,
  priceTag,
  productCard,
  stockLabel,
} from './components.js';

const SORTS = ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'rating', 'new'];

export function catalogView(state) {
  const page = state.data.page;
  const q = state.catalog;
  const recent = state.data.recent ?? [];
  const pages = page ? Array.from({ length: page.totalPages }, (_, index) => index + 1) : [];
  return html`<section class="hero">
      <h1>${t('catalog.title')}</h1>
      <p class="hero__lead">${t('catalog.lead')}</p>
    </section>
    <form class="filters" data-form="search" role="search" aria-label="${t('catalog.filters')}">
      <div class="field field--grow">
        <label for="search">${t('catalog.search')}</label
        ><input
          id="search"
          name="search"
          type="search"
          value="${q.search}"
          data-testid="${TID.searchInput}"
        />
      </div>
      <div class="field">
        <label for="category">${t('catalog.category')}</label
        ><select id="category" name="category" data-testid="${TID.categoryFilter}">
          ${options([['', t('catalog.all')], ...(page?.categories ?? []).map((c) => [c, t(`category.${c}`)])], q.category)}
        </select>
      </div>
      <div class="field field--small">
        <label for="min">${t('catalog.min')}</label
        ><input
          id="min"
          name="min"
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          value="${q.min}"
          data-testid="${TID.filterMin}"
        />
      </div>
      <div class="field field--small">
        <label for="max">${t('catalog.max')}</label
        ><input
          id="max"
          name="max"
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          value="${q.max}"
          data-testid="${TID.filterMax}"
        />
      </div>
      <div class="field">
        <label for="minRating">${t('catalog.rating')}</label
        ><select id="minRating" name="minRating" data-testid="${TID.filterRating}">
          ${options(
            [
              [0, t('catalog.anyRating')],
              [3, '★ 3+'],
              [4, '★ 4+'],
              [4.5, '★ 4.5+'],
            ],
            q.minRating,
          )}
        </select>
      </div>
      <div class="field">
        <label for="sort">${t('catalog.sort')}</label
        ><select id="sort" name="sort" data-testid="${TID.sortSelect}">
          ${options(
            SORTS.map((s) => [s, t(`sort.${s}`)]),
            q.sort,
          )}
        </select>
      </div>
      <div class="field field--small">
        <label for="perPage">${t('catalog.perPage')}</label
        ><select id="perPage" name="perPage" data-testid="${TID.perPageSelect}">
          ${options(
            [
              [4, '4'],
              [8, '8'],
              [16, '16'],
            ],
            q.perPage,
          )}
        </select>
      </div>
      <label class="check"
        ><input
          type="checkbox"
          name="inStock"
          data-testid="${TID.filterInStock}"
          ${attr('checked', q.inStock)}
        />
        ${t('catalog.inStock')}</label
      >
      <div class="filters__actions">
        <button class="btn" data-testid="${TID.searchSubmit}">${t('catalog.apply')}</button>
        <button
          type="button"
          class="btn btn--ghost"
          data-act="resetFilters"
          data-testid="${TID.resetFilters}"
        >
          ${t('catalog.reset')}
        </button>
      </div>
    </form>
    ${errorBox(state, state.problem)}
    ${
      page
        ? page.items.length
          ? html`<p class="muted" role="status">${t('catalog.count', { count: page.total })}</p>
              <div class="grid">${page.items.map((product) => productCard(state, product))}</div>
              <nav class="pager" aria-label="${t('catalog.pagination')}">
                ${pages.map((n) => html`<button type="button" class="btn btn--ghost" data-act="page" data-id="${n}" data-testid="${TID.pageButton(n)}" ${attr('aria-current', n === page.page ? 'page' : null)}>${n}</button>`)}
              </nav>`
          : emptyState(t('catalog.emptyTitle'), t('catalog.emptyText'), false)
        : ''
    }
    ${
      recent.length
        ? html`<section class="recent" data-testid="${TID.recentlyViewed}">
            <h2>${t('catalog.recent')}</h2>
            <ul class="recent__list">
              ${recent.map((product) => html`<li><a href="${href('products', product.id)}">${product.name}</a></li>`)}
            </ul>
          </section>`
        : ''
    }`;
}

export function productView(state) {
  const detail = state.data.detail;
  if (!detail) return errorBox(state, state.problem);
  const { product, reviews } = detail;
  const plans = state.data.plans ?? [];
  return html`<article class="detail">
      <div class="detail__media">${image(product, true)}</div>
      <div class="detail__body">
        <h1 data-testid="${TID.detailTitle}">${product.name}</h1>
        <p>
          ${t('product.description', { name: product.name, category: t(`category.${product.category}`).toLowerCase() })}
        </p>
        <p class="muted">
          ${t('product.meta', { sku: product.sku, category: t(`category.${product.category}`), vat: product.vatBp / 100 })}
        </p>
        ${priceTag(state, product)} ${stockLabel(product)}
        ${
          product.stockLevel === 'out'
            ? detail.stockAlert
              ? html`<p class="alert">${t('product.alertActive')}</p>`
              : state.user
                ? html`<form data-form="stockAlert" class="stack">
                    <input type="hidden" name="id" value="${product.id}" /><label class="check"
                      ><input type="checkbox" name="consent" required />
                      ${t('product.alertConsent')}</label
                    ><button class="btn" data-testid="${TID.detailStockAlert}">
                      ${t('product.alertMe')}
                    </button>
                  </form>`
                : html`<p><a href="${href('login')}">${t('product.alertLogin')}</a></p>`
            : html`<form data-form="detailCart" class="inline-form">
                <input type="hidden" name="id" value="${product.id}" />
                <div class="field field--small">
                  <label for="qty">${t('product.quantity')}</label
                  ><input
                    id="qty"
                    type="number"
                    name="qty"
                    min="1"
                    max="${Math.min(20, product.stock)}"
                    value="1"
                    data-testid="${TID.detailQty}"
                  />
                </div>
                <button class="btn" data-testid="${TID.detailAddCart}">
                  ${t('product.addToCart')}
                </button>
              </form>`
        }
        <button
          type="button"
          class="btn btn--ghost"
          data-act="wish"
          data-id="${product.id}"
          data-testid="${TID.productAddWishlist(product.id)}"
        >
          ${t('product.save')}
        </button>
        ${
          plans.length
            ? html`<section class="installments" data-testid="${TID.installmentsSimulator}">
                <h2>${t('product.installmentsTitle')}</h2>
                ${plans.map((plan) => html`<p><strong>${t('installments.label', { count: plan.count })}</strong> : ${plan.installments.map((i) => html`<span class="pill" data-testid="${TID.installmentRow(`${String(plan.count)}-${String(i.index)}`)}">${money(i.amount)} · ${formatDate(i.dueDate)}</span> `)}</p>`)}
                <p class="muted">${t('installments.noFees')}</p>
              </section>`
            : ''
        }
      </div>
    </article>
    <section class="reviews">
      <h2>${t('product.reviews')}</h2>
      ${
        reviews.length
          ? html`<ul class="reviews__list">
              ${reviews.map(
                (review, index) =>
                  html`<li data-testid="${TID.reviewItem(index)}">
                    <strong>${review.author} · ★ ${review.rating}</strong>
                    <span class="muted">${formatDate(review.date)}</span>
                    <p>${review.comment}</p>
                  </li>`,
              )}
            </ul>`
          : html`<p class="muted">${t('product.noReviews')}</p>`
      }
      ${
        state.user
          ? html`<form class="form" data-form="review" data-testid="${TID.reviewForm}">
              <input type="hidden" name="id" value="${product.id}" />
              <div class="field">
                <label for="rating">${t('product.rating')}</label
                ><select id="rating" name="rating">
                  ${options(
                    [5, 4, 3, 2, 1].map((n) => [n, `★ ${String(n)}`]),
                    5,
                  )}
                </select>
              </div>
              <div class="field">
                <label for="comment">${t('product.comment')}</label
                ><textarea
                  id="comment"
                  name="comment"
                  minlength="3"
                  maxlength="500"
                  required
                ></textarea>
              </div>
              <button class="btn" data-testid="${TID.reviewSubmit}">
                ${t('product.postReview')}
              </button>
            </form>`
          : ''
      }
    </section>`;
}

export function compareView(state) {
  const products = state.data.products ?? [];
  if (!products.length)
    return html`<h1>${t('compare.title')}</h1>
      ${emptyState(t('compare.emptyTitle'), t('compare.emptyText'))}`;
  const row = (label, cell) =>
    html`<tr>
      <th scope="row">${label}</th>
      ${products.map((product) => html`<td>${cell(product)}</td>`)}
    </tr>`;
  return html`<h1>${t('compare.title')}</h1>
    <div class="table-wrap">
      <table class="table" data-testid="${TID.compareTable}">
        <caption class="sr-only">
          ${t('compare.caption')}
        </caption>
        <thead>
          <tr>
            <td></td>
            ${products.map((product) => html`<th scope="col"><a href="${href('products', product.id)}">${product.name}</a></th>`)}
          </tr>
        </thead>
        <tbody>
          ${row(t('compare.price'), (p) => money(p.effectivePrice))}
          ${row(t('compare.category'), (p) => t(`category.${p.category}`))}
          ${row(t('compare.rating'), (p) => `★ ${String(p.rating)} (${String(p.reviewCount)})`)}
          ${row(t('compare.stock'), (p) => t(`stock.${p.stockLevel}`))}
          ${row(t('compare.weight'), (p) => `${String(p.weightGrams)} g`)}
          ${row(t('compare.vat'), (p) => `${String(p.vatBp / 100)} %`)}
          ${row('', (p) => html`<button type="button" class="btn btn--ghost btn--small" data-act="compare" data-id="${p.id}" data-testid="${TID.compareRemove(p.id)}">${t('compare.remove')}</button>`)}
        </tbody>
      </table>
    </div>`;
}
