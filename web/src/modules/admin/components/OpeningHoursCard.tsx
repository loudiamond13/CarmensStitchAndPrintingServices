// S2 Hours & Closures, card A "Opening hours" (CONT-01, PUB-03, OR-3, D-21, SEC-07; plan 11-16). One form of seven day rows, saved by one "Save Hours"
// with the week version it was opened with.
//   - A day is a checkbox (ticked = open). An open day has Opens and Closes selects every 30 minutes from 5:00 AM to 11:30 PM; a closed
//     day says Closed. A day that is ticked with no times of its own starts at 9:00 AM to 6:00 PM.
//   - Under the rows, "Visitors see" reads the current choices the way the website's footer does (summarizeOpenDays).
//   - Every rule the server checks is checked here first (hoursSchema, OR-3); nothing is sent while a rule is broken, and focus goes to the
//     first invalid select. A server 400 lands under the time it names and wins.
//   - The version a save sends is the one the form was opened with, never the live query data (SEC-07). A save that goes through shows the
//     toast, puts the saved week in the query cache and clears the public data held in this browser (invalidatePublicContent).
//   - A stale save (409 edit.stale) shows the shared ConflictBanner at the top of the card with every typed choice kept. Load Latest asks
//     "Discard changes?" first (08 D-58), then reads the week again and replaces the choices and the version (05 D-20).
//   - Undo Changes puts every day back to the saved week at once; it is aria-disabled while nothing changed.
//   - The card tells its tab whether the week differs from the saved one (`onDirtyChange`), so the page can ask before a tab change or a leave.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type Control, type Path, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Checkbox } from '@/components/entry';
import { useToast } from '@/components/feedback';
import { Select } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConfirmDialog } from '@/components/overlays';
import { ConflictBanner, ErrorState, LoadingRegion, SkeletonText } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { focusFirstInvalid } from '@/lib/forms/focusFirstInvalid';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import {
  hoursClosedCellClasses,
  hoursDayCellClasses,
  hoursListClasses,
  hoursPreviewClasses,
  hoursRowClasses,
} from '@/modules/admin/components/siteContent.recipe';
import { useOpeningHoursQuery, useUpdateOpeningHours } from '@/modules/admin/hooks/useOpeningHoursQuery';
import type { OpeningHours } from '@/modules/admin/services/openingHoursService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import {
  DEFAULT_CLOSES,
  DEFAULT_OPENS,
  HOURS_TIME_OPTIONS,
  hoursSchema,
  hoursValuesOf,
  sameWeek,
  toOpeningHoursRequest,
  weekOfValues,
  type HoursInput,
} from '@/modules/admin/siteContentSchemas';
import { describeHttpError } from '@/utils/describeHttpError';
import { formatTime, summarizeOpenDays } from '@/utils/hours';

const COPY = SITE_CONTENT_COPY.hours;

/** The machine code of a save made against an old edit version (SEC-07). */
const EDIT_STALE = 'edit.stale';

/** A time's key in the server's answer: `Days[6].ClosesAt`, by the day's place in the request (Monday first). */
const TIME_KEY = /^days\[(\d)\]\.(opensAt|closesAt)$/i;

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

type DayField = 'open' | 'opensAt' | 'closesAt';

/** The form path of one field of one day. */
function pathOf<F extends DayField>(index: number, field: F): `days.${number}.${F}` {
  return `days.${String(index)}.${field}` as `days.${number}.${F}`;
}

/** The form field a server error key belongs to (the server keys in its own casing), or null when this form draws no such field. */
function formPathOf(key: string): Path<HoursInput> | null {
  const match = TIME_KEY.exec(key);
  if (match?.[1] === undefined || match[2] === undefined) {
    return null;
  }
  return pathOf(Number(match[1]), match[2].toLowerCase() === 'opensat' ? 'opensAt' : 'closesAt');
}

/** The saved time is always one of the choices; a time the list does not hold (an old value) is kept as one more, in its place. */
function optionsFor(value: string): readonly { value: string; label: string }[] {
  if (value === '' || HOURS_TIME_OPTIONS.some((option) => option.value === value)) {
    return HOURS_TIME_OPTIONS;
  }
  return [...HOURS_TIME_OPTIONS, { value, label: formatTime(value) ?? value }].sort((a, b) =>
    a.value.localeCompare(b.value),
  );
}

interface TimeSelectProps {
  control: Control<HoursInput>;
  name: `days.${number}.opensAt` | `days.${number}.closesAt`;
  label: string;
  hiddenName: string;
}

/** One time select: the visible "Opens" or "Closes" for the eye, the day's own name ("Monday opens") for a screen reader. */
function TimeSelect({ control, name, label, hiddenName }: TimeSelectProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          label={
            <>
              <span aria-hidden="true">{label}</span>
              <span className={srOnlyClasses}>{hiddenName}</span>
            </>
          }
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          options={optionsFor(field.value)}
          error={fieldState.error?.message ?? ''}
        />
      )}
    />
  );
}

