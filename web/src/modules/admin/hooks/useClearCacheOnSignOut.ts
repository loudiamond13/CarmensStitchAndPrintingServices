// Empties the shared query cache when the signed-in person ends or changes, so one person's lists (signed-in devices,
// later orders) are never shown to the next person on a shared workstation (WR-14, CWE-200).
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSessionSnapshot, subscribeSession } from '@/modules/admin/services/session';

export function useClearCacheOnSignOut(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    let lastId = getSessionSnapshot().user?.id ?? null;
    return subscribeSession(() => {
      const id = getSessionSnapshot().user?.id ?? null;
      if (id === null || (lastId !== null && id !== lastId)) {
        queryClient.clear();
      }
      lastId = id;
    });
  }, [queryClient]);
}
