// D1 Dashboard, /admin (DASH-01). Header only for now.
import { pageHeadClasses, pageHeadTitleClasses, pageTitleClasses } from '@/components/layout/layout.recipe';

export function DashboardRoute() {
  return (
    <div className={pageHeadClasses}>
      <div className={pageHeadTitleClasses}>
        <h1 className={pageTitleClasses}>Dashboard</h1>
      </div>
    </div>
  );
}
