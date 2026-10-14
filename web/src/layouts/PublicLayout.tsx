// The public layout (UI-SPEC Layout Contract "Public layout", spec §2.2, §6.6, §7, App. E.1 header and footer; WEB-05,
// A11Y-01, A11Y-02). The Blush page root (always light, D-14) holds, in keyboard order, the skip link, the SiteHeader,
// the one `main` (an unstyled SPEC-GAP wrapper) around the route's page, and the footer. The toast layer sits inside the
// page root after them (plan 02-21).
//   - The current header link comes from the path: `/`, `/products`, `/gallery` and `/contact` mark theirs, and any
//     other path marks none (A11Y-04 empty edge), so nothing turns bold.
//   - `main` keeps at least the viewport height minus the header, so the footer stays put while a route chunk loads;
//     it is `aria-busy` until the chunk lands (UI consideration: loading, route chunks).
//   - PERF-01: the components come from their own modules, not the `@/components/*` barrels. A barrel re-exports admin-only
//     parts (Sidebar, Topbar, MoneyInput, ...), and once a build uses them, importing the barrel here put them in the
//     chunks the public route loads (docs/web/budgets.md, "Public route imports").
import { Outlet, useLocation, useNavigation } from 'react-router';
import { SkipLink } from '@/components/entry/SkipLink';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { pageRootClasses } from '@/components/layout/layout.recipe';
import { SITE_LINKS, SiteHeader } from '@/components/navigation/SiteHeader';
import { SiteFooter } from '@/modules/public/components/SiteFooter';

/** The label of the header link for `pathname`, or '' (no link current) for any other path. */
function currentSiteLink(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return SITE_LINKS.find((link) => link.to === path)?.label ?? '';
}

export function PublicLayout() {
  const { pathname } = useLocation();
  const loading = useNavigation().state === 'loading';
  return (
    <div data-theme="light" className={pageRootClasses}>
      <ToastProvider>
        <SkipLink />
        <SiteHeader active={currentSiteLink(pathname)} />
        <main
          id="main"
          tabIndex={-1}
          aria-busy={loading ? true : undefined}
          className="min-h-[calc(100dvh-var(--header-height))]"
        >
          <Outlet />
        </main>
        <SiteFooter />
      </ToastProvider>
    </div>
  );
}
