/**
 * Request schemas of the API (hand-written, strict: unknown fields are refused).
 * Names match the route table and the generated OpenAPI document.
 */
import {
  array,
  boolean,
  isoDate,
  isoDateTime,
  number,
  object,
  oneOf,
  queryBoolean,
  string,
} from './validate.js';

const ZIP = /^[\p{L}\p{N} -]{3,12}$/u;
const COUNTRY = /^[A-Z]{2}$/;

export const SORT_KEYS = ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'rating', 'new'];
export const ORDER_STATUSES = [
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'ReturnRequested',
  'Refunded',
];
export const SCENARIOS = [
  'default',
  'empty-catalog',
  'low-stock',
  'order-history',
  'loyalty-gold',
  'rgpd-expired',
];

const name = () => string({ min: 1, max: 60 });
const email = () => string({ max: 254, email: true, case: 'lower' });
const productId = () => number({ min: 1, max: 1_000_000 });

export const LoginRequestSchema = object({
  username: string({ min: 1, max: 64 }),
  password: string({ min: 1, max: 128, trim: false }),
});

export const RegisterRequestSchema = object(
  {
    firstName: name(),
    lastName: name(),
    email: email(),
    username: string({
      pattern: /^[A-Za-z0-9_.-]{3,32}$/,
      message: 'Use 3 to 32 letters, digits, _ . -',
    }),
    password: string({
      min: 8,
      max: 128,
      trim: false,
      pattern: /^(?=.*[a-z])(?=.*\d)/i,
      message: 'Needs a letter and a digit',
    }),
    confirm: string({ max: 128, trim: false }),
    terms: oneOf([true]),
    newsletter: boolean({ optional: true }),
  },
  {
    refine: (data, fail) => {
      if (data.password !== data.confirm) fail('confirm', 'mismatch');
    },
  },
);

export const AddressSchema = object({
  firstName: name(),
  lastName: name(),
  address: string({ min: 3, max: 120 }),
  city: string({ min: 1, max: 60 }),
  zip: string({ pattern: ZIP, message: 'Invalid postal code' }),
  country: string({ case: 'upper', pattern: COUNTRY, message: 'Use a 2-letter country code' }),
});

export const ProfileUpdateSchema = object(
  {
    firstName: name(),
    lastName: name(),
    email: email(),
    phone: string({
      max: 20,
      pattern: /^(\+?[0-9 .-]{6,20})?$/,
      message: 'Invalid phone number',
      default: '',
    }),
    address: string({ max: 120, default: '' }),
    city: string({ max: 60, default: '' }),
    zip: string({ max: 12, default: '' }),
    country: string({ max: 60, case: 'upper', default: '' }),
  },
  {
    refine: (data, fail) => {
      const parts = [data.address, data.city, data.zip, data.country];
      if (parts.some(Boolean) && !parts.every(Boolean)) fail('address', 'incomplete-address');
      if (data.zip && !ZIP.test(data.zip)) fail('zip', 'invalid-zip');
      if (data.country && !COUNTRY.test(data.country)) fail('country', 'invalid-country');
    },
  },
);

export const ProductQuerySchema = object({
  search: string({ max: 100, default: '' }),
  category: string({ max: 40, default: '' }),
  min: number({ min: 0, coerce: true, optional: true }),
  max: number({ min: 0, coerce: true, optional: true }),
  inStock: queryBoolean(),
  minRating: number({ min: 0, max: 5, integer: false, coerce: true, default: 0 }),
  sort: oneOf(SORT_KEYS, { default: 'name-asc' }),
  page: number({ min: 1, max: 10_000, coerce: true, default: 1 }),
  perPage: number({ min: 1, max: 48, coerce: true, default: 8 }),
});

export const QuoteRequestSchema = object({
  lines: array(object({ productId: productId(), qty: number({ min: 1, max: 20 }) }), {
    min: 1,
    max: 50,
  }),
  couponCode: string({ max: 32, optional: true, nullable: true }),
  shippingMethod: oneOf(['standard', 'express', 'pickup']),
  destination: object({
    country: string({ case: 'upper', pattern: COUNTRY, message: 'Use a 2-letter country code' }),
    zip: string({ pattern: ZIP, optional: true }),
  }),
  loyaltyPointsToRedeem: number({ min: 0, max: 1_000_000, default: 0 }),
});

export const OrderRequestSchema = object({
  quoteId: string({ min: 8, max: 80 }),
  payment: object({ method: oneOf(['card', 'pod']), card: string({ max: 23, optional: true }) }),
  shippingAddress: AddressSchema,
  installments: oneOf([1, 3, 4], { default: 1 }),
});

export const ReviewRequestSchema = object({
  rating: number({ min: 1, max: 5 }),
  comment: string({ min: 3, max: 500 }),
});

export const StockAlertRequestSchema = object({ consent: oneOf([true]) });

export const InstallmentsRequestSchema = object({
  total: number({ min: 0, max: 100_000_000 }),
  count: oneOf([3, 4]),
});

const returnLines = () =>
  array(object({ productId: productId(), qty: number({ min: 0, max: 20 }) }), { min: 1, max: 50 });

export const ReturnQuoteRequestSchema = object({
  orderId: string({ min: 1, max: 40 }),
  lines: returnLines(),
});

export const ReturnRequestSchema = object({
  orderId: string({ min: 1, max: 40 }),
  lines: returnLines(),
  reason: string({ max: 500, default: '' }),
});

export const VisitorConsentRequestSchema = object({
  visitorId: string({ pattern: /^[a-f0-9-]{16,64}$/, message: 'Invalid visitor id' }),
  choices: object({ analytics: boolean(), personalization: boolean() }),
  policyVersion: string({ max: 20 }),
});

export const AccountConsentsRequestSchema = object({ newsletter: boolean() });

export const DeleteAccountRequestSchema = object({
  password: string({ min: 1, max: 128, trim: false }),
});

export const AdminProductPatchSchema = object(
  {
    price: number({ min: 1, max: 10_000_000, optional: true }),
    stock: number({ min: 0, max: 100_000, optional: true }),
    active: boolean({ optional: true }),
  },
  {
    refine: (data, fail) => {
      if (!Object.keys(data).length) fail('', 'empty-patch');
    },
  },
);

export const AdminStatusPatchSchema = object({ status: oneOf(ORDER_STATUSES) });

export const KpiQuerySchema = object({ from: isoDate(), to: isoDate() });

export const DemoResetRequestSchema = object({
  scenario: oneOf(SCENARIOS, { default: 'default' }),
});
export const DemoClockRequestSchema = object({ now: isoDateTime() });
export const DemoIdsRequestSchema = object({
  seed: number({ min: 0, max: 1_000_000, optional: true, nullable: true }),
});
