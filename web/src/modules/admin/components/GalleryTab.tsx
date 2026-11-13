// SPEC-GAP: gallery tab
// S6 Gallery tab, /admin/site-content?tab=gallery (GAL-03, PUB-03, D-10, D-15, D-27; plan 11-32): every shown order and every upload in the one
// gallery order, with the photo, the name over "{Basketball} · {17} pcs", where it came from and whether it shows, paged by the server and
// filtered by product line (the line, page and size are in the URL). Add Photo in the head opens the window for older work.
//   - The list has its own loading, error and empty states, so it never blanks another tab.
//   - An order item has Move up, Move down and a link to its order, and nothing else: it is changed and taken off the website there (D-15,
//     D-27), never here. An upload also has Edit, Hide or Show and Delete.
//   - A line that is hidden takes everything filed under it off the public site (D-08): the row says "Line hidden".
//   - Move, Hide and Show save at once with no question (nothing is lost). While one of them saves, the pressed control is busy and every
//     other row action is aria-disabled, so they keep focus and ignore a press (WEB-09): one move changes the places of the other rows, and
//     one submission is in flight at a time. Focus then stays on the pressed control once the list has read again; a move that put the row at
//     an end of the whole list leaves Move up or Move down aria-disabled, so focus goes to the other one.
//   - A move swaps with the visible neighbour, which may be on the next or previous page (the server decides; with a line filter it is the
//     neighbour in the filtered list). The tab then follows the item to its new page with a push, focuses the item's control there, and the
//     polite line says "{team} moved to page {2}." Within a page the line says "{team} moved to place {2} of {6}."
//   - Delete asks first with Cancel focused and names the team. Focus then goes to the next row, else the previous row, else Add Photo.
//   - Names and notes are rendered as text only (CWE-79): React escapes them, and nothing here accepts or renders HTML.
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { MediaPlaceholder } from '@/components/brand';
import { EmptyState, useToast } from '@/components/feedback';
import { Select, type SelectOption } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  FilterBar,
  Pagination,
  ResponsiveTable,
  ResultBar,
  RowAction,
  RowActions,
  type ResponsiveTableColumn,
} from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { LazyImage } from '@/components/states';
import { Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { mayHaveSaved } from '@/lib/forms/mayHaveSaved';
import { usePagedList } from '@/lib/url-state/usePagedList';
import { GalleryPhotoModal } from '@/modules/admin/components/GalleryPhotoModal';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import {
  galleryNameClasses,
  galleryOrderLinkClasses,
  galleryStatusClasses,
  galleryThumbClasses,
  lineActionsClasses,
  lineCellClasses,
  lineShortNameClasses,
  lineTextClasses,
  testimonialHomeNoteClasses,
} from '@/modules/admin/components/siteContent.recipe';
import {
  useDeleteGalleryUpload,
  useGalleryItemsQuery,
  useMoveGalleryItem,
  useReadGalleryAgain,
  useSetGalleryUploadShown,
} from '@/modules/admin/hooks/useGalleryItemQueries';
import { useGalleryTabParams } from '@/modules/admin/hooks/useGalleryTabParams';
import { useProductLineListQuery } from '@/modules/admin/hooks/useProductLineQueries';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import type { GalleryItem } from '@/modules/admin/services/galleryItemsService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import { describeHttpError, errorLine } from '@/utils/describeHttpError';

const COPY = SITE_CONTENT_COPY.gallery;

/** The results caption Pagination moves focus to after a page change (it needs tabIndex -1). */
const CAPTION_ID = 'gallery-items-caption';

/** "Basketball · 17 pcs", "Basketball", "17 pcs", or null when the item has neither. */
function detailsOf(item: GalleryItem): string | null {
  const parts = [item.lineShortName, item.pieces === null ? null : COPY.pieces(Number(item.pieces))].filter(
    (part): part is string => part !== null && part !== '',
  );
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

type Control = 'up' | 'down' | 'toggle';

/** The focus registry keys of a row's controls. */
type ControlName = Control | 'edit';
const controlKey = (control: ControlName, id: string): string => `${control}:${id}`;

/** The single-click action that is saving, or has saved and waits for the list to show it. */
interface Acting {
  id: string;
  /** The control that was pressed. */
  control: Control;
  /** After a move: the place in its page the item takes (zero based). Unset until the move has gone through, and for Hide and Show. */
  expectIndex?: number;
  /** After Hide or Show: whether the upload is then shown. Unset until it has gone through. */
  expectShown?: boolean;
  /** After a move across a page edge: the page the tab was sent to. */
  toPage?: number;
  /** One value per press, kept when the action is copied: focus is moved once per press, never again by a later copy. */
  token: object;
  /** The list has been read again since the action went through. */
  settled: boolean;
}

/** True once the page on screen shows what the successful action should have made of it. A kept earlier page never counts. */
function isDone(action: Acting, rows: readonly GalleryItem[] | undefined, placeholder: boolean): boolean {
  if (rows === undefined || placeholder) {
    return false;
  }
  if (action.expectIndex !== undefined) {
    return rows[action.expectIndex]?.id === action.id;
  }
  const item = rows.find((candidate) => candidate.id === action.id);
  return item !== undefined && action.expectShown !== undefined && item.isShown === action.expectShown;
}

/** What the table needs to wire a row's controls. */
interface RowWiring {
  /** The action that is saving or waiting for the list: every control is aria-disabled, and the pressed one is busy. */
  acting: Acting | null;
  press: (item: GalleryItem, control: Control) => void;
  /** Opens the edit window. */
  edit: (item: GalleryItem) => void;
  /** Opens the delete question. */
  remove: (item: GalleryItem) => void;
  /** Remembers each row's controls, so focus can go back to them. */
  register: (key: string, element: HTMLElement | null) => void;
  /** The place of a row in the whole filtered list, from 0, across every page; -1 when it is not on this page. */
  placeOf: (item: GalleryItem) => number;
  /** How many items the filtered list holds over every page. */
  total: number;
}

function columns(wiring: RowWiring): readonly ResponsiveTableColumn<GalleryItem>[] {
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
          <UiLink to={`/admin/orders/${item.orderId}`} className={clsx(galleryOrderLinkClasses, hitAreaClasses)}>
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
    {
      key: 'actions',
      header: COPY.table.actions,
      actions: true,
      // Up to five 36px buttons would cover the card title on a phone, so the actions sit under the other cells.
      flowActions: true,
      cell: (item) => {
        const place = wiring.placeOf(item);
        // While an action saves, the pressed control is busy and every other control is aria-disabled (WEB-09).
        const acting = wiring.acting !== null;
        const busyOf = (control: Control): boolean =>
          wiring.acting?.id === item.id && wiring.acting.control === control;
        const upLabel = COPY.rowActions.up(item.name);
        const downLabel = COPY.rowActions.down(item.name);
        const toggleLabel = item.isShown ? COPY.rowActions.hide(item.name) : COPY.rowActions.show(item.name);
        return (
          <RowActions className={lineActionsClasses}>
            <RowAction
              icon="chevron-up"
              label={upLabel}
              title={upLabel}
              disabled={place === 0 || acting}
              busy={busyOf('up')}
              onClick={() => {
                wiring.press(item, 'up');
              }}
              ref={(button) => {
                wiring.register(controlKey('up', item.id), button);
              }}
            />
            <RowAction
              icon="chevron-down"
              label={downLabel}
              title={downLabel}
              disabled={place === wiring.total - 1 || acting}
              busy={busyOf('down')}
              onClick={() => {
                wiring.press(item, 'down');
              }}
              ref={(button) => {
                wiring.register(controlKey('down', item.id), button);
              }}
            />
            {item.kind === 'upload' ? (
              <>
                <RowAction
                  icon="pencil"
                  label={COPY.rowActions.edit(item.name)}
                  title={COPY.rowActions.edit(item.name)}
                  disabled={acting}
                  onClick={() => {
                    wiring.edit(item);
                  }}
                  ref={(button) => {
                    wiring.register(controlKey('edit', item.id), button);
                  }}
                />
                <RowAction
                  icon={item.isShown ? 'eye-off' : 'eye'}
                  label={toggleLabel}
                  title={toggleLabel}
                  disabled={acting}
                  busy={busyOf('toggle')}
                  onClick={() => {
                    wiring.press(item, 'toggle');
                  }}
                  ref={(button) => {
                    wiring.register(controlKey('toggle', item.id), button);
                  }}
                />
                <RowAction
                  icon="trash-2"
                  label={COPY.rowActions.remove(item.name)}
                  title={COPY.rowActions.remove(item.name)}
                  danger
                  disabled={acting}
                  onClick={() => {
                    wiring.remove(item);
                  }}
                />
              </>
            ) : (
              item.orderId !== null &&
              item.orderNumber !== null && (
                <RowAction
                  icon="arrow-up-right"
                  label={COPY.rowActions.change(item.name, item.orderNumber)}
                  title={COPY.rowActions.change(item.name, item.orderNumber)}
                  to={`/admin/orders/${item.orderId}`}
                />
              )
            )}
          </RowActions>
        );
      },
    },
  ];
}

export function GalleryTab() {
  const toast = useToast();
  const { register, focusRow } = useRowFocus();
  const addRef = useRef<HTMLButtonElement>(null);
  const lines = useProductLineListQuery();
  const [values, set] = useGalleryTabParams(lines.data?.map((line) => line.id.toLowerCase()));
  const listParams = { line: values.line, page: values.page, pageSize: values.size };
  const query = useGalleryItemsQuery(listParams);
  const readAgain = useReadGalleryAgain(listParams);
  const rows = query.data?.rows;
  const total = Number(query.data?.total ?? 0);
  const { pastTheEnd, pageCount, showPager, fresh } = usePagedList(query, total, values.size, set.clampPage);
  const [acting, setActing] = useState<Acting | null>(null);
  // The polite line after a move.
  const [announcement, setAnnouncement] = useState('');
  const [adding, setAdding] = useState(false);
  // The upload the Edit window is open for, or was last open for (kept while it animates out).
  const [editing, setEditing] = useState<{ item: GalleryItem; open: boolean } | null>(null);
  // The upload the Delete question is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ item: GalleryItem; open: boolean } | null>(null);
  // The row whose Edit takes focus once the list shows it after a save.
  const focusAfterSave = useRef<string | null>(null);
  // Where focus goes once the deleted row has left the list: the Move up of another row, or Add Photo when it is null.
  const focusAfterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);
  // The last action's focus has been moved already (so a later render of the same action does not move it again).
  const focused = useRef<object | null>(null);

  const lineOptions: readonly SelectOption[] = (lines.data ?? []).map((line) => ({
    value: line.id.toLowerCase(),
    label: line.isActive ? line.title : COPY.filter.hidden(line.title),
  }));
  const lineName = lines.data?.find((line) => line.id.toLowerCase() === values.line)?.shortName ?? null;
  // A line with nothing filed under it: no table, one message and the way back to every line.
  const emptyLine = values.line !== null && fresh && total === 0 && !pastTheEnd;

  // A move that sent the tab to another page lets go once that page has been read, whatever it shows.
  const pageRead = acting?.toPage !== undefined && fresh && !query.isFetching && values.page === acting.toPage;
  // The action holds every row's controls until the page shows what it did, or has been read again after it.
  const holding =
    acting !== null && !acting.settled && !pageRead && !isDone(acting, rows, query.isPlaceholderData) ? acting : null;
  const move = useMoveGalleryItem();
  const toggle = useSetGalleryUploadShown();

  /** The place of a row in the whole filtered list, from 0. */
  const placeOf = (item: GalleryItem): number => {
    const index = rows?.findIndex((candidate) => candidate.id === item.id) ?? -1;
    return index < 0 ? -1 : (values.page - 1) * values.size + index;
  };

  /** A refused or failed immediate action: a danger toast with the shared error line, and the list read again when it may have gone through. */
  const reportFailure = (item: GalleryItem, control: Control, error: unknown): void => {
    setActing(null);
    const title =
      control === 'toggle'
        ? (item.isShown ? COPY.failed.hide : COPY.failed.show)(item.name)
        : COPY.failed.move(item.name);
    const copy = describeHttpError(error);
    if (copy !== null) {
      toast.show({ tone: 'danger', title, message: errorLine(copy) });
    }
    if (mayHaveSaved(error) || (isHttpError(error) && error.status === 404)) {
      void query.refetch();
    }
  };

  /** Sends the action and, once it has gone through, says so and waits for the page to show it (the write's own refresh is already on its way). */
  const run = async (item: GalleryItem, control: Control, token: object): Promise<void> => {
    const list = rows ?? [];
    const index = list.findIndex((candidate) => candidate.id === item.id);
    const outcome =
      control === 'toggle'
        ? await toggle.submit({ id: item.id, shown: !item.isShown })
        : await move.submit({ id: item.id, direction: control, lineId: values.line });
    if (!outcome.ok) {
      reportFailure(item, control, outcome.error);
      return;
    }
    if (control === 'toggle') {
      const shown = !item.isShown;
      toast.show(shown ? COPY.toast.shown : COPY.toast.hidden);
      setActing({ id: item.id, control, expectShown: shown, settled: false, token });
    } else {
      const crossesTop = control === 'up' && index === 0 && values.page > 1;
      const crossesBottom = control === 'down' && index === list.length - 1 && values.page < pageCount;
      if (crossesTop || crossesBottom) {
        // The item is now the last row of the page before, or the first row of the page after: the tab follows it there.
        const toPage = values.page + (crossesBottom ? 1 : -1);
        setAnnouncement(COPY.movedToPage(item.name, toPage));
        setActing({
          id: item.id,
          control,
          expectIndex: crossesBottom ? 0 : values.size - 1,
          toPage,
          settled: false,
          token,
        });
        set.setPage(toPage);
        return;
      }
      const expectIndex = control === 'up' ? index - 1 : index + 1;
      setAnnouncement(COPY.moved(item.name, (values.page - 1) * values.size + expectIndex + 1, total));
      setActing({ id: item.id, control, expectIndex, settled: false, token });
    }
    void query.refetch({ cancelRefetch: false }).finally(() => {
      setActing((current) => (current?.id === item.id ? { ...current, settled: true } : current));
    });
  };

  /**
   * Starts Move up, Move down, or Hide or Show: every row's controls are aria-disabled from now until the page has read again, because one
   * move changes the places of the others and one submission is in flight at a time.
   */
  const press = (item: GalleryItem, control: Control): void => {
    if (holding !== null) {
      return;
    }
    const token = {};
    setActing({ id: item.id, control, settled: false, token });
    void run(item, control, token);
  };

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  /** The row after this one, else the one before it, else null: where focus goes when this row is deleted. */
  const neighbourOf = (item: GalleryItem): string | null => {
    const list = rows ?? [];
    const index = list.findIndex((candidate) => candidate.id === item.id);
    return list[index + 1]?.id ?? list[index - 1]?.id ?? null;
  };

  const removal = useDeleteGalleryUpload({
    onSuccess: (_result, id) => {
      const item = deleting?.item;
      if (item?.id === id) {
        focusAfterRemoval.current = { removedId: id, focusId: neighbourOf(item) };
        toast.show(COPY.toast.deleted);
      }
      closeDelete();
    },
  });

  const confirmDelete = async () => {
    if (deleting === null) {
      return undefined;
    }
    const { item } = deleting;
    const outcome = await removal.submit(item.id);
    // Someone deleted it first: the question closes, says so, and the list is read again.
    if (!outcome.ok && isHttpError(outcome.error) && outcome.error.status === 404) {
      focusAfterRemoval.current = { removedId: item.id, focusId: neighbourOf(item) };
      closeDelete();
      toast.show({ tone: 'info', title: COPY.toast.alreadyDeleted });
      void query.refetch();
      return undefined;
    }
    return outcome;
  };

  // Runs after every render: moves focus once the page holds what the last action expects.
  useEffect(() => {
    const saved = focusAfterSave.current;
    if (saved !== null && rows?.some((item) => item.id === saved) === true && !query.isFetching) {
      focusAfterSave.current = null;
      focusRow(controlKey('edit', saved));
    }
    const removed = focusAfterRemoval.current;
    if (removed !== null && rows !== undefined && !rows.some((item) => item.id === removed.removedId)) {
      focusAfterRemoval.current = null;
      if (removed.focusId === null || !focusRow(controlKey('up', removed.focusId))) {
        addRef.current?.focus();
      }
    }
    if (acting !== null && rows !== undefined && focused.current !== acting.token && isDone(acting, rows, query.isPlaceholderData)) {
      focused.current = acting.token;
      if (acting.control === 'toggle') {
        focusRow(controlKey('toggle', acting.id));
      } else {
        // The pressed control, unless the item is now at that end of the whole list (it is then aria-disabled): the other move button.
        const place = (values.page - 1) * values.size + (acting.expectIndex ?? 0);
        const atEnd = acting.control === 'up' ? place === 0 : place === total - 1;
        const other = acting.control === 'up' ? 'down' : 'up';
        focusRow(controlKey(atEnd ? other : acting.control, acting.id));
      }
    }
  });

  const wiring: RowWiring = {
    acting: holding,
    press,
    edit: (item) => {
      setEditing({ item, open: true });
    },
    remove: (item) => {
      setDeleting({ item, open: true });
    },
    register,
    placeOf,
    total,
  };

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
            columns={columns(wiring)}
            rows={rows}
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
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {announcement}
      </div>
      <GalleryPhotoModal
        mode="add"
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        onSaved={() => undefined}
      />
      <GalleryPhotoModal
        mode="edit"
        open={editing?.open ?? false}
        item={editing?.item ?? null}
        readLatest={async (id) => (await readAgain()).rows.find((row) => row.id === id)}
        onClose={() => {
          setEditing((current) => (current === null ? null : { ...current, open: false }));
        }}
        onSaved={(saved) => {
          focusAfterSave.current = saved.id;
        }}
      />
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={COPY.remove.title}
          message={COPY.remove.message(deleting.item.name)}
          confirmLabel={COPY.remove.confirm}
          pendingLabel={COPY.remove.pending}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
        />
      )}
    </>
  );
}
