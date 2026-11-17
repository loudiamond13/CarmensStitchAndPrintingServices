// SPEC-GAP: L4 Terms of Use at /terms (UI-SPEC L4; LEGAL-03, LEGAL-05). The page head from the shared facts; the article text
// comes in a later plan. The document title is the one the server sends.
import { LegalPage } from '../components/LegalPage';
import { usePageTitle } from '../hooks/usePageTitle';
import { LEGAL_PAGES } from '../legalPages';

export function TermsPage() {
  const page = LEGAL_PAGES.terms;
  usePageTitle(page.title);
  return <LegalPage page={page} />;
}
