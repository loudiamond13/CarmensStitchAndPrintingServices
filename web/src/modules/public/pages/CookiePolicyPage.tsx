// SPEC-GAP: L3 Cookie Policy at /cookies (UI-SPEC L3; LEGAL-02, LEGAL-05). The page head from the shared facts and the sections of
// its text module. Its version is the consent policy version (D-22). The document title is the one the server sends.
import { LegalPage } from '../components/LegalPage';
import { usePageTitle } from '../hooks/usePageTitle';
import { COOKIES_TEXT } from '../legalCookies';

export function CookiePolicyPage() {
  const { meta, sections } = COOKIES_TEXT;
  usePageTitle(meta.title);
  return <LegalPage page={meta} sections={sections} />;
}
