import { describe, expect, it } from 'vitest';
import { AUDIT_RANGES, DEFAULT_AUDIT_RANGE, keptFloor, resolveAuditRange } from './auditRange';

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
});
