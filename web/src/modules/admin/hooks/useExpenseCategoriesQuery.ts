// The expense category list the filter (and later the Add form) reads. Read when the page opens; it changes rarely.
import { useQuery } from '@tanstack/react-query';
import { expenseCategoriesService } from '@/modules/admin/services/expenseCategoriesService';

/** The root of the category query: invalidating it reads the list again (after a category is added, renamed or retired). */
export const expenseCategoriesKey = ['expense-categories'] as const;

export function useExpenseCategoriesQuery() {
  return useQuery({
    queryKey: expenseCategoriesKey,
    queryFn: ({ signal }) => expenseCategoriesService.list(signal),
  });
}
