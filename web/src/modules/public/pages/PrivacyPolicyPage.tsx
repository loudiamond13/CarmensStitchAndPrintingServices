// SPEC-GAP: L2 Privacy Policy at /privacy (UI-SPEC L2; LEGAL-01, LEGAL-05). The page head from the shared facts and the sections of
// its text module. The document title is the one the server sends.
import { LegalPage } from '../components/LegalPage';
import { usePageTitle } from '../hooks/usePageTitle';
import { PRIVACY_TEXT } from '../legalPrivacy';

export function PrivacyPolicyPage() {
  const { meta, sections } = PRIVACY_TEXT;
  usePageTitle(meta.title);
  return <LegalPage page={meta} sections={sections} />;
}
