import { attr, html } from '../core/html.js';
import { href } from '../core/router.js';
import { formatDate, LANGS, t } from '../../i18n/index.js';
import { TID } from '../testids.js';
import { options } from './components.js';

const SCENARIOS = [
  'default',
  'empty-catalog',
  'low-stock',
  'order-history',
  'loyalty-gold',
  'rgpd-expired',
];

function nav(state) {
  const link = (name, label, extra = '') =>
    html`<a
      href="${href(name)}"
      data-testid="${TID.navLink(name)}"
      ${attr('aria-current', state.route.name === name ? 'page' : null)}
      >${label}${extra}</a
    >`;
  const count = state.cart.reduce((sum, line) => sum + line.qty, 0);
  return html`<nav class="nav" aria-label="${t('nav.label')}">
    ${link('products', t('nav.shop'))}
    ${
      state.user
        ? html`${link('wishlist', t('nav.wishlist'))}${link('orders', t('nav.orders'))}${link('loyalty', t('nav.loyalty'))}${link('profile', t('nav.profile'))}${link('my-data', t('nav.myData'))}`
        : link('register', t('nav.register'))
    }
    ${state.user?.role === 'admin' ? link('admin', t('nav.admin')) : ''}
    ${link('compare', t('nav.compare'), state.compare.length ? html` <span class="pill">${state.compare.length}</span>` : '')}
    ${link('cart', t('nav.cart'), html` <span class="pill" data-testid="${TID.cartBadge}" aria-label="${t('nav.cartCount', { count })}">${count}</span>`)}
  </nav>`;
}

function tools(state) {
  return html`<div class="tools">
    <div class="lang-switch" role="group" aria-label="${t('nav.language')}">
      ${LANGS.map((lang) => html`<button type="button" class="lang-switch__btn" data-act="lang" data-id="${lang}" data-testid="${TID.langSwitch(lang)}" aria-pressed="${String(state.lang === lang)}" lang="${lang}">${lang.toUpperCase()}</button>`)}
    </div>
    <button
      type="button"
      class="btn btn--ghost btn--small"
      data-act="theme"
      data-testid="${TID.themeToggle}"
    >
      ${t(state.theme === 'dark' ? 'nav.lightMode' : 'nav.darkMode')}
    </button>
    ${
      state.user
        ? html`<a
              class="btn btn--ghost btn--small"
              href="${href('preferences')}"
              data-testid="${TID.navLink('preferences')}"
              >${t('nav.preferences')}</a
            ><button
              type="button"
              class="btn btn--ghost btn--small"
              data-act="logout"
              data-testid="${TID.logout}"
            >
              ${t('nav.logout', { username: state.user.username })}
            </button>`
        : html`<a
            class="btn btn--small"
            href="${href('login')}"
            data-testid="${TID.navLink('login')}"
            >${t('nav.login')}</a
          >`
    }
  </div>`;
}

function qaToolbar(state) {
  if (!state.qa.visible) return html``;
  const meta = state.meta;
  return html`<section
    class="qa-toolbar"
    data-testid="${TID.qaToolbar}"
    aria-label="${t('qa.label')}"
  >
    <p class="qa-toolbar__info" data-testid="${TID.qaInfo}">
      ${t('qa.info', { transport: state.transport, scenario: meta?.scenario ?? '-', user: state.user ? `${state.user.username}${state.user.faultProfile ? ` (${state.user.faultProfile})` : ''}` : t('qa.anonymous') })}
      · ${t('qa.clock')}
      <time>${meta?.now ?? '-'}</time
      >${meta?.clockFrozen ? html` <span class="pill">${t('qa.frozen')}</span>` : ''}
    </p>
    <form class="qa-toolbar__form" data-form="qaReset">
      <label
        >${t('qa.scenario')}
        <select name="scenario" data-testid="${TID.qaScenario}">
          ${options(
            SCENARIOS.map((s) => [s, s]),
            meta?.scenario ?? 'default',
          )}
        </select></label
      >
      <button class="btn btn--small" data-testid="${TID.qaReset}">${t('qa.reset')}</button>
    </form>
    <form class="qa-toolbar__form" data-form="qaClock">
      <label
        >${t('qa.clockAt')}
        <input
          name="now"
          type="text"
          placeholder="2026-12-31T23:59:30+01:00"
          data-testid="${TID.qaClock}"
      /></label>
      <button class="btn btn--small" data-testid="${TID.qaClockFreeze}">${t('qa.freeze')}</button>
      <button
        class="btn btn--ghost btn--small"
        type="button"
        data-act="qaClockReal"
        data-testid="${TID.qaClockReal}"
      >
        ${t('qa.realTime')}
      </button>
    </form>
    <form class="qa-toolbar__form" data-form="qaNetwork">
      <label
        >${t('qa.latency')}
        <input
          name="latency"
          type="number"
          min="0"
          max="30000"
          value="${state.qa.latency}"
          data-testid="${TID.qaLatency}"
      /></label>
      <label
        >${t('qa.fail')}
        <input
          name="fail"
          type="text"
          placeholder="quotes:503"
          value="${state.qa.fail}"
          data-testid="${TID.qaFail}"
      /></label>
      <button class="btn btn--small" data-testid="${TID.qaApply}">${t('qa.apply')}</button>
    </form>
  </section>`;
}

