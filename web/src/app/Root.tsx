// The root route's component (research Pattern 2): the one TanStack Query client for everything below it, with the
// shared defaults (createQueryClient, plan 02-39). No NuqsAdapter here: URL state lives in the lazy UrlStateLayout
// route (plan 02-11), so pages without URL state never load nuqs.
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Outlet } from 'react-router';
import { createQueryClient } from '@/lib/query/queryClient';

export function Root() {
  // One client per mounted app: created once on the first render and kept for the life of the root.
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
