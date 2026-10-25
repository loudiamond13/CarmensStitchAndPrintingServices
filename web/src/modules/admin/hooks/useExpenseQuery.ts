// One expense's detail for the Edit and View modals (CEXP-02, CEXP-04). Read fresh on every open and never kept: the row version
// it carries must be the latest one, so there is no stale time, no cache lifetime and no refetch on window focus (the open form
// keeps its own version, and a stale save is refused with a 409, 05 D-20).
import { useQuery } from '@tanstack/react-query';
import { expensesService } from '@/modules/admin/services/expensesService';

/** Its own root, so a list invalidation does not read the open expense again. */
export const expenseKey = (id: string) => ['company-expense', id] as const;

/** Reads the expense while `enabled` (the modal is open) and `id` is known. */
export function useExpenseQuery(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: expenseKey(id ?? ''),
    queryFn: ({ signal }) => expensesService.get(id ?? '', signal),
    enabled: enabled && id !== null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
