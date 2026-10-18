import { attr, html } from '../core/html.js';
import { href } from '../core/router.js';
import { formatDate, money, t } from '../../i18n/index.js';
import { TID } from '../testids.js';
import { emptyState, errorBox, field, options, productCard } from './components.js';
import { COUNTRIES } from './checkout.js';

export function loginView(state) {
  return html`<h1>${t('login.title')}</h1>
    <form class="form form--narrow" data-form="login">
      ${errorBox(state, state.problem)}
      ${field(state, { name: 'username', label: t('form.username'), testid: TID.loginUsername, autocomplete: 'username', required: true })}
      ${field(state, { name: 'password', label: t('form.password'), type: 'password', testid: TID.loginPassword, autocomplete: 'current-password', required: true })}
      <button class="btn" data-testid="${TID.loginSubmit}">${t('login.submit')}</button>
      <p class="muted small">${t('login.demo')}</p>
      <p><a href="${href('register')}">${t('login.register')}</a></p>
    </form>`;
}

export function registerView(state) {
  const input = (name, type = 'text', autocomplete, hint) =>
    field(state, {
      name,
      type,
      label: t(`form.${name}`),
      required: true,
      testid: TID.registerField(name),
      ...(autocomplete ? { autocomplete } : {}),
      ...(hint ? { hint } : {}),
    });
  return html`<h1>${t('register.title')}</h1>
    <form class="form form--narrow" data-form="register">
      ${errorBox(state, state.problem)} ${input('firstName', 'text', 'given-name')}
      ${input('lastName', 'text', 'family-name')} ${input('email', 'email', 'email')}
      ${input('username', 'text', 'username', t('register.usernameHint'))}
      ${input('password', 'password', 'new-password', t('register.passwordHint'))}
      ${input('confirm', 'password', 'new-password')}
      <label class="check"
        ><input type="checkbox" name="terms" required data-testid="${TID.registerField('terms')}" />
        ${t('register.terms')}</label
      >
      <label class="check"
        ><input
          type="checkbox"
          name="newsletter"
          data-testid="${TID.registerField('newsletter')}"
        />
        ${t('register.newsletter')}</label
      >
      <p class="muted small">${t('privacy.formNotice')}</p>
      <button class="btn" data-testid="${TID.registerSubmit}">${t('register.submit')}</button>
    </form>`;
}

export function wishlistView(state) {
  const items = state.data.items ?? [];
  if (!items.length)
    return html`<h1>${t('wishlist.title')}</h1>
      ${emptyState(t('wishlist.emptyTitle'), t('wishlist.emptyText'))}`;
  return html`<h1>${t('wishlist.title')}</h1>
    <div class="grid">
      ${items.map(
        (product) =>
          html`<div class="stack">
            ${productCard(state, product)}<button
              type="button"
              class="btn btn--ghost"
              data-act="moveWish"
              data-id="${product.id}"
              data-testid="${TID.wishlistMove(product.id)}"
              ${attr('disabled', product.stockLevel === 'out')}
            >
              ${t('wishlist.move')}
            </button>
          </div>`,
      )}
    </div>`;
}

export function profileView(state) {
  const profile = state.data.profile ?? {};
  const input = (name, type = 'text', required = false) =>
    field(state, {
      name,
      type,
      label: t(`form.${name}`),
      value: profile[name] ?? '',
      required,
      testid: TID.profileField(name),
    });
  return html`<h1>${t('profile.title')}</h1>
    <form class="form form--narrow" data-form="profile">
      ${errorBox(state, state.problem)} ${input('firstName', 'text', true)}
      ${input('lastName', 'text', true)} ${input('email', 'email', true)} ${input('phone', 'tel')}
      <fieldset>
        <legend>${t('profile.address')}</legend>
        ${input('address')} ${input('city')} ${input('zip')}
        <div class="field">
          <label for="p-country">${t('form.country')}</label
          ><select id="p-country" name="country" data-testid="${TID.profileField('country')}">
            ${options([['', '—'], ...COUNTRIES.map((c) => [c, t(`country.${c}`)])], profile.country ?? '')}
          </select>
        </div>
      </fieldset>
      <p class="muted small">${t('privacy.formNotice')}</p>
      <button class="btn" data-testid="${TID.profileSubmit}">${t('profile.save')}</button>
    </form>`;
}

