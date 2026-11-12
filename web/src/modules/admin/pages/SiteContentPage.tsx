// SPEC-GAP: site content
// S0 Site Content, /admin/site-content (D-27, WEB-10; plan 11-12). The Manager-only page of the public website's words, hours, products
// and gallery: the header, the tab strip and one panel per tab.
//   - The tab is the URL `tab` parameter (useSiteContentTab). Only the chosen tab's panel is mounted, so each tab loads its own data
//     with its own loading and error states, and one failing tab never blanks the others.
//   - A tab that holds unsaved changes tells the page (`onDirtyChange`). A tab change, a move to another page inside the app and a reload
//     then ask first ("Discard changes?", 08 D-58; `beforeunload`).
//   - `panels` names the tabs that exist and how each one is drawn. The route gives it the built tabs; a later plan adds its tab there.
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { ButtonLink } from '@/components/actions';
import { getTabPanelProps, Tabs, type TabItem } from '@/components/choice';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { ConfirmDialog } from '@/components/overlays';
import { Badge } from '@/components/status';
import { BusinessInfoTab } from '@/modules/admin/components/BusinessInfoTab';
import { HoursTab } from '@/modules/admin/components/HoursTab';
import { ProductLinesTab } from '@/modules/admin/components/ProductLinesTab';
import { expensesHeadActionsClasses, expensesTitleRowClasses } from '@/modules/admin/components/expenses.recipe';
import { profilePageClasses } from '@/modules/admin/components/profile.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { SITE_CONTENT_TABS, useSiteContentTab, type SiteContentTab } from '@/modules/admin/hooks/useSiteContentTab';
import { useUnsavedChangesGuard } from '@/modules/admin/hooks/useUnsavedChangesGuard';
import { AdminNotFoundPage } from '@/modules/admin/pages/AdminNotFoundPage';
import { ProductLineRoute } from '@/modules/admin/pages/ProductLinePage';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';

const COPY = SITE_CONTENT_COPY;
const ID_BASE = 'content';

/** How one tab's panel is drawn: it receives the callback that reports unsaved changes. */
export type SiteContentPanels = Partial<Record<SiteContentTab, (onDirtyChange: (dirty: boolean) => void) => ReactNode>>;

/** The tabs that are built so far: 'business', 'hours' and 'products'. The Products tab edits nothing itself, so it reports no unsaved changes. */
const BUILT_PANELS: SiteContentPanels = {
  business: (onDirtyChange) => <BusinessInfoTab onDirtyChange={onDirtyChange} />,
  hours: (onDirtyChange) => <HoursTab onDirtyChange={onDirtyChange} />,
  products: () => <ProductLinesTab />,
};

export function SiteContentPage({ panels }: { panels: SiteContentPanels }) {
  const { tab: urlTab, setTab } = useSiteContentTab();
  const [dirty, setDirty] = useState(false);
  // The tab the person asked for while the current one holds unsaved changes.
  const [asked, setAsked] = useState<SiteContentTab | null>(null);
  const guard = useUnsavedChangesGuard({ isDirty: dirty });

  const built = SITE_CONTENT_TABS.filter((id) => panels[id] !== undefined);
  const items: readonly TabItem<SiteContentTab>[] = built.map((id) => ({ id, label: COPY.tabs[id] }));
  // A tab that is not built yet reads as the first one that is.
  const tab = built.includes(urlTab) ? urlTab : (built[0] ?? 'business');

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const choose = (next: SiteContentTab): void => {
    if (next === tab) {
      return;
    }
    if (dirty) {
      setAsked(next);
      return;
    }
    setTab(next);
  };

  const discard = (): void => {
    const next = asked;
    setAsked(null);
    setDirty(false);
    if (next !== null) {
      setTab(next);
    }
  };

  return (
    <div className={profilePageClasses}>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={expensesTitleRowClasses}>
            <h1 className={pageTitleClasses}>{COPY.title}</h1>
            <Badge tone="accent" icon="shield-check">
              {COPY.badge}
            </Badge>
          </div>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
        <div className={expensesHeadActionsClasses}>
          <ButtonLink to="/" target="_blank" rel="noopener noreferrer" variant="secondary" icon="arrow-up-right">
            {COPY.viewWebsite}
            <span className={srOnlyClasses}>{COPY.newTab}</span>
          </ButtonLink>
        </div>
      </div>
      <Tabs idBase={ID_BASE} items={items} value={tab} onChange={choose} />
      {built.map((id) => (
        <div key={id} {...getTabPanelProps(ID_BASE, id)} hidden={tab !== id}>
          {tab === id && panels[id]?.(setDirty)}
        </div>
      ))}
      <ConfirmDialog
        open={guard.dialog.open}
        title={COPY.discard.title}
        message={COPY.discard.message}
        cancelLabel={COPY.discard.keep}
        confirmLabel={COPY.discard.discard}
        onConfirm={guard.dialog.onDiscard}
        onCancel={guard.dialog.onKeepEditing}
      />
      <ConfirmDialog
        open={asked !== null}
        title={COPY.discard.title}
        message={COPY.discard.message}
        cancelLabel={COPY.discard.keep}
        confirmLabel={COPY.discard.discard}
        onConfirm={discard}
        onCancel={() => {
          setAsked(null);
        }}
      />
    </div>
  );
}

/** What follows `site-content/` for the product line editor: `products/new` or `products/{id}`. */
const PRODUCT_LINE_PATH = /^products\/([^/]+)\/?$/;

/**
 * The Site Content route (`site-content/*`): the tabs page at `site-content`, the product line editor at `site-content/products/new` and
 * `site-content/products/{id}`, and the in-shell Page not found screen for any other address under it. One splat route keeps the shared
 * entry from growing for the editor's two addresses (PERF-01: public Contact has almost no room left).
 */
export function SiteContentRoute() {
  const rest = useParams()['*'] ?? '';
  if (rest === '') {
    return <SiteContentPage panels={BUILT_PANELS} />;
  }
  const lineId = PRODUCT_LINE_PATH.exec(rest)?.[1];
  return lineId === undefined ? <AdminNotFoundPage /> : <ProductLineRoute lineId={lineId} />;
}
