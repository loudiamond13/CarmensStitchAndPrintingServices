// SPEC-GAP: the loader of the four legal pages (PERF-01). The router holds one dynamic import for all four legal routes, and this
// small chunk holds the four page imports. Four imports in the router grew the entry chunk by about 0.24 KB gz, which put Home and
// Contact over the 150 KB budget; one import grows it by about 0.10 KB. Each page is still its own lazy chunk.
import type { ComponentType } from 'react';
import type { LegalPageKey } from './legalPages';

export async function loadLegalPage(key: LegalPageKey): Promise<ComponentType> {
  switch (key) {
    case 'privacy':
      return (await import('./pages/PrivacyPolicyPage')).PrivacyPolicyPage;
    case 'cookies':
      return (await import('./pages/CookiePolicyPage')).CookiePolicyPage;
    case 'terms':
      return (await import('./pages/TermsPage')).TermsPage;
    case 'accessibility':
      return (await import('./pages/AccessibilityPage')).AccessibilityPage;
  }
}
