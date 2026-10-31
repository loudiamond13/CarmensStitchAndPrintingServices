// The order expense category list the order expense form reads. Read when a form opens; it changes rarely.
import { useQuery } from '@tanstack/react-query';
import { orderExpenseCategoriesService } from '@/modules/admin/services/orderExpenseCategoriesService';

/** The root of the order expense category query: invalidating it reads the list again (after a category is added, renamed or retired). */
export const orderExpenseCategoriesKey = ['order-expense-categories'] as const;

export function useOrderExpenseCategoriesQuery() {
  return useQuery({
    queryKey: orderExpenseCategoriesKey,
    queryFn: ({ signal }) => orderExpenseCategoriesService.list(signal),
  });
}
