// SPEC-GAP: testimonials
// S5 Testimonials tab, /admin/site-content?tab=testimonials (CONT-03, PUB-03, D-05; plan 11-24): every testimonial, shown and hidden, in display
// order, with the start of the quote (clamped to 2 lines, so a 300 character quote never stretches its row; the whole quote is in the edit window,
// line-clamp-2 in testimonialQuoteClasses), the name over the team or role, the stars, its status and its row actions. Add Testimonial in the head
// opens the window.
//   - The list has its own loading, error and empty states, so it never blanks another tab.
//   - The order and which testimonials are on the Home page are the server's; the table only marks the first 3 shown rows (D-05).
//   - Move, Hide and Show save at once with no question (nothing is lost). While one of them saves, the pressed control is busy and every other
//     row action is aria-disabled, so they keep focus and ignore a press (WEB-09): one move changes the places of the other rows, and one
//     submission is in flight at a time. Focus then stays on the pressed control once the list has read again; a move that put the row at an end
//     leaves Move up or Move down aria-disabled, so focus goes to the other one.
//   - A polite line says where the moved testimonial is: "Testimonial from Ana Reyes moved to position 2 of 4."
//   - Delete asks first with Cancel focused and names the person and the start of the quote. Focus then goes to the Edit of the next row, else the
//     previous row, else Add Testimonial.
//   - A quote is rendered as text only (CWE-79): React escapes it, and nothing here accepts or renders HTML.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { useToast } from '@/components/feedback';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { mayHaveSaved } from '@/lib/forms/mayHaveSaved';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import {
  lineActionsClasses,
  testimonialHomeNoteClasses,
  testimonialNameClasses,
  testimonialPersonClasses,
  testimonialQuoteClasses,
  testimonialStarClasses,
  testimonialStarsClasses,
  testimonialStatusClasses,
  testimonialTeamClasses,
} from '@/modules/admin/components/siteContent.recipe';
import { TestimonialModal } from '@/modules/admin/components/TestimonialModal';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import {
  useDeleteTestimonial,
  useMoveTestimonial,
  useSetTestimonialShown,
  useTestimonialsQuery,
} from '@/modules/admin/hooks/useTestimonialQueries';
import type { MoveDirection, Testimonial } from '@/modules/admin/services/testimonialsService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import { describeHttpError, errorLine } from '@/utils/describeHttpError';

const COPY = SITE_CONTENT_COPY.testimonials;

/** The Home page shows the first 3 shown testimonials (D-05). */
const HOME_COUNT = 3;

/** How much of the quote the Delete question quotes. */
const QUOTE_START_MAX = 50;

/** The start of a quote for the Delete question: cut at 50 characters with an ellipsis, or the whole quote when it is short. */
function quoteStart(quote: string): string {
  const text = quote.trim();
  return text.length <= QUOTE_START_MAX ? text : `${text.slice(0, QUOTE_START_MAX).trimEnd()}…`;
}

/** The ids of the testimonials the Home page shows: the first 3 shown ones, in display order. */
function homeIdsOf(rows: readonly Testimonial[] | undefined): ReadonlySet<string> {
  return new Set(
    (rows ?? [])
      .filter((item) => item.isShown)
      .slice(0, HOME_COUNT)
      .map((item) => item.id),
  );
}

type Control = 'up' | 'down' | 'toggle';

/** The focus registry keys of a row's controls. */
type ControlName = Control | 'edit';
const controlKey = (control: ControlName, id: string): string => `${control}:${id}`;

/** The single-click action that is saving, or has saved and waits for the list to read again. */
interface Acting {
  id: string;
  /** The control that was pressed. */
  control: Control;
  /** After a move: the place the testimonial takes in the list (zero based). Unset until the move has gone through. */
  expectIndex?: number;
  /** After Hide or Show: whether the testimonial is then shown. Unset until it has gone through. */
  expectShown?: boolean;
  /** One value per press, kept when the action is copied: focus is moved once per press, never again by a later copy. */
  token: object;
  /** The list has been read again since the action went through. */
  settled: boolean;
}

/** True once the list shows what the successful action should have made of it: the testimonial in its new place, or shown or hidden. */
function isDone(action: Acting, rows: readonly Testimonial[] | undefined): boolean {
  const index = rows?.findIndex((item) => item.id === action.id) ?? -1;
  const item = rows?.[index];
  if (item === undefined) {
    return false;
  }
  if (action.expectIndex !== undefined) {
    return index === action.expectIndex;
  }
  return action.expectShown !== undefined && item.isShown === action.expectShown;
}

