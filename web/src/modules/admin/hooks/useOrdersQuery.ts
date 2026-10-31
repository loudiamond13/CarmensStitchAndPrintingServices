// The Orders list (L1). Keyed on the parsed, defaulted list params (WEB-08), cancellable, and keeping the previous page's
// rows on screen while the next one loads.
import { useListQuery } from '@/lib/query/useListQuery';
import { ordersService, type OrdersListQuery } from '@/modules/admin/services/ordersService';

/** The root of every order query: invalidating it reads each list page again after an order write. */
export const ordersKey = ['orders'] as const;

/** `enabled` false holds the request back, for a list that waits on a value (the business today for a date preset). */
export function useOrdersQuery(params: OrdersListQuery, options: { enabled?: boolean } = {}) {
  return useListQuery({
    key: ordersKey[0],
    params,
    fetcher: (query, signal) => ordersService.list(query, signal),
    enabled: options.enabled ?? true,
  });
}
