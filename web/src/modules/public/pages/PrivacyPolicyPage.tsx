// SPEC-GAP: L2 Privacy Policy at /privacy (UI-SPEC L2; LEGAL-01, LEGAL-05). The page head from the shared facts; the article text
// comes in a later plan. The document title is the one the server sends.
import { LegalPage } from '../components/LegalPage';
import { usePageTitle } from '../hooks/usePageTitle';
import { LEGAL_PAGES } from '../legalPages';

export function PrivacyPolicyPage() {
  const page = LEGAL_PAGES.privacy;
  usePageTitle(page.title);
  return <LegalPage page={page} />;
}
