import { attr, html } from '../core/html.js';
import { money, percent, t } from '../../i18n/index.js';
import { TID } from '../testids.js';
import { errorBox } from './components.js';

const NEXT = {
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  ReturnRequested: ['Refunded'],
  Cancelled: [],
  Refunded: [],
};

/** Accessible bar chart: SVG for sighted users, the data table below for everyone. */
function chart(kpis) {
  const max = Math.max(1, ...kpis.revenueByCategory.map((row) => row.revenue));
  const height = 28 * kpis.revenueByCategory.length + 8;
  return html`<figure class="chart" data-testid="${TID.adminChart}">
      <svg viewBox="0 0 600 ${height}" role="img" aria-labelledby="chart-title">
        <title id="chart-title">${t('admin.chartTitle')}</title>
        ${kpis.revenueByCategory.map((row, index) => html`<g><text x="0" y="${index * 28 + 20}" class="chart__label">${t(`category.${row.category}`)}</text><rect x="140" y="${index * 28 + 6}" width="${Math.max(2, Math.round((row.revenue / max) * 330))}" height="18" rx="4" class="chart__bar"></rect><text x="${Math.round((row.revenue / max) * 330) + 148}" y="${index * 28 + 20}" class="chart__value">${money(row.revenue)}</text></g>`)}
      </svg>
      <figcaption class="sr-only">${t('admin.chartCaption')}</figcaption>
    </figure>
    <table class="table">
      <caption>
        ${t('admin.chartTitle')}
      </caption>
      <thead>
        <tr>
          <th scope="col">${t('admin.category')}</th>
          <th scope="col">${t('admin.revenue')}</th>
        </tr>
      </thead>
      <tbody>
        ${kpis.revenueByCategory.map(
          (row) =>
            html`<tr>
              <td>${t(`category.${row.category}`)}</td>
              <td>${money(row.revenue)}</td>
            </tr>`,
        )}
      </tbody>
    </table>`;
}

