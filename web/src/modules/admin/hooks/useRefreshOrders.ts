// Every order write reads the order lists, the deleted list and, because a name or color shows on orders and their counts decide
// whether Settings offers Delete, the three order list-entry lists again (RESEARCH Pattern 4; plan 08-10). The answer resolves once
// all have been asked, so a caller can move focus after the new rows are in the cache.
import { useQueryClient } from '@tanstack/react-query';
import { orderExpenseCategoriesKey } from '@/modules/admin/hooks/useOrderExpenseCategoriesQuery';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { paymentMethodsKey } from '@/modules/admin/hooks/usePaymentMethodsQuery';
import { productTypesKey } from '@/modules/admin/hooks/useProductTypesQuery';

/** The root of the deleted-orders queries (plan 08-20 keys its list under it). */
export const ordersDeletedKey = ['orders-deleted'] as const;

const REFRESHED_KEYS: readonly (readonly string[])[] = [
  ordersKey,
  ordersDeletedKey,
  productTypesKey,
  paymentMethodsKey,
  orderExpenseCategoriesKey,
];

export function useRefreshOrders(): () => Promise<unknown> {
  const queryClient = useQueryClient();
  return () => Promise.all(REFRESHED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
