// Every category change reads the category list again and, because a name or color shows on every expense, the expense lists, the
// month figures and the deleted list too (UI-SPEC Freshness, D-12; plan 06-17). The shared expense refresh already covers all of
// them. The answer resolves once all have been asked, so a caller can move focus after the new rows are in the cache.
import { useRefreshExpenses } from '@/modules/admin/hooks/useRefreshExpenses';

export function useRefreshCategories(): () => Promise<unknown> {
  return useRefreshExpenses();
}
