// SPEC-GAP: product lines
// S3 Products tab, /admin/site-content?tab=products (CONT-02, PUB-02, D-01, D-08; plan 11-20): every product line, shown and hidden, in display
// order, with its 44px main photo or placeholder, the title as a link to the editor over the short name, the starting price, how many order
// product types and gallery items are filed under it, its status and its row actions. Add Product Line in the head goes to the editor.
//   - The list has its own loading, error and empty states, so it never blanks another tab.
//   - Prices, counts and the order are the server's; this only formats them (Core Value).
import clsx from 'clsx';
import { ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { MediaPlaceholder } from '@/components/brand';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { Money } from '@/components/money';
import { EmptyValue, LazyImage } from '@/components/states';
import { Badge } from '@/components/status';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import {
  lineCellClasses,
  linePriceCellClasses,
  linePriceMinimumClasses,
  lineShortNameClasses,
  lineTextClasses,
  lineThumbClasses,
  lineTitleLinkClasses,
} from '@/modules/admin/components/siteContent.recipe';
import { useProductLineListQuery } from '@/modules/admin/hooks/useProductLineQueries';
import type { ProductLineListItem } from '@/modules/admin/services/productLinesService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import { formatCount } from '@/utils/format';

const COPY = SITE_CONTENT_COPY.products;

const NEW_LINE_PATH = '/admin/site-content/products/new';

/** The editor of one line. */
export const lineEditorPath = (id: string): string => `/admin/site-content/products/${encodeURIComponent(id)}`;

/** The 44px main photo, or the placeholder while the line has none. */
function Thumb({ line }: { line: ProductLineListItem }) {
  return (
    <span className={lineThumbClasses}>
      {line.mainPhotoThumb === null ? (
        <MediaPlaceholder label={false} ratio="1 / 1" />
      ) : (
        <LazyImage src={line.mainPhotoThumb} alt="" width={44} height={44} ratio="1 / 1" />
      )}
    </span>
  );
}

function columns(): readonly ResponsiveTableColumn<ProductLineListItem>[] {
  return [
    {
      key: 'line',
      header: COPY.table.line,
      lead: true,
      cell: (item) => (
        <span className={lineCellClasses}>
          <Thumb line={item} />
          <span className={lineTextClasses}>
            <UiLink to={lineEditorPath(item.id)} className={clsx(lineTitleLinkClasses, hitAreaClasses)}>
              {item.title}
            </UiLink>
            <span className={lineShortNameClasses}>{item.shortName}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'startsAt',
      header: COPY.table.startsAt,
      money: true,
      cell: (item) =>
        item.startsAtPrice === null ? (
          <EmptyValue />
        ) : (
          <span className={linePriceCellClasses}>
            <Money amount={Number(item.startsAtPrice)} />
            {item.minimumQuantity !== null && (
              <span className={linePriceMinimumClasses}>{COPY.minimum(Number(item.minimumQuantity))}</span>
            )}
          </span>
        ),
    },
    {
      key: 'orderTypes',
      header: COPY.table.orderTypes,
      money: true,
      cell: (item) => formatCount(item.productTypeIds.length),
    },
    {
      key: 'gallery',
      header: COPY.table.gallery,
      money: true,
      cell: (item) => formatCount(Number(item.shownGalleryCount)),
    },
    {
      key: 'status',
      header: COPY.table.status,
      cell: (item) =>
        item.isActive ? (
          <Badge tone="success" dot>
            {COPY.status.shown}
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            {COPY.status.hidden}
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: COPY.table.actions,
      actions: true,
      cell: (item) => (
        <RowActions>
          <RowAction
            to={lineEditorPath(item.id)}
            icon="pencil"
            label={COPY.rowActions.edit(item.title)}
            title={COPY.rowActions.edit(item.title)}
          />
        </RowActions>
      ),
    },
  ];
}

export function ProductLinesTab() {
  const query = useProductLineListQuery();
  return (
    <SiteContentCard
      title={COPY.card.title}
      hint={COPY.card.hint}
      action={
        <ButtonLink to={NEW_LINE_PATH} variant="primary" icon="plus">
          {COPY.add}
        </ButtonLink>
      }
    >
      <ResponsiveTable<ProductLineListItem>
        caption={COPY.table.caption}
        columns={columns()}
        rows={query.data}
        rowKey={(item) => item.id}
        isInactive={(item) => !item.isActive}
        things={COPY.things}
        pending={query.isPending}
        failed={query.isError}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
        emptyIcon="shirt"
        emptyTitle={COPY.empty.title}
        emptyMessage={COPY.empty.message}
        emptyLevel={3}
        skeletonRows={4}
      />
    </SiteContentCard>
  );
}
