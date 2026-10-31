// SPEC-GAP: S2 CategoryModal. One modal for every Settings list (plan 08-08): a `config` names the list's words, schema and calls, and
// defaults to the company expense categories. S2 Category modal, add and edit modes (UI-SPEC "S2 Category modal"; D-08, D-12, D-13, OQ-6, OR-3, SEC-07; plan
// 06-17). A Name and a Badge color: six native radios, each named by a color word and described by a live CategoryBadge of the typed name
// (or "Sample"), so color is never the only cue. Edit also shows RecordMeta. Every rule is checked in the browser first
// (categoryFormSchema); a rule only the server can check (a duplicate name, the Others rename) comes back under Name. A failure that
// belongs to no field shows one alert line above the fields and keeps the typed values. While the request runs, Esc, the scrim and
// Cancel do nothing (WEB-09), and the one Idempotency-Key of an add is kept for a retry. Each open starts clean: the form lives in a
// part that is mounted again on every open.
//   - Edit reads the category fresh on every open (SkeletonText in a LoadingRegion, then focus on Name). The form keeps the row version
//     it opened with and sends it with Save Changes; a refetch never replaces it (05 D-13, D-20). Only the edit save sends a version.
//   - A 409 keeps every typed value and shows the ConflictBanner: Load Latest reads the category again, replaces the values and the
//     version, and moves the cursor to Name.
//   - Others (OQ-6) keeps its name: the Name is read-only (readOnly, so it stays readable and focusable) with a hint, and focus opens on
//     the chosen color. Its color may change.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { RadioGroup, type RadioOption } from '@/components/entry';
import { Field, messageClasses } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { Modal } from '@/components/overlays';
import { ConflictBanner, ErrorState, LoadingRegion, SkeletonText } from '@/components/states';
import { CATEGORY_TONE_LABEL, CATEGORY_TONES } from '@/components/status';
import { RecordMeta } from '@/components/data';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { expensesModalBodyClasses } from '@/modules/admin/components/expenses.recipe';
import { CATEGORY_NAME_MAX, type CategoryFormInput, type CategoryFormValues } from '@/modules/admin/categorySchemas';
import { useListEntryQuery } from '@/modules/admin/hooks/useListEntryQuery';
import { LIST_SETTINGS, type ListEntryDetail, type ListSettingsConfig } from '@/modules/admin/listSettingsConfigs';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const EDIT_STALE = 'edit.stale';
/** The tone a new category starts with: Taupe. */
const DEFAULT_TONE = 'neutral';

