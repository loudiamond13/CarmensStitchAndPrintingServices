// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONSENT_COOKIE_NAME, formatConsentCookie, parseConsentCookie } from './consentCookie';

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

    expect(cookie).not.toBeNull();
    expect(formatConsentCookie(cookie as NonNullable<typeof cookie>)).toBe(value);
  });
});
