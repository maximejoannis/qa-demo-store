import { effectivePrice, promotionPercent, stockLevel, vatBpFor } from '../engine/index.js';

export function productDto(product, now, rating) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    oldPrice: product.oldPrice,
    effectivePrice: effectivePrice(product, now),
    promotionPercent: promotionPercent(product, now),
    stock: Math.max(0, product.stock),
    stockLevel: stockLevel(product.stock),
    weightGrams: product.weightGrams,
    rating: rating?.rating ?? product.rating,
    reviewCount: rating?.count ?? product.reviews,
    badge: product.badge,
    isNew: product.isNew,
    image: product.image,
    active: product.active,
    vatBp: vatBpFor(product.category),
  };
}

export const userDto = (user, config) => ({
  username: user.username,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  faultProfile: config.faultsEnabled ? user.faultProfile : null,
});

export const orderDto = (order) => ({
  id: order.id,
  date: order.date,
  status: order.status,
  username: order.username,
  invoiceNumber: order.invoiceNumber,
  lines: order.lines,
  totals: order.totals,
  coupon: order.coupon,
  shippingMethod: order.shippingMethod,
  shippingAddress: order.shippingAddress,
  delivery: order.delivery,
  deliveredAt: order.deliveredAt,
  payment: order.payment,
  installmentPlan: order.installmentPlan,
  loyaltyPointsEarned: order.loyaltyPointsEarned,
  return: order.return,
});
