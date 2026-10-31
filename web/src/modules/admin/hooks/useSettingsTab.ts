// The Settings tab in the URL `tab` parameter (D-31, WEB-10). Product Types is the default and stays out of the URL; a change
// replaces the history entry; an invalid value reads as Product Types and is removed with one replace. The URL holds the tab name only.
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser } from '@/lib/url-state/parsers';

// prettier-ignore
export const SETTINGS_TABS = ['product-types', 'payment-methods', 'order-expense-categories', 'expense-categories'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const useSettingsParams = createListParams({ tab: literalParser(SETTINGS_TABS, 'product-types') });

export function useSettingsTab() {
  const [{ tab }, { setFilter }] = useSettingsParams();
  return {
    tab,
    setTab: (next: SettingsTab): void => {
      setFilter('tab', next);
    },
  };
}
