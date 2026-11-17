// SPEC-GAP: LegalPage, the L1 template (UI-SPEC L1; LEGAL-05, D-14): the head, with the DRAFT notice while the page is not approved,
// the crumbs, eyebrow, h1, the version line and the lead; then the article area with the sections of the page's text module.
// Deep imports only (PERF-01).
import { versionLine } from '../legalCopy';
import type { LegalSectionData } from '../legalContent';
import type { LegalPageMeta } from '../legalPages';
import { articleAreaClasses, articleClasses, versionLineClasses } from './legal.recipe';
import { LegalNotice } from './LegalNotice';
import { LegalSection } from './LegalSection';
import { PageHead } from './PageHead';

export interface LegalPageProps {
  page: LegalPageMeta;
  /** The sections of the page's text module; a page without them shows only its head. */
  sections?: readonly LegalSectionData[];
}

export function LegalPage({ page, sections }: LegalPageProps) {
  return (
    <>
      <PageHead
        notice={page.approved ? undefined : <LegalNotice />}
        crumb={page.crumb}
        eyebrow={page.eyebrow}
        headline={page.headline}
        meta={<p className={versionLineClasses}>{versionLine(page.version, page.lastUpdated)}</p>}
        lead={page.lead}
      />
      {sections !== undefined && sections.length > 0 && (
        <div className={articleAreaClasses}>
          <article className={articleClasses}>
            {sections.map((section) => (
              <LegalSection key={section.id} section={section} />
            ))}
          </article>
        </div>
      )}
    </>
  );
}
