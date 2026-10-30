// The order page tab in the URL `tab` parameter (ORD-07, WEB-10).
export const ORDER_TABS = ['items', 'payments', 'discounts', 'expenses', 'refunds'] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export function useOrderTab() {
  return {
    tab: 'items' as OrderTab,
    setTab: (next: OrderTab): void => {
      void next;
    },
  };
}
