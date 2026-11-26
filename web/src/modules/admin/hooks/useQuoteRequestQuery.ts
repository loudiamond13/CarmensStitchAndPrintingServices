// One quote request in full for the request page (INQ-05). Its key sits under `['quote-requests']`, so a status change that
// invalidates that prefix reads this page, the inbox lists and the New count again.
import { useQuery } from '@tanstack/react-query';
import { quoteRequestsService } from '@/modules/admin/services/quoteRequestsService';

export const quoteRequestKey = (id: string) => ['quote-requests', 'detail', id] as const;

/** A request id is a GUID; any other address is not found without asking the server. */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isQuoteRequestId(id: string): boolean {
  return GUID.test(id);
}

export function useQuoteRequestQuery(id: string) {
  return useQuery({
    queryKey: quoteRequestKey(id),
    queryFn: ({ signal }) => quoteRequestsService.get(id, signal),
    enabled: isQuoteRequestId(id),
  });
}
