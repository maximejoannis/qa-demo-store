import { ApiError } from './errors.js';

const TEST_CARDS = {
  4242424242424242: { ok: true },
  4000000000000002: { ok: false, code: 'CARD_DECLINED', title: 'Card declined', status: 402 },
  4000000000000069: { ok: false, code: 'CARD_EXPIRED', title: 'Card expired', status: 402 },
  4000000000000119: {
    ok: false,
    code: 'PAYMENT_PROVIDER_ERROR',
    title: 'Technical error, please retry',
    status: 502,
  },
};

/**
 * Simulated payment: only the documented test cards exist. Any other number is refused and
 * never stored nor logged; only the last 4 digits of an accepted card are kept.
 */
export function pay(method, card) {
  if (method === 'pod') return { last4: null };
  const digits = (card ?? '').replace(/[\s-]/g, '');
  const outcome = TEST_CARDS[digits];
  if (!outcome) throw new ApiError(422, 'INVALID_CARD', 'Use one of the documented test cards');
  if (!outcome.ok) throw new ApiError(outcome.status, outcome.code, outcome.title);
  return { last4: digits.slice(-4) };
}
