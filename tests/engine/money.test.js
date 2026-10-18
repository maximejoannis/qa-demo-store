import { describe, expect, it } from 'vitest';
import {
  allocateProRata,
  assertCents,
  divideHalfUp,
  EngineError,
  isEngineError,
  sumCents,
} from '../../src/engine/index.js';

describe('ENG-MONEY-01 integer cents and commercial rounding', () => {
  it('ENG-MONEY-01 rounds half up', () => {
    expect(divideHalfUp(5, 2)).toBe(3);
    expect(divideHalfUp(4, 2)).toBe(2);
    expect(divideHalfUp(149, 100)).toBe(1);
    expect(divideHalfUp(150, 100)).toBe(2);
    expect(divideHalfUp(0, 7)).toBe(0);
  });
  it('ENG-MONEY-01 rejects invalid operands', () => {
    expect(() => divideHalfUp(-1, 2)).toThrow(EngineError);
    expect(() => divideHalfUp(1.5, 2)).toThrow(/numerator/);
    expect(() => divideHalfUp(1, 0)).toThrow(/denominator/);
    expect(() => divideHalfUp(1, 2.5)).toThrow(/denominator/);
  });
  it('ENG-MONEY-01 validates cents', () => {
    expect(() => assertCents(10)).not.toThrow();
    expect(() => assertCents(0)).not.toThrow();
    for (const bad of [-1, 1.2, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      try {
        assertCents(bad, 'price');
        expect.unreachable();
      } catch (error) {
        expect(isEngineError(error)).toBe(true);
        expect(error.code).toBe('INVALID_AMOUNT');
        expect(error.details).toMatchObject({ field: 'price' });
      }
    }
    expect(isEngineError(new Error('x'))).toBe(false);
  });
  it('ENG-MONEY-02 allocates pro rata with remainder on the largest weight', () => {
    expect(allocateProRata(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProRata(100, [1, 2, 1])).toEqual([25, 50, 25]);
    expect(allocateProRata(10, [3, 7])).toEqual([3, 7]);
    expect(allocateProRata(1, [100, 300, 200])).toEqual([0, 1, 0]);
    expect(allocateProRata(50, [])).toEqual([]);
    expect(allocateProRata(50, [0, 0])).toEqual([0, 0]);
    expect(sumCents([1, 2, 3])).toBe(6);
  });
});
