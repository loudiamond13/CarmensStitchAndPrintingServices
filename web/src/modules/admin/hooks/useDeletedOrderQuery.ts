// One deleted order's read for the permanent-delete dialog (D-24, 07 D-28): its child rows give the counts the Manager sees before
// typing the order number. Read fresh on every open and never kept, so the counts are the stored ones. Its own root, so a list
// invalidation does not read the open order again.
import { useQuery } from '@tanstack/react-query';
import { deletedOrdersService } from '@/modules/admin/services/deletedOrdersService';

export const deletedOrderKey = (id: string) => ['order-deleted', id] as const;

/** Reads the deleted order while `enabled` (the dialog is open). */
export function useDeletedOrderQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: deletedOrderKey(id),
    queryFn: ({ signal }) => deletedOrdersService.get(id, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
