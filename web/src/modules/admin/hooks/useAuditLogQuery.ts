// The Audit Log list (A1) and the people its filters offer. The list is keyed on the parsed, defaulted list params with the range
// already resolved to business days (WEB-08), cancellable, and keeps the previous page's rows on screen while the next one loads.
import { useQuery } from '@tanstack/react-query';
import { useListQuery } from '@/lib/query/useListQuery';
import { auditLogService, type AuditLogQuery } from '@/modules/admin/services/auditLogService';

/** The root of every audit query. */
export const auditLogKey = ['audit-log'] as const;

export function useAuditLogQuery(params: AuditLogQuery) {
  return useListQuery({
    key: 'audit-log',
    params,
    fetcher: (query, signal) => auditLogService.list(query, signal),
  });
}

/** Everyone the Done by and Done to filters offer. Read when the page opens; the list changes rarely. */
export function useAuditPeopleQuery() {
  return useQuery({
    queryKey: [...auditLogKey, 'people'] as const,
    queryFn: ({ signal }) => auditLogService.people(signal),
  });
}
