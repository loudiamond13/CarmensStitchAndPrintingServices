// SPEC-GAP: AuditDetail (UI-SPEC A1 "Detail"; AUDIT-02, D-27, D-40; plan 05-33). The expandable row's description list in the
// RecordMeta look: What changed (left out when the entry has nothing to say), IP address (the empty-value icon when there is
// none), Device ("Unknown browser" when there is none) and Reference (wraps anywhere). Every value is a text node, never HTML
// (CWE-79), and What changed comes only from fixed words: describeAuditDetail for the older events, and the typed lines and
// snapshot of expense and category events (D-27), which never carry description or notes text (05 D-40).
import type { ReactNode } from 'react';
import { EmptyValue } from '@/components/states';
import {
  AUDIT_COPY,
  describeAuditChange,
  describeAuditDetail,
  describeAuditOrderSnapshot,
  describeAuditSnapshot,
  isStatedValueAction,
} from '@/modules/admin/auditCopy';
import {
  auditChangeListClasses,
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

/** The typed lines of an expense, order or list entry, as fixed sentences: the snapshots first, then each change line once (an unreadable value reads "<Field> changed", an unknown field "Other detail changed"). */
function changeSentences(item: AuditLogItem): string[] {
  const stated = isStatedValueAction(item.action);
  return [
    ...(item.snapshot === null ? [] : [describeAuditSnapshot(item.snapshot)]),
    ...(item.orderSnapshot === null ? [] : [describeAuditOrderSnapshot(item.orderSnapshot)]),
    // Several unknown fields read the same, so each sentence shows once.
    ...new Set(item.changes.map((line) => describeAuditChange(line, stated))),
  ];
}

export function AuditDetail({ item, id }: AuditDetailProps) {
  const changed = describeAuditDetail(item.action, item.detail);
  const sentences = changeSentences(item);
  const hasIp = item.ipPrefix !== null && item.ipPrefix !== '';
  const hasDevice = item.device !== null && item.device !== '' && item.device !== STORED_UNKNOWN_DEVICE;
  return (
    <dl id={id} className={auditDetailClasses}>
      {item.orderNumber !== null && <DetailRow term={AUDIT_COPY.detail.order}>{item.orderNumber}</DetailRow>}
      {sentences.length > 0 ? (
        <DetailRow term={AUDIT_COPY.detail.whatChanged}>
          <ul className={auditChangeListClasses}>
            {sentences.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>
        </DetailRow>
      ) : (
        changed !== null && <DetailRow term={AUDIT_COPY.detail.whatChanged}>{changed}</DetailRow>
      )}
      <DetailRow term={AUDIT_COPY.detail.ipAddress}>{hasIp ? item.ipPrefix : <EmptyValue />}</DetailRow>
      <DetailRow term={AUDIT_COPY.detail.device}>
        {hasDevice ? item.device : AUDIT_COPY.detail.unknownBrowser}
      </DetailRow>
      <DetailRow term={AUDIT_COPY.detail.reference}>{item.reference}</DetailRow>
    </dl>
  );
}
