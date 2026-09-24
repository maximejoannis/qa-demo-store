export function addToCart(cart, product, qty = 1) {
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: 'Invalid quantity' };
  if (!product || !product.active || product.stock <= 0)
    return { ok: false, error: 'Product unavailable' };
  const cur = cart.find((l) => l.id === product.id)?.qty ?? 0;
  if (cur + qty > product.stock) return { ok: false, error: 'Not enough stock' };
  const next = cur
    ? cart.map((l) => (l.id === product.id ? { ...l, qty: cur + qty } : l))
    : [...cart, { id: product.id, qty }];
  return { ok: true, cart: next };
}
export const removeFromCart = (cart, id) => cart.filter((l) => l.id !== id);
export function setQuantity(cart, product, qty) {
  if (!Number.isInteger(qty) || qty < 0) return { ok: false, error: 'Invalid quantity' };
  if (qty === 0) return { ok: true, cart: removeFromCart(cart, product.id) };
  if (qty > product.stock) return { ok: false, error: 'Not enough stock' };
  return { ok: true, cart: cart.map((l) => (l.id === product.id ? { ...l, qty } : l)) };
}
export const cartCount = (cart) => cart.reduce((n, l) => n + l.qty, 0);
export const cartLines = (cart, products) =>
  cart.flatMap((l) => {
    const p = products.find((x) => x.id === l.id);
    return p ? [{ ...l, name: p.name, unitPrice: effectivePrice(p) }] : [];
  });
import { effectivePrice } from '../promotions/promotions.js';
