import { EngineError } from './errors.js';
import { DEFAULT_RULES } from './rules.js';
import { addBusinessDays, parisDate } from './time.js';

export const SHIPPING_METHODS = ['standard', 'express', 'pickup'];

/**
 * @param {string} country
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {import("./types.js").Zone}
 */
export function zoneFor(country, rules = DEFAULT_RULES) {
  const code = country.trim().toUpperCase();
  if (rules.shipping.frCountries.includes(code)) return 'FR';
  if (rules.shipping.euCountries.includes(code)) return 'EU';
  return 'WORLD';
}

function zoneRule(method, zone, rules) {
  const methodRule = rules.shipping.methods[method];
  if (!methodRule) {
    throw new EngineError('UNKNOWN_SHIPPING_METHOD', 'Unknown shipping method', { method });
  }
  const rule = methodRule.zones[zone];
  if (!rule) {
    throw new EngineError('SHIPPING_NOT_AVAILABLE', 'Shipping method not available', {
      method,
      zone,
    });
  }
  return rule;
}

/**
 * ENG-SHIP-01: base price per zone plus a supplement per started kilogram beyond the first.
 * @param {import("./types.js").ShippingMethodId} method
 * @param {import("./types.js").Zone} zone
 * @param {number} weightGrams
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {number} Cents.
 */
export function shippingCost(method, zone, weightGrams, rules = DEFAULT_RULES) {
  const rule = zoneRule(method, zone, rules);
  const extraKg = Math.max(0, Math.ceil((weightGrams - rules.shipping.includedGrams) / 1000));
  return rule.base + extraKg * rule.perExtraKg;
}

/**
 * ENG-SHIP-03: delivery window in French business days (weekends and public holidays excluded).
 * @param {import("./types.js").ShippingMethodId} method
 * @param {import("./types.js").Zone} zone
 * @param {Date} now
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {{ from: string, to: string }}
 */
export function deliveryWindow(method, zone, now, rules = DEFAULT_RULES) {
  const [min, max] = zoneRule(method, zone, rules).days;
  const today = parisDate(now);
  return { from: addBusinessDays(today, min), to: addBusinessDays(today, max) };
}

export function availableMethods(zone, rules = DEFAULT_RULES) {
  return SHIPPING_METHODS.filter((method) => rules.shipping.methods[method].zones[zone]);
}
