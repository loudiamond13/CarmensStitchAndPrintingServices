// SPEC-GAP: product lines
// S3 Products tab, /admin/site-content?tab=products (CONT-02, PUB-02, D-01, D-08; plan 11-20): every product line, shown and hidden, in display
// order, with its 44px main photo or placeholder, the title as a link to the editor over the short name, the starting price, how many order
// product types and gallery items are filed under it, its status and its row actions. Add Product Line in the head goes to the editor.
//   - The list has its own loading, error and empty states, so it never blanks another tab.
//   - Prices, counts and the order are the server's; this only formats them (Core Value).
//   - Move, Hide and Show save at once with no question (nothing is lost). While one of them saves, the pressed control is busy and every other
//     row action is aria-disabled, so they keep focus and ignore a press (WEB-09): one move changes the places of the other rows, and one
//     submission is in flight at a time. Focus then stays on the pressed control once the list has read again; a move that put the row at an
//     end leaves Move up or Move down aria-disabled, so focus goes to the other one.
//   - A polite line says where the moved line is: "Basketball Jerseys moved to position 2 of 6."
//   - Delete is offered only for a line nothing is filed under (D-08) and asks first with Cancel focused. A line that became used meanwhile
//     is refused by the server (422): the question shows the server's line and the list reads again, so Delete goes.
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { MediaPlaceholder } from '@/components/brand';
import { useToast } from '@/components/feedback';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { Money } from '@/components/money';
import { ConfirmDialog } from '@/components/overlays';
import { EmptyValue, LazyImage } from '@/components/states';
import { Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { mayHaveSaved } from '@/lib/forms/mayHaveSaved';
import { expensesCaptionClasses } from '@/modules/admin/components/expenses.recipe';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import {
  lineActionsClasses,
  lineCellClasses,
  linePriceCellClasses,
  linePriceMinimumClasses,
  lineShortNameClasses,
  lineTextClasses,
  lineThumbClasses,
  lineTitleLinkClasses,
} from '@/modules/admin/components/siteContent.recipe';
import {
  useDeleteProductLine,
  useMoveProductLine,
  useProductLineListQuery,
  useSetProductLineShown,
} from '@/modules/admin/hooks/useProductLineQueries';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import type { MoveDirection, ProductLineListItem } from '@/modules/admin/services/productLinesService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';
import { formatCount } from '@/utils/format';

const COPY = SITE_CONTENT_COPY.products;

const NEW_LINE_PATH = '/admin/site-content/products/new';

/** The server's code for "something is filed under this line" (D-08). */
const IN_USE_CODE = 'product-lines.in-use';

/** The editor of one line. */
export const lineEditorPath = (id: string): string => `/admin/site-content/products/${encodeURIComponent(id)}`;

/** The focus registry keys of a row's controls. */
type ControlName = 'up' | 'down' | 'toggle' | 'edit';
const controlKey = (control: ControlName, id: string): string => `${control}:${id}`;

/** The single-click action that is saving, or has saved and waits for the list to read again. */
interface Acting {
  id: string;
  /** The control that was pressed. */
  control: 'up' | 'down' | 'toggle';
  /** After a move: the place the line takes in the list (zero based). Unset until the move has gone through. */
  expectIndex?: number;
  /** After Hide or Show: whether the line is then shown. Unset until it has gone through. */
  expectShown?: boolean;
  /** One value per press, kept when the action is copied: focus is moved once per press, never again by a later copy. */
  token: object;
  /** The list has been read again since the action went through. */
  settled: boolean;
}

/** True once the list shows what the successful action should have made of it: the line in its new place, or shown or hidden. */
function isDone(action: Acting, rows: readonly ProductLineListItem[] | undefined): boolean {
  const index = rows?.findIndex((line) => line.id === action.id) ?? -1;
  const line = rows?.[index];
  if (line === undefined) {
    return false;
  }
  if (action.expectIndex !== undefined) {
    return index === action.expectIndex;
  }
  return action.expectShown !== undefined && line.isActive === action.expectShown;
}

/**
 * The control that takes focus once the action is done: the one that was pressed, unless a move put the row at the end that control points to
 * (then it is aria-disabled, so focus goes to the other move button of the row).
 */
function focusTargetOf(action: Acting, rows: readonly ProductLineListItem[]): string {
  if (action.expectIndex === undefined) {
    return controlKey('toggle', action.id);
  }
  const atEnd = action.control === 'up' ? action.expectIndex === 0 : action.expectIndex === rows.length - 1;
  const other = action.control === 'up' ? 'down' : 'up';
  return controlKey(atEnd ? other : action.control, action.id);
}

/** What the table needs to wire a row's controls. */
interface RowWiring {
  /** The action that is saving or waiting for the list: every control is aria-disabled, and the pressed one is busy. */
  acting: Acting | null;
  press: (line: ProductLineListItem, control: 'up' | 'down' | 'toggle') => void;
  /** Opens the delete question. */
  remove: (line: ProductLineListItem) => void;
  /** Remembers each row's controls, so focus can go back to them. */
  register: (key: string, element: HTMLElement | null) => void;
  /** How many lines the list holds, for the ends of the order. */
  total: number;
  /** The first row's index is 0: whether a row is at an end. */
  indexOf: (line: ProductLineListItem) => number;
}

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

function columns(wiring: RowWiring): readonly ResponsiveTableColumn<ProductLineListItem>[] {
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
      // Up to five 36px buttons would cover the card title on a phone, so the actions sit under the other cells.
      flowActions: true,
      cell: (item) => {
        const index = wiring.indexOf(item);
        // While an action saves, the pressed control is busy and every other control is aria-disabled (WEB-09).
        const acting = wiring.acting !== null;
        const busyOf = (control: 'up' | 'down' | 'toggle'): boolean =>
          wiring.acting?.id === item.id && wiring.acting.control === control;
        const upLabel = COPY.rowActions.up(item.title);
        const downLabel = COPY.rowActions.down(item.title);
        const editLabel = COPY.rowActions.edit(item.title);
        const toggleLabel = item.isActive ? COPY.rowActions.hide(item.title) : COPY.rowActions.show(item.title);
        const removeLabel = COPY.rowActions.remove(item.title);
        return (
          <RowActions className={lineActionsClasses}>
            <RowAction
              icon="chevron-up"
              label={upLabel}
              title={upLabel}
              disabled={index === 0 || acting}
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
              disabled={index === wiring.total - 1 || acting}
              busy={busyOf('down')}
              onClick={() => {
                wiring.press(item, 'down');
              }}
              ref={(button) => {
                wiring.register(controlKey('down', item.id), button);
              }}
            />
            <RowAction
              to={lineEditorPath(item.id)}
              icon="pencil"
              label={editLabel}
              title={editLabel}
              ref={(link: HTMLAnchorElement | null) => {
                wiring.register(controlKey('edit', item.id), link);
              }}
            />
            <RowAction
              icon={item.isActive ? 'eye-off' : 'eye'}
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
            {/* Only a line nothing is filed under can be deleted (D-08); the server checks again. */}
            {item.canDelete && (
              <RowAction
                icon="trash-2"
                label={removeLabel}
                title={removeLabel}
                danger
                disabled={acting}
                onClick={() => {
                  wiring.remove(item);
                }}
              />
            )}
          </RowActions>
        );
      },
    },
  ];
}

