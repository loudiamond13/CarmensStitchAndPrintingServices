// SPEC-GAP: L5 Accessibility Statement at /accessibility (UI-SPEC L5; LEGAL-04, LEGAL-05). The page head from the shared facts and
// the sections of its text module. The document title is the one the server sends.
import { LegalPage } from '../components/LegalPage';
import { usePageTitle } from '../hooks/usePageTitle';
import { ACCESSIBILITY_TEXT } from '../legalAccessibility';

export function AccessibilityPage() {
  const { meta, sections } = ACCESSIBILITY_TEXT;
  usePageTitle(meta.title);
  return <LegalPage page={meta} sections={sections} />;
}