function DayRow({ form, index }: { form: UseFormReturn<HoursInput>; index: number }) {
  const { control, getValues, setValue } = form;
  const day = COPY.days[index] ?? '';
  const open = useWatch({ control, name: pathOf(index, 'open') });
  return (
    <div className={hoursRowClasses}>
      <div className={hoursDayCellClasses}>
        <Controller
          control={control}
          name={pathOf(index, 'open')}
          render={({ field }) => (
            <Checkbox
              label={day}
              name={field.name}
              checked={field.value}
              onChange={(checked) => {
                field.onChange(checked);
                if (checked && getValues(pathOf(index, 'opensAt')) === '') {
                  setValue(pathOf(index, 'opensAt'), DEFAULT_OPENS);
                }
                if (checked && getValues(pathOf(index, 'closesAt')) === '') {
                  setValue(pathOf(index, 'closesAt'), DEFAULT_CLOSES);
                }
              }}
            />
          )}
        />
      </div>
      {open ? (
        <>
          <TimeSelect
            control={control}
            name={pathOf(index, 'opensAt')}
            label={COPY.opens.label}
            hiddenName={COPY.opens.name(day)}
          />
          <TimeSelect
            control={control}
            name={pathOf(index, 'closesAt')}
            label={COPY.closes.label}
            hiddenName={COPY.closes.name(day)}
          />
        </>
      ) : (
        <span className={hoursClosedCellClasses}>{COPY.closed}</span>
      )}
    </div>
  );
}

/** Every field of every day, so the week is read as plain values (never a row object that React Hook Form changes in place). */
const WEEK_FIELDS = DAY_INDEXES.flatMap((index) => [
  pathOf(index, 'open'),
  pathOf(index, 'opensAt'),
  pathOf(index, 'closesAt'),
]);

/** The week as the form holds it right now. */
function useWeek(control: Control<HoursInput>): HoursInput {
  const fields = useWatch({ control, name: WEEK_FIELDS });
  return {
    days: DAY_INDEXES.map((index) => ({
      day: index + 1,
      open: fields[index * 3] === true,
      opensAt: String(fields[index * 3 + 1] ?? ''),
      closesAt: String(fields[index * 3 + 2] ?? ''),
    })),
  };
}

/** "Visitors see: Mon-Sat · 9:00 AM - 6:00 PM", one line for each run of open days. */
function HoursPreview({ week }: { week: HoursInput }) {
  const lines = summarizeOpenDays(weekOfValues(week));
  return (
    <div className={hoursPreviewClasses}>
      {lines.length === 0 ? (
        <p>{COPY.previewClosed}</p>
      ) : (
        lines.map((line, position) => <p key={line}>{position === 0 ? COPY.preview(line) : line}</p>)
      )}
    </div>
  );
}

/** The latest week from the server, or why it could not be read. */
type ReloadResult = { readonly hours: OpeningHours } | { readonly error: unknown };

interface OpeningHoursFormProps {
  hours: OpeningHours;
  onDirtyChange: ((dirty: boolean) => void) | undefined;
  /** Reads the week from the server again (Load Latest). */
  reload: () => Promise<ReloadResult>;
}

