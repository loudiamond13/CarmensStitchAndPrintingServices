// SPEC-GAP: L5 Accessibility Statement at /accessibility (UI-SPEC L5; LEGAL-04, LEGAL-05). The page head from the shared facts; the
// article text comes in a later plan. The document title is the one the server sends.
import { LegalPage } from '../components/LegalPage';
import { usePageTitle } from '../hooks/usePageTitle';
import { LEGAL_PAGES } from '../legalPages';

export function AccessibilityPage() {
  const page = LEGAL_PAGES.accessibility;
  usePageTitle(page.title);
  return <LegalPage page={page} />;
}
