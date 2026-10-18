import { describe, expect, it } from 'vitest';
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
} from '../../src/backend/validate.js';

const errors = (schema, value) => {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('API-VAL hand-written validation', () => {
  it('API-VAL-01 strings: trim, case, length, pattern, email, optional and nullable', () => {
    expect(string({ case: 'upper' }).safeParse(' fr ')).toEqual({ success: true, data: 'FR' });
    expect(string({ trim: false }).safeParse(' a ')).toEqual({ success: true, data: ' a ' });
    expect(errors(string(), 3)).toEqual([': Expected a string']);
    expect(errors(string({ min: 2 }), 'a')).toEqual([': Too short (min 2)']);
    expect(errors(string({ max: 2 }), 'abc')).toEqual([': Too long (max 2)']);
    expect(errors(string({ email: true }), 'nope')).toEqual([': Invalid email']);
    expect(errors(string({ pattern: /^a/ }), 'b')).toEqual([': Invalid format']);
    expect(string({ optional: true }).safeParse(undefined)).toEqual({
      success: true,
      data: undefined,
    });
    expect(string({ nullable: true }).safeParse(null)).toEqual({ success: true, data: null });
    expect(string({ default: 'x' }).safeParse(undefined)).toEqual({ success: true, data: 'x' });
    expect(string({ case: 'lower', email: true }).json).toMatchObject({
      type: 'string',
      format: 'email',
    });
  });

  it('API-VAL-02 numbers, booleans, enums, dates', () => {
    expect(number({ coerce: true }).safeParse('12')).toEqual({ success: true, data: 12 });
    expect(errors(number(), '12')).toEqual([': Expected a number']);
    expect(errors(number(), 1.5)).toEqual([': Expected an integer']);
    expect(number({ integer: false }).safeParse(1.5).success).toBe(true);
    expect(errors(number({ min: 1 }), 0)).toEqual([': Too small (min 1)']);
    expect(errors(number({ max: 1 }), 2)).toEqual([': Too big (max 1)']);
    expect(number({ default: 3 }).safeParse(undefined)).toEqual({ success: true, data: 3 });
    expect(number({ min: 1, max: 2 }).json).toEqual({ type: 'integer', minimum: 1, maximum: 2 });
    expect(errors(boolean(), 'yes')).toEqual([': Expected a boolean']);
    expect(boolean({ optional: true }).safeParse(undefined).success).toBe(true);
    expect(errors(oneOf(['a', 'b']), 'c')).toEqual([': Expected one of: a, b']);
    expect(oneOf(['a'], { optional: true }).safeParse(undefined).success).toBe(true);
    expect(queryBoolean().safeParse('true')).toEqual({ success: true, data: true });
    expect(queryBoolean().safeParse(undefined)).toEqual({ success: true, data: false });
    expect(errors(queryBoolean(), 'yes')).toEqual([': Expected true or false']);
    expect(isoDate().safeParse('2026-10-12').success).toBe(true);
    expect(isoDateTime().safeParse('2026-10-12T10:00:00+02:00').success).toBe(true);
    expect(isoDateTime().safeParse('2026-10-12T10:00Z').success).toBe(true);
    expect(errors(isoDateTime(), '2026-10-12')).toHaveLength(1);
    expect(errors(isoDateTime(), '2026-13-45T10:00:00Z')).toHaveLength(1);
  });

  it('API-VAL-03 strict objects and arrays collect every issue with its path', () => {
    const schema = object(
      {
        items: array(object({ qty: number({ min: 1 }) }), { min: 1, max: 2 }),
        note: string({ optional: true }),
      },
      {
        refine: (data, fail) => {
          if (data.items.length === 2) fail('items', 'two-items');
        },
      },
    );
    expect(errors(schema, { items: [{ qty: 0, price: 1 }] })).toEqual([
      'items.0.price: Unknown field',
      'items.0.qty: Too small (min 1)',
    ]);
    expect(errors(schema, { items: [] })).toEqual(['items: Too few items (min 1)']);
    expect(errors(schema, { items: [1, 2, 3] })).toEqual(['items: Too many items (max 2)']);
    expect(errors(schema, { items: 'x' })).toEqual(['items: Expected an array']);
    expect(errors(schema, [])).toEqual([': Expected an object']);
    expect(errors(schema, { items: [{ qty: 1 }, { qty: 2 }] })).toEqual(['items: two-items']);
    expect(schema.safeParse({ items: [{ qty: 1 }] })).toEqual({
      success: true,
      data: { items: [{ qty: 1 }] },
    });
    expect(schema.json).toMatchObject({
      type: 'object',
      required: ['items'],
      additionalProperties: false,
    });
  });
});
