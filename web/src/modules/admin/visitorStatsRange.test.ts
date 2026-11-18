import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATS_RANGE,
  STATS_KEPT_YEARS,
  STATS_PRESETS,
  STATS_RANGES,
  statsCustomRangeErrors,
  statsCustomRangeSchema,
  statsFloor,
  statsQueryFor,
} from './visitorStatsRange';

// The Visitor Stats date range (D-24, D-04, OR-3): the five server presets plus Custom, a 3-year floor counted the way the
// server counts it (AnalyticsRetention.DailyFloor), and the server's own messages.

const TODAY = '2026-11-15';

describe('the presets', () => {
  it('offers the five server presets, then Custom, with the last 30 days as the default', () => {
    expect(STATS_PRESETS).toEqual(['last-7-days', 'last-30-days', 'this-month', 'last-month', 'this-year']);
    expect(STATS_RANGES).toEqual([...STATS_PRESETS, 'custom']);
    expect(DEFAULT_STATS_RANGE).toBe('last-30-days');
  });

  it('keeps 3 years of daily totals (D-04)', () => {
    expect(STATS_KEPT_YEARS).toBe(3);
  });
});

describe('statsFloor', () => {
  it('is the same day 3 years before the business today', () => {
    expect(statsFloor(TODAY)).toBe('2023-11-15');
  });

  it('turns Feb 29 into Feb 28, as the server does', () => {
    expect(statsFloor('2028-02-29')).toBe('2025-02-28');
  });
});

describe('statsCustomRangeErrors (OR-3, the server messages)', () => {
  it('is clean for two real dates in order inside the window, both ends included', () => {
    expect(statsCustomRangeErrors({ from: '2023-11-15', to: TODAY }, TODAY)).toEqual({ from: null, to: null });
    expect(statsCustomRangeErrors({ from: '2026-10-01', to: '2026-10-01' }, TODAY)).toEqual({ from: null, to: null });
  });

  it('asks for a start date', () => {
    expect(statsCustomRangeErrors({ from: '', to: TODAY }, TODAY).from).toBe('Enter a start date.');
  });

  it('asks for an end date', () => {
    expect(statsCustomRangeErrors({ from: '2026-10-01', to: '' }, TODAY).to).toBe('Enter an end date.');
  });

  it('refuses a date that is not a real calendar day', () => {
    expect(statsCustomRangeErrors({ from: '2026-02-30', to: TODAY }, TODAY).from).toBe('Enter a real date.');
    expect(statsCustomRangeErrors({ from: '2026-10-01', to: '2026-13-01' }, TODAY).to).toBe('Enter a real date.');
  });

  it('puts "The start date must be on or before the end date." under From when the dates are reversed', () => {
    expect(statsCustomRangeErrors({ from: '2026-11-02', to: '2026-11-01' }, TODAY)).toEqual({
      from: 'The start date must be on or before the end date.',
      to: null,
    });
  });

  it('names the 3-year floor for a date before it or after today', () => {
    expect(statsCustomRangeErrors({ from: '2023-11-14', to: TODAY }, TODAY).from).toBe(
      'Choose a date from Nov 15, 2023 to today.',
    );
    expect(statsCustomRangeErrors({ from: '2026-11-01', to: '2026-11-16' }, TODAY).to).toBe(
      'Choose a date from Nov 15, 2023 to today.',
    );
  });

  it('is a zod schema the page can parse with', () => {
    expect(statsCustomRangeSchema(TODAY).safeParse({ from: '2026-10-01', to: TODAY }).success).toBe(true);
    expect(statsCustomRangeSchema(TODAY).safeParse({ from: '', to: '' }).success).toBe(false);
  });
});

describe('statsQueryFor', () => {
  it('asks for a preset by name only, never with dates worked out in the browser', () => {
    expect(statsQueryFor({ range: 'this-year', from: '2026-01-01', to: TODAY }, TODAY)).toEqual({
      range: 'this-year',
      from: null,
      to: null,
    });
    expect(statsQueryFor({ range: 'last-30-days', from: null, to: null }, null)).toEqual({
      range: 'last-30-days',
      from: null,
      to: null,
    });
  });

  it('asks for a custom range once both dates pass the checks', () => {
    expect(statsQueryFor({ range: 'custom', from: '2026-01-05', to: '2026-02-04' }, TODAY)).toEqual({
      range: 'custom',
      from: '2026-01-05',
      to: '2026-02-04',
    });
  });

  it('has no request for a custom range that is half filled, reversed, outside the window or waiting for today', () => {
    expect(statsQueryFor({ range: 'custom', from: null, to: null }, TODAY)).toBeNull();
    expect(statsQueryFor({ range: 'custom', from: '2026-02-04', to: '2026-01-05' }, TODAY)).toBeNull();
    expect(statsQueryFor({ range: 'custom', from: '2020-01-01', to: '2026-01-05' }, TODAY)).toBeNull();
    expect(statsQueryFor({ range: 'custom', from: '2026-01-05', to: '2026-02-04' }, null)).toBeNull();
  });
});
