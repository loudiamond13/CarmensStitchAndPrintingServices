// SPEC-GAP: AdminPreviewPage (UI-SPEC "Phase 2 pages" → AdminPreviewPage; D-20, WEB-05). Dev builds only: each admin
// path shows the `.s-ph` page head with the section's nav label as its h1 and the "Development only" subline, then an
// EmptyState with the section's nav icon and a primary md link to the Component Showcase. The document title is
// "{Section} · CSPS Admin". The empty-state title is an h2, the level after the page h1 (A11Y-02).
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { ButtonLink } from '@/components/actions';
import { EmptyState } from '@/components/feedback';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ADMIN_NAV, type AdminSection } from '@/components/navigation';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { adminNavItemForPath } from '@/modules/admin/sections';

export interface AdminPreviewPageProps {
  section: AdminSection;
}

export function AdminPreviewPage({ section }: AdminPreviewPageProps) {
  const item = ADMIN_NAV.find((candidate) => candidate.id === section) ?? ADMIN_NAV[0];
  const label = item?.label ?? '';
  useEffect(() => {
    document.title = `${label}${ADMIN_COPY.titleSuffix}`;
  }, [label]);
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 className={pageTitleClasses}>{label}</h1>
          <p className={pageSublineClasses}>{ADMIN_COPY.preview.subline}</p>
        </div>
      </div>
      <EmptyState
        icon={item?.icon}
        title={ADMIN_COPY.preview.emptyTitle}
        message={ADMIN_COPY.preview.emptyMessage}
        action={
          <ButtonLink variant="primary" size="md" to="/dev/components">
            {ADMIN_COPY.preview.showcase}
          </ButtonLink>
        }
      />
    </>
  );
}

/** The route component of every admin preview path: the section comes from the path. */
export function AdminPreviewRoute() {
  const { pathname } = useLocation();
  return <AdminPreviewPage section={adminNavItemForPath(pathname)?.id ?? 'dashboard'} />;
}
