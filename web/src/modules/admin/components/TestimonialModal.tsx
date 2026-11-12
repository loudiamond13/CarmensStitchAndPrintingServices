// SPEC-GAP: testimonials
// S5 TestimonialModal. The window that adds or edits one testimonial (CONT-03, D-05, OR-3, SEC-06, SEC-07; plan 11-24): Quote, Name, Team or
// role, the Stars group and "Show on the website", saved by "Save Testimonial".
//   - The rules the server checks are checked here first with its own words (testimonialSchema, OR-3). The quote is sent as typed, trimmed at
//     both ends; the words inside it are never changed.
//   - An add sends one Idempotency-Key per submission and starts with 5 stars and Show on the website ticked. An edit sends the version the window
//     was opened with and no key; a stale save keeps every typed value behind the ConflictBanner, and Load Latest reads the list again and
//     replaces the values and the version (05 D-20).
//   - A changed window asks "Discard changes?" before it closes (08 D-58); nothing closes while a save runs. Each open starts clean: the form
//     lives in a part that is mounted again on every open.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Checkbox, RadioGroup } from '@/components/entry';
import { useToast } from '@/components/feedback';
import { Field, messageClasses } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConfirmDialog, Modal } from '@/components/overlays';
import { ConflictBanner } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { focusFirstInvalid } from '@/lib/forms/focusFirstInvalid';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { expensesModalBodyClasses } from '@/modules/admin/components/expenses.recipe';
import {
  useCreateTestimonial,
  useReadTestimonialsAgain,
  useUpdateTestimonial,
} from '@/modules/admin/hooks/useTestimonialQueries';
import type { Testimonial } from '@/modules/admin/services/testimonialsService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import {
  testimonialSchema,
  testimonialValuesOf,
  toTestimonialRequest,
  type TestimonialInput,
} from '@/modules/admin/siteContentSchemas';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const COPY = SITE_CONTENT_COPY.testimonials;

/** The machine code of a save made against an old edit version (SEC-07). */
const EDIT_STALE = 'edit.stale';

/** The text fields a server message can land under, in the order they show. */
const FIELD_ORDER = ['quote', 'name', 'teamOrRole'] as const;

/** The stars as the group offers them: 5 stars first, then down to 1 star. */
const STAR_OPTIONS = [5, 4, 3, 2, 1].map((count) => ({ value: String(count), label: COPY.stars(count) }));

interface TestimonialModalCommon {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc and the scrim (after the discard question; never while a save runs), and after a save. */
  onClose: () => void;
  /** The testimonial was saved; the list reads again and the window has shown its toast. */
  onSaved: (saved: Testimonial) => void;
}

export interface AddTestimonialModalProps extends TestimonialModalCommon {
  mode: 'add';
}

export interface EditTestimonialModalProps extends TestimonialModalCommon {
  mode: 'edit';
  /** The testimonial to edit, as the list holds it. Null renders nothing (the window was never opened). */
  testimonial: Testimonial | null;
}

export type TestimonialModalProps = AddTestimonialModalProps | EditTestimonialModalProps;

export function TestimonialModal({ open = true, ...props }: TestimonialModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  const testimonial = props.mode === 'edit' ? props.testimonial : null;
  if (props.mode === 'edit' && testimonial === null) {
    return null;
  }
  return (
    <TestimonialForm
      key={`${props.mode}-${String(opens)}`}
      testimonial={testimonial}
      open={open}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

interface TestimonialFormProps {
  /** The testimonial being edited; null in add mode. */
  testimonial: Testimonial | null;
  open: boolean;
  onClose: () => void;
  onSaved: (saved: Testimonial) => void;
}

function TestimonialForm({ testimonial, open, onClose, onSaved }: TestimonialFormProps) {
  const isEdit = testimonial !== null;
  const toast = useToast();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const readAgain = useReadTestimonialsAgain();
  // The testimonial the form was opened with; the version a save sends is this one's, whatever a later read of the list brings.
  const [opened, setOpened] = useState<Testimonial | null>(testimonial);
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
    reset,
    setError,

    formState: { isDirty },
  } = useForm<TestimonialInput>({
    resolver: zodResolver(testimonialSchema),
    mode: 'onBlur',
    defaultValues: testimonialValuesOf(opened),
  });

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
      // No rendered field matches (the stars group shows no message of its own): say what the server said.
      setFailure(Object.values(error.fieldErrors)[0]?.[0] ?? errorLine(copy));
      saveRef.current?.focus();
      return;
    }
    setFailure(errorLine(copy));
    saveRef.current?.focus();
  };

  const finished = (saved: Testimonial): void => {
    toast.show(isEdit ? COPY.toast.saved : COPY.toast.added);
    onSaved(saved);
    onClose();
  };
  const adding = useCreateTestimonial({ onSuccess: finished, onFailure: showFailure });
  const editing = useUpdateTestimonial({ onSuccess: finished, onFailure: showFailure });
  const pending = adding.pending || editing.pending;

  const onValid = async (values: TestimonialInput): Promise<void> => {
    setFailure(null);
    if (opened === null) {
      await adding.submit(toTestimonialRequest(values, null));
    } else {
      await editing.submit({ id: opened.id, body: toTestimonialRequest(values, opened.version) });
    }
  };

  /** Load Latest: after a stale save, the banner's button. The typed values are replaced only once the latest version has arrived. */
  const loadLatest = async (): Promise<void> => {
    if (opened === null) {
      return;
    }
    setLoadingLatest(true);
    let latest: Testimonial | undefined;
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
    reset(testimonialValuesOf(latest));
    setConflicts(0);
    setFailure(null);
    setStatus(COPY.window.latestLoaded);
    const field = formRef.current?.elements.namedItem('quote');
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
            name="quote"
            render={({ field, fieldState }) => (
              <Field
                multiline
                rows={4}
                label={COPY.window.quote.label}
                hint={COPY.window.quote.hint}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.window.name.label}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                autoComplete="off"
                required
              />
            )}
          />
          <Controller
            control={control}
            name="teamOrRole"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.window.team.label}
                placeholder={COPY.window.team.placeholder}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                autoComplete="off"
              />
            )}
          />
          <Controller
            control={control}
            name="stars"
            render={({ field }) => (
              <RadioGroup
                legend={COPY.window.stars}
                name="stars"
                value={field.value}
                onChange={field.onChange}
                options={STAR_OPTIONS}
              />
            )}
          />
          <Controller
            control={control}
            name="isShown"
            render={({ field }) => (
              <Checkbox label={COPY.window.show} checked={field.value} onChange={field.onChange} />
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
