// The Audit Log list (A1). Keyed on the parsed, defaulted list params with the range already resolved to business days (WEB-08),
// cancellable, and keeping the previous page's rows on screen while the next one loads.
import { useListQuery } from '@/lib/query/useListQuery';
import { auditLogService, type AuditLogQuery } from '@/modules/admin/services/auditLogService';

/** The root of every audit list query. */
export const auditLogKey = ['audit-log'] as const;

export function useAuditLogQuery(params: AuditLogQuery) {
  return useListQuery({
    key: 'audit-log',
    params,
    fetcher: (query, signal) => auditLogService.list(query, signal),
  });
}