/**
 * The control that takes focus once the action is done: the one that was pressed, unless a move put the row at the end that control points to
 * (then it is aria-disabled, so focus goes to the other move button of the row).
 */
function focusTargetOf(action: Acting, rows: readonly Testimonial[]): string {
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
  press: (item: Testimonial, control: Control) => void;
  /** Opens the edit window. */
  edit: (item: Testimonial) => void;
  /** Opens the delete question. */
  remove: (item: Testimonial) => void;
  /** Remembers each row's controls, so focus can go back to them. */
  register: (key: string, element: HTMLElement | null) => void;
  /** How many testimonials the list holds, for the ends of the order. */
  total: number;
  /** The first row's index is 0: whether a row is at an end. */
  indexOf: (item: Testimonial) => number;
  /** The first 3 shown rows, which the Home page draws. */
  homeIds: ReadonlySet<string>;
}

function columns(wiring: RowWiring): readonly ResponsiveTableColumn<Testimonial>[] {
  return [
    {
      key: 'quote',
      header: COPY.table.quote,
      lead: true,
      cell: (item) => <span className={testimonialQuoteClasses}>{item.quote}</span>,
    },
    {
      key: 'name',
      header: COPY.table.name,
      cell: (item) => (
        <span className={testimonialPersonClasses}>
          <span className={testimonialNameClasses}>{item.name}</span>
          {item.teamOrRole !== null && item.teamOrRole !== '' && (
            <span className={testimonialTeamClasses}>{item.teamOrRole}</span>
          )}
        </span>
      ),
    },
    {
      key: 'stars',
      header: COPY.table.stars,
      cell: (item) => (
        <span className={testimonialStarsClasses}>
          <Icon name="star" size={16} className={testimonialStarClasses} />
          {COPY.stars(Number(item.stars))}
        </span>
      ),
    },
    {
      key: 'status',
      header: COPY.table.status,
      cell: (item) => (
        <span className={testimonialStatusClasses}>
          {item.isShown ? (
            <Badge tone="success" dot>
              {COPY.status.shown}
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              {COPY.status.hidden}
            </Badge>
          )}
          {wiring.homeIds.has(item.id) && <span className={testimonialHomeNoteClasses}>{COPY.onHome}</span>}
        </span>
      ),
    },
    {
      key: 'actions',
      header: COPY.table.actions,
      actions: true,
      // Five 36px buttons would cover the card title on a phone, so the actions sit under the other cells.
      flowActions: true,
      cell: (item) => {
        const index = wiring.indexOf(item);
        // While an action saves, the pressed control is busy and every other control is aria-disabled (WEB-09).
        const acting = wiring.acting !== null;
        const busyOf = (control: Control): boolean =>
          wiring.acting?.id === item.id && wiring.acting.control === control;
        const upLabel = COPY.rowActions.up(item.name);
        const downLabel = COPY.rowActions.down(item.name);
        const editLabel = COPY.rowActions.edit(item.name);
        const toggleLabel = item.isShown ? COPY.rowActions.hide(item.name) : COPY.rowActions.show(item.name);
        const removeLabel = COPY.rowActions.remove(item.name);
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
              icon="pencil"
              label={editLabel}
              title={editLabel}
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
              label={removeLabel}
              title={removeLabel}
              danger
              disabled={acting}
              onClick={() => {
                wiring.remove(item);
              }}
            />
          </RowActions>
        );
      },
    },
  ];
}

