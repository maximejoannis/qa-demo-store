export const TAX_RATE = 0.2;
export const money = (cents) => `€${(cents / 100).toFixed(2)}`;
export function computeTotals({ lines, coupon = null, shippingCost = 0 }) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  let discount = 0;
  let freeShip = false;
  if (coupon) {
    if (coupon.type === 'percent') discount = Math.round((subtotal * coupon.value) / 100);
    else if (coupon.type === 'fixed') discount = Math.min(coupon.value, subtotal);
    else freeShip = true;
  }
  const shipping = subtotal === 0 || freeShip ? 0 : shippingCost;
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * TAX_RATE);
  return { subtotal, discount, shipping, tax, total: taxable + shipping + tax };
}
