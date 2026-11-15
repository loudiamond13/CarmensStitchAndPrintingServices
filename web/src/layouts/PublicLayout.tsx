// The public layout (UI-SPEC Layout Contract "Public layout", spec §2.2, §6.6, §7, App. E.1 header and footer; WEB-05,
// A11Y-01, A11Y-02). The Blush page root (always light, D-14) holds, in keyboard order, the skip link, the SiteHeader,
// the one `main` (an unstyled SPEC-GAP wrapper) around the route's page, and the footer. The toast layer sits inside the
// page root after them (plan 02-21).
//   - The current header link comes from the path: `/`, `/products`, `/gallery` and `/contact` mark theirs, and any
//     other path marks none (A11Y-04 empty edge), so nothing turns bold.
//   - `main` keeps at least the viewport height minus the header, so the footer stays put while a route chunk loads;
//     it is `aria-busy` until the chunk lands (UI consideration: loading, route chunks).
//   - While the layout is shown, the page (html) gets top scroll padding for the sticky header, one value at every width,
//     so a focused control stops 24px below it (WCAG 2.4.11); on /products and /gallery it also clears the sticky pill bar.
//   - Home and Products show the full footer; Gallery, Contact and the 404 page show the base row (UI-SPEC Footer).
//   - On /contact the phone-only ContactBar sits after the footer (sticky to the bottom of the page root), and the page gets
//     a bottom scroll padding at 767px and below, so a focused control stops clear of the bar (PUB-06, WCAG 2.4.11).
//   - PERF-01: the components come from their own modules, not the `@/components/*` barrels. A barrel re-exports admin-only
//     parts (Sidebar, Topbar, MoneyInput, ...), and once a build uses them, importing the barrel here put them in the
//     chunks the public route loads (docs/web/budgets.md, "Public route imports").
import clsx from 'clsx';
import { lazy, Suspense } from 'react';
import { Outlet, useLocation, useNavigation } from 'react-router';
import { SkipLink } from '@/components/entry/SkipLink';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { pageRootClasses } from '@/components/layout/layout.recipe';
import { SITE_LINKS, SiteHeader } from '@/components/navigation/SiteHeader';
import { SiteFooter } from '@/modules/public/components/SiteFooter';
import { useSiteQuery } from '@/modules/public/hooks/useSiteQuery';
import type { PublicOutletContext } from '@/modules/public/outletContext';
import { tw } from '@/ui/tw';

// The sticky bar loads as its own chunk, only on /contact, so the other pages never carry it (public bundle budget, PERF-01).
const ContactBarSlot = lazy(() => import('@/modules/public/components/ContactBarSlot'));

/** The bottom scroll padding for the bar at 767px and below: the bar's height (--spacing-contact-bar), the safe area and 24px, so focus never hides under it. */
const contactScrollPaddingClasses = tw(
  'vp-lt-md:[:root:has(&)]:scroll-pb-[calc(var(--spacing-contact-bar)+var(--space-6)+env(safe-area-inset-bottom))]',
);

// The page's top scroll padding: the sticky header, 1px and 24px, plus --bar-top: 0 here and the 69px pill bar (44px pill,
// 12px above and below, 1px rule) on Products and Gallery, so a focused control or an address target stops clear of both bars (WCAG
// 2.4.11). One padding rule and one extra property keep the shared layout chunk small (PERF-01).
const topScrollPaddingClasses = tw(
  '[:root:has(&)]:scroll-pt-[calc(var(--header-height)+1px+var(--space-6)+var(--bar-top,0px))]',
);
const productsBarClasses = tw('[:root:has(&)]:[--bar-top:69px]');

/** The label of the header link for `pathname`, or '' (no link current) for any other path. */
function currentSiteLink(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return SITE_LINKS.find((link) => link.to === path)?.label ?? '';
}

export function PublicLayout() {
  const { pathname } = useLocation();
  const link = currentSiteLink(pathname);
  const onContact = link === 'Contact';
  const onBarPage = link === 'Products' || link === 'Gallery';
  const site = useSiteQuery();
  const outletContext: PublicOutletContext = {
    messengerUrl: site.status === 'success' ? site.data.messengerUrl : null,
    turnaroundLine: site.status === 'success' ? site.data.turnaroundLine : null,
  };
  const fullFooter = link === 'Home' || link === 'Products';
  const loading = useNavigation().state === 'loading';
  return (
    <div data-theme="light" data-fill="viewport" className={pageRootClasses}>
      <ToastProvider>
        <SkipLink />
        <SiteHeader active={link} />
        <main
          id="main"
          tabIndex={-1}
          aria-busy={loading ? true : undefined}
          className={clsx(
            'min-h-[calc(100dvh-var(--header-height))]',
            topScrollPaddingClasses,
            onBarPage && productsBarClasses,
            onContact && contactScrollPaddingClasses,
          )}
        >
          <Outlet context={outletContext} />
        </main>
        <SiteFooter variant={fullFooter ? 'full' : 'base'} />
        {onContact && (
          <Suspense fallback={null}>
            <ContactBarSlot />
          </Suspense>
        )}
      </ToastProvider>
    </div>
  );
}
