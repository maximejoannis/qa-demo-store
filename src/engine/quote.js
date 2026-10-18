import { effectivePrice } from './catalog.js';
import { validateCoupon } from './coupons.js';
import { EngineError } from './errors.js';
import { pointsEarned, redemptionValue } from './loyalty.js';
import { allocateProRata, assertCents, divideHalfUp, sumCents } from './money.js';
import { DEFAULT_RULES, ENGINE_VERSION, vatBpFor } from './rules.js';
import { deliveryWindow, shippingCost, zoneFor } from './shipping.js';
import { assertDate } from './time.js';

function validateLines(input, rules) {
  const { lines } = input;
  if (lines.length === 0 || lines.length > rules.limits.maxLines) {
    throw new EngineError('INVALID_LINES', 'The cart must contain between 1 and 50 lines', {
      max: rules.limits.maxLines,
    });
  }
  const seen = new Set();
  for (const { product, qty } of lines) {
    if (seen.has(product.id)) {
      throw new EngineError('INVALID_LINES', 'Duplicate product line', { productId: product.id });
    }
    seen.add(product.id);
    if (!Number.isInteger(qty) || qty < 1 || qty > rules.limits.maxQtyPerLine) {
      throw new EngineError('INVALID_QUANTITY', 'Invalid quantity', {
        productId: product.id,
        max: rules.limits.maxQtyPerLine,
      });
    }
    if (!product.active) {
      throw new EngineError('PRODUCT_UNAVAILABLE', 'Product unavailable', {
        productId: product.id,
      });
    }
    if (product.stock < qty) {
      throw new EngineError('OUT_OF_STOCK', 'Not enough stock', {
        productId: product.id,
        available: Math.max(0, product.stock),
      });
    }
    assertCents(product.price, 'price');
  }
}

/** ENG-VAT-01 / ENG-VAT-02: HT = round(TTC / (1 + rate)) per rate, VAT = TTC - HT. */
export function vatBreakdown(amountsByRate) {
  return [...amountsByRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rateBp, ttc]) => {
      const ht = divideHalfUp(ttc * 10000, 10000 + rateBp);
      return { rateBp, ttc, ht, vat: ttc - ht };
    });
}

/**
 * Computes a full, authoritative quote. Prices always come from `product`, never from the client.
 * @param {import("./types.js").QuoteInput} input
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {import("./types.js").Quote}
 */
export function computeQuote(input, rules = DEFAULT_RULES) {
  assertDate(input.now);
  validateLines(input, rules);
  const { now } = input;
  const priced = input.lines.map(({ product, qty }) => {
    const unitPrice = effectivePrice(product, now);
    return { product, qty, unitPrice, gross: unitPrice * qty };
  });
  const merchandise = sumCents(priced.map((line) => line.gross));
  const weightGrams = sumCents(priced.map((line) => line.product.weightGrams * line.qty));
  // Coupon (ENG-DISC-03..05)
  const coupon = input.couponCode
    ? validateCoupon(input.couponCode, merchandise, now, rules)
    : null;
  let couponDiscount = 0;
  if (coupon?.type === 'percent') couponDiscount = divideHalfUp(merchandise * coupon.value, 100);
  if (coupon?.type === 'fixed') couponDiscount = Math.min(coupon.value, merchandise);
  // Loyalty redemption (ENG-LOY-03), applied after the coupon
  const redeem = input.loyalty?.redeem ?? 0;
  const loyaltyDiscount = input.loyalty
    ? redemptionValue(redeem, input.loyalty.balance, merchandise - couponDiscount, rules)
    : 0;
  // ENG-DISC-06: order-level discounts are allocated pro rata to lines
  const allocated = allocateProRata(
    couponDiscount + loyaltyDiscount,
    priced.map((line) => line.gross),
  );
  const lines = priced.map((line, index) => {
    const discount = allocated[index] ?? 0;
    return {
      productId: line.product.id,
      name: line.product.name,
      category: line.product.category,
      qty: line.qty,
      unitPrice: line.unitPrice,
      gross: line.gross,
      discount,
      net: line.gross - discount,
      vatBp: vatBpFor(line.product.category, rules),
    };
  });
  const merchandiseNet = merchandise - couponDiscount - loyaltyDiscount;
  // Shipping (ENG-SHIP-01, ENG-SHIP-02, ENG-DISC-05)
  const zone = zoneFor(input.country, rules);
  const standardShippingCost = rules.shipping.methods.standard.zones[zone]
    ? shippingCost('standard', zone, weightGrams, rules)
    : 0;
  const freeStandard =
    input.shippingMethod === 'standard' &&
    zone === 'FR' &&
    merchandiseNet >= rules.shipping.freeStandardThresholdFr;
  const shippingGross = freeStandard
    ? 0
    : shippingCost(input.shippingMethod, zone, weightGrams, rules);
  const shippingDiscount =
    coupon?.type === 'shipping' ? Math.min(shippingGross, standardShippingCost) : 0;
  const shippingNet = shippingGross - shippingDiscount;
  // VAT (ENG-VAT-03: shipping follows the rates of the goods, pro rata)
  const byRate = new Map();
  for (const line of lines) byRate.set(line.vatBp, (byRate.get(line.vatBp) ?? 0) + line.net);
  const rates = [...byRate.keys()];
  const shippingShares = allocateProRata(
    shippingNet,
    rates.map((rate) => byRate.get(rate) ?? 0),
  );
  if (merchandiseNet === 0 && shippingNet > 0) {
    shippingShares[0] = shippingNet; // fully discounted basket: shipping at the first rate
  }
  rates.forEach((rate, index) =>
    byRate.set(rate, (byRate.get(rate) ?? 0) + (shippingShares[index] ?? 0)),
  );
  const vat = vatBreakdown(byRate);
  const total = merchandiseNet + shippingNet;
  return {
    engineVersion: ENGINE_VERSION,
    rulesVersion: rules.version,
    lines,
    merchandise,
    coupon: coupon
      ? { code: coupon.code, type: coupon.type, discount: couponDiscount, shippingDiscount }
      : null,
    loyaltyDiscount,
    loyaltyPointsRedeemed: loyaltyDiscount ? redeem : 0,
    merchandiseNet,
    shipping: {
      method: input.shippingMethod,
      zone,
      gross: shippingGross,
      discount: shippingDiscount,
      net: shippingNet,
      weightGrams,
    },
    standardShippingCost,
    vat,
    totalHt: sumCents(vat.map((line) => line.ht)),
    totalVat: sumCents(vat.map((line) => line.vat)),
    total,
    loyaltyPointsEarned: pointsEarned(merchandiseNet, input.loyalty?.tier ?? 'bronze', rules),
    delivery: deliveryWindow(input.shippingMethod, zone, now, rules),
  };
}
