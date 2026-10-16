// Empties every tracked query cache when the signed-in person ends or changes, so one person's lists are never shown to
// the next person on a shared workstation (WR-14, CWE-200). It lives outside React, so it works whichever routes are mounted.
import type { QueryClient } from '@tanstack/react-query';

const clients = new Set<QueryClient>();
let owner: string | null = null;

/** Starts clearing `client` on owner changes; the returned function stops it. */
export function trackQueryClient(client: QueryClient): () => void {
  clients.add(client);
  return () => {
    clients.delete(client);
  };
}

/** Records who owns the cache now (`null` when nobody is signed in) and clears it on sign-out or a different person. */
export function setCacheOwner(id: string | null): void {
  if (id === null || (owner !== null && id !== owner)) {
    for (const client of clients) {
      client.clear();
    }
  }
  owner = id;
}
