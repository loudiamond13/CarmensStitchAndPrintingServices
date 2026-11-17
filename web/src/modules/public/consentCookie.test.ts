// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONSENT_COOKIE_NAME,
  formatConsentCookie,
  isCurrentChoice,
  needsChoice,
  parseConsentCookie,
  readConsentCookie,
} from './consentCookie';

// The cookie codec (ANL-07). The cases are the file the .NET tests read too (tests/fixtures/consent-cookie-cases.json).

interface ValidCase {
  value: string;
  consentId: string;
  policyVersion: string;
  stats: boolean | null;
  map: boolean;
  decidedOn: string;
  pending: boolean;
}

interface NeedsChoiceCase {
  value: string | null;
  currentVersion: string;
  today: string;
  gpc: boolean;
  expected: boolean;
}

interface CookieCases {
  cookieName: string;
  valid: ValidCase[];
  invalid: string[];
  needsChoice: NeedsChoiceCase[];
}

const cases = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/consent-cookie-cases.json', import.meta.url), 'utf8'),
) as CookieCases;

describe('consent cookie name', () => {
  it('is the name pinned in the shared file', () => {
    expect(CONSENT_COOKIE_NAME).toBe(cases.cookieName);
    expect(CONSENT_COOKIE_NAME).toBe('__Host-csps_consent');
  });
});

describe('parseConsentCookie and formatConsentCookie', () => {
  it.each(cases.valid.map((c) => [c.value, c] as const))('reads the shared valid case %s', (value, expected) => {
    expect(parseConsentCookie(value)).toEqual({
      consentId: expected.consentId,
      policyVersion: expected.policyVersion,
      stats: expected.stats,
      map: expected.map,
      decidedOn: expected.decidedOn,
      pending: expected.pending,
    });
  });

  it.each(cases.valid.map((c) => c.value))('formats the shared valid case %s back to the same text', (value) => {
    const cookie = parseConsentCookie(value);

    expect(cookie === null ? null : formatConsentCookie(cookie)).toBe(value);
  });
});

describe('parseConsentCookie on invalid values', () => {
  it.each(cases.invalid.map((value) => [JSON.stringify(value), value] as const))(
    'refuses the shared invalid case %s without throwing',
    (_label, value) => {
      expect(parseConsentCookie(value)).toBeNull();
    },
  );

  it('refuses a missing value', () => {
    expect(parseConsentCookie(undefined)).toBeNull();
  });

  it('keeps the boundary cases in the shared file', () => {
    expect(cases.invalid.length).toBeGreaterThanOrEqual(14);
    expect(cases.valid.some((c) => c.value.length === 100)).toBe(true);
    expect(cases.invalid.some((c) => c.length === 101)).toBe(true);
    expect(cases.valid.some((c) => c.stats === null)).toBe(true);
    expect(cases.valid.some((c) => c.pending)).toBe(true);
  });
});

describe('readConsentCookie', () => {
  const value = '1_0f5c2a9e4b7d4c1e8a3f6b2d9e0c7a51_0.1_1_1_20261115';

  it('finds the cookie among others', () => {
    expect(readConsentCookie(`a=1; ${CONSENT_COOKIE_NAME}=${value}; b=2`)).toBe(value);
  });

  it('finds the cookie when it is the only one or the first', () => {
    expect(readConsentCookie(`${CONSENT_COOKIE_NAME}=${value}`)).toBe(value);
    expect(readConsentCookie(`${CONSENT_COOKIE_NAME}=${value}; b=2`)).toBe(value);
  });

  it('returns undefined when the cookie is missing', () => {
    expect(readConsentCookie('')).toBeUndefined();
    expect(readConsentCookie('a=1; b=2')).toBeUndefined();
  });

  it('does not match a cookie whose name only ends or starts with the name', () => {
    expect(readConsentCookie(`x${CONSENT_COOKIE_NAME}=${value}`)).toBeUndefined();
    expect(readConsentCookie(`${CONSENT_COOKIE_NAME}_x=${value}`)).toBeUndefined();
  });
});

