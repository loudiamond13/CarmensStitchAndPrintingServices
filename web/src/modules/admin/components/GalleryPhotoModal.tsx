// SPEC-GAP: gallery tab
// S6 GalleryPhotoModal. The window that adds or edits one upload for older work (GAL-03, D-10, OR-3, SEC-06, SEC-07; plan 11-32): the consent
// Note, the Photo picker, Team or name, Product line, Pieces, Note and "Show on the website", saved by "Save Photo".
//   - The rules the server checks are checked here first with its own words (galleryUploadSchema, OR-3). The photo is chosen, prepared in the
//     browser (prepareImage: type by its bytes, upright, shrunk, size check) and only the redrawn file is sent, so the camera and location data
//     of the original never leave the device. The picker is PhotoSlot's look but does not save at once: the file goes with the form.
//   - An add sends one multipart form with one Idempotency-Key per submission and starts with Show on the website ticked (the API hides a new
//     upload when the field is left out). An edit sends the version the window was opened with and no key. A new photo on an edit is sent first
//     (its answer carries the new version), then the form; a retry after a failed form skips a photo that is already up.
//   - A stale save keeps every typed value behind the ConflictBanner, and Load Latest reads the page again and replaces the values and the
//     version (05 D-20).
//   - A changed window asks "Discard changes?" before it closes (08 D-58); nothing closes while a save runs. Each open starts clean.
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type ChangeEvent, type SyntheticEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon, MediaPlaceholder } from '@/components/brand';
import { Checkbox } from '@/components/entry';
import { useToast } from '@/components/feedback';
import { Field, messageClasses, Select, type SelectOption } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  pickErrorBodyClasses,
  pickErrorClasses,
  pickErrorIconClasses,
  pickErrorListClasses,
  pickErrorNameClasses,
  pickErrorReasonClasses,
  spinnerClasses,
  statusIconClasses,
} from '@/components/media/media.recipe';
import { ConfirmDialog, Modal } from '@/components/overlays';
import { ConflictBanner, LazyImage, Note } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { focusFirstInvalid } from '@/lib/forms/focusFirstInvalid';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { expensesModalBodyClasses } from '@/modules/admin/components/expenses.recipe';
import {
  slotActionsClasses,
  slotClasses,
  slotFrameClasses,
  slotHintClasses,
  slotLabelClasses,
  slotPickErrorClasses,
  slotStatusClasses,
  slotTouchOnlyClasses,
} from '@/modules/admin/components/photoSlot.recipe';
import {
  useCreateGalleryUpload,
  useReplaceGalleryPhoto,
  useUpdateGalleryUpload,
} from '@/modules/admin/hooks/useGalleryItemQueries';
import { imageRulesQuery } from '@/modules/admin/hooks/useImageRulesQuery';
import { productLinesKey } from '@/modules/admin/hooks/useProductLineQueries';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import {
  cleanFileName,
  pickFailureMessage,
  pickIssue,
  toImageRules,
  type ImageRules,
} from '@/modules/admin/orderPhotosSchemas';
import type { GalleryItem } from '@/modules/admin/services/galleryItemsService';
import { productLinesService } from '@/modules/admin/services/productLinesService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import {
  galleryEditSchema,
  galleryUploadSchema,
  galleryUploadValuesOf,
  toGalleryUploadRequest,
  type GalleryUploadInput,
} from '@/modules/admin/siteContentSchemas';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';
import { prepareImage, type PrepareResult } from '@/utils/images';

const COPY = SITE_CONTENT_COPY.gallery;
const PHOTO_COPY = SITE_CONTENT_COPY.photoSlot;
const REASONS = ORDER_PHOTOS_COPY.reasons;

/** The machine code of a save made against an old edit version (SEC-07). */
const EDIT_STALE = 'edit.stale';

/** The types the pick offers: the server's list, never `image/*`, so a phone's chooser shows photos only (IMG-02). */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

/** Where a server field message lands, by the server's name for the field, in the order the fields show. */
const FIELD_ORDER = [
  ['file', 'hasPhoto'],
  ['teamName', 'teamName'],
  ['productLineId', 'productLineId'],
  ['pieces', 'pieces'],
  ['note', 'note'],
] as const;

interface GalleryPhotoModalCommon {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc and the scrim (after the discard question; never while a save runs), and after a save. */
  onClose: () => void;
  /** The photo was saved; the list reads again and the window has shown its toast. */
  onSaved: (saved: GalleryItem) => void;
}

export interface AddGalleryPhotoModalProps extends GalleryPhotoModalCommon {
  mode: 'add';
}

