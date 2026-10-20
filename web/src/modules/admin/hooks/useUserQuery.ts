// One person's detail for the Edit User panel (U3). Read fresh on every open and never kept: the edit version it carries must
// be the latest one, so there is no stale time, no cache lifetime and no refetch on window focus (the open form keeps its own
// version, and a stale save is refused with a 409, D-20).
import { useQuery } from '@tanstack/react-query';
import { usersKey } from '@/modules/admin/hooks/useUsersQuery';
import { usersService } from '@/modules/admin/services/usersService';

/** Under the roster's root, so a roster invalidation marks the detail stale too. */
export const userKey = (id: string) => [...usersKey, 'detail', id] as const;

/** Reads the person while `enabled` (the panel is open) and `id` is known. */
export function useUserQuery(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: userKey(id ?? ''),
    queryFn: ({ signal }) => usersService.get(id ?? '', signal),
    enabled: enabled && id !== null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
