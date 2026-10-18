import { EngineError } from './errors.js';

export const ORDER_STATUSES = [
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'ReturnRequested',
  'Refunded',
];

/** ENG-ORD-01: allowed status transitions. */
export const TRANSITIONS = {
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: ['ReturnRequested'],
  ReturnRequested: ['Refunded'],
  Cancelled: [],
  Refunded: [],
};

export const canTransition = (from, to) => TRANSITIONS[from].includes(to);

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new EngineError('INVALID_TRANSITION', `Cannot change ${from} to ${to}`, { from, to });
  }
}

/** ENG-ORD-02: invoice numbers are sequential per year, without gaps: FA-2026-000001. */
export function nextInvoiceNumber(previous, year) {
  const prefix = `FA-${String(year)}-`;
  const last = previous?.startsWith(prefix) ? Number(previous.slice(prefix.length)) : 0;
  return `${prefix}${String(last + 1).padStart(6, '0')}`;
}
