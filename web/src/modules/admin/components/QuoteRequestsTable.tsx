// SPEC-GAP: quote requests inbox table (UI-SPEC R1 item 4). The R1 ResponsiveTable columns: Received, Name, Phone, Product,
// Pieces, Photos and Status; cards below 768px with the name as the card title. The whole row is not a link: the name link
// is the one way in. Every value is React text (T-13-43).
import type { ReactNode } from 'react';
import { UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { Badge } from '@/components/status';
import { QUOTE_REQUESTS_COPY } from '@/modules/admin/quoteRequestsCopy';
import { isQuoteStatus, QUOTE_STATUS_TONE, quoteStatusLabel } from '@/modules/admin/quoteStatus';
import type { QuoteRequestListItem } from '@/modules/admin/services/quoteRequestsService';
import { formatBusinessDate, formatBusinessTime, formatCount } from '@/utils/format';
import {
  quoteNameLinkClasses,
  quotePhotosClasses,
  quotePhotosWarningClasses,
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

function receivedCell(item: QuoteRequestListItem): ReactNode {
  const utc = item.receivedAtUtc;
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

/** "3"; with missing photos the warning icon and "2 of 3" with hidden "photos arrived"; none is empty; "Removed" after Spam. */
function photosCell(item: QuoteRequestListItem): ReactNode {
  if (item.photosRemoved) return COPY.photos.removed;
  const declared = Number(item.photoCount);
  const stored = Number(item.storedPhotoCount);
  if (declared <= 0) return null;
  if (stored >= declared) return formatCount(declared);
  return (
    <span className={quotePhotosClasses}>
      <span className={quotePhotosWarningClasses}>
        <Icon name="triangle-alert" size={16} />
      </span>
      {COPY.photos.partial(stored, declared)} <span className={srOnlyClasses}>{COPY.photos.partialHidden}</span>
    </span>
  );
}

const COLUMNS: readonly ResponsiveTableColumn<QuoteRequestListItem>[] = [
  { key: 'received', header: COPY.columns.received, cell: receivedCell },
  { key: 'name', header: COPY.columns.name, lead: true, cell: (item) => <NameCell item={item} /> },
  { key: 'phone', header: COPY.columns.phone, cell: (item) => item.contactNumber },
  { key: 'product', header: COPY.columns.product, cell: productText },
  {
    key: 'pieces',
    header: COPY.columns.pieces,
    cell: (item) => (item.quantity === null || item.quantity === '' ? null : COPY.pieces(item.quantity)),
  },
  { key: 'photos', header: COPY.columns.photos, cell: photosCell },
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