export function loyaltyView(state) {
  const loyalty = state.data.loyalty;
  if (!loyalty) return errorBox(state, state.problem);
  return html`<h1>${t('loyalty.title')}</h1>
    <div class="kpis">
      <div class="kpi">
        <span class="kpi__label">${t('loyalty.balance')}</span
        ><strong class="kpi__value" data-testid="${TID.loyaltyBalance}">${loyalty.balance}</strong
        ><span class="muted"
          >${t('loyalty.worth', { amount: money(Math.floor(loyalty.balance / 100) * 500) })}</span
        >
      </div>
      <div class="kpi">
        <span class="kpi__label">${t('loyalty.tier')}</span
        ><strong class="kpi__value" data-testid="${TID.loyaltyTier}"
          >${t(`tier.${loyalty.tier}`)}</strong
        ><span class="muted"
          >${loyalty.next ? t('loyalty.next', { points: loyalty.next.missingPoints, tier: t(`tier.${loyalty.next.tier}`) }) : t('loyalty.top')}</span
        >
      </div>
    </div>
    <p class="muted">${t('loyalty.rules')}</p>
    <h2>${t('loyalty.history')}</h2>
    ${
      loyalty.history.length
        ? html`<ul class="lines" data-testid="${TID.loyaltyHistory}">
            ${loyalty.history.map((entry) => html`<li>${formatDate(entry.date)} · ${t(`loyalty.entry.${entry.type}`)} · ${entry.points} pts · ${entry.orderId}</li>`)}
          </ul>`
        : html`<p class="muted">${t('loyalty.empty')}</p>`
    }`;
}

export function preferencesView(state) {
  return html`<h1>${t('preferences.title')}</h1>
    <form class="form form--narrow" data-form="preferences">
      <div class="field">
        <label for="pref-theme">${t('preferences.theme')}</label
        ><select id="pref-theme" name="theme">
          ${options(
            [
              ['light', t('preferences.light')],
              ['dark', t('preferences.dark')],
            ],
            state.theme,
          )}
        </select>
      </div>
      <div class="field">
        <label for="pref-lang">${t('preferences.language')}</label
        ><select id="pref-lang" name="lang">
          ${options(
            [
              ['fr', 'Français'],
              ['en', 'English'],
            ],
            state.lang,
          )}
        </select>
      </div>
      <div class="field">
        <label for="pref-sort">${t('preferences.sort')}</label
        ><select id="pref-sort" name="sort">
          ${options(
            ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'rating', 'new'].map((s) => [
              s,
              t(`sort.${s}`),
            ]),
            state.catalog.sort,
          )}
        </select>
      </div>
      <div class="field">
        <label for="pref-per-page">${t('preferences.perPage')}</label
        ><select id="pref-per-page" name="perPage">
          ${options(
            [
              [4, '4'],
              [8, '8'],
              [16, '16'],
            ],
            state.catalog.perPage,
          )}
        </select>
      </div>
      <label class="check"
        ><input type="checkbox" name="qa" ${attr('checked', state.qa.visible)} />
        ${t('preferences.qa')}</label
      >
      <button class="btn" data-testid="${TID.preferencesSubmit}">${t('preferences.save')}</button>
    </form>`;
}

export function myDataView(state) {
  const consents = state.data.consents ?? {
    newsletter: false,
  };
  return html`<h1>${t('myData.title')}</h1>
    <p>${t('myData.intro')}</p>
    <section class="card">
      <h2>${t('myData.exportTitle')}</h2>
      <p>${t('myData.exportText')}</p>
      <button type="button" class="btn" data-act="exportData" data-testid="${TID.myDataExport}">
        ${t('myData.export')}
      </button>
    </section>
    <section class="card">
      <h2>${t('myData.consentTitle')}</h2>
      <form data-form="newsletter" class="stack">
        <label class="check"
          ><input
            type="checkbox"
            name="newsletter"
            data-testid="${TID.myDataNewsletter}"
            ${attr('checked', consents.newsletter)}
          />
          ${t('myData.newsletter')}</label
        ><button class="btn btn--ghost">${t('myData.saveConsent')}</button>
      </form>
      <p>
        <button type="button" class="link" data-act="consentManage">${t('myData.cookies')}</button>
      </p>
    </section>
    <section class="card">
      <h2>${t('myData.rectifyTitle')}</h2>
      <p><a href="${href('profile')}">${t('myData.rectify')}</a></p>
    </section>
    <section class="card card--danger">
      <h2>${t('myData.deleteTitle')}</h2>
      <p>${t('myData.deleteText')}</p>
      <form class="form form--narrow" data-form="deleteAccount">
        ${errorBox(state, state.problem)}
        ${field(state, { name: 'password', type: 'password', label: t('myData.confirmPassword'), required: true, testid: TID.myDataDeletePassword, autocomplete: 'current-password' })}
        <button class="btn btn--danger" data-testid="${TID.myDataDelete}">
          ${t('myData.delete')}
        </button>
      </form>
    </section>`;
}

export function privacyView() {
  const sections = [
    'controller',
    'purposes',
    'retention',
    'recipients',
    'rights',
    'cookies',
    'security',
    'contact',
  ];
  return html`<article class="prose">
    <h1>${t('privacy.title')}</h1>
    <p class="muted">${t('privacy.updated')}</p>
    ${sections.map(
      (section) =>
        html`<h2>${t(`privacy.${section}.title`)}</h2>
          <p>${t(`privacy.${section}.text`)}</p>`,
    )}
  </article>`;
}

export const notFoundView = () => emptyState(t('notFound.title'), t('notFound.text'));

export const forbiddenView = () => emptyState(t('forbidden.title'), t('forbidden.text'));
