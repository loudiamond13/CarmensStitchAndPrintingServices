// One deleted order's reads (D-24, 07 D-28). The deleted order page reads it as its own data. The permanent-delete dialog reads it
// under a separate root for its counts, fresh on every open and never kept, so the counts are the stored ones and the dialog never
// refetches or fails the page behind it. Each has its own root, so a list invalidation does not read an open order again.
import { useQuery } from '@tanstack/react-query';
import { deletedOrdersService } from '@/modules/admin/services/deletedOrdersService';

export const deletedOrderKey = (id: string) => ['order-deleted', id] as const;
export const deletedOrderCountsKey = (id: string) => ['order-deleted-counts', id] as const;

function useDeletedOrderRead(queryKey: readonly unknown[], id: string, enabled: boolean) {
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => deletedOrdersService.get(id, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/** The deleted order page's read. */
export function useDeletedOrderQuery(id: string, enabled: boolean) {
  return useDeletedOrderRead(deletedOrderKey(id), id, enabled);
}

/** The permanent-delete dialog's read of the counts, while `enabled` (the dialog is open). */
export function useDeletedOrderCountsQuery(id: string, enabled: boolean) {
  return useDeletedOrderRead(deletedOrderCountsKey(id), id, enabled);
}
