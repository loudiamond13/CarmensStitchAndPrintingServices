// The order page tab in the URL `tab` parameter (ORD-07, WEB-10). Items is the default and stays out of the URL; a change
// replaces the history entry; an invalid value reads as Items and is removed with one replace. The URL holds the tab name only.
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser } from '@/lib/url-state/parsers';

export const ORDER_TABS = ['items', 'payments', 'discounts', 'expenses', 'refunds'] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

const useOrderParams = createListParams({ tab: literalParser(ORDER_TABS, 'items') });

export function useOrderTab() {
  const [{ tab }, { setFilter }] = useOrderParams();
  return {
    tab,
    setTab: (next: OrderTab): void => {
      setFilter('tab', next);
    },
  };
}
