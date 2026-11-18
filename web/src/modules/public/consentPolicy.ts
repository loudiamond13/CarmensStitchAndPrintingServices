// The Cookie Policy version that a consent choice is made under (D-22). It sits alone so the public first download takes
// this one string, not the whole legal page table (PERF-01); legalPages.ts reads it for the Cookie Policy's own version,
// and tests keep it equal to tests/fixtures/legal-pages.json and the server's LegalPages.
export const COOKIE_POLICY_VERSION = '1.0';
