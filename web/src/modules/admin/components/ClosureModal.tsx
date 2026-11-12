// SPEC-GAP: S2 ClosureModal. The window that adds or edits one closure (CONT-04, OR-3, SEC-06, SEC-07, D-22; plan 11-16): First day, Last day and
// a Public note, saved by "Save Closure".
//   - First day starts on the business today from the server (useBusinessToday), never this device's clock. The rules the server checks are
//     checked here first with its own words (closureSchema, OR-3); an overlap with another closure is the one rule only the server can check,
//     and its line lands under First day.
//   - An add sends one Idempotency-Key per submission. An edit sends the version the window was opened with and no key; a stale save keeps
//     every typed value behind the ConflictBanner, and Load Latest reads the list again and replaces the values and the version (05 D-20).
//   - A changed window asks "Discard changes?" before it closes (08 D-58); nothing closes while a save runs. Each open starts clean: the
//     form lives in a part that is mounted again on every open.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { useToast } from '@/components/feedback';
import { DateInput, Field, messageClasses } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConfirmDialog, Modal } from '@/components/overlays';
import { ConflictBanner } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { focusFirstInvalid } from '@/lib/forms/focusFirstInvalid';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { expensesModalBodyClasses } from '@/modules/admin/components/expenses.recipe';
import { useBusinessToday } from '@/modules/admin/hooks/useBusinessToday';
import {
  useCreateShopClosure,
  useReadClosuresAgain,
  useUpdateShopClosure,
} from '@/modules/admin/hooks/useShopClosuresQuery';
import type { ShopClosure } from '@/modules/admin/services/shopClosuresService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import {
  closureSchema,
  closureValuesOf,
  toClosureRequest,
  type ClosureInput,
} from '@/modules/admin/siteContentSchemas';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const COPY = SITE_CONTENT_COPY.closures;

/** The machine code of a save made against an old edit version (SEC-07). */
const EDIT_STALE = 'edit.stale';

const FIELD_ORDER = ['firstDay', 'lastDay', 'note'] as const;

interface ClosureModalCommon {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc and the scrim (after the discard question; never while a save runs), and after a save. */
  onClose: () => void;
  /** The closure was saved; the list reads again and the page shows its toast. */
  onSaved: (saved: ShopClosure) => void;
}

export interface AddClosureModalProps extends ClosureModalCommon {
  mode: 'add';
}

export interface EditClosureModalProps extends ClosureModalCommon {
  mode: 'edit';
  /** The closure to edit, as the list holds it. Null renders nothing (the window was never opened). */
  closure: ShopClosure | null;
}

export type ClosureModalProps = AddClosureModalProps | EditClosureModalProps;

