// SPEC-GAP: L4 Terms of Use at /terms (UI-SPEC L4; LEGAL-03, LEGAL-05). The page head from the shared facts and the sections of its
// text module. The document title is the one the server sends.
import { LegalPage } from '../components/LegalPage';
import { usePageTitle } from '../hooks/usePageTitle';
import { TERMS_TEXT } from '../legalTerms';

export function TermsPage() {
  const { meta, sections } = TERMS_TEXT;
  usePageTitle(meta.title);
  return <LegalPage page={meta} sections={sections} />;
}
