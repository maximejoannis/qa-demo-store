import { attr, html } from '../core/html.js';
import { href } from '../core/router.js';
import { formatDate, money, t } from '../../i18n/index.js';
import { TID } from '../testids.js';
import { emptyState, errorBox, field, options, quoteSummary } from './components.js';

export const COUNTRIES = ['FR', 'BE', 'DE', 'ES', 'IT', 'LU', 'MC', 'CH', 'GB', 'US', 'CA'];

const METHODS = ['standard', 'express', 'pickup'];

const countryOptions = (selected) =>
  options(
    COUNTRIES.map((code) => [code, t(`country.${code}`)]),
    selected,
  );

function deliveryChoice(state) {
  return html`<div class="field">
      <label for="shipping">${t('cart.shipping')}</label
      ><select id="shipping" name="shipping" data-ship data-testid="${TID.shippingMethod}">
        ${options(
          METHODS.map((m) => [m, t(`shipping.${m}`)]),
          state.shippingMethod,
        )}
      </select>
    </div>
    <div class="field">
      <label for="country">${t('cart.country')}</label
      ><select id="country" name="country" data-country data-testid="${TID.shippingCountry}">
        ${countryOptions(state.country)}
      </select>
    </div>`;
}

const deliveryEstimate = (state) =>
  state.quote
    ? html`<p class="muted" data-testid="${TID.deliveryEstimate}">
        ${t('cart.delivery', { from: formatDate(state.quote.delivery.from), to: formatDate(state.quote.delivery.to) })}
      </p>`
    : '';

export function cartView(state) {
  if (!state.cart.length)
    return html`<h1>${t('cart.title')}</h1>
      ${emptyState(t('cart.emptyTitle'), t('cart.emptyText'))}`;
  const products = state.data.products ?? [];
  const quoteLine = (id) => state.quote?.lines.find((line) => line.productId === id);
  return html`<h1>${t('cart.title')}</h1>
    <div class="table-wrap">
      <table class="table">
        <caption class="sr-only">
          ${t('cart.caption')}
        </caption>
        <thead>
          <tr>
            <th scope="col">${t('cart.product')}</th>
            <th scope="col">${t('cart.unitPrice')}</th>
            <th scope="col">${t('cart.quantity')}</th>
            <th scope="col">${t('cart.lineTotal')}</th>
            <td></td>
          </tr>
        </thead>
        <tbody>
          ${state.cart.map((line) => {
            const product = products.find((candidate) => candidate.id === line.productId);
            const priced = quoteLine(line.productId);
            const name = product?.name ?? `#${String(line.productId)}`;
            return html`<tr data-testid="${TID.cartItem(line.productId)}">
              <td><a href="${href('products', line.productId)}">${name}</a></td>
              <td>
                ${priced ? money(priced.unitPrice) : product ? money(product.effectivePrice) : '—'}
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value="${line.qty}"
                  data-qty="${line.productId}"
                  data-testid="${TID.cartQty(line.productId)}"
                  aria-label="${t('cart.quantityFor', { name })}"
                />
              </td>
              <td>${priced ? money(priced.gross) : '—'}</td>
              <td>
                <button
                  type="button"
                  class="btn btn--ghost btn--small"
                  data-act="remove"
                  data-id="${line.productId}"
                  data-testid="${TID.cartRemove(line.productId)}"
                  aria-label="${t('cart.removeName', { name })}"
                >
                  ${t('cart.remove')}
                </button>
              </td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
    <div class="cart-grid">
      <div class="stack">
        <form class="inline-form" data-form="coupon">
          <div class="field">
            <label for="coupon">${t('cart.coupon')}</label
            ><input
              id="coupon"
              name="code"
              autocomplete="off"
              data-testid="${TID.couponInput}"
              value="${state.coupon ?? ''}"
            />
          </div>
          <button class="btn" data-testid="${TID.couponApply}">${t('cart.applyCoupon')}</button>
          ${state.coupon ? html`<button type="button" class="btn btn--ghost" data-act="removeCoupon" data-testid="${TID.couponRemove}">${t('cart.removeCoupon', { code: state.coupon })}</button>` : ''}
        </form>
        <form class="inline-form" data-form="delivery">${deliveryChoice(state)}</form>
        ${deliveryEstimate(state)}
        <p class="muted">${t('cart.coupons')}</p>
      </div>
      <aside class="card summary-card" aria-label="${t('summary.title')}">
        <h2>${t('summary.title')}</h2>
        ${errorBox(state, state.quoteProblem)} ${state.quote ? quoteSummary(state.quote) : ''}
        ${state.quote ? html`<p class="muted">${t('summary.points', { points: state.quote.loyaltyPointsEarned })}</p>` : ''}
        <a
          class="btn btn--block${state.quote ? '' : ' btn--disabled'}"
          href="${href('checkout')}"
          data-testid="${TID.checkoutLink}"
          ${attr('aria-disabled', state.quote ? null : 'true')}
          >${t('cart.checkout')}</a
        >
      </aside>
    </div>`;
}

