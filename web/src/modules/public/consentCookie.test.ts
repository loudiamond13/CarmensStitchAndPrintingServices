// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONSENT_COOKIE_NAME, formatConsentCookie, parseConsentCookie, readConsentCookie } from './consentCookie';

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

interface CookieCases {
  cookieName: string;
  valid: ValidCase[];
  invalid: string[];
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
