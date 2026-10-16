// The screen for an admin section whose page is built in a later phase (Orders, Expenses, Users, My Profile): the page
// head with the h1, then an empty state, inside the admin shell. The document title is "Page not found · CSPS Admin".
import { useEffect } from 'react';
import { EmptyState } from '@/components/feedback';
import { pageHeadClasses, pageHeadTitleClasses, pageTitleClasses } from '@/components/layout/layout.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';

export function AdminNotFoundPage() {
  useEffect(() => {
    document.title = `${ADMIN_COPY.notFound.title}${ADMIN_COPY.titleSuffix}`;
  }, []);
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 className={pageTitleClasses}>{ADMIN_COPY.notFound.title}</h1>
        </div>
      </div>
      <EmptyState icon="info" title={ADMIN_COPY.notFound.emptyTitle} message={ADMIN_COPY.notFound.emptyMessage} />
    </>
  );
}
