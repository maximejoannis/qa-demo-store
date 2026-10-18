import { html } from '../core/html.js';
import { href } from '../core/router.js';
import { formatDate, money, percent, t } from '../../i18n/index.js';
import { TID } from '../testids.js';
import { emptyState, errorBox, summary } from './components.js';

const orderSummary = (order) => summary({ ...order.totals, vat: order.totals.vat });

const statusLabel = (status) => t(`status.${status}`);

export function ordersView(state) {
  const orders = state.data.orders ?? [];
  if (!orders.length)
    return html`<h1>${t('orders.title')}</h1>
      ${emptyState(t('orders.emptyTitle'), t('orders.emptyText'))}`;
  return html`<h1>${t('orders.title')}</h1>
    <div class="table-wrap">
      <table class="table">
        <caption class="sr-only">
          ${t('orders.caption')}
        </caption>
        <thead>
          <tr>
            <th scope="col">${t('orders.number')}</th>
            <th scope="col">${t('orders.date')}</th>
            <th scope="col">${t('orders.total')}</th>
            <th scope="col">${t('orders.status')}</th>
            <th scope="col">${t('orders.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(
            (order) =>
              html`<tr data-testid="${TID.orderRow(order.id)}">
                <td data-testid="${TID.orderNumber}">${order.id}</td>
                <td>${formatDate(order.date)}</td>
                <td>${money(order.totals.total)}</td>
                <td>
                  <span
                    class="status status--${order.status.toLowerCase()}"
                    data-testid="${TID.orderStatus(order.id)}"
                    >${statusLabel(order.status)}</span
                  >
                </td>
                <td class="actions">
                  <a href="${href('orders', order.id)}">${t('orders.details')}</a>
                  <a href="${href('invoice', order.id)}" data-testid="${TID.orderInvoice(order.id)}"
                    >${t('orders.invoice')}</a
                  >
                  ${order.status === 'Processing' ? html`<button type="button" class="btn btn--ghost btn--small" data-act="cancel" data-id="${order.id}" data-testid="${TID.orderCancel(order.id)}">${t('orders.cancel')}</button>` : ''}
                </td>
              </tr>`,
          )}
        </tbody>
      </table>
    </div>`;
}

