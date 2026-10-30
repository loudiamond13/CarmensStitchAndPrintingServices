// The Settings tab in the URL `tab` parameter (D-31, WEB-10). Skeleton: the real parsing lands in the green step.
export const SETTINGS_TABS = ['product-types', 'payment-methods', 'order-expense-categories', 'expense-categories'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export function useSettingsTab() {
  return {
    tab: 'product-types' as SettingsTab,
    setTab: (next: SettingsTab): void => {
      void next;
    },
  };
}
