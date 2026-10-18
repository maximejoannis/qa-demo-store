import {
  assertTransition,
  computeQuote,
  loyaltyBalance,
  nextInvoiceNumber,
  rollingEarnedPoints,
  tierFor,
} from '../engine/index.js';
import { ApiError } from './errors.js';
import { C } from './types.js';

export async function loyaltyOf(ctx, userId) {
  return (await ctx.store.get(C.loyalty, userId)) ?? { id: userId, entries: [] };
}

export async function addLoyalty(ctx, userId, entry) {
  if (entry.points <= 0) return;
  const record = await loyaltyOf(ctx, userId);
  await ctx.store.put(C.loyalty, { ...record, entries: [...record.entries, entry] });
}

export async function loyaltyContext(ctx, userId) {
  const record = await loyaltyOf(ctx, userId);
  const rolling = rollingEarnedPoints(record.entries, ctx.now);
  return {
    balance: loyaltyBalance(record.entries),
    tier: tierFor(rolling),
    rolling,
    entries: record.entries,
  };
}

/** Loads authoritative product data and runs the engine (prices never come from the client). */
export async function quoteFor(ctx, params, user) {
  const lines = await Promise.all(
    params.lines.map(async (line) => ({
      product: await ctx.product(line.productId),
      qty: line.qty,
    })),
  );
  const loyalty = user ? await loyaltyContext(ctx, user.id) : null;
  if (!user && params.loyaltyPointsToRedeem > 0) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to use loyalty points');
  }
  return computeQuote({
    lines,
    couponCode: params.couponCode,
    shippingMethod: params.shippingMethod,
    country: params.country,
    loyalty: loyalty
      ? { balance: loyalty.balance, tier: loyalty.tier, redeem: params.loyaltyPointsToRedeem }
      : null,
    now: ctx.now,
  });
}

async function adjustStock(ctx, lines, direction) {
  for (const line of lines) {
    const product = await ctx.store.get(C.products, String(line.productId));
    if (product)
      await ctx.store.put(C.products, { ...product, stock: product.stock + direction * line.qty });
  }
}

export async function nextInvoice(ctx) {
  const meta = (await ctx.store.get(C.meta, 'invoice')) ?? {
    id: 'invoice',
    last: null,
  };
  const number = nextInvoiceNumber(meta.last ?? null, Number(ctx.today.slice(0, 4)));
  await ctx.store.put(C.meta, { ...meta, last: number });
  return number;
}

/** Persists an order built from an authoritative quote: stock, invoice number, loyalty. */
export async function createOrder(ctx, input) {
  const { quote, user } = input;
  const order = {
    id: await ctx.newId('ORD-'),
    userId: user.id,
    username: user.username,
    date: ctx.now.toISOString(),
    status: 'Processing',
    invoiceNumber: await nextInvoice(ctx),
    lines: quote.lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      category: line.category,
      qty: line.qty,
      unitPrice: line.unitPrice,
      net: line.net,
      vatBp: line.vatBp,
    })),
    totals: {
      merchandise: quote.merchandise,
      discount: quote.coupon?.discount ?? 0,
      loyaltyDiscount: quote.loyaltyDiscount,
      shipping: quote.shipping.net,
      totalHt: quote.totalHt,
      totalVat: quote.totalVat,
      total: quote.total,
      vat: quote.vat,
    },
    merchandiseNet: quote.merchandiseNet,
    standardShippingCost: quote.standardShippingCost,
    coupon: quote.coupon?.code ?? null,
    shippingMethod: quote.shipping.method,
    shippingAddress: input.shippingAddress,
    delivery: quote.delivery,
    deliveredAt: null,
    payment: input.payment,
    installmentPlan: input.installmentPlan,
    loyaltyPointsEarned: quote.loyaltyPointsEarned,
    loyaltyPointsRedeemed: quote.loyaltyPointsRedeemed,
    refunded: 0,
    return: null,
  };
  await adjustStock(ctx, order.lines, -1);
  if (order.loyaltyPointsRedeemed) {
    await addLoyalty(ctx, user.id, {
      type: 'redeem',
      points: order.loyaltyPointsRedeemed,
      date: ctx.today,
      orderId: order.id,
    });
  }
  await ctx.store.put(C.orders, order);
  return order;
}

/** Applies a status change with its side effects (ENG-ORD-01). */
export async function changeStatus(ctx, order, next) {
  assertTransition(order.status, next);
  const updated = { ...order, status: next };
  if (next === 'Cancelled') {
    await adjustStock(ctx, order.lines, 1);
    if (order.userId && order.loyaltyPointsRedeemed) {
      await addLoyalty(ctx, order.userId, {
        type: 'restore',
        points: order.loyaltyPointsRedeemed,
        date: ctx.today,
        orderId: order.id,
      });
    }
  }
  if (next === 'Delivered') {
    updated.deliveredAt = ctx.today;
    if (order.userId) {
      await addLoyalty(ctx, order.userId, {
        type: 'earn',
        points: order.loyaltyPointsEarned,
        date: ctx.today,
        orderId: order.id,
      });
    }
  }
  if (next === 'Refunded') {
    const refund = order.return;
    if (!refund) throw new ApiError(409, 'NO_RETURN_REQUEST', 'No return request for this order');
    await adjustStock(ctx, refund.lines, 1);
    updated.refunded = refund.total;
    if (order.userId) {
      await addLoyalty(ctx, order.userId, {
        type: 'revoke',
        points: refund.pointsToRevoke,
        date: ctx.today,
        orderId: order.id,
      });
    }
  }
  await ctx.store.put(C.orders, updated);
  return updated;
}