export interface EditGalleryPhotoModalProps extends GalleryPhotoModalCommon {
  mode: 'edit';
  /** The upload to edit, as the list holds it. Null renders nothing (the window was never opened). */
  item: GalleryItem | null;
  /** Reads the list again and gives back the item as the server holds it now, or undefined when it is not there (Load Latest). */
  readLatest: (id: string) => Promise<GalleryItem | undefined>;
}

export type GalleryPhotoModalProps = AddGalleryPhotoModalProps | EditGalleryPhotoModalProps;

export function GalleryPhotoModal({ open = true, ...props }: GalleryPhotoModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  const item = props.mode === 'edit' ? props.item : null;
  if (props.mode === 'edit' && item === null) {
    return null;
  }
  return (
    <GalleryPhotoForm
      key={`${props.mode}-${String(opens)}`}
      item={item}
      open={open}
      onClose={props.onClose}
      onSaved={props.onSaved}
      readLatest={props.mode === 'edit' ? props.readLatest : undefined}
    />
  );
}

/** A photo that has been chosen and prepared: the redrawn file and its small preview. */
interface PickedPhoto {
  file: File;
  preview: string | null;
}

interface GalleryPhotoFormProps {
  /** The upload being edited; null in add mode. */
  item: GalleryItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: (saved: GalleryItem) => void;
  readLatest: ((id: string) => Promise<GalleryItem | undefined>) | undefined;
}

/** What the Product line Select offers: every line in the Manager's order, a hidden one as "{title} (hidden)". */
function useLineOptions(item: GalleryItem | null): { options: readonly SelectOption[]; failed: boolean } {
  const lines = useQuery({
    queryKey: productLinesKey,
    queryFn: ({ signal }) => productLinesService.list(signal),
  });
  const options: SelectOption[] = (lines.data ?? []).map((line) => ({
    value: line.id,
    label: line.isActive ? line.title : COPY.filter.hidden(line.title),
  }));
  // Until the lines have been read, an edit still shows the upload's own line.
  if (item?.lineId != null && !options.some((option) => typeof option !== 'string' && option.value === item.lineId)) {
    options.push({ value: item.lineId, label: item.lineShortName ?? item.lineId });
  }
  return { options, failed: lines.isError };
}

/** Why a prepared file may not be used, in words the person can use: the server's own line for a refusal, plain words for the rest. */
function refusalOf(
  reason: Extract<PrepareResult, { ok: false }>['reason'],
  fileName: string,
  rules: ImageRules,
): string {
  return pickFailureMessage(reason, fileName, rules);
}

interface PhotoPickerProps {
  /** The upload's saved thumb (an edit), shown until a new photo is picked. */
  savedThumb: string | null;
  savedAlt: string;
  picked: PickedPhoto | null;
  /** The message under the picker (Choose a photo.), or empty. */
  error: string;
  /** The window is saving: the picker waits (aria-disabled, focus kept). */
  locked: boolean;
  onPicked: (photo: PickedPhoto) => void;
}

