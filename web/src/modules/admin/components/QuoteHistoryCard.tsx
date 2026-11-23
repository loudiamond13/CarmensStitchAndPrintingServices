// SPEC-GAP: quote request history card (UI-SPEC R2 item 5; D-15, SEC-08). The status moves newest first as the server sends them,
// "{Status} · {name} · {date}", ending with the arrival, which has no creator. Text only (CWE-79).
import { ActorName } from '@/components/data';
import {
  orderCardBodyClasses,
  orderCardHeadClasses,
  orderCardTitleClasses,
  orderHistoryCardClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { quoteHistoryListClasses } from '@/modules/admin/components/quoteRequests.recipe';
import { QUOTE_REQUEST_COPY } from '@/modules/admin/quoteRequestsCopy';
import { quoteStatusLabel } from '@/modules/admin/quoteStatus';
import type { QuoteRequestStatusChange } from '@/modules/admin/services/quoteRequestsService';
import { formatBusinessDateTime } from '@/utils/format';

const COPY = QUOTE_REQUEST_COPY.history;
const TITLE_ID = 'quote-request-history';

function When({ at }: { at: string }) {
  return <time dateTime={at}>{formatBusinessDateTime(at) ?? at}</time>;
}

export function QuoteHistoryCard({ history }: { history: readonly QuoteRequestStatusChange[] }) {
  return (
    <section className={orderHistoryCardClasses} aria-labelledby={TITLE_ID}>
      <div className={orderCardHeadClasses}>
        <h2 id={TITLE_ID} className={orderCardTitleClasses}>
          {COPY.title}
        </h2>
      </div>
      <div className={orderCardBodyClasses}>
        <ol className={quoteHistoryListClasses}>
          {history.map((change) => (
            <li key={`${change.changedAt}-${change.from ?? ''}-${change.to}`}>
              {change.from === null ? (
                <>
                  {COPY.received}
                  {COPY.separator}
                  <When at={change.changedAt} />
                </>
              ) : (
                <>
                  {quoteStatusLabel(change.to)}
                  {COPY.separator}
                  <ActorName actor={change.changedBy} />
                  {COPY.separator}
                  <When at={change.changedAt} />
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