export function ProductLinesTab() {
  const toast = useToast();
  const query = useProductLineListQuery();
  const { register, focusRow } = useRowFocus();
  const addRef = useRef<HTMLAnchorElement>(null);
  const rows = query.data;
  const [acting, setActing] = useState<Acting | null>(null);
  // The polite line after a move.
  const [announcement, setAnnouncement] = useState('');
  // The line the Delete question is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ line: ProductLineListItem; open: boolean } | null>(null);
  // Where focus goes once the deleted row has left the list: the Edit of another row, or Add Product Line when it is null.
  const focusAfterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);

  // The action holds every row's controls until the list shows what it did, or has been read again after it.
  const holding = acting !== null && !acting.settled && !isDone(acting, rows) ? acting : null;
  const move = useMoveProductLine();
  const toggle = useSetProductLineShown();
  // The last action's focus has been moved already (so a later render of the same action does not move it again).
  const focused = useRef<object | null>(null);

  /** A refused or failed immediate action: a danger toast with the shared error line, and the list read again when it may have gone through. */
  const reportFailure = (
    line: ProductLineListItem,
    control: 'up' | 'down' | 'toggle',
    error: unknown,
    indexBefore: number,
  ): void => {
    setActing(null);
    const title =
      control === 'toggle'
        ? (line.isActive ? COPY.failed.hide : COPY.failed.show)(line.title)
        : COPY.failed.move(line.title);
    const copy = describeHttpError(error);
    if (copy !== null) {
      toast.show({ tone: 'danger', title, message: errorLine(copy) });
    }
    const action = control === 'toggle' ? toggle : move;
    if (isHttpError(error) && error.status === 404) {
      // A final answer: the line is gone, so the same press is a new intent and gets a new Idempotency-Key.
      action.reset();
      void query.refetch();
    } else if (mayHaveSaved(error)) {
      // The answer may have been lost while the server is still working on it, so the key is dropped only once the list shows what the
      // action did. Until then a repeat press keeps the key and is replayed, or refused as still running.
      void query.refetch().then((result) => {
        if (result.isError || result.data === undefined) {
          return;
        }
        const after = result.data.findIndex((item) => item.id === line.id);
        const tookEffect =
          control === 'toggle' ? result.data[after]?.isActive === !line.isActive : after !== indexBefore;
        if (tookEffect) {
          action.reset();
        }
      });
    }
  };

  /** Sends the action and, once it has gone through, says so and waits for the list to read again (the write's own refresh is already on its way). */
  const run = async (line: ProductLineListItem, control: 'up' | 'down' | 'toggle', token: object): Promise<void> => {
    const list = rows ?? [];
    const index = list.findIndex((item) => item.id === line.id);
    const outcome =
      control === 'toggle'
        ? await toggle.submit({ id: line.id, shown: !line.isActive })
        : await move.submit({ id: line.id, direction: control satisfies MoveDirection });
    if (!outcome.ok) {
      reportFailure(line, control, outcome.error, index);
      return;
    }
    if (control === 'toggle') {
      const shown = !line.isActive;
      toast.show(
        shown
          ? { title: COPY.toast.shown.title(line.title), message: COPY.toast.shown.message }
          : { title: COPY.toast.hidden.title(line.title), message: COPY.toast.hidden.message },
      );
      setActing({ id: line.id, control, expectShown: shown, settled: false, token });
    } else {
      const expectIndex = control === 'up' ? index - 1 : index + 1;
      setAnnouncement(COPY.moved(line.title, expectIndex + 1, list.length));
      setActing({ id: line.id, control, expectIndex, settled: false, token });
    }
    void query.refetch({ cancelRefetch: false }).finally(() => {
      setActing((current) => (current?.id === line.id ? { ...current, settled: true } : current));
    });
  };

  /**
   * Starts Move up, Move down, or Hide or Show: every row's controls are aria-disabled from now until the list has read again, because one
   * move changes the places of the others and one submission is in flight at a time.
   */
  const press = (line: ProductLineListItem, control: 'up' | 'down' | 'toggle'): void => {
    if (holding !== null) {
      return;
    }
    const token = {};
    setActing({ id: line.id, control, settled: false, token });
    void run(line, control, token);
  };

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  /** The row after this one, else the one before it, else null: where focus goes when this row is deleted. */
  const neighbourOf = (line: ProductLineListItem): string | null => {
    const list = rows ?? [];
    const index = list.findIndex((item) => item.id === line.id);
    return list[index + 1]?.id ?? list[index - 1]?.id ?? null;
  };

  const removal = useDeleteProductLine({
    onSuccess: (_result, id) => {
      const line = deleting?.line;
      if (line?.id === id) {
        focusAfterRemoval.current = { removedId: id, focusId: neighbourOf(line) };
        toast.show({ title: COPY.toast.deleted.title, message: COPY.toast.deleted.message(line.title) });
      }
      closeDelete();
    },
  });

  const confirmDelete = async () => {
    if (deleting === null) {
      return undefined;
    }
    const { line } = deleting;
    const outcome = await removal.submit(line.id);
    if (!outcome.ok && isHttpError(outcome.error)) {
      // Someone deleted it first: the question closes, says so, and the list is read again.
      if (outcome.error.status === 404) {
        focusAfterRemoval.current = { removedId: line.id, focusId: neighbourOf(line) };
        closeDelete();
        toast.show({ tone: 'info', title: COPY.toast.alreadyDeleted });
        void query.refetch();
        return undefined;
      }
      // It became used meanwhile: the question shows the server's line, and the list read again takes Delete away.
      if (outcome.error.status === 422) {
        void query.refetch();
      }
    }
    return outcome;
  };

  // The server's own words for a line that became used meanwhile, shown in the question.
  const describeDeleteFailure = (error: unknown): ErrorCopy | string | undefined =>
    isHttpError(error) && error.status === 422 && error.code === IN_USE_CODE ? COPY.remove.inUse : undefined;

  // Runs after every render: moves focus once the list holds what the last action expects.
  useEffect(() => {
    const removed = focusAfterRemoval.current;
    if (removed !== null && rows !== undefined && !rows.some((line) => line.id === removed.removedId)) {
      focusAfterRemoval.current = null;
      if (removed.focusId === null || !focusRow(controlKey('edit', removed.focusId))) {
        addRef.current?.focus();
      }
    }
    if (acting !== null && rows !== undefined && focused.current !== acting.token && isDone(acting, rows)) {
      focused.current = acting.token;
      focusRow(focusTargetOf(acting, rows));
    }
  });

  const wiring: RowWiring = {
    acting: holding,
    press,
    remove: (line) => {
      setDeleting({ line, open: true });
    },
    register,
    total: rows?.length ?? 0,
    indexOf: (line) => rows?.findIndex((item) => item.id === line.id) ?? -1,
  };

  return (
    <>
      <SiteContentCard
        title={COPY.card.title}
        hint={COPY.card.hint}
        action={
          <ButtonLink to={NEW_LINE_PATH} variant="primary" icon="plus" ref={addRef}>
            {COPY.add}
          </ButtonLink>
        }
      >
        <ResponsiveTable<ProductLineListItem>
          caption={COPY.table.caption}
          columns={columns(wiring)}
          rows={rows}
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
        <p className={expensesCaptionClasses}>{COPY.caption}</p>
      </SiteContentCard>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {announcement}
      </div>
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={COPY.remove.title(deleting.line.title)}
          message={COPY.remove.message}
          confirmLabel={COPY.remove.confirm}
          pendingLabel={COPY.remove.pending}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
          describeFailure={describeDeleteFailure}
        />
      )}
    </>
  );
}