function PhotoPicker({ savedThumb, savedAlt, picked, error, locked, onPicked }: PhotoPickerProps) {
  const queryClient = useQueryClient();
  const chooseInputRef = useRef<HTMLInputElement>(null);
  const takeInputRef = useRef<HTMLInputElement>(null);
  const [pressed, setPressed] = useState<'choose' | 'take' | null>(null);
  const [refused, setRefused] = useState<{ fileName: string; reason: string } | null>(null);
  const messageId = useId();
  const hasPhoto = picked !== null || savedThumb !== null;
  const working = pressed !== null;

  /** The picked file, checked and redrawn in the browser; the form takes it only when every check passes. */
  const run = async (file: File): Promise<void> => {
    const fileName = cleanFileName(file.name);
    const refuse = (reason: string): void => {
      setRefused({ fileName, reason });
    };
    let rules: ImageRules;
    try {
      rules = toImageRules(await queryClient.query(imageRulesQuery));
    } catch {
      refuse(REASONS.rulesUnavailable);
      return;
    }
    let prepared: PrepareResult;
    try {
      prepared = await prepareImage(file, rules);
    } catch {
      prepared = { ok: false, reason: 'unreadable' };
    }
    if (!prepared.ok) {
      refuse(refusalOf(prepared.reason, file.name, rules));
      return;
    }
    const issue = pickIssue(rules, {
      name: file.name,
      type: prepared.type,
      bytes: prepared.file.size,
      width: prepared.width,
      height: prepared.height,
    });
    if (issue !== null) {
      refuse(issue);
      return;
    }
    onPicked({
      file: new File([prepared.file], prepared.name, { type: prepared.type, lastModified: file.lastModified }),
      preview: prepared.preview,
    });
  };

  const pick = (control: 'choose' | 'take') => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || working || locked) {
      return;
    }
    setPressed(control);
    setRefused(null);
    void run(file).finally(() => {
      setPressed(null);
    });
  };

  const waiting = (control: 'choose' | 'take'): boolean => locked || (working && pressed !== control);
  const invalid = error !== '';

  return (
    <fieldset className={slotClasses} aria-describedby={invalid ? messageId : undefined}>
      <legend className={slotLabelClasses}>
        {COPY.window.photo}
        <span aria-hidden="true">{' *'}</span>
      </legend>
      <div data-ratio="1/1" className={slotFrameClasses['1/1']}>
        {picked?.preview != null ? (
          <img src={picked.preview} alt={COPY.window.previewAlt('')} className="size-full object-cover" />
        ) : picked === null && savedThumb !== null ? (
          <LazyImage src={savedThumb} alt={savedAlt} width={88} height={88} ratio="1 / 1" className="size-full" />
        ) : (
          <MediaPlaceholder label={COPY.window.noPhoto} ratio="1 / 1" />
        )}
      </div>
      <div className={slotActionsClasses}>
        <Button
          variant="secondary"
          size="sm"
          icon="cloud-upload"
          pending={pressed === 'choose'}
          aria-disabled={waiting('choose')}
          aria-invalid={invalid || undefined}
          onClick={() => {
            chooseInputRef.current?.click();
          }}
        >
          {hasPhoto ? PHOTO_COPY.replace('Photo') : PHOTO_COPY.choose('Photo')}
        </Button>
        <span className={slotTouchOnlyClasses}>
          <Button
            variant="secondary"
            size="sm"
            icon="camera"
            pending={pressed === 'take'}
            aria-disabled={waiting('take')}
            onClick={() => {
              takeInputRef.current?.click();
            }}
          >
            {PHOTO_COPY.take('Photo')}
          </Button>
        </span>
      </div>
      <p className={slotHintClasses}>{COPY.window.photoHint}</p>
      <div role="status" aria-live="polite" className={slotStatusClasses}>
        {pressed !== null && (
          <>
            <span className={statusIconClasses}>
              <Icon name="loader-circle" size={14} className={spinnerClasses} />
            </span>
            {PHOTO_COPY.uploading}
          </>
        )}
        {pressed === null && picked !== null && (
          <>
            <span className={statusIconClasses}>
              <Icon name="check" size={14} />
            </span>
            {COPY.window.photoChosen}
          </>
        )}
      </div>
      {invalid && (
        <p id={messageId} className={messageClasses({ error: true })}>
          <Icon name="triangle-alert" size={14} />
          {error}
        </p>
      )}
      {refused !== null && (
        <div className={clsx(pickErrorClasses, slotPickErrorClasses)} role="alert">
          <span className={pickErrorIconClasses}>
            <Icon name="triangle-alert" size={16} />
          </span>
          <div className={pickErrorBodyClasses}>
            <ul className={pickErrorListClasses}>
              <li>
                <span className={pickErrorNameClasses}>{refused.fileName}</span>
                <span className={pickErrorReasonClasses}>{refused.reason}</span>
              </li>
            </ul>
          </div>
        </div>
      )}
      <input ref={chooseInputRef} type="file" accept={ACCEPT} hidden onChange={pick('choose')} />
      <input ref={takeInputRef} type="file" accept="image/*" capture="environment" hidden onChange={pick('take')} />
    </fieldset>
  );
}