function OpeningHoursForm({ hours, onDirtyChange, reload }: OpeningHoursFormProps) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  // The week version this form was opened with: changed only by a save of this form or by Load Latest.
  const [version, setVersion] = useState(hours.version);
  // What the form was last saved or opened with: the week "unsaved" is measured against, and what Undo Changes goes back to.
  const [baseline, setBaseline] = useState(() => hoursValuesOf(hours));
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [asking, setAsking] = useState(false);
  // The polite line read out after Load Latest.
  const [status, setStatus] = useState('');
  // Counts the times focus should move to the first flagged field once its message is on screen.
  const [focusTick, setFocusTick] = useState(0);
  const form = useForm<HoursInput>({
    resolver: zodResolver(hoursSchema),
    mode: 'onBlur',
    defaultValues: baseline,
  });
  const { control, handleSubmit, reset, setError } = form;
  const week = useWeek(control);
  const dirty = !sameWeek(week, baseline);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  // A tab that closes leaves nothing unsaved behind.
  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );
  useEffect(() => {
    if (focusTick > 0 && formRef.current !== null) {
      focusFirstInvalid(formRef.current);
    }
  }, [focusTick]);

  const { submit, pending } = useUpdateOpeningHours({
    onSuccess: (saved) => {
      const savedValues = hoursValuesOf(saved);
      setVersion(saved.version);
      setBaseline(savedValues);
      setConflicts(0);
      reset(savedValues);
      toast.show({ title: COPY.toast.title, message: COPY.toast.message });
    },
    onFailure: (copy, error) => {
      if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
        setConflicts((count) => count + 1);
        return;
      }
      if (isHttpError(error) && error.status === 400) {
        let placed = 0;
        let other: string | undefined;
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          const message = messages[0];
          if (message === undefined) {
            continue;
          }
          const path = formPathOf(key);
          if (path === null) {
            other ??= message;
          } else {
            setError(path, { type: 'server', message });
            placed += 1;
          }
        }
        if (placed > 0) {
          setFocusTick((tick) => tick + 1);
          return;
        }
        // No shown time matches: say what the server said.
        toast.show({ tone: 'danger', title: other ?? copy.title, message: other === undefined ? copy.body : '' });
        return;
      }
      toast.show({ tone: 'danger', title: copy.title, message: copy.body });
    },
  });

  /** Load Latest, once the person has agreed to lose what was chosen: the choices are replaced only when the latest week has arrived. */
  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const result = await reload();
    setLoadingLatest(false);
    if ('error' in result) {
      const copy = describeHttpError(result.error);
      if (copy !== null) {
        toast.show({ tone: 'danger', title: copy.title, message: copy.body });
      }
      return;
    }
    const latest = hoursValuesOf(result.hours);
    setVersion(result.hours.version);
    setBaseline(latest);
    setConflicts(0);
    reset(latest);
    setStatus(COPY.latestLoaded);
    formRef.current?.querySelector<HTMLElement>('input')?.focus();
  };

  const onValid = async (values: HoursInput): Promise<void> => {
    await submit(toOpeningHoursRequest(values, version));
  };

  return (
    <>
      <form
        ref={formRef}
        noValidate
        onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
          void handleSubmit(onValid, () => {
            setFocusTick((tick) => tick + 1);
          })(event);
        }}
      >
        <SiteContentCard
          title={COPY.card.title}
          hint={COPY.card.hint}
          footer={
            <>
              <Button
                variant="secondary"
                aria-disabled={!dirty || pending}
                onClick={() => {
                  if (dirty && !pending) {
                    reset(baseline);
                  }
                }}
              >
                {COPY.actions.undo}
              </Button>
              <Button type="submit" variant="primary" icon="check" pending={pending}>
                {pending ? COPY.actions.saving : COPY.actions.save}
              </Button>
            </>
          }
        >
          {conflicts > 0 && (
            <ConflictBanner
              key={conflicts}
              pending={loadingLatest}
              onLoadLatest={() => {
                setAsking(true);
              }}
            />
          )}
          <div className={hoursListClasses}>
            {DAY_INDEXES.map((index) => (
              <DayRow key={index} form={form} index={index} />
            ))}
          </div>
          <HoursPreview week={week} />
        </SiteContentCard>
      </form>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {status}
      </div>
      <ConfirmDialog
        open={asking}
        title={SITE_CONTENT_COPY.discard.title}
        message={SITE_CONTENT_COPY.discard.loadLatestMessage}
        cancelLabel={SITE_CONTENT_COPY.discard.keep}
        confirmLabel={SITE_CONTENT_COPY.discard.discard}
        onConfirm={() => {
          setAsking(false);
          void loadLatest();
        }}
        onCancel={() => {
          setAsking(false);
        }}
      />
    </>
  );
}

/** The card as grey blocks while the first answer is on its way. */
function OpeningHoursSkeleton() {
  return (
    <SiteContentCard title={COPY.card.title} hint={COPY.card.hint}>
      <SkeletonText lines={3} />
    </SiteContentCard>
  );
}

export interface OpeningHoursCardProps {
  /** Called with true while the week differs from the saved one, and with false when the card closes. */
  onDirtyChange?: ((dirty: boolean) => void) | undefined;
}

export function OpeningHoursCard({ onDirtyChange }: OpeningHoursCardProps) {
  const query = useOpeningHoursQuery();
  const hours = query.data;
  const reload = async (): Promise<ReloadResult> => {
    const result = await query.refetch();
    return result.isError || result.data === undefined ? { error: result.error } : { hours: result.data };
  };
  let content;
  if (hours !== undefined) {
    content = <OpeningHoursForm hours={hours} onDirtyChange={onDirtyChange} reload={reload} />;
  } else if (query.isError) {
    content = (
      <SiteContentCard title={COPY.card.title} hint={COPY.card.hint}>
        <ErrorState
          things={COPY.things}
          error={query.error}
          align="start"
          onRetry={() => {
            void query.refetch();
          }}
        />
      </SiteContentCard>
    );
  } else {
    content = <OpeningHoursSkeleton />;
  }
  return (
    <LoadingRegion loading={query.isPending} failed={query.isError} things={COPY.things}>
      {content}
    </LoadingRegion>
  );
}
