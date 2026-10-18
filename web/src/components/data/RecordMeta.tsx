// SPEC-GAP: RecordMeta (UI-SPEC "RecordMeta"; SEC-08, D-08, D-11; plan 05-25). A description list of two read-only rows,
// "Recorded by" and "Last changed by": each is the ActorName, then " · ", then the business date and time in a time
// element (Asia/Manila, en-PH). A record that was never changed has no time for its last change, so that row shows
// EmptyValue. The two columns are max-content and the rest; at page width 767 and below each term sits over its value.
// Shared by every later detail or edit view.
import { EmptyValue } from '@/components/states';
import { formatBusinessDateTime } from '@/utils/format';
import { ActorName, type ActorLike } from './ActorName';
import { RECORD_META_COPY } from './copy';
import { recordMetaClasses, recordMetaRowClasses, recordMetaTermClasses, recordMetaValueClasses } from './data.recipe';

export interface RecordMetaProps {
  recordedBy: ActorLike | null;
  /** When the record was made, as a UTC instant from the API. */
  recordedAt: string | null;
  lastChangedBy: ActorLike | null;
  /** When the record was last changed, as a UTC instant; null if it never was. */
  lastChangedAt: string | null;
}

interface RowProps {
  term: string;
  actor: ActorLike | null;
  at: string | null;
}

function RecordMetaRow({ term, actor, at }: RowProps) {
  const text = at === null ? null : formatBusinessDateTime(at);
  return (
    <div className={recordMetaRowClasses}>
      <dt className={recordMetaTermClasses}>{term}</dt>
      <dd className={recordMetaValueClasses}>
        {at === null ? (
          <EmptyValue />
        ) : (
          <>
            <ActorName actor={actor} />
            {RECORD_META_COPY.separator}
            {text === null ? <EmptyValue /> : <time dateTime={at}>{text}</time>}
          </>
        )}
      </dd>
    </div>
  );
}

export function RecordMeta({ recordedBy, recordedAt, lastChangedBy, lastChangedAt }: RecordMetaProps) {
  return (
    <dl className={recordMetaClasses}>
      <RecordMetaRow term={RECORD_META_COPY.recordedBy} actor={recordedBy} at={recordedAt} />
      <RecordMetaRow term={RECORD_META_COPY.lastChangedBy} actor={lastChangedBy} at={lastChangedAt} />
    </dl>
  );
}
