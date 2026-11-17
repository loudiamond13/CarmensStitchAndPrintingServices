// Reading the consent cookie from `document.cookie` (ANL-07). It sits alone, apart from the codec in consentCookie.ts, so
// the public first download takes this reader and nothing of the codec (PERF-01); consentCookie.ts re-exports both.

export const CONSENT_COOKIE_NAME = '__Host-csps_consent';

/** The consent cookie value from a `document.cookie` string, or undefined when there is none. */
export function readConsentCookie(documentCookie: string): string | undefined {
  for (const pair of documentCookie.split(';')) {
    const text = pair.trimStart();
    const equals = text.indexOf('=');
    if (equals > 0 && text.slice(0, equals) === CONSENT_COOKIE_NAME) return text.slice(equals + 1);
  }
  return undefined;
}
