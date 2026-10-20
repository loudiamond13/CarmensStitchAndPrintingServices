// The staff roster page (U1). Keyed on the parsed, defaulted list params (WEB-08), cancellable, and keeping the previous
// page's rows on screen while the next one loads.
import { useListQuery } from '@/lib/query/useListQuery';
import { usersService, type UsersListQuery } from '@/modules/admin/services/usersService';

/** The root of every roster query: invalidating it reads each page again (after Add User, Edit and the row actions). */
export const usersKey = ['users'] as const;

export function useUsersQuery(params: UsersListQuery) {
  return useListQuery({
    key: 'users',
    params,
    fetcher: (query, signal) => usersService.list(query, signal),
  });
}