export function TestimonialsTab() {
  const toast = useToast();
  const query = useTestimonialsQuery();
  const { register, focusRow } = useRowFocus();
  const addRef = useRef<HTMLButtonElement>(null);
  const rows = query.data;
  const [acting, setActing] = useState<Acting | null>(null);
  // The polite line after a move.
  const [announcement, setAnnouncement] = useState('');
  const [adding, setAdding] = useState(false);
  // The testimonial the Edit window is open for, or was last open for (kept while it animates out).
  const [editing, setEditing] = useState<{ item: Testimonial; open: boolean } | null>(null);
  // The testimonial the Delete question is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ item: Testimonial; open: boolean } | null>(null);
  // The row whose Edit takes focus once the list shows it after a save.
  const focusAfterSave = useRef<string | null>(null);
  // Where focus goes once the deleted row has left the list: the Edit of another row, or Add Testimonial when it is null.
  const focusAfterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);

  // The action holds every row's controls until the list shows what it did, or has been read again after it.
  const holding = acting !== null && !acting.settled && !isDone(acting, rows) ? acting : null;
  const move = useMoveTestimonial();
  const toggle = useSetTestimonialShown();
  // The last action's focus has been moved already (so a later render of the same action does not move it again).
  const focused = useRef<object | null>(null);

  /** A refused or failed immediate action: a danger toast with the shared error line, and the list read again when it may have gone through. */
  const reportFailure = (item: Testimonial, control: Control, error: unknown): void => {
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

  /** Sends the action and, once it has gone through, says so and waits for the list to read again (the write's own refresh is already on its way). */
  const run = async (item: Testimonial, control: Control, token: object): Promise<void> => {
    const list = rows ?? [];
    const index = list.findIndex((candidate) => candidate.id === item.id);
    const outcome =
      control === 'toggle'
        ? await toggle.submit({ id: item.id, shown: !item.isShown })
        : await move.submit({ id: item.id, direction: control satisfies MoveDirection });
    if (!outcome.ok) {
      reportFailure(item, control, outcome.error);
      return;
    }
    if (control === 'toggle') {
      const shown = !item.isShown;
      toast.show(shown ? COPY.toast.shown : COPY.toast.hidden);
      setActing({ id: item.id, control, expectShown: shown, settled: false, token });
    } else {
      const expectIndex = control === 'up' ? index - 1 : index + 1;
      setAnnouncement(COPY.moved(item.name, expectIndex + 1, list.length));
      setActing({ id: item.id, control, expectIndex, settled: false, token });
    }
    void query.refetch({ cancelRefetch: false }).finally(() => {
      setActing((current) => (current?.id === item.id ? { ...current, settled: true } : current));
    });
  };

  /**
   * Starts Move up, Move down, or Hide or Show: every row's controls are aria-disabled from now until the list has read again, because one
   * move changes the places of the others and one submission is in flight at a time.
   */
  const press = (item: Testimonial, control: Control): void => {
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
  const neighbourOf = (item: Testimonial): string | null => {
    const list = rows ?? [];
    const index = list.findIndex((candidate) => candidate.id === item.id);
    return list[index + 1]?.id ?? list[index - 1]?.id ?? null;
  };

  const removal = useDeleteTestimonial({
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

  // Runs after every render: moves focus once the list holds what the last action expects.
  useEffect(() => {
    const saved = focusAfterSave.current;
    if (saved !== null && rows?.some((item) => item.id === saved) === true && !query.isFetching) {
      focusAfterSave.current = null;
      focusRow(controlKey('edit', saved));
    }
    const removed = focusAfterRemoval.current;
    if (removed !== null && rows !== undefined && !rows.some((item) => item.id === removed.removedId)) {
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
    edit: (item) => {
      setEditing({ item, open: true });
    },
    remove: (item) => {
      setDeleting({ item, open: true });
    },
    register,
    total: rows?.length ?? 0,
    indexOf: (item) => rows?.findIndex((candidate) => candidate.id === item.id) ?? -1,
    homeIds: homeIdsOf(rows),
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
        <ResponsiveTable<Testimonial>
          caption={COPY.table.caption}
          columns={columns(wiring)}
          rows={rows}
          rowKey={(item) => item.id}
          isInactive={(item) => !item.isShown}
          things={COPY.things}
          pending={query.isPending}
          failed={query.isError}
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
          emptyIcon="quote"
          emptyTitle={COPY.empty.title}
          emptyMessage={COPY.empty.message}
          emptyLevel={3}
          skeletonRows={3}
        />
      </SiteContentCard>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {announcement}
      </div>
      <TestimonialModal
        mode="add"
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        onSaved={(saved) => {
          focusAfterSave.current = saved.id;
        }}
      />
      <TestimonialModal
        mode="edit"
        open={editing?.open ?? false}
        testimonial={editing?.item ?? null}
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
          message={COPY.remove.message(deleting.item.name, quoteStart(deleting.item.quote))}
          confirmLabel={COPY.remove.confirm}
          pendingLabel={COPY.remove.pending}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
        />
      )}
    </>
  );
}
