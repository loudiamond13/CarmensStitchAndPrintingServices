// SPEC-GAP: L3 Cookie Policy at /cookies (UI-SPEC L3; LEGAL-02, LEGAL-05). The page head from the shared facts; the article text
// comes in a later plan. Its version is the consent policy version (D-22). The document title is the one the server sends.
import { LegalPage } from '../components/LegalPage';
import { usePageTitle } from '../hooks/usePageTitle';
import { LEGAL_PAGES } from '../legalPages';

export function CookiePolicyPage() {
  const page = LEGAL_PAGES.cookies;
  usePageTitle(page.title);
  return <LegalPage page={page} />;
}
