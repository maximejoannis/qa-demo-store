import { EngineError } from './errors.js';

export const TIME_ZONE = 'Europe/Paris';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const parisFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function assertDate(value, field = 'now') {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new EngineError('INVALID_DATE', `${field} must be a valid date`, { field });
  }
}

/**
 * Calendar date in Paris for an instant (fixes the UTC off-by-one of v1).
 * @param {Date} instant
 * @returns {string} IsoDate.
 */
export function parisDate(instant) {
  assertDate(instant);
  return parisFormatter.format(instant);
}

function parse(iso) {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new EngineError('INVALID_DATE', `Invalid ISO date: ${iso}`, { value: iso });
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new EngineError('INVALID_DATE', `Invalid ISO date: ${iso}`, { value: iso });
  }
  return { y, m, d };
}

const toIso = (date) => date.toISOString().slice(0, 10);

export function assertIsoDate(iso) {
  parse(iso);
}

export function addDays(iso, days) {
  const { y, m, d } = parse(iso);
  return toIso(new Date(Date.UTC(y, m - 1, d + days)));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from, to) {
  const a = parse(from);
  const b = parse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(iso) {
  const { y, m, d } = parse(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Same day `months` later, clamped to the last day of the target month. */
export function addMonthsClamped(iso, months) {
  const { y, m, d } = parse(iso);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))));
}

/** Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIso(new Date(Date.UTC(year, month - 1, day)));
}

/** The 11 French public holidays (metropolitan France) for a year. */
export function frenchPublicHolidays(year) {
  const easter = easterSunday(year);
  const fixed = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map(
    (md) => `${String(year)}-${md}`,
  );
  return [
    ...fixed,
    addDays(easter, 1), // Easter Monday
    addDays(easter, 39), // Ascension
    addDays(easter, 50), // Whit Monday
  ].sort();
}

export function isBusinessDay(iso) {
  const weekday = dayOfWeek(iso);
  if (weekday === 0 || weekday === 6) return false;
  return !frenchPublicHolidays(parse(iso).y).includes(iso);
}

/**
 * Adds `count` business days. With count = 0, returns `iso` if it is a business day,
 * otherwise the next business day.
 * @param {string} iso IsoDate.
 * @param {number} count
 * @returns {string} IsoDate.
 */
export function addBusinessDays(iso, count) {
  let current = iso;
  if (count === 0) {
    while (!isBusinessDay(current)) current = addDays(current, 1);
    return current;
  }
  let remaining = count;
  while (remaining > 0) {
    current = addDays(current, 1);
    if (isBusinessDay(current)) remaining -= 1;
  }
  return current;
}
