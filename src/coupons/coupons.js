export const COUPONS = {
  WELCOME10: { code: 'WELCOME10', type: 'percent', value: 10, min: 0, expires: '2099-12-31' },
  SAVE20: { code: 'SAVE20', type: 'fixed', value: 2000, min: 10000, expires: '2099-12-31' },
  FREESHIP: { code: 'FREESHIP', type: 'shipping', value: 0, min: 0, expires: '2099-12-31' },
  OLD5: { code: 'OLD5', type: 'percent', value: 5, min: 0, expires: '2020-01-01' },
};
export function validateCoupon(code, subtotal, now = new Date()) {
  const c =
    COUPONS[
      String(code ?? '')
        .trim()
        .toUpperCase()
    ];
  if (!c) return { ok: false, error: 'Unknown coupon' };
  if (new Date(c.expires) < now) return { ok: false, error: 'Coupon expired' };
  if (subtotal < c.min) return { ok: false, error: `Minimum purchase is €${c.min / 100}` };
  return { ok: true, coupon: c };
}