function consentBanner(state) {
  if (state.consent && !state.consentOpen) return html``;
  const current = state.consent ?? { analytics: false, personalization: false };
  return html`<section
    class="consent"
    data-testid="${TID.consentBanner}"
    role="region"
    aria-labelledby="consent-title"
  >
    <h2 id="consent-title">${t('consent.title')}</h2>
    <p>${t('consent.text')} <a href="${href('privacy')}">${t('consent.policy')}</a></p>
    ${
      state.consentCustomize
        ? html`<form class="consent__form" data-form="consent">
            <label class="check"
              ><input type="checkbox" checked disabled /> ${t('consent.necessary')}</label
            >
            <label class="check"
              ><input type="checkbox" name="analytics" ${attr('checked', current.analytics)} />
              ${t('consent.analytics')}</label
            >
            <label class="check"
              ><input
                type="checkbox"
                name="personalization"
                ${attr('checked', current.personalization)}
              />
              ${t('consent.personalization')}</label
            >
            <button class="btn" data-testid="${TID.consentSave}">${t('consent.save')}</button>
          </form>`
        : ''
    }
    <div class="consent__actions">
      <button
        type="button"
        class="btn"
        data-act="consentReject"
        data-testid="${TID.consentRejectAll}"
      >
        ${t('consent.rejectAll')}
      </button>
      <button
        type="button"
        class="btn"
        data-act="consentAccept"
        data-testid="${TID.consentAcceptAll}"
      >
        ${t('consent.acceptAll')}
      </button>
      ${state.consentCustomize ? '' : html`<button type="button" class="btn btn--ghost" data-act="consentCustomize" data-testid="${TID.consentCustomize}">${t('consent.customize')}</button>`}
    </div>
  </section>`;
}

export function layout(state, content) {
  return html`<a class="skip-link" href="#main">${t('nav.skip')}</a>
    <header class="site-header">
      <a class="logo" href="${href('products')}" data-testid="${TID.logo}">QA Demo Store</a>
      ${nav(state)} ${tools(state)}
    </header>
    ${state.transport !== 'server' ? html`<p class="demo-banner" data-testid="${TID.demoBanner}">${t('demo.banner')}</p>` : ''}
    ${qaToolbar(state)}
    <main id="main" tabindex="-1">
      <div aria-live="polite" class="live">
        ${
          state.message
            ? html`<div
                class="msg${state.message.error ? ' msg--error' : ''}"
                role="${state.message.error ? 'alert' : 'status'}"
                data-testid="${TID.message}"
              >
                ${state.message.text}
                <button
                  type="button"
                  class="msg__close"
                  data-act="dismiss"
                  data-testid="${TID.messageDismiss}"
                  aria-label="${t('common.dismiss')}"
                >
                  ×
                </button>
              </div>`
            : ''
        }
      </div>
      <div
        class="view"
        data-testid="${TID.viewRoot}"
        data-view="${state.route.name}"
        data-state="${state.view}"
        aria-busy="${String(state.view === 'loading')}"
      >
        ${content}
      </div>
    </main>
    ${consentBanner(state)}
    <footer class="site-footer">
      <p>
        ${t('footer.fictional')} ·
        <a href="${href('privacy')}" data-testid="${TID.privacyPolicy}">${t('footer.privacy')}</a> ·
        <button
          type="button"
          class="link"
          data-act="consentManage"
          data-testid="${TID.consentManage}"
        >
          ${t('footer.cookies')}
        </button>
      </p>
      <p>
        ${state.meta ? t('footer.versions', { engine: state.meta.engineVersion, rules: state.meta.rulesVersion, date: formatDate(state.meta.now) }) : ''}
      </p>
      <button
        type="button"
        class="btn btn--ghost btn--small"
        data-act="reset"
        data-testid="${TID.resetDemo}"
      >
        ${t('footer.reset')}
      </button>
    </footer>`;
}
