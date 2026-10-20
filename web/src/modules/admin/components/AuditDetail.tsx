// SPEC-GAP: AuditDetail (UI-SPEC A1 "Detail"; AUDIT-02, D-27, D-40; plan 05-33). The expandable row's description list in the
// RecordMeta look: What changed (left out when the entry has nothing to say), IP address (the empty-value icon when there is
// none), Device ("Unknown browser" when there is none) and Reference (wraps anywhere). Every value is a text node, never HTML
// (CWE-79), and What changed comes only from describeAuditDetail's fixed words, so no name or email can appear.
import type { ReactNode } from 'react';
import { EmptyValue } from '@/components/states';
import { AUDIT_COPY, describeAuditDetail } from '@/modules/admin/auditCopy';
import {
  auditDetailClasses,
  auditDetailRowClasses,
  auditDetailTermClasses,
  auditDetailValueClasses,
} from '@/modules/admin/components/audit.recipe';
import type { AuditLogItem } from '@/modules/admin/services/auditLogService';

/** The word the API stores for a browser it could not name. */
const STORED_UNKNOWN_DEVICE = 'Unknown';

interface RowProps {
  term: string;
  children: ReactNode;
}

function DetailRow({ term, children }: RowProps) {
  return (
    <div className={auditDetailRowClasses}>
      <dt className={auditDetailTermClasses}>{term}</dt>
      <dd className={auditDetailValueClasses}>{children}</dd>
    </div>
  );
}

export interface AuditDetailProps {
  item: AuditLogItem;
  /** The id the row's toggle names in aria-controls. */
  id?: string | undefined;
}

export function AuditDetail({ item, id }: AuditDetailProps) {
  const changed = describeAuditDetail(item.action, item.detail);
  const hasIp = item.ipPrefix !== null && item.ipPrefix !== '';
  const hasDevice = item.device !== null && item.device !== '' && item.device !== STORED_UNKNOWN_DEVICE;
  return (
    <dl id={id} className={auditDetailClasses}>
      {changed !== null && <DetailRow term={AUDIT_COPY.detail.whatChanged}>{changed}</DetailRow>}
      <DetailRow term={AUDIT_COPY.detail.ipAddress}>{hasIp ? item.ipPrefix : <EmptyValue />}</DetailRow>
      <DetailRow term={AUDIT_COPY.detail.device}>
        {hasDevice ? item.device : AUDIT_COPY.detail.unknownBrowser}
      </DetailRow>
      <DetailRow term={AUDIT_COPY.detail.reference}>{item.reference}</DetailRow>
    </dl>
  );
}
