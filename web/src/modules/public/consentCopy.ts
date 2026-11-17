// The words of the cookie bar (UI-SPEC Copywriting "Consent bar, window and map"; ANL-01, D-16). They sit apart from
// copy.ts because only the lazy bar and the announcement use them, and copy.ts reaches every public page's first download
// (PERF-01). SPEC-GAP: CB1 has no spec copy; these are the UI-SPEC strings.

export const CONSENT_COPY = {
  barLabel: 'Cookie choices',
  barText: 'We use cookies for visitor stats and the Google map, only if you say yes. See our',
  policyLink: 'Cookie Policy',
  barTextEnd: '.',
  settings: 'Cookie Settings',
  reject: 'Reject All',
  accept: 'Accept All',
} as const;
