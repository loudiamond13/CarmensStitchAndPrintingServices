// SPEC-GAP: LegalPage, the L1 template head (UI-SPEC L1 item 1; LEGAL-05, D-14): the DRAFT notice while the page is not approved,
// the crumbs, eyebrow, h1, the version line and the lead. The article area below it takes the text of later plans. Deep imports only (PERF-01).
import type { ReactNode } from 'react';
import { versionLine } from '../legalCopy';
import type { LegalPageMeta } from '../legalPages';
import { articleAreaClasses, versionLineClasses } from './legal.recipe';
import { LegalNotice } from './LegalNotice';
import { PageHead } from './PageHead';

export interface LegalPageProps {
  page: LegalPageMeta;
  /** The article: the table of contents and the sections. */
  children?: ReactNode;
}

export function LegalPage({ page, children }: LegalPageProps) {
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
      {children !== undefined && <div className={articleAreaClasses}>{children}</div>}
    </>
  );
}
