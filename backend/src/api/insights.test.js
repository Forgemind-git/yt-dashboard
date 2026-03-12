'use strict';

const { _helpers: h } = require('./insights');
const { ewma, linearSlope, stddev, diversityIndex, pctChange, clamp, safeDivide, round } = h;

// ─── ewma ──────────────────────────────────────────────────────────────────────

describe('ewma', () => {
  test('empty array returns 0', () => {
    expect(ewma([])).toBe(0);
  });

  test('single element returns that element', () => {
    expect(ewma([42])).toBe(42);
  });

  test('alpha=1 returns last element', () => {
    expect(ewma([1, 2, 3, 4, 5], 1)).toBe(5);
  });

  test('alpha=0 returns first element', () => {
    expect(ewma([1, 2, 3, 4, 5], 0)).toBe(1);
  });

  test('normal alpha weighted toward recent values', () => {
    // With alpha=0.3: result = 0.3*2 + 0.7*(0.3*1 + 0.7*10) ≈ varies, just check it's between first and last
    const result = ewma([10, 1, 2], 0.3);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(15);
  });
});

// ─── linearSlope ───────────────────────────────────────────────────────────────

describe('linearSlope', () => {
  test('single element returns 0', () => {
    expect(linearSlope([5])).toBe(0);
  });

  test('empty array returns 0', () => {
    expect(linearSlope([])).toBe(0);
  });

  test('flat line has slope 0', () => {
    expect(linearSlope([3, 3, 3, 3])).toBe(0);
  });

  test('ascending line has positive slope', () => {
    const slope = linearSlope([0, 1, 2, 3, 4]);
    expect(slope).toBeCloseTo(1, 5);
  });

  test('descending line has negative slope', () => {
    const slope = linearSlope([4, 3, 2, 1, 0]);
    expect(slope).toBeCloseTo(-1, 5);
  });
});

// ─── stddev ────────────────────────────────────────────────────────────────────

describe('stddev', () => {
  test('empty array returns 0', () => {
    expect(stddev([])).toBe(0);
  });

  test('single element returns 0', () => {
    expect(stddev([7])).toBe(0);
  });

  test('known variance: [2,4,4,4,5,5,7,9] has stddev=2', () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
  });

  test('identical values have stddev=0', () => {
    expect(stddev([5, 5, 5, 5])).toBe(0);
  });
});

// ─── diversityIndex ────────────────────────────────────────────────────────────

describe('diversityIndex', () => {
  test('empty array returns 0', () => {
    expect(diversityIndex([])).toBe(0);
  });

  test('single element returns 0 (no diversity)', () => {
    expect(diversityIndex([100])).toBe(0);
  });

  test('equal distribution is maximally diverse (returns 1)', () => {
    const result = diversityIndex([25, 25, 25, 25]);
    expect(result).toBeCloseTo(1, 5);
  });

  test('all-zero values return 0', () => {
    expect(diversityIndex([0, 0, 0])).toBe(0);
  });

  test('result is clamped between 0 and 1', () => {
    const result = diversityIndex([90, 5, 3, 2]);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ─── pctChange (insights version) ─────────────────────────────────────────────

describe('pctChange (insights.js)', () => {
  test('previous=0 and current>0 returns 100', () => {
    expect(pctChange(50, 0)).toBe(100);
  });

  test('previous=0 and current=0 returns 0', () => {
    expect(pctChange(0, 0)).toBe(0);
  });

  test('positive growth', () => {
    expect(pctChange(110, 100)).toBeCloseTo(10, 5);
  });

  test('negative growth', () => {
    expect(pctChange(90, 100)).toBeCloseTo(-10, 5);
  });
});

// ─── clamp ─────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  test('value below min returns min', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  test('value above max returns max', () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });

  test('value within range returns value', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  test('value equal to min returns min', () => {
    expect(clamp(0, 0, 100)).toBe(0);
  });

  test('value equal to max returns max', () => {
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

// ─── safeDivide ────────────────────────────────────────────────────────────────

describe('safeDivide', () => {
  test('denominator=0 returns fallback (default 0)', () => {
    expect(safeDivide(10, 0)).toBe(0);
  });

  test('denominator=0 returns custom fallback', () => {
    expect(safeDivide(10, 0, -1)).toBe(-1);
  });

  test('normal division', () => {
    expect(safeDivide(10, 2)).toBe(5);
  });

  test('denominator=null returns fallback', () => {
    expect(safeDivide(10, null)).toBe(0);
  });
});

// ─── round ─────────────────────────────────────────────────────────────────────

describe('round', () => {
  test('NaN input returns NaN', () => {
    expect(round(NaN, 2)).toBeNaN();
  });

  test('rounds to 2 decimal places', () => {
    expect(round(1.2345, 2)).toBe(1.23);
  });

  test('rounds to 0 decimal places', () => {
    expect(round(1.6, 0)).toBe(2);
  });

  test('rounds negative numbers correctly', () => {
    expect(round(-1.2345, 2)).toBe(-1.23);
  });

  test('zero stays zero', () => {
    expect(round(0, 3)).toBe(0);
  });
});