export function ClosureModal({ open = true, ...props }: ClosureModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  const closure = props.mode === 'edit' ? props.closure : null;
  if (props.mode === 'edit' && closure === null) {
    return null;
  }
  return (
    <ClosureForm
      key={`${props.mode}-${String(opens)}`}
      closure={closure}
      open={open}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

interface ClosureFormProps {
  /** The closure being edited; null in add mode. */
  closure: ShopClosure | null;
  open: boolean;
  onClose: () => void;
  onSaved: (saved: ShopClosure) => void;
}

function ClosureForm({ closure, open, onClose, onSaved }: ClosureFormProps) {
  const isEdit = closure !== null;
  const toast = useToast();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const today = useBusinessToday(open);
  const readAgain = useReadClosuresAgain();
  // The closure the form was opened with; the version a save sends is this one's, whatever a later read of the list brings.
  const [opened, setOpened] = useState<ShopClosure | null>(closure);
  // The one line above the fields for a failure that belongs to no field.
  const [failure, setFailure] = useState<string | null>(null);
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  // The polite line read out after Load Latest.
  const [status, setStatus] = useState('');
  const [asking, setAsking] = useState(false);
  // Counts the times focus should move to the first flagged field once its message is on screen.
  const [focusTick, setFocusTick] = useState(0);
  const {
    control,
    handleSubmit,
    getValues,
    reset,
    setError,

    formState: { isDirty },
  } = useForm<ClosureInput>({
    resolver: zodResolver(closureSchema(today, opened?.firstDay ?? null)),
    mode: 'onBlur',
    defaultValues: closureValuesOf(opened, today),
  });
  const firstDay = useWatch({ control, name: 'firstDay' });

  // The business today arrives after the window opened: an add that has no first day yet starts on it, and that is not a change.
  useEffect(() => {
    if (!isEdit && today !== null && getValues('firstDay') === '') {
      reset(closureValuesOf(null, today));
    }
  }, [isEdit, today, getValues, reset]);
  useEffect(() => {
    if (focusTick > 0 && formRef.current !== null) {
      focusFirstInvalid(formRef.current);
    }
  }, [focusTick]);

  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    // 05 D-20: a stale save keeps every typed value; the banner offers Load Latest, which takes focus.
    if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
      setConflicts((count) => count + 1);
      return;
    }
    if (isHttpError(error) && error.status === 404) {
      setFailure(COPY.window.gone);
      void readAgain().catch(() => undefined);
      saveRef.current?.focus();
      return;
    }
    if (isHttpError(error) && error.status === 400) {
      let placed = false;
      for (const field of FIELD_ORDER) {
        const message = serverFieldMessage(error.fieldErrors, field);
        if (message !== undefined) {
          setError(field, { type: 'server', message });
          placed = true;
        }
      }
      if (placed) {
        setFocusTick((tick) => tick + 1);
        return;
      }
      // No rendered field matches: say what the server said.
      setFailure(Object.values(error.fieldErrors)[0]?.[0] ?? errorLine(copy));
      saveRef.current?.focus();
      return;
    }
    setFailure(errorLine(copy));
    saveRef.current?.focus();
  };

  const finished = (saved: ShopClosure): void => {
    onSaved(saved);
    onClose();
  };
  const adding = useCreateShopClosure({ onSuccess: finished, onFailure: showFailure });
  const editing = useUpdateShopClosure({ onSuccess: finished, onFailure: showFailure });
  const pending = adding.pending || editing.pending;

  const onValid = async (values: ClosureInput): Promise<void> => {
    setFailure(null);
    if (opened === null) {
      await adding.submit(toClosureRequest(values, null));
    } else {
      await editing.submit({ id: opened.id, body: toClosureRequest(values, opened.version) });
    }
  };

  /** Load Latest: after a stale save, the banner's button. The typed values are replaced only once the latest version has arrived. */
  const loadLatest = async (): Promise<void> => {
    if (opened === null) {
      return;
    }
    setLoadingLatest(true);
    let latest: ShopClosure | undefined;
    try {
      latest = (await readAgain()).find((candidate) => candidate.id === opened.id);
    } catch (error: unknown) {
      setLoadingLatest(false);
      const copy = describeHttpError(error);
      if (copy !== null) {
        toast.show({ tone: 'danger', title: copy.title, message: copy.body });
      }
      return;
    }
    setLoadingLatest(false);
    if (latest === undefined) {
      setConflicts(0);
      setFailure(COPY.window.gone);
      return;
    }
    setOpened(latest);
    reset(closureValuesOf(latest, today));
    setConflicts(0);
    setFailure(null);
    setStatus(COPY.window.latestLoaded);
    const field = formRef.current?.elements.namedItem('firstDay');
    if (field instanceof HTMLElement) {
      field.focus();
    }
  };

  // D-58: a changed window asks before it drops what was typed; nothing closes while a save runs.
  const requestClose = (): void => {
    if (pending) {
      return;
    }
    if (isDirty) {
      setAsking(true);
      return;
    }
    onClose();
  };

  const title = isEdit ? COPY.window.editTitle : COPY.window.addTitle;
  return (
    <>
      <Modal
        open={open}
        title={title}
        onClose={requestClose}
        loading={pending}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose}>
              {COPY.window.cancel}
            </Button>
            <Button variant="primary" type="submit" form={formId} icon="check" pending={pending} ref={saveRef}>
              {pending ? COPY.window.saving : COPY.window.save}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          ref={formRef}
          noValidate
          className={expensesModalBodyClasses}
          onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
            void handleSubmit(onValid, () => {
              setFocusTick((tick) => tick + 1);
            })(event);
          }}
        >
          {conflicts > 0 && (
            <ConflictBanner
              key={conflicts}
              pending={loadingLatest}
              onLoadLatest={() => {
                void loadLatest();
              }}
            />
          )}
          {failure !== null && (
            <p className={messageClasses({ error: true })} role="alert">
              <Icon name="triangle-alert" size={14} />
              {failure}
            </p>
          )}
          <Controller
            control={control}
            name="firstDay"
            render={({ field, fieldState }) => (
              <DateInput
                label={COPY.window.firstDay}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                {...(isEdit || today === null ? {} : { min: today })}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="lastDay"
            render={({ field, fieldState }) => (
              <DateInput
                label={COPY.window.lastDay}
                hint={COPY.window.lastDayHint}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                {...(isCalendarDate(firstDay) ? { min: firstDay } : {})}
              />
            )}
          />
          <Controller
            control={control}
            name="note"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.window.note}
                hint={COPY.window.noteHint}
                placeholder={COPY.window.notePlaceholder}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                autoComplete="off"
              />
            )}
          />
          <div role="status" aria-live="polite" className={srOnlyClasses}>
            {status}
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={asking}
        title={COPY.discard.title}
        message={COPY.discard.message}
        cancelLabel={COPY.discard.keep}
        confirmLabel={COPY.discard.discard}
        onCancel={() => {
          setAsking(false);
        }}
        onConfirm={() => {
          setAsking(false);
          onClose();
        }}
      />
    </>
  );
}
