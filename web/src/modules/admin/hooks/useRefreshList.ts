// A change to an order list entry reads the list again and, because a name or color shows on orders, the order queries too (plan 08-08;
// UI-SPEC Freshness). The company expense categories keep their Phase 6 refresh. The answer resolves once all have been asked, so a
// caller can move focus after the new rows are in the cache.
import { useQueryClient } from '@tanstack/react-query';
import type { ListKey } from '@/modules/admin/components/ListEntrySelect';
import { orderExpenseCategoriesKey } from '@/modules/admin/hooks/useOrderExpenseCategoriesQuery';
import { ordersKey } from '@/modules/admin/hooks/useOrdersQuery';
import { paymentMethodsKey } from '@/modules/admin/hooks/usePaymentMethodsQuery';
import { productTypesKey } from '@/modules/admin/hooks/useProductTypesQuery';
import { useRefreshCategories } from '@/modules/admin/hooks/useRefreshCategories';

const ORDER_LIST_KEYS: Record<Exclude<ListKey, 'expense-categories'>, readonly string[]> = {
  'product-types': productTypesKey,
  'payment-methods': paymentMethodsKey,
  'order-expense-categories': orderExpenseCategoriesKey,
};

export function useRefreshList(list: ListKey): () => Promise<unknown> {
  const queryClient = useQueryClient();
  const refreshCompany = useRefreshCategories();
  return () =>
    list === 'expense-categories'
      ? refreshCompany()
      : Promise.all([
          queryClient.invalidateQueries({ queryKey: ORDER_LIST_KEYS[list] }),
          queryClient.invalidateQueries({ queryKey: ordersKey }),
        ]);
}
