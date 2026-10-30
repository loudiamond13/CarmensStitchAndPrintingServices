// The Manager's Deleted Orders list (X1). Keyed on the parsed, defaulted list params (WEB-08), cancellable, and keeping the previous
// page's rows on screen while the next one loads. Its root is ordersDeletedKey, which every order write invalidates (useRefreshOrders).
import { useListQuery } from '@/lib/query/useListQuery';
import { ordersDeletedKey } from '@/modules/admin/hooks/useRefreshOrders';
import { deletedOrdersService, type DeletedOrdersListQuery } from '@/modules/admin/services/deletedOrdersService';

export function useDeletedOrdersQuery(params: DeletedOrdersListQuery) {
  return useListQuery({
    key: ordersDeletedKey[0],
    params,
    fetcher: (query, signal) => deletedOrdersService.list(query, signal),
  });
}