describe('needsChoice', () => {
  it.each(cases.needsChoice.map((c) => [`${String(c.value)} on ${c.today} (gpc ${String(c.gpc)})`, c] as const))(
    'follows the shared case %s',
    (_label, c) => {
      const cookie = parseConsentCookie(c.value ?? undefined);

      expect(needsChoice(cookie, { currentVersion: c.currentVersion, today: c.today, gpc: c.gpc })).toBe(c.expected);
    },
  );

  it('is true for no cookie', () => {
    expect(needsChoice(null, { currentVersion: '1.0', today: '2026-11-15', gpc: false })).toBe(true);
  });

  it('is never true under GPC', () => {
    expect(needsChoice(null, { currentVersion: '1.0', today: '2026-11-15', gpc: true })).toBe(false);
  });

  it('keeps the re-ask cases in the shared file', () => {
    expect(cases.needsChoice.some((c) => c.gpc)).toBe(true);
    expect(cases.needsChoice.some((c) => c.value === null)).toBe(true);
    expect(cases.needsChoice.some((c) => c.today === '2026-11-14' && !c.expected)).toBe(true);
  });

  it('keeps a future-dated case in the shared file, so a later edit cannot drop D-43 coverage', () => {
    const decidedDay = (value: string | null): string => /_(\d{8})(_p)?$/.exec(value ?? '')?.[1] ?? '';
    const isFuture = (c: { value: string | null; today: string }): boolean =>
      decidedDay(c.value) > c.today.replaceAll('-', '');

    expect(cases.needsChoice.some((c) => !c.gpc && isFuture(c) && c.expected)).toBe(true);
    expect(cases.needsChoice.some((c) => c.gpc && isFuture(c) && !c.expected)).toBe(true);
  });
});

describe('isCurrentChoice (D-22, D-43, ANL-07)', () => {
  const options = { currentVersion: '1.0', today: '2026-11-15' };
  const cookie = (decidedOn: string, policyVersion = '1.0') => ({
    consentId: '0f5c2a9e4b7d4c1e8a3f6b2d9e0c7a51',
    policyVersion,
    stats: true,
    map: true,
    decidedOn,
    pending: false,
  });

  it('is true for the current version decided today or a day before', () => {
    expect(isCurrentChoice(cookie('2026-11-15'), options)).toBe(true);
    expect(isCurrentChoice(cookie('2026-11-14'), options)).toBe(true);
  });

  it('is true up to the day before 12 months have passed', () => {
    expect(isCurrentChoice(cookie('2025-11-16'), options)).toBe(true);
  });

  it('is false for a decision day after today', () => {
    expect(isCurrentChoice(cookie('2026-11-16'), options)).toBe(false);
    expect(isCurrentChoice(cookie('9999-12-31'), options)).toBe(false);
  });

  it('is false for a choice 12 months old', () => {
    expect(isCurrentChoice(cookie('2025-11-15'), options)).toBe(false);
  });

  it('is false for an old policy version', () => {
    expect(isCurrentChoice(cookie('2026-11-14', '0.1'), options)).toBe(false);
  });

  it('is false when today is unreadable', () => {
    expect(isCurrentChoice(cookie('2026-11-14'), { ...options, today: 'yesterday' })).toBe(false);
  });

  it('holds at the last day of the calendar (the saturated year)', () => {
    expect(isCurrentChoice(cookie('9999-12-30'), { currentVersion: '1.0', today: '9999-12-30' })).toBe(true);
  });

  it('ends a choice made on 29 February on 28 February a year later', () => {
    const decided = cookie('2024-02-29');
    expect(isCurrentChoice(decided, { currentVersion: '1.0', today: '2025-02-27' })).toBe(true);
    expect(isCurrentChoice(decided, { currentVersion: '1.0', today: '2025-02-28' })).toBe(false);
  });

  it('counts February as 28 days in a century year that is not a leap year, and as a leap year in a 400 year', () => {
    const century = cookie('2099-02-28');
    expect(isCurrentChoice(century, { currentVersion: '1.0', today: '2100-02-27' })).toBe(true);
    expect(isCurrentChoice(century, { currentVersion: '1.0', today: '2100-02-28' })).toBe(false);
    const fourHundred = cookie('1999-02-28');
    expect(isCurrentChoice(fourHundred, { currentVersion: '1.0', today: '2000-02-27' })).toBe(true);
    expect(isCurrentChoice(fourHundred, { currentVersion: '1.0', today: '2000-02-28' })).toBe(false);
  });

  it('judges a pending choice by the same rule', () => {
    expect(isCurrentChoice({ ...cookie('2026-11-16'), pending: true }, options)).toBe(false);
    expect(isCurrentChoice({ ...cookie('2026-11-14'), pending: true }, options)).toBe(true);
  });
});
