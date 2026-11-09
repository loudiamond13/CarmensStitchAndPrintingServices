// @vitest-environment node
// Pins how the signed-in sweeps seed money (wave 11 WR-02): a sweep must not grow this month's shop totals on every run, because
// "Collected this month" feeds the 320 px dashboard figures (P10-BL-06). Money the sweeps only need on a person's hand is dated before
// the current business month; what the dashboard sweep records this month stays tiny.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DASHBOARD_SWEEP_FIGURES, manilaDate, PAST_MONTH_DAYS } from '../e2e/helpers.ts';

/** Days that sit at the start, middle and end of 28, 29, 30 and 31 day months, and across a year end. */
const TODAYS = [
  '2026-11-01T00:30:00+08:00',
  '2026-11-30T23:30:00+08:00',
  '2026-03-01T08:00:00+08:00',
  '2028-02-29T08:00:00+08:00',
  '2026-12-31T08:00:00+08:00',
  '2027-01-01T08:00:00+08:00',
  '2026-05-31T23:59:00+08:00',
];

describe('sweep money seeding', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(TODAYS)('dates the past-month payments outside the business month of %s', (now) => {
    vi.useFakeTimers({ now: new Date(now) });
    expect(manilaDate(PAST_MONTH_DAYS).slice(0, 7)).not.toBe(manilaDate(0).slice(0, 7));
    expect(manilaDate(PAST_MONTH_DAYS) < manilaDate(0)).toBe(true);
  });

  it('records only small figures this month in the dashboard sweep', () => {
    expect(DASHBOARD_SWEEP_FIGURES.payment).toBeGreaterThan(0);
    expect(DASHBOARD_SWEEP_FIGURES.payment).toBeLessThanOrEqual(20);
    expect(DASHBOARD_SWEEP_FIGURES.expense).toBeGreaterThan(0);
    expect(DASHBOARD_SWEEP_FIGURES.expense).toBeLessThan(DASHBOARD_SWEEP_FIGURES.payment);
  });

  it('has the money sweep date its payments with the past-month offset and the dashboard sweep use the small figures', () => {
    const money = readFileSync(new URL('../e2e/money-sweep.spec.ts', import.meta.url), 'utf8');
    const dashboard = readFileSync(new URL('../e2e/dashboard-sweep.spec.ts', import.meta.url), 'utf8');
    expect(money).toContain('paymentDate: manilaDate(PAST_MONTH_DAYS)');
    expect(money).toContain('orderDate: manilaDate(PAST_MONTH_DAYS)');
    expect(money).not.toMatch(/manilaDate\(-?\d{1,2}\)/);
    expect(dashboard).toContain('amount: DASHBOARD_SWEEP_FIGURES.payment');
    expect(dashboard).toContain('amount: DASHBOARD_SWEEP_FIGURES.expense');
  });
});
