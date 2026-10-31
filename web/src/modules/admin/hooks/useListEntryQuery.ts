// One list entry's detail for the Edit modal of any Settings list (D-12, SEC-07; plan 08-08). Read fresh on every open and never kept:
// the row version it carries must be the latest one, so there is no stale time, no cache lifetime and no refetch on window focus (the
// open form keeps its own version, and a stale save is refused with a 409, 05 D-20).
import { useQuery } from '@tanstack/react-query';
import type { ListKey } from '@/modules/admin/components/ListEntrySelect';
import { LIST_SETTINGS } from '@/modules/admin/listSettingsConfigs';

/** Its own root per list, so a list invalidation does not read the open entry again. */
export const listEntryKey = (list: ListKey, id: string) => ['list-entry', list, id] as const;

/** Reads the entry while `enabled` (the modal is open) and `id` is known. */
export function useListEntryQuery(list: ListKey, id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: listEntryKey(list, id ?? ''),
    queryFn: ({ signal }) => LIST_SETTINGS[list].service.get(id ?? '', signal),
    enabled: enabled && id !== null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