const FIELD_ORDER = ['name', 'tone'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

/** What the page needs to know about a saved category: both the add and the edit answer carry these. */
export interface SavedCategory {
  readonly id: string;
  readonly name: string;
}

interface CategoryModalCommon {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the modal: Cancel, Esc and the scrim (never while a request runs), and after a save. */
  onClose: () => void;
  /** The category was saved. */
  onSaved: (category: SavedCategory) => void;
  /** Which list the modal serves: its words, schema and calls. Default: the company expense categories (Phase 6). */
  config?: ListSettingsConfig;
}

export interface AddCategoryModalProps extends CategoryModalCommon {
  mode: 'add';
}

export interface EditCategoryModalProps extends CategoryModalCommon {
  mode: 'edit';
  /** Which category to edit. Null renders nothing (the modal was never opened). */
  categoryId: string | null;
}

export type CategoryModalProps = AddCategoryModalProps | EditCategoryModalProps;

export function CategoryModal({
  open = true,
  config = LIST_SETTINGS['expense-categories'],
  ...props
}: CategoryModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  const categoryId = props.mode === 'edit' ? props.categoryId : null;
  if (props.mode === 'edit' && categoryId === null) {
    return null;
  }
  return (
    <CategoryForm
      key={`${props.mode}-${String(opens)}`}
      config={config}
      mode={props.mode}
      categoryId={categoryId}
      open={open}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

/** What the edit form shows for a saved category: every control is text. */
function valuesOf(category: ListEntryDetail): CategoryFormInput {
  return { name: category.name, tone: category.tone };
}

interface CategoryFormProps {
  config: ListSettingsConfig;
  mode: 'add' | 'edit';
  /** The category being edited; null in add mode. */
  categoryId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: (category: SavedCategory) => void;
}

function CategoryForm({ config, mode, categoryId, open, onClose, onSaved }: CategoryFormProps) {
  const isEdit = mode === 'edit';
  const FORM = config.words.modal;
  const ADD = FORM.add;
  const EDIT = FORM.edit;
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const query = useListEntryQuery(config.list, categoryId, open && isEdit);
  // The category the form was filled from; the version a save sends is this one's, whatever a later refetch brings.
  const [opened, setOpened] = useState<ListEntryDetail | null>(null);
  const fresh = isEdit && query.isSuccess && query.isFetchedAfterMount ? query.data : null;
  if (opened === null && fresh !== null) {
    setOpened(fresh);
  }
  // The one line above the fields for a failure that belongs to no field.
  const [failure, setFailure] = useState<string | null>(null);
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  // The polite line read out after Load Latest.
  const [status, setStatus] = useState('');
  const { control, handleSubmit, setError, reset } = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(config.schema),
    mode: 'onBlur',
    defaultValues: { name: '', tone: DEFAULT_TONE },
    ...(opened === null ? {} : { values: valuesOf(opened) }),
  });

  const name = useWatch({ control, name: 'name' });
  const loaded = !isEdit || opened !== null;
  const loadFailed = isEdit && query.isError && opened === null;
  const isOthers = opened?.isOthers === true;

  const focusField = (field: FieldName): void => {
    const element =
      field === 'name'
        ? formRef.current?.elements.namedItem('name')
        : formRef.current?.querySelector('input[name="tone"]:checked');
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  // The category has arrived: the cursor goes to Name, or to the saved color for Others, whose name cannot change.
  useEffect(() => {
    if (!isEdit || opened === null) {
      return;
    }
    if (opened.isOthers) {
      const saved = [...(formRef.current?.querySelectorAll<HTMLInputElement>('input[name="tone"]') ?? [])].find(
        (radio) => radio.value === opened.tone,
      );
      if (saved !== undefined) {
        saved.focus();
        return;
      }
    }
    const nameField = formRef.current?.elements.namedItem('name');
    if (nameField instanceof HTMLElement) {
      nameField.focus();
    }
  }, [isEdit, opened]);

  const showLine = (text: string): void => {
    setFailure(text);
    saveRef.current?.focus();
  };

  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    // 05 D-20: a stale save keeps every typed value; the banner offers Load Latest, which takes focus.
    if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
      setConflicts((count) => count + 1);
      return;
    }
    if (isHttpError(error) && error.status === 400) {
      let first: FieldName | null = null;
      for (const field of FIELD_ORDER) {
        const message = serverFieldMessage(error.fieldErrors, field);
        if (message !== undefined) {
          setError(field, { type: 'server', message });
          first ??= field;
        }
      }
      if (first !== null) {
        focusField(first);
        return;
      }
      // No rendered field matches: say what the server said.
      showLine(Object.values(error.fieldErrors)[0]?.[0] ?? errorLine(copy));
      return;
    }
    showLine(errorLine(copy));
  };

  const submission = useSubmission<CategoryFormValues, SavedCategory>(
    (key, values) => {
      if (!isEdit) {
        return config.service.create({ name: values.name, tone: values.tone }, key);
      }
      if (opened === null || categoryId === null) {
        return Promise.reject(new Error('The category is not loaded.'));
      }
      return config.service.update(categoryId, {
        name: values.name,
        tone: values.tone,
        version: opened.version,
      });
    },
    {
      onSuccess: (saved) => {
        onSaved({ id: saved.id, name: saved.name });
        onClose();
      },
      onFailure: showFailure,
    },
  );
  const { submit, pending } = submission;

  const onValid = async (values: CategoryFormValues): Promise<void> => {
    setFailure(null);
    await submit(values);
  };

  const onInvalid = (errors: FieldErrors<CategoryFormInput>): void => {
    const first = FIELD_ORDER.find((field) => errors[field] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  /** Load Latest: after a stale save, the banner's button. The typed values are replaced only once the latest version has arrived. */
  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const result = await query.refetch();
    setLoadingLatest(false);
    if (result.isError) {
      const copy = describeHttpError(result.error);
      if (copy !== null) {
        setFailure(errorLine(copy));
      }
      return;
    }
    const latest = result.data;
    if (latest === undefined) {
      return;
    }
    setOpened(latest);
    reset(valuesOf(latest));
    setConflicts(0);
    setFailure(null);
    setStatus(EDIT.latestLoaded);
    focusField('name');
  };

  const close = (): void => {
    if (!pending) {
      onClose();
    }
  };

  const previewName = name.trim() === '' ? FORM.color.sample : name.trim();
  const options: readonly RadioOption[] = CATEGORY_TONES.map((tone) => ({
    value: tone,
    label: CATEGORY_TONE_LABEL[tone],
    description: <CategoryBadge category={{ name: previewName, tone }} />,
  }));

  const form = (
    <form
      id={formId}
      ref={formRef}
      noValidate
      className={expensesModalBodyClasses}
      onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
        void handleSubmit(onValid, onInvalid)(event);
      }}
    >
      {failure !== null && (
        <p className={messageClasses({ error: true })} role="alert">
          <Icon name="triangle-alert" size={14} />
          {failure}
        </p>
      )}
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <Field
            label={FORM.name.label}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            hint={isOthers ? FORM.name.othersHint : undefined}
            readOnly={isOthers}
            maxLength={CATEGORY_NAME_MAX}
            autoComplete="off"
            required
          />
        )}
      />
      <Controller
        control={control}
        name="tone"
        render={({ field, fieldState }) => (
          <div className={expensesModalBodyClasses}>
            <RadioGroup
              legend={FORM.color.legend}
              name="tone"
              value={field.value}
              onChange={field.onChange}
              options={options}
            />
            {fieldState.error !== undefined && (
              <p className={messageClasses({ error: true })}>
                <Icon name="triangle-alert" size={14} />
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />
      {opened !== null && (
        <RecordMeta
          recordedBy={opened.recordedBy}
          recordedAt={opened.recordedAt}
          lastChangedBy={opened.lastChangedBy}
          lastChangedAt={opened.lastChangedAt}
        />
      )}
    </form>
  );

  const waiting = loadFailed ? (
    <ErrorState
      things={EDIT.loadFailedThing}
      error={query.error}
      align="start"
      onRetry={() => {
        void query.refetch();
      }}
    />
  ) : (
    <SkeletonText />
  );

  // The stale-save banner sits at the top of the body.
  const editBody = (
    <div className={expensesModalBodyClasses}>
      {conflicts > 0 && (
        <ConflictBanner
          key={conflicts}
          pending={loadingLatest}
          onLoadLatest={() => {
            void loadLatest();
          }}
        />
      )}
      {loaded ? form : waiting}
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {status}
      </div>
    </div>
  );

  const words = isEdit ? EDIT : ADD;
  return (
    <Modal
      open={open}
      title={words.title}
      description={words.description}
      onClose={close}
      loading={pending}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {words.cancel}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            icon="check"
            pending={pending}
            aria-disabled={!loaded}
            ref={saveRef}
          >
            {pending ? words.saving : words.save}
          </Button>
        </>
      }
    >
      {isEdit ? (
        <LoadingRegion loading={!loaded && !loadFailed} failed={loadFailed} things={EDIT.things}>
          {editBody}
        </LoadingRegion>
      ) : (
        form
      )}
    </Modal>
  );
}
