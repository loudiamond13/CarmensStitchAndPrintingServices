// SPEC-GAP: quote requests inbox table (UI-SPEC R1 item 4). The R1 ResponsiveTable columns: Received, Name, Phone, Product,
// Pieces, Photos and Status; cards below 768px with the name as the card title. The whole row is not a link: the name link
// is the one way in. Every value is React text (T-13-43).
import { UiLink } from '@/components/actions';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { Badge } from '@/components/status';
import { QUOTE_REQUESTS_COPY } from '@/modules/admin/quoteRequestsCopy';
import { isQuoteStatus, QUOTE_STATUS_TONE, quoteStatusLabel } from '@/modules/admin/quoteStatus';
import type { QuoteRequestListItem } from '@/modules/admin/services/quoteRequestsService';
import { formatBusinessDate, formatBusinessTime } from '@/utils/format';
import {
  quoteNameLinkClasses,
  quoteReceivedClasses,
  quoteReceivedTimeClasses,
  quoteTeamClasses,
  quoteWhoClasses,
} from './quoteRequests.recipe';

const COPY = QUOTE_REQUESTS_COPY;

/** A status as its badge: the tone, the dot and the word. A key the types do not know shows as sent, in neutral. */
export function QuoteStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={isQuoteStatus(status) ? QUOTE_STATUS_TONE[status] : 'neutral'} dot>
      {quoteStatusLabel(status)}
    </Badge>
  );
}

function productText(item: QuoteRequestListItem): string | null {
  const product = item.product;
  if (product === null) return null;
  if (product.choice === 'custom') return COPY.product.custom;
  if (product.choice === 'not-sure') return COPY.product.notSure;
  return product.title;
}

function ReceivedCell({ utc }: { utc: string }) {
  const date = formatBusinessDate(utc);
  const time = formatBusinessTime(utc);
  if (date === null || time === null) return null;
  return (
    <time dateTime={utc} className={quoteReceivedClasses}>
      <span>{date}</span>
      <span className={quoteReceivedTimeClasses}>{time}</span>
    </time>
  );
}

function NameCell({ item }: { item: QuoteRequestListItem }) {
  return (
    <div className={quoteWhoClasses}>
      <UiLink to={`/admin/quote-requests/${encodeURIComponent(item.id)}`} className={quoteNameLinkClasses}>
        {item.customerName}
      </UiLink>
      {item.teamName !== null && item.teamName !== '' && <span className={quoteTeamClasses}>{item.teamName}</span>}
    </div>
  );
}

function photosText(item: QuoteRequestListItem): string | null {
  const declared = Number(item.photoCount);
  return declared > 0 ? String(declared) : null;
}

const COLUMNS: readonly ResponsiveTableColumn<QuoteRequestListItem>[] = [
  { key: 'received', header: COPY.columns.received, cell: (item) => <ReceivedCell utc={item.receivedAtUtc} /> },
  { key: 'name', header: COPY.columns.name, lead: true, cell: (item) => <NameCell item={item} /> },
  { key: 'phone', header: COPY.columns.phone, cell: (item) => item.contactNumber },
  { key: 'product', header: COPY.columns.product, cell: productText },
  {
    key: 'pieces',
    header: COPY.columns.pieces,
    cell: (item) => (item.quantity === null || item.quantity === '' ? null : COPY.pieces(item.quantity)),
  },
  { key: 'photos', header: COPY.columns.photos, cell: photosText },
  { key: 'status', header: COPY.columns.status, cell: (item) => <QuoteStatusBadge status={item.status} /> },
];

export interface QuoteRequestsTableProps {
  rows: readonly QuoteRequestListItem[] | undefined;
  /** Makes the caption a focus target for Pagination. */
  captionId?: string | undefined;
  pending: boolean;
  refetching: boolean;
}

export function QuoteRequestsTable({ rows, captionId, pending, refetching }: QuoteRequestsTableProps) {
  return (
    <ResponsiveTable<QuoteRequestListItem>
      caption={COPY.tableCaption}
      captionId={captionId}
      columns={COLUMNS}
      rows={rows}
      rowKey={(item) => item.id}
      things={COPY.loadingThings}
      pending={pending}
      refetching={refetching}
      skeletonRows={5}
    />
  );
}
