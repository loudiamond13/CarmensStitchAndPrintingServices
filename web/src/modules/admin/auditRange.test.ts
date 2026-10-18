import { describe, expect, it } from 'vitest';
import { AUDIT_RANGES, customRangeErrors, DEFAULT_AUDIT_RANGE, keptFloor, resolveAuditRange } from './auditRange';

// The audit log's date range (D-26, WEB-10): presets by name, "Everything kept" from the start of the 8-month window.

describe('keptFloor', () => {
  it('is the same day 8 months before the business today', () => {
    expect(keptFloor('2026-10-18')).toBe('2026-02-18');
    expect(keptFloor('2026-08-05')).toBe('2025-12-05');
  });

  it('keeps the last day of a shorter month, as the server does', () => {
    expect(keptFloor('2026-10-31')).toBe('2026-02-28');
    expect(keptFloor('2026-12-31')).toBe('2026-04-30');
    expect(keptFloor('2024-10-31')).toBe('2024-02-29');
  });
});

describe('the ranges', () => {
  it('offers the UI-SPEC presets, Everything kept and Custom, with the last 7 days as the default', () => {
    expect(AUDIT_RANGES).toEqual(['last-7-days', 'last-30-days', 'this-month', 'last-month', 'all', 'custom']);
    expect(DEFAULT_AUDIT_RANGE).toBe('last-7-days');
  });
});

describe('resolveAuditRange against the business today', () => {
  const today = '2026-10-18';

  it('resolves each preset from the business today', () => {
    expect(resolveAuditRange({ range: 'last-7-days', from: null, to: null }, today)).toEqual({
      from: '2026-10-12',
      to: '2026-10-18',
    });
    expect(resolveAuditRange({ range: 'last-30-days', from: null, to: null }, today)).toEqual({
      from: '2026-09-19',
      to: '2026-10-18',
    });
    expect(resolveAuditRange({ range: 'this-month', from: null, to: null }, today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-18',
    });
    expect(resolveAuditRange({ range: 'last-month', from: null, to: null }, today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('resolves Everything kept to the start of the kept window through today', () => {
    expect(resolveAuditRange({ range: 'all', from: null, to: null }, today)).toEqual({
      from: '2026-02-18',
      to: '2026-10-18',
    });
  });

  it('ignores a stray from and to on a preset', () => {
    expect(resolveAuditRange({ range: 'last-7-days', from: '2026-01-01', to: '2026-01-02' }, today)).toEqual({
      from: '2026-10-12',
      to: '2026-10-18',
    });
  });

  it('moves with the calendar: the same name gives a different day tomorrow', () => {
    expect(resolveAuditRange({ range: 'last-7-days', from: null, to: null }, '2026-10-19')).toEqual({
      from: '2026-10-13',
      to: '2026-10-19',
    });
  });

  it('applies a custom range with two valid dates inside the window', () => {
    expect(resolveAuditRange({ range: 'custom', from: '2026-09-01', to: '2026-09-15' }, today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-15',
    });
    expect(resolveAuditRange({ range: 'custom', from: '2026-02-18', to: '2026-10-18' }, today)).toEqual({
      from: '2026-02-18',
      to: '2026-10-18',
    });
  });

  it('does not apply a custom range that is half filled, reversed or outside the window: the last 7 days stay', () => {
    const lastWeek = { from: '2026-10-12', to: '2026-10-18' };
    expect(resolveAuditRange({ range: 'custom', from: null, to: null }, today)).toEqual(lastWeek);
    expect(resolveAuditRange({ range: 'custom', from: '2026-09-01', to: null }, today)).toEqual(lastWeek);
    expect(resolveAuditRange({ range: 'custom', from: '2026-09-15', to: '2026-09-01' }, today)).toEqual(lastWeek);
    expect(resolveAuditRange({ range: 'custom', from: '2026-02-17', to: '2026-09-01' }, today)).toEqual(lastWeek);
    expect(resolveAuditRange({ range: 'custom', from: '2026-09-01', to: '2026-10-19' }, today)).toEqual(lastWeek);
  });
});

describe('customRangeErrors (OR-3: the server rules, checked before any request)', () => {
  const today = '2026-10-18';
  const none = { from: null, to: null };

  it('is clean for two real dates in order, inside the kept window, including both ends', () => {
    expect(customRangeErrors({ from: '2026-09-01', to: '2026-09-15' }, today)).toEqual(none);
    expect(customRangeErrors({ from: '2026-02-18', to: '2026-10-18' }, today)).toEqual(none);
    expect(customRangeErrors({ from: '2026-10-18', to: '2026-10-18' }, today)).toEqual(none);
  });

  it('asks for a missing start and a missing end', () => {
    expect(customRangeErrors({ from: '', to: '' }, today)).toEqual({
      from: 'Enter a start date.',
      to: 'Enter an end date.',
    });
    expect(customRangeErrors({ from: '', to: '2026-10-01' }, today)).toEqual({ from: 'Enter a start date.', to: null });
    expect(customRangeErrors({ from: '2026-10-01', to: '' }, today)).toEqual({ from: null, to: 'Enter an end date.' });
  });

  it('refuses a date that is not a real calendar day', () => {
    expect(customRangeErrors({ from: '2026-02-30', to: '2026-10-01' }, today)).toEqual({
      from: 'Enter a real date.',
      to: null,
    });
    expect(customRangeErrors({ from: '2026-09-01', to: 'tomorrow' }, today)).toEqual({
      from: null,
      to: 'Enter a real date.',
    });
  });

  it('names the first day of the kept window for a date before it or after today', () => {
    const message = 'Choose a date from Feb 18, 2026 to today.';
    expect(customRangeErrors({ from: '2026-02-17', to: '2026-10-01' }, today)).toEqual({ from: message, to: null });
    expect(customRangeErrors({ from: '2026-09-01', to: '2026-10-19' }, today)).toEqual({ from: null, to: message });
  });

  it('puts "The start date must be on or before the end date." under From when the dates are reversed', () => {
    expect(customRangeErrors({ from: '2026-10-05', to: '2026-10-01' }, today)).toEqual({
      from: 'The start date must be on or before the end date.',
      to: null,
    });
  });
});