function GalleryPhotoForm({ item, open, onClose, onSaved, readLatest }: GalleryPhotoFormProps) {
  const isEdit = item !== null;
  const toast = useToast();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const { options: lineOptions, failed: linesFailed } = useLineOptions(item);
  // The upload the form was opened with; the version a save sends is this one's, whatever a later read of the list brings.
  const [opened, setOpened] = useState<GalleryItem | null>(item);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  // The picked file that is already on the server (a photo sent first on an edit whose form then failed): a retry does not send it again.
  const [uploaded, setUploaded] = useState<File | null>(null);
  // Which part of a save is running: the file going up, or the form being saved.
  const [phase, setPhase] = useState<'uploading' | 'saving'>('saving');
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
    setValue,
    formState: { isDirty },
  } = useForm<GalleryUploadInput>({
    resolver: zodResolver(isEdit ? galleryEditSchema : galleryUploadSchema),
    mode: 'onBlur',
    defaultValues: galleryUploadValuesOf(opened),
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
      saveRef.current?.focus();
      return;
    }
    if (isHttpError(error) && error.status === 400) {
      let placed = false;
      for (const [serverField, formField] of FIELD_ORDER) {
        const message = serverFieldMessage(error.fieldErrors, serverField);
        if (message !== undefined) {
          setError(formField, { type: 'server', message });
          placed = true;
        }
      }
      if (placed) {
        setFocusTick((tick) => tick + 1);
        return;
      }
      // No field matches: the photo itself was refused (images.type, images.too-large) or the form as a whole. Say what the server said.
      const detail = error.problem?.detail?.trim();
      setFailure(detail !== undefined && detail !== '' ? detail : errorLine(copy));
      saveRef.current?.focus();
      return;
    }
    setFailure(errorLine(copy));
    saveRef.current?.focus();
  };

  const finished = (saved: GalleryItem): void => {
    toast.show(isEdit ? COPY.toast.saved : COPY.toast.added);
    onSaved(saved);
    onClose();
  };
  const adding = useCreateGalleryUpload({ onSuccess: finished, onFailure: showFailure });
  const replacing = useReplaceGalleryPhoto({ onFailure: showFailure });
  const editing = useUpdateGalleryUpload({ onSuccess: finished, onFailure: showFailure });
  const pending = adding.pending || replacing.pending || editing.pending;

  const onValid = async (values: GalleryUploadInput): Promise<void> => {
    setFailure(null);
    if (opened === null) {
      if (picked === null) {
        return;
      }
      setPhase('uploading');
      const fields = toGalleryUploadRequest(values, null);
      await adding.submit({
        file: picked.file,
        fileName: picked.file.name,
        teamName: fields.teamName ?? '',
        productLineId: fields.productLineId ?? '',
        pieces: fields.pieces === null ? null : Number(fields.pieces),
        note: fields.note ?? '',
        isShown: values.isShown,
      });
      return;
    }
    let version = opened.version;
    if (picked !== null && uploaded !== picked.file) {
      setPhase('uploading');
      const replaced = await replacing.submit({ id: opened.id, file: picked.file, fileName: picked.file.name });
      if (!replaced.ok) {
        return;
      }
      setUploaded(picked.file);
      version = replaced.value.version;
      setOpened({ ...opened, version });
    }
    setPhase('saving');
    await editing.submit({ id: opened.id, body: toGalleryUploadRequest(values, version) });
  };

  /** Load Latest: after a stale save, the banner's button. The typed values are replaced only once the latest version has arrived. */
  const loadLatest = async (): Promise<void> => {
    if (opened === null || readLatest === undefined) {
      return;
    }
    setLoadingLatest(true);
    let latest: GalleryItem | undefined;
    try {
      latest = await readLatest(opened.id);
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
    setPicked(null);
    setUploaded(null);
    // The next photo is a new upload, never the old answer with its old version.
    replacing.reset();
    reset(galleryUploadValuesOf(latest));
    setConflicts(0);
    setFailure(null);
    setStatus(COPY.window.latestLoaded);
    const field = formRef.current?.elements.namedItem('teamName');
    if (field instanceof HTMLElement) {
      field.focus();
    }
  };

  // D-58: a changed window asks before it drops what was typed; a chosen photo counts as a change. Nothing closes while a save runs.
  const requestClose = (): void => {
    if (pending) {
      return;
    }
    if (isDirty || picked !== null) {
      setAsking(true);
      return;
    }
    onClose();
  };

  const title = isEdit ? COPY.window.editTitle : COPY.window.addTitle;
  const saveLabel = pending ? (phase === 'uploading' ? COPY.window.uploading : COPY.window.saving) : COPY.window.save;
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
              {saveLabel}
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
          <Note icon="info">{COPY.window.note}</Note>
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
          {linesFailed && (
            <p className={messageClasses({ error: true })} role="alert">
              <Icon name="triangle-alert" size={14} />
              {COPY.window.linesFailed}
            </p>
          )}
          <Controller
            control={control}
            name="hasPhoto"
            render={({ field, fieldState }) => (
              <PhotoPicker
                savedThumb={opened?.thumb ?? null}
                savedAlt={COPY.window.previewAlt(opened?.name ?? '')}
                picked={picked}
                error={fieldState.error?.message ?? ''}
                locked={pending}
                onPicked={(photo) => {
                  setPicked(photo);
                  setFailure(null);
                  field.onChange(true);
                  setValue('hasPhoto', true, { shouldValidate: true });
                }}
              />
            )}
          />
          <Controller
            control={control}
            name="teamName"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.window.team.label}
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
            name="productLineId"
            render={({ field, fieldState }) => (
              <Select
                label={COPY.window.line.label}
                placeholder={COPY.window.line.placeholder}
                options={lineOptions}
                name={field.name}
                value={field.value}
                onChange={(event) => {
                  field.onChange(event.target.value);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="pieces"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.window.pieces.label}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          />
          <Controller
            control={control}
            name="note"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.window.noteField.label}
                placeholder={COPY.window.noteField.placeholder}
                hint={COPY.window.noteField.hint}
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
