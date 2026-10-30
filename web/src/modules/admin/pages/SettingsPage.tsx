// SPEC-GAP: S1 Settings, /admin/settings (D-31, D-32). The Manager-only page with one tab per list: Product Types, Payment Methods,
// Order Expense Categories and Company Expense Categories. The tab is in the URL `tab` parameter (useSettingsTab); each tab is one
// ListSettingsSection, the Phase 6 category card driven by that list's config. Only the chosen tab's card is mounted, so the other
// lists are read when their tab opens.
import { useEffect } from 'react';
import { getTabPanelProps, Tabs, type TabItem } from '@/components/choice';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { Badge } from '@/components/status';
import { ListSettingsSection } from '@/modules/admin/components/ListSettingsSection';
import { expensesTitleRowClasses } from '@/modules/admin/components/expenses.recipe';
import { profilePageClasses } from '@/modules/admin/components/profile.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { SETTINGS_TABS, useSettingsTab, type SettingsTab } from '@/modules/admin/hooks/useSettingsTab';
import { LIST_SETTINGS } from '@/modules/admin/listSettingsConfigs';
import { SETTINGS_COPY } from '@/modules/admin/settingsCopy';

const COPY = SETTINGS_COPY;
const ID_BASE = 'settings';

const TAB_ITEMS: readonly TabItem<SettingsTab>[] = SETTINGS_TABS.map((id) => ({ id, label: COPY.tabs[id] }));

export function SettingsRoute() {
  const { tab, setTab } = useSettingsTab();

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
      </div>
      <Tabs idBase={ID_BASE} items={TAB_ITEMS} value={tab} onChange={setTab} />
      {SETTINGS_TABS.map((id) => (
        <div key={id} {...getTabPanelProps(ID_BASE, id)} hidden={tab !== id}>
          {tab === id && <ListSettingsSection config={LIST_SETTINGS[id]} />}
        </div>
      ))}
    </div>
  );
}
