// S2 Hours & Closures, card A "Opening hours" (CONT-01, PUB-03, OR-3, D-21; plan 11-16). One form of seven day rows, saved by one "Save Hours"
// with the week version it was opened with.
//   - A day is a checkbox (ticked = open). An open day has Opens and Closes selects every 30 minutes from 5:00 AM to 11:30 PM; a closed
//     day says Closed. A day that is ticked with no times of its own starts at 9:00 AM to 6:00 PM.
//   - Under the rows, "Visitors see" reads the current choices the way the website's footer does (summarizeOpenDays).
//   - Every rule the server checks is checked here first (hoursSchema, OR-3); nothing is sent while a rule is broken, and focus goes to the
//     first invalid select.
//   - The version a save sends is the one the form was opened with, never the live query data (SEC-07). A save that goes through shows the
//     toast, puts the saved week in the query cache and clears the public data held in this browser (invalidatePublicContent).
//   - The card tells its tab whether the week differs from the saved one (`onDirtyChange`), so the page can ask before a tab change or a leave.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type Control, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Checkbox } from '@/components/entry';
import { useToast } from '@/components/feedback';
import { Select } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { LoadingRegion, SkeletonText } from '@/components/states';
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
import { formatTime, summarizeOpenDays } from '@/utils/hours';

const COPY = SITE_CONTENT_COPY.hours;

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

type DayField = 'open' | 'opensAt' | 'closesAt';

/** The form path of one field of one day. */
function pathOf<F extends DayField>(index: number, field: F): `days.${number}.${F}` {
  return `days.${String(index)}.${field}` as `days.${number}.${F}`;
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

interface OpeningHoursFormProps {
  hours: OpeningHours;
  onDirtyChange: ((dirty: boolean) => void) | undefined;
}

function OpeningHoursForm({ hours, onDirtyChange }: OpeningHoursFormProps) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  // The week version this form was opened with: changed only by a save of this form.
  const [version, setVersion] = useState(hours.version);
  // What the form was last saved or opened with: the week "unsaved" is measured against.
  const [baseline, setBaseline] = useState(() => hoursValuesOf(hours));
  // Counts the times focus should move to the first flagged field once its message is on screen.
  const [focusTick, setFocusTick] = useState(0);
  const form = useForm<HoursInput>({
    resolver: zodResolver(hoursSchema),
    mode: 'onBlur',
    defaultValues: baseline,
  });
  const { control, handleSubmit, reset } = form;
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
      reset(savedValues);
      toast.show({ title: COPY.toast.title, message: COPY.toast.message });
    },
    onFailure: (copy) => {
      toast.show({ tone: 'danger', title: copy.title, message: copy.body });
    },
  });

  const onValid = async (values: HoursInput): Promise<void> => {
    await submit(toOpeningHoursRequest(values, version));
  };

  return (
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
          <Button type="submit" variant="primary" icon="check" pending={pending}>
            {pending ? COPY.actions.saving : COPY.actions.save}
          </Button>
        }
      >
        <div className={hoursListClasses}>
          {DAY_INDEXES.map((index) => (
            <DayRow key={index} form={form} index={index} />
          ))}
        </div>
        <HoursPreview week={week} />
      </SiteContentCard>
    </form>
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
  return (
    <LoadingRegion loading={query.isPending} failed={query.isError} things={COPY.things}>
      {hours === undefined ? (
        <OpeningHoursSkeleton />
      ) : (
        <OpeningHoursForm hours={hours} onDirtyChange={onDirtyChange} />
      )}
    </LoadingRegion>
  );
}