export function adminView(state) {
  const products = state.data.products ?? [];
  const orders = state.data.orders ?? [];
  const kpis = state.data.kpis;
  const reorder = state.data.reorder ?? [];
  const purge = state.data.purge;
  const period = state.data.period ?? {
    from: '',
    to: '',
  };
  const kpi = (key, value) =>
    html`<div class="kpi" data-testid="${TID.adminKpi(key)}">
      <span class="kpi__label">${t(`admin.kpi.${key}`)}</span
      ><strong class="kpi__value">${value}</strong>
    </div>`;
  return html`<h1>${t('admin.title')}</h1>
    ${errorBox(state, state.problem)}
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title">${t('admin.dashboard')}</h2>
      <form class="inline-form" data-form="kpiPeriod">
        <div class="field">
          <label for="kpi-from">${t('admin.from')}</label
          ><input
            id="kpi-from"
            type="date"
            name="from"
            value="${period.from}"
            data-testid="${TID.adminKpiFrom}"
          />
        </div>
        <div class="field">
          <label for="kpi-to">${t('admin.to')}</label
          ><input
            id="kpi-to"
            type="date"
            name="to"
            value="${period.to}"
            data-testid="${TID.adminKpiTo}"
          />
        </div>
        <button class="btn">${t('admin.refresh')}</button>
      </form>
      ${
        kpis
          ? html`<div class="kpis">
                ${kpi('revenueTtc', money(kpis.revenueTtc))}${kpi('revenueHt', money(kpis.revenueHt))}${kpi('orders', String(kpis.orders))}${kpi('averageBasket', money(kpis.averageBasket))}${kpi('cancellationRate', percent(kpis.cancellationRateBp))}${kpi('returnRate', percent(kpis.returnRateBp))}
              </div>
              ${kpis.revenueByCategory.length ? chart(kpis) : html`<p class="muted">${t('admin.noData')}</p>`}
              ${
                kpis.topProducts.length
                  ? html`<h3>${t('admin.top')}</h3>
                      <ol>
                        ${kpis.topProducts.map((p) => html`<li>${p.name} — ${p.qty} · ${money(p.revenue)}</li>`)}
                      </ol>`
                  : ''
              }`
          : ''
      }
    </section>
    <section aria-labelledby="reorder-title">
      <h2 id="reorder-title">${t('admin.reorder')}</h2>
      ${
        reorder.length
          ? html`<table class="table">
              <thead>
                <tr>
                  <th scope="col">${t('admin.product')}</th>
                  <th scope="col">${t('admin.stock')}</th>
                  <th scope="col">${t('admin.reorderPoint')}</th>
                  <th scope="col">${t('admin.suggested')}</th>
                </tr>
              </thead>
              <tbody>
                ${reorder.map(
                  (item) =>
                    html`<tr data-testid="${TID.adminReorder(item.productId)}">
                      <td>${item.name}</td>
                      <td>${item.stock}</td>
                      <td>${item.reorderPoint}</td>
                      <td>${item.suggestedQty}</td>
                    </tr>`,
                )}
              </tbody>
            </table>`
          : html`<p class="muted">${t('admin.noReorder')}</p>`
      }
    </section>
    <section aria-labelledby="products-title">
      <h2 id="products-title">${t('admin.products')}</h2>
      <div class="table-wrap">
        <table class="table">
          <tbody>
            ${products.map(
              (p) =>
                html`<tr data-testid="${TID.adminProduct(p.id)}">
                  <th scope="row">${p.name}</th>
                  <td>
                    <form class="inline-form" data-form="adminProduct">
                      <input type="hidden" name="id" value="${p.id}" />
                      <div class="field field--small">
                        <label for="stock-${p.id}">${t('admin.stock')}</label
                        ><input
                          id="stock-${p.id}"
                          type="number"
                          min="0"
                          name="stock"
                          value="${p.stock}"
                          data-testid="${TID.adminStock(p.id)}"
                        />
                      </div>
                      <div class="field field--small">
                        <label for="price-${p.id}">${t('admin.priceTtc')}</label
                        ><input
                          id="price-${p.id}"
                          type="number"
                          min="0.01"
                          step="0.01"
                          name="price"
                          value="${(p.price / 100).toFixed(2)}"
                          data-testid="${TID.adminPrice(p.id)}"
                        />
                      </div>
                      <label class="check"
                        ><input
                          type="checkbox"
                          name="active"
                          data-testid="${TID.adminActive(p.id)}"
                          ${attr('checked', p.active)}
                        />
                        ${t('admin.active')}</label
                      >
                      <button class="btn btn--small" data-testid="${TID.adminSave(p.id)}">
                        ${t('admin.save')}
                      </button>
                    </form>
                  </td>
                </tr>`,
            )}
          </tbody>
        </table>
      </div>
    </section>
    <section aria-labelledby="orders-title">
      <h2 id="orders-title">${t('admin.orders')}</h2>
      ${
        orders.length
          ? html`<div class="table-wrap">
              <table class="table">
                <tbody>
                  ${orders.map(
                    (o) =>
                      html`<tr data-testid="${TID.adminOrder(o.id)}">
                        <td>${o.id}</td>
                        <td>${o.username}</td>
                        <td>${money(o.totals.total)}</td>
                        <td data-testid="${TID.adminStatus(o.id)}">${t(`status.${o.status}`)}</td>
                        <td class="actions">
                          ${(NEXT[o.status] ?? []).map((next) => html`<button type="button" class="btn btn--ghost btn--small" data-act="status" data-id="${o.id}" data-next="${next}">${t(`status.${next}`)}</button>`)}
                        </td>
                      </tr>`,
                  )}
                </tbody>
              </table>
            </div>`
          : html`<p class="muted">${t('admin.noOrders')}</p>`
      }
    </section>
    <section aria-labelledby="purge-title" class="card">
      <h2 id="purge-title">${t('admin.purgeTitle')}</h2>
      <p>${t('admin.purgeText')}</p>
      <button type="button" class="btn" data-act="purge" data-testid="${TID.adminPurge}">
        ${t('admin.purge')}
      </button>
      ${
        purge
          ? html`<ul data-testid="${TID.adminPurgeResult}">
              ${Object.entries(purge).map(([key, value]) => html`<li>${t(`admin.purged.${key}`)} : ${value}</li>`)}
            </ul>`
          : ''
      }
    </section>`;
}