export function orderDetailView(state) {
  const order = state.data.order;
  if (!order) return errorBox(state, state.problem);
  const refund = state.data.returnQuote;
  const selected = state.data.returnLines ?? [];
  const selectedQty = (productId) =>
    selected.find((line) => line.productId === productId)?.qty ?? 0;
  const address = order.shippingAddress;
  return html`<h1>${t('orders.detailTitle', { id: order.id })}</h1>
    <p>
      ${formatDate(order.date)} ·
      <span
        class="status status--${order.status.toLowerCase()}"
        data-testid="${TID.orderStatus(order.id)}"
        >${statusLabel(order.status)}</span
      >
      · ${t('orders.invoiceNumber', { number: order.invoiceNumber })}
    </p>
    <ul class="lines">
      ${order.lines.map((line) => html`<li>${line.name} × ${line.qty} — ${money(line.net)}</li>`)}
    </ul>
    <p>
      ${t('orders.delivery', { name: `${address.firstName} ${address.lastName}`, address: `${address.address}, ${address.zip} ${address.city}`, method: t(`shipping.${order.shippingMethod}`) })}
    </p>
    ${order.deliveredAt ? html`<p>${t('orders.deliveredAt', { date: formatDate(order.deliveredAt) })}</p>` : html`<p>${t('orders.expected', { from: formatDate(order.delivery.from), to: formatDate(order.delivery.to) })}</p>`}
    ${order.installmentPlan ? html`<p>${t('orders.plan')} ${order.installmentPlan.map((i) => html`<span class="pill">${money(i.amount)} · ${formatDate(i.dueDate)}</span> `)}</p>` : ''}
    ${orderSummary(order)}
    ${
      order.return
        ? html`<section class="card">
            <h2>${t('returns.requested')}</h2>
            <p>${t('returns.amount', { amount: money(order.return.total) })}</p>
          </section>`
        : ''
    }
    ${
      order.status === 'Delivered'
        ? html`<section class="card">
            <h2>${t('returns.title')}</h2>
            <form class="form" data-form="returnRequest" data-testid="${TID.returnForm}">
              <input type="hidden" name="orderId" value="${order.id}" />
              ${order.lines.map((line) => html`<div class="field field--small"><label for="ret-${line.productId}">${line.name} (${t('returns.max', { qty: line.qty })})</label><input id="ret-${line.productId}" type="number" min="0" max="${line.qty}" name="qty-${line.productId}" value="${selectedQty(line.productId)}" data-testid="${TID.returnQty(line.productId)}" /></div>`)}
              <div class="field">
                <label for="reason">${t('returns.reason')}</label
                ><textarea id="reason" name="reason" maxlength="500"></textarea>
              </div>
              <div class="form__actions">
                <button
                  type="button"
                  class="btn btn--ghost"
                  data-act="returnQuote"
                  data-testid="${TID.returnQuote}"
                >
                  ${t('returns.simulate')}</button
                ><button class="btn" data-testid="${TID.returnSubmit}">
                  ${t('returns.submit')}
                </button>
              </div>
            </form>
            ${
              refund
                ? html`<p class="alert" role="status" data-testid="${TID.returnResult}">
                    ${
                      refund.eligible
                        ? t('returns.eligible', {
                            amount: money(refund.total),
                            shipping: money(refund.shippingRefund),
                            points: refund.pointsToRevoke,
                            deadline: formatDate(refund.deadline ?? ''),
                          })
                        : t(`returns.reason.${refund.reason ?? 'NOT_DELIVERED'}`, {
                            deadline: refund.deadline ? formatDate(refund.deadline) : '',
                          })
                    }
                  </p>`
                : ''
            }
          </section>`
        : ''
    }
    <p class="actions">
      <a class="btn btn--ghost" href="${href('orders')}">${t('orders.back')}</a>
      <a class="btn btn--ghost" href="${href('invoice', order.id)}">${t('orders.invoice')}</a>
    </p>`;
}

export function invoiceView(state) {
  const data = state.data.invoice;
  if (!data) return errorBox(state, state.problem);
  const { order, seller } = data;
  const a = order.shippingAddress;
  return html`<article class="invoice" data-testid="${TID.invoice}">
    <header class="invoice__header">
      <div>
        <strong>${seller.name}</strong><br />${seller.address}<br />SIREN ${seller.siren}<br />${t('invoice.vatNumber')}
        ${seller.vatNumber}
      </div>
      <div>
        <h1>${t('invoice.title', { number: order.invoiceNumber })}</h1>
        <p>
          ${t('invoice.date', { date: formatDate(data.issuedAt) })}<br />${t('invoice.order', { id: order.id })}
        </p>
      </div>
    </header>
    <p>
      <strong>${t('invoice.billedTo')}</strong><br />${a.firstName} ${a.lastName}<br />${a.address}<br />${a.zip}
      ${a.city} ${a.country}
    </p>
    <table class="table">
      <thead>
        <tr>
          <th scope="col">${t('invoice.item')}</th>
          <th scope="col">${t('invoice.qty')}</th>
          <th scope="col">${t('invoice.unit')}</th>
          <th scope="col">${t('invoice.vatRate')}</th>
          <th scope="col">${t('invoice.amount')}</th>
        </tr>
      </thead>
      <tbody>
        ${order.lines.map(
          (line) =>
            html`<tr>
              <td>${line.name}</td>
              <td>${line.qty}</td>
              <td>${money(line.unitPrice)}</td>
              <td>${percent(line.vatBp)}</td>
              <td>${money(line.net)}</td>
            </tr>`,
        )}
      </tbody>
    </table>
    ${orderSummary(order)}
    <p class="muted small">${t('invoice.legal')}</p>
    <button type="button" class="btn no-print" data-act="print" data-testid="${TID.invoicePrint}">
      ${t('invoice.print')}
    </button>
  </article>`;
}
