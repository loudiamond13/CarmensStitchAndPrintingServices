// One category's detail for the Edit Category modal (D-12, SEC-07). Read fresh on every open and never kept: the row version it
// carries must be the latest one, so there is no stale time, no cache lifetime and no refetch on window focus (the open form keeps
// its own version, and a stale save is refused with a 409, 05 D-20).
import { useQuery } from '@tanstack/react-query';
import { expenseCategoriesService } from '@/modules/admin/services/expenseCategoriesService';

/** Its own root, so a category-list invalidation does not read the open category again. */
export const expenseCategoryKey = (id: string) => ['expense-category', id] as const;

/** Reads the category while `enabled` (the modal is open) and `id` is known. */
export function useExpenseCategoryQuery(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: expenseCategoryKey(id ?? ''),
    queryFn: ({ signal }) => expenseCategoriesService.get(id ?? '', signal),
    enabled: enabled && id !== null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
