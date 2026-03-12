'use strict';

const { parseDateRange, pctChange } = require('./helpers');

// ─── parseDateRange ────────────────────────────────────────────────────────────

describe('parseDateRange', () => {
  test('no params: to is yesterday, from is 27 days before yesterday', () => {
    const result = parseDateRange({});
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const expectedTo = yesterday.toISOString().split('T')[0];

    const expectedFromDate = new Date(yesterday);
    expectedFromDate.setDate(yesterday.getDate() - 27);
    const expectedFrom = expectedFromDate.toISOString().split('T')[0];

    expect(result.to).toBe(expectedTo);
    expect(result.from).toBe(expectedFrom);
  });

  test('no params: prevFrom and prevTo cover the equal-length window before from', () => {
    const result = parseDateRange({});
    const fromDate = new Date(result.from);
    const toDate = new Date(result.to);
    const prevToDate = new Date(result.prevTo);
    const prevFromDate = new Date(result.prevFrom);

    // prevTo should be one day before from
    const dayBefore = new Date(fromDate);
    dayBefore.setDate(fromDate.getDate() - 1);
    expect(result.prevTo).toBe(dayBefore.toISOString().split('T')[0]);

    // Prev range length should equal current range length
    const currentRange = (toDate - fromDate) / (1000 * 60 * 60 * 24) + 1;
    const prevRange = (prevToDate - prevFromDate) / (1000 * 60 * 60 * 24) + 1;
    expect(prevRange).toBe(currentRange);
  });

  test('explicit from+to: prev period is same-length window immediately before from', () => {
    const result = parseDateRange({ from: '2026-02-01', to: '2026-02-28' });
    expect(result.from).toBe('2026-02-01');
    expect(result.to).toBe('2026-02-28');
    // Range is 28 days, prev period should end on 2026-01-31 (day before from)
    expect(result.prevTo).toBe('2026-01-31');
    // prevFrom is 28 days before prevTo (28 days = indices 0..27, so 27 days back)
    expect(result.prevFrom).toBe('2026-01-03');
  });

  test('single-day range: prev period is the day immediately before', () => {
    const result = parseDateRange({ from: '2026-03-10', to: '2026-03-10' });
    expect(result.from).toBe('2026-03-10');
    expect(result.to).toBe('2026-03-10');
    expect(result.prevTo).toBe('2026-03-09');
    expect(result.prevFrom).toBe('2026-03-09');
  });
});

// ─── pctChange (helpers version) ──────────────────────────────────────────────

describe('pctChange (helpers.js)', () => {
  test('prev=0 and cur>0 returns 100', () => {
    expect(pctChange(50, 0)).toBe(100);
  });

  test('prev=0 and cur=0 returns 0', () => {
    expect(pctChange(0, 0)).toBe(0);
  });

  test('positive change rounds to 2 decimal places', () => {
    expect(pctChange(110, 100)).toBe(10);
  });

  test('negative change', () => {
    expect(pctChange(90, 100)).toBe(-10);
  });

  test('fractional change', () => {
    expect(pctChange(101, 100)).toBe(1);
  });
});
