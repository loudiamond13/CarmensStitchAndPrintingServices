// SPEC-GAP: site content
// S0 Site Content, /admin/site-content (D-27, WEB-10; plan 11-12). The Manager-only page of the public website's words, hours, products
// and gallery: the header, the tab strip and one panel per tab.
//   - The tab is the URL `tab` parameter (useSiteContentTab). Only the chosen tab's panel is mounted, so each tab loads its own data
//     with its own loading and error states, and one failing tab never blanks the others.
//   - `panels` names the tabs that exist and how each one is drawn. The route gives it the built tabs; a later plan adds its tab there.
import { useEffect, type ReactNode } from 'react';
import { ButtonLink } from '@/components/actions';
import { getTabPanelProps, Tabs, type TabItem } from '@/components/choice';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { Badge } from '@/components/status';
import { BusinessInfoTab } from '@/modules/admin/components/BusinessInfoTab';
import { expensesHeadActionsClasses, expensesTitleRowClasses } from '@/modules/admin/components/expenses.recipe';
import { profilePageClasses } from '@/modules/admin/components/profile.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { SITE_CONTENT_TABS, useSiteContentTab, type SiteContentTab } from '@/modules/admin/hooks/useSiteContentTab';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';

const COPY = SITE_CONTENT_COPY;
const ID_BASE = 'content';

/** How one tab's panel is drawn: it receives the callback that reports unsaved changes. */
export type SiteContentPanels = Partial<Record<SiteContentTab, (onDirtyChange: (dirty: boolean) => void) => ReactNode>>;

const noop = (): void => undefined;

/** The tabs that are built so far. */
const BUILT_PANELS: SiteContentPanels = {
  business: (onDirtyChange) => <BusinessInfoTab onDirtyChange={onDirtyChange} />,
};

export function SiteContentPage({ panels }: { panels: SiteContentPanels }) {
  const { tab: urlTab, setTab } = useSiteContentTab();

  const built = SITE_CONTENT_TABS.filter((id) => panels[id] !== undefined);
  const items: readonly TabItem<SiteContentTab>[] = built.map((id) => ({ id, label: COPY.tabs[id] }));
  // A tab that is not built yet reads as the first one that is.
  const tab = built.includes(urlTab) ? urlTab : (built[0] ?? 'business');

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

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
      <Tabs idBase={ID_BASE} items={items} value={tab} onChange={setTab} />
      {built.map((id) => (
        <div key={id} {...getTabPanelProps(ID_BASE, id)} hidden={tab !== id}>
          {tab === id && panels[id]?.(noop)}
        </div>
      ))}
    </div>
  );
}

export function SiteContentRoute() {
  return <SiteContentPage panels={BUILT_PANELS} />;
}
