// SPEC-GAP: gallery tab
// S6 Gallery tab, /admin/site-content?tab=gallery (GAL-03, PUB-03, D-10, D-15, D-27; plan 11-32): every shown order and every upload in the one
// gallery order, with the photo, the name over "{Basketball} · {17} pcs", where it came from and whether it shows. Add Photo in the head opens the
// window for older work.
//   - The list has its own loading, error and empty states, so it never blanks another tab.
//   - An order item shows its order number as a link to the order: it is changed and taken off the website there (D-15, D-27), never here.
//   - A line that is hidden takes everything filed under it off the public site (D-08): the row says "Line hidden".
//   - Names and notes are rendered as text only (CWE-79): React escapes them, and nothing here accepts or renders HTML.
import clsx from 'clsx';
import { useRef, useState } from 'react';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { MediaPlaceholder } from '@/components/brand';
import { EmptyState } from '@/components/feedback';
import { Select, type SelectOption } from '@/components/forms';
import { FilterBar, Pagination, ResponsiveTable, ResultBar, type ResponsiveTableColumn } from '@/components/lists';
import { Badge } from '@/components/status';
import { LazyImage } from '@/components/states';
import { usePagedList } from '@/lib/url-state/usePagedList';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import { GalleryPhotoModal } from '@/modules/admin/components/GalleryPhotoModal';
import {
  galleryNameClasses,
  galleryOrderLinkClasses,
  galleryStatusClasses,
  galleryThumbClasses,
  lineCellClasses,
  lineShortNameClasses,
  lineTextClasses,
  testimonialHomeNoteClasses,
} from '@/modules/admin/components/siteContent.recipe';
import { useGalleryItemsQuery } from '@/modules/admin/hooks/useGalleryItemQueries';
import { useGalleryTabParams } from '@/modules/admin/hooks/useGalleryTabParams';
import { useProductLineListQuery } from '@/modules/admin/hooks/useProductLineQueries';
import type { GalleryItem } from '@/modules/admin/services/galleryItemsService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';

const COPY = SITE_CONTENT_COPY.gallery;

/** "Basketball · 17 pcs", "Basketball", "17 pcs", or null when the item has neither. */
function detailsOf(item: GalleryItem): string | null {
  const parts = [
    item.lineShortName,
    item.pieces === null ? null : COPY.pieces(Number(item.pieces)),
  ].filter((part): part is string => part !== null && part !== '');
  return parts.length === 0 ? null : parts.join(' · ');
}

/** The 56px cover, or the placeholder while the item has no photo. */
function Thumb({ item }: { item: GalleryItem }) {
  return (
    <span className={galleryThumbClasses}>
      {item.thumb === null ? (
        <MediaPlaceholder label={false} ratio="1 / 1" />
      ) : (
        <LazyImage src={item.thumb} alt="" width={56} height={56} ratio="1 / 1" />
      )}
    </span>
  );
}

function columns(): readonly ResponsiveTableColumn<GalleryItem>[] {
  return [
    {
      key: 'photo',
      header: COPY.table.photo,
      lead: true,
      cell: (item) => {
        const details = detailsOf(item);
        return (
          <span className={lineCellClasses}>
            <Thumb item={item} />
            <span className={lineTextClasses}>
              <span className={galleryNameClasses}>{item.name}</span>
              {details !== null && <span className={lineShortNameClasses}>{details}</span>}
            </span>
          </span>
        );
      },
    },
    {
      key: 'source',
      header: COPY.table.source,
      cell: (item) =>
        item.kind === 'order' && item.orderId !== null && item.orderNumber !== null ? (
          <UiLink
            to={`/admin/orders/${item.orderId}`}
            className={clsx(galleryOrderLinkClasses, hitAreaClasses)}
          >
            {item.orderNumber}
          </UiLink>
        ) : (
          COPY.uploaded
        ),
    },
    {
      key: 'status',
      header: COPY.table.status,
      cell: (item) => (
        <span className={galleryStatusClasses}>
          {item.isShown ? (
            <Badge tone="success" dot>
              {COPY.status.shown}
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              {COPY.status.hidden}
            </Badge>
          )}
          {item.lineHidden && <span className={testimonialHomeNoteClasses}>{COPY.lineHidden}</span>}
        </span>
      ),
    },
  ];
}

/** The results caption Pagination moves focus to after a page change (it needs tabIndex -1). */
const CAPTION_ID = 'gallery-items-caption';

export function GalleryTab() {
  const addRef = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);
  const lines = useProductLineListQuery();
  const [values, set] = useGalleryTabParams(lines.data?.map((line) => line.id.toLowerCase()));
  const query = useGalleryItemsQuery({ line: values.line, page: values.page, pageSize: values.size });
  const total = Number(query.data?.total ?? 0);
  const { pastTheEnd, pageCount, showPager, fresh } = usePagedList(query, total, values.size, set.clampPage);

  const lineOptions: readonly SelectOption[] = (lines.data ?? []).map((line) => ({
    value: line.id.toLowerCase(),
    label: line.isActive ? line.title : COPY.filter.hidden(line.title),
  }));
  const lineName = lines.data?.find((line) => line.id.toLowerCase() === values.line)?.shortName ?? null;
  // A line with nothing filed under it: no table, one message and the way back to every line.
  const emptyLine = values.line !== null && fresh && total === 0 && !pastTheEnd;

  return (
    <>
      <SiteContentCard
        title={COPY.card.title}
        hint={COPY.card.hint}
        action={
          <Button
            variant="primary"
            icon="plus"
            ref={addRef}
            onClick={() => {
              setAdding(true);
            }}
          >
            {COPY.add}
          </Button>
        }
      >
        <FilterBar label={COPY.filter.landmark}>
          <Select
            label={COPY.filter.label}
            placeholder={COPY.filter.all}
            options={lineOptions}
            value={values.line ?? ''}
            onChange={(event) => {
              set.setFilter('line', event.target.value === '' ? null : event.target.value);
            }}
          />
        </FilterBar>
        <ResultBar
          count={pastTheEnd ? 0 : total}
          thing={COPY.resultThing}
          things={COPY.resultThings}
          orderNote={COPY.orderNote}
        />
        {emptyLine ? (
          <EmptyState
            icon="image"
            level={3}
            title={COPY.emptyLine.title(lineName ?? '')}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  set.setFilter('line', null);
                }}
              >
                {COPY.emptyLine.showAll}
              </Button>
            }
          />
        ) : (
          <ResponsiveTable<GalleryItem>
            caption={COPY.table.caption}
            captionId={CAPTION_ID}
            columns={columns()}
            rows={query.data?.rows}
            rowKey={(item) => item.id}
            isInactive={(item) => !item.isShown || item.lineHidden}
            things={COPY.things}
            pending={query.isPending || pastTheEnd}
            refetching={query.isPlaceholderData && query.isFetching}
            failed={query.isError}
            error={query.error}
            onRetry={() => {
              void query.refetch();
            }}
            emptyIcon="image"
            emptyTitle={COPY.empty.title}
            emptyMessage={COPY.empty.message}
            emptyLevel={3}
            skeletonRows={4}
          />
        )}
        {showPager && (
          <Pagination
            page={values.page}
            pageCount={pageCount}
            onPageChange={set.setPage}
            focusTargetId={CAPTION_ID}
            pageSize={values.size}
            onPageSizeChange={set.setPageSize}
            sizeOnlyWhenSinglePage
          />
        )}
      </SiteContentCard>
      <GalleryPhotoModal
        mode="add"
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        onSaved={() => undefined}
      />
    </>
  );
}
