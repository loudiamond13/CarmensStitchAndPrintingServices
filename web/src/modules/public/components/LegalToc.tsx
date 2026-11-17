// SPEC-GAP: LegalToc (UI-SPEC L1 item 2; LEGAL-05): the "On this page" navigation, one link to each h2. From 1024px it is the sticky
// column beside the article; at 1023px and below it is a closed details box above the article. Both are in the markup and the
// stylesheet shows one, so there is no script and no layout jump. No scroll spy. Deep imports only (PERF-01).
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import type { LegalSectionData } from '../legalContent';
import { LEGAL_COPY } from '../legalCopy';
import {
  tocBoxClasses,
  tocBoxLinksClasses,
  tocChevronClasses,
  tocLinkClasses,
  tocListClasses,
  tocSummaryClasses,
  tocWideClasses,
} from './legal.recipe';

const { label: TOC_LABEL } = LEGAL_COPY.toc;

function TocLinks({ sections }: { sections: readonly LegalSectionData[] }) {
  return (
    <ul className={tocListClasses}>
      {sections.map((section) => (
        <li key={section.id}>
          <UiLink to={`#${section.id}`} className={tocLinkClasses}>
            {section.heading}
          </UiLink>
        </li>
      ))}
    </ul>
  );
}

export interface LegalTocProps {
  sections: readonly LegalSectionData[];
}

export function LegalToc({ sections }: LegalTocProps) {
  return (
    <>
      <nav aria-label={TOC_LABEL} className={tocWideClasses}>
        <TocLinks sections={sections} />
      </nav>
      <details className={tocBoxClasses}>
        <summary className={tocSummaryClasses}>
          {TOC_LABEL}
          <Icon name="chevron-down" size={18} className={tocChevronClasses} />
        </summary>
        <nav aria-label={TOC_LABEL} className={tocBoxLinksClasses}>
          <TocLinks sections={sections} />
        </nav>
      </details>
    </>
  );
}
