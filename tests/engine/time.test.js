import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  addDays,
  addMonthsClamped,
  assertDate,
  assertIsoDate,
  daysBetween,
  dayOfWeek,
  easterSunday,
  frenchPublicHolidays,
  isBusinessDay,
  parisDate,
} from '../../src/engine/index.js';
import { paris } from './fixtures.js';

describe('ENG-TIME-01 Paris calendar dates', () => {
  it('ENG-TIME-01 uses the Paris date around midnight (v1 UTC bug)', () => {
    expect(parisDate(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
    expect(parisDate(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    expect(parisDate(new Date('2026-12-31T22:59:59Z'))).toBe('2026-12-31');
    expect(parisDate(paris('2026-03-29T03:30:00'))).toBe('2026-03-29');
    expect(parisDate(paris('2026-10-25T02:30:00'))).toBe('2026-10-25');
  });
  it('ENG-TIME-01 rejects invalid inputs', () => {
    expect(() => assertDate(new Date('nope'))).toThrow(/valid date/);
    expect(() => assertIsoDate('2026-02-30')).toThrow(/Invalid ISO date/);
    expect(() => assertIsoDate('26-1-1')).toThrow(/Invalid ISO date/);
    expect(() => assertIsoDate('2028-02-29')).not.toThrow();
  });
  it('ENG-TIME-02 performs date arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(dayOfWeek('2026-10-11')).toBe(0);
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonthsClamped('2026-05-15', 0)).toBe('2026-05-15');
  });
});

describe('ENG-SHIP-04 French public holidays', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('ENG-SHIP-04 computes Easter %i', (year, date) => {
    expect(easterSunday(year)).toBe(date);
  });
  it('ENG-SHIP-04 lists the 11 holidays including movable feasts', () => {
    const holidays = frenchPublicHolidays(2026);
    expect(holidays).toHaveLength(11);
    expect(holidays).toEqual(
      expect.arrayContaining([
        '2026-04-06',
        '2026-05-14',
        '2026-05-25',
        '2026-07-14',
        '2026-12-25',
      ]),
    );
  });
  it('ENG-SHIP-04 counts business days', () => {
    expect(isBusinessDay('2026-10-12')).toBe(true);
    expect(isBusinessDay('2026-10-10')).toBe(false);
    expect(isBusinessDay('2026-05-25')).toBe(false);
    // Friday 22 May 2026, Whit Monday on 25 May
    expect(addBusinessDays('2026-05-22', 1)).toBe('2026-05-26');
    expect(addBusinessDays('2026-05-22', 3)).toBe('2026-05-28');
    expect(addBusinessDays('2026-10-10', 0)).toBe('2026-10-12');
    expect(addBusinessDays('2026-10-12', 0)).toBe('2026-10-12');
    expect(addBusinessDays('2026-12-24', 1)).toBe('2026-12-28');
  });
});
