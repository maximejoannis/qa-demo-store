const CARDS = {
  4242424242424242: { ok: true },
  4000000000000002: { ok: false, code: 'declined', error: 'Card declined' },
  4000000000000069: { ok: false, code: 'expired', error: 'Card expired' },
  4000000000000119: { ok: false, code: 'error', error: 'Technical error, please retry' },
};
export function pay(method, card = '') {
  if (method === 'pod') return { ok: true };
  if (method !== 'card') return { ok: false, code: 'method', error: 'Unknown payment method' };
  return (
    CARDS[String(card).replace(/\s/g, '')] ?? {
      ok: false,
      code: 'invalid',
      error: 'Invalid card number',
    }
  );
}
