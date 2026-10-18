// RED stub (plan 05-33): replaced in the GREEN commit.
import type { AuditLogItem } from '@/modules/admin/services/auditLogService';

export function AuditDetail({ item }: { item: AuditLogItem; id?: string }) {
  return item.id === 0 ? <dl /> : null;
}
