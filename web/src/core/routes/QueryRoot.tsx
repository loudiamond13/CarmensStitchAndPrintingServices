// The query route (research Pattern 2): one TanStack Query client for every admin and dev route below it, with the shared
// defaults (createQueryClient, plan 02-39). It is a lazy pathless route (router.tsx), so the library loads with the admin
// chunks and the public entry never carries it (PERF-02). No NuqsAdapter here: URL state lives in the lazy
// UrlStateLayout route (plan 02-11), so pages without URL state never load nuqs.
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { trackQueryClient } from '@/lib/query/cacheOwner';
import { createQueryClient } from '@/lib/query/queryClient';

export function QueryRoot() {
  // One client per mounted route: created on the first render and kept while any admin or sign-in screen is open.
  const [queryClient] = useState(createQueryClient);
  // The cache is cleared when the signed-in person ends or changes, on every route (cacheOwner).
  useEffect(() => trackQueryClient(queryClient), [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