const STEPS = ['address', 'delivery', 'payment', 'review'];

export function checkoutView(state) {
  if (!state.cart.length)
    return html`<h1>${t('checkout.title')}</h1>
      ${emptyState(t('cart.emptyTitle'), t('cart.emptyText'))}`;
  const c = state.checkout;
  const loyalty = state.data.loyalty;
  const eligibleInstallments = Boolean(
    state.quote && state.quote.total >= 10000 && state.quote.total <= 200000,
  );
  const steps = html`<ol class="steps">
    ${STEPS.map((step, index) => html`<li data-testid="${TID.checkoutStep(step)}" ${attr('aria-current', index === c.step ? 'step' : null)} class="${index < c.step ? 'done' : ''}">${t(`checkout.step.${step}`)}</li>`)}
  </ol>`;
  const address = html`<fieldset>
    <legend>${t('checkout.step.address')}</legend>
    ${field(state, { name: 'firstName', label: t('form.firstName'), value: c.firstName, required: true, autocomplete: 'given-name', testid: TID.checkoutField('firstName') })}
    ${field(state, { name: 'lastName', label: t('form.lastName'), value: c.lastName, required: true, autocomplete: 'family-name', testid: TID.checkoutField('lastName') })}
    ${field(state, { name: 'address', label: t('form.address'), value: c.address, required: true, autocomplete: 'street-address', testid: TID.checkoutAddress })}
    ${field(state, { name: 'city', label: t('form.city'), value: c.city, required: true, autocomplete: 'address-level2', testid: TID.checkoutField('city') })}
    ${field(state, { name: 'zip', label: t('form.zip'), value: c.zip, required: true, autocomplete: 'postal-code', testid: TID.checkoutField('zip') })}
    <div class="field">
      <label for="f-country">${t('form.country')}</label
      ><select id="f-country" name="country" data-testid="${TID.checkoutField('country')}">
        ${countryOptions(c.country)}
      </select>
    </div>
    <p class="muted small">${t('privacy.formNotice')}</p>
  </fieldset>`;
  const delivery = html`<fieldset>
    <legend>${t('checkout.step.delivery')}</legend>
    ${deliveryChoice(state)} ${deliveryEstimate(state)}
    ${
      loyalty
        ? html`<div class="field">
            <label for="redeem">${t('checkout.redeem', { balance: loyalty.balance })}</label
            ><input
              id="redeem"
              name="redeem"
              type="number"
              min="0"
              step="100"
              value="${state.redeemPoints}"
              data-testid="${TID.loyaltyRedeem}"
              aria-describedby="redeem-hint"
            /><small id="redeem-hint" class="muted">${t('checkout.redeemHint')}</small>
          </div>`
        : ''
    }
  </fieldset>`;
  const payment = html`<fieldset>
    <legend>${t('checkout.step.payment')}</legend>
    <div class="field">
      <label for="payment">${t('checkout.payment')}</label
      ><select id="payment" name="payment" data-testid="${TID.paymentMethod}">
        ${options(
          [
            ['card', t('checkout.card')],
            ['pod', t('checkout.pod')],
          ],
          c.payment,
        )}
      </select>
    </div>
    ${field(state, { name: 'card', label: t('checkout.cardNumber'), value: c.card, autocomplete: 'off', testid: TID.paymentCard, hint: t('checkout.cardHint') })}
    ${
      eligibleInstallments
        ? html`<div class="field">
            <label for="installments">${t('checkout.installments')}</label
            ><select id="installments" name="installments" data-testid="${TID.installmentsChoice}">
              ${options(
                [
                  [1, t('installments.once')],
                  [3, t('installments.label', { count: 3 })],
                  [4, t('installments.label', { count: 4 })],
                ],
                c.installments,
              )}
            </select>
          </div>`
        : html`<p class="muted">${t('checkout.installmentsUnavailable')}</p>`
    }
  </fieldset>`;
  const review = html`<section aria-labelledby="review-title">
    <h2 id="review-title">${t('checkout.step.review')}</h2>
    <p>
      ${t('checkout.deliverTo', { name: `${c.firstName} ${c.lastName}`, address: `${c.address}, ${c.zip} ${c.city}, ${t(`country.${c.country}`)}` })}
    </p>
    <p>
      ${t('checkout.reviewShipping', { method: t(`shipping.${state.shippingMethod}`), payment: t(c.payment === 'card' ? 'checkout.card' : 'checkout.pod') })}${c.installments > 1 ? ` · ${t('installments.label', { count: c.installments })}` : ''}
    </p>
    <p class="muted small">${t('checkout.legal')}</p>
  </section>`;
  const content = [address, delivery, payment, review][c.step] ?? address;
  return html`<h1>${t('checkout.title')}</h1>
    ${steps}
    <div class="cart-grid">
      <form class="form" data-form="checkoutStep" novalidate>
        ${content}
        <div class="form__actions">
          ${c.step ? html`<button type="button" class="btn btn--ghost" data-act="checkoutBack" data-testid="${TID.checkoutBack}">${t('checkout.back')}</button>` : ''}
          <button
            class="btn"
            ${attr('data-testid', c.step === 3 ? TID.placeOrder : TID.checkoutNext)}
          >
            ${t(c.step === 3 ? 'checkout.placeOrder' : 'checkout.continue')}
          </button>
        </div>
      </form>
      <aside class="card summary-card" aria-label="${t('summary.title')}">
        <h2>${t('summary.title')}</h2>
        ${errorBox(state, state.quoteProblem)}${state.quote ? quoteSummary(state.quote) : ''}
      </aside>
    </div>`;
}

export function confirmationView(state) {
  const order = state.data.order;
  if (!order) return errorBox(state, state.problem);
  return html`<h1 data-testid="${TID.orderConfirmation}">${t('confirmation.title')}</h1>
    <p>${t('confirmation.number')} <strong data-testid="${TID.orderNumber}">${order.id}</strong></p>
    <p>
      ${t('confirmation.delivery', { from: formatDate(order.delivery.from), to: formatDate(order.delivery.to) })}
    </p>
    ${order.installmentPlan ? html`<p>${t('confirmation.installments', { count: order.installmentPlan.length, first: money(order.installmentPlan[0]?.amount ?? 0) })}</p>` : ''}
    <p>${t('confirmation.points', { points: order.loyaltyPointsEarned })}</p>
    <p class="actions">
      <a class="btn" href="${href('orders', order.id)}">${t('confirmation.view')}</a>
      <a class="btn btn--ghost" href="${href('invoice', order.id)}">${t('orders.invoice')}</a>
    </p>`;
}
