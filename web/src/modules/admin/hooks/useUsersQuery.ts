// The staff roster page (U1). Keyed on the parsed, defaulted list params (WEB-08), cancellable, and keeping the previous
// page's rows on screen while the next one loads.
import { useListQuery } from '@/lib/query/useListQuery';
import { usersService, type UsersListQuery } from '@/modules/admin/services/usersService';

export function useUsersQuery(params: UsersListQuery) {
  return useListQuery({
    key: 'users',
    params,
    fetcher: (query, signal) => usersService.list(query, signal),
  });
}
