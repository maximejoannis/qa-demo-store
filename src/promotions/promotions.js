export function effectivePrice(product, now = new Date()) {
  if (!product?.oldPrice || product.oldPrice <= product.price) return product.price;
  const today = now.toISOString().slice(0, 10);
  if (product.promoStart && today < product.promoStart) return product.oldPrice;
  if (product.promoEnd && today > product.promoEnd) return product.oldPrice;
  return product.price;
}

export function promotionPercent(product, now = new Date()) {
  const price = effectivePrice(product, now);
  return price < product.oldPrice
    ? Math.round(((product.oldPrice - price) / product.oldPrice) * 100)
    : 0;
}
