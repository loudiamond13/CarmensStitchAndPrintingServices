// SPEC-GAP: photo slot
// PhotoSlot (UI-SPEC Component Inventory, S1 card 6 and S4 card 5; D-02, CONT-02; plan 11-22): one named photo place. The preview (or its
// placeholder), Choose Photo (and Take Photo where hover is none), the picked file prepared in the browser before it goes up, the status
// line and the pick-error box. The slot saves at once: the caller's `onUpload` sends the prepared file and answers how it ended.
//   - Nothing is sent that has not been through `prepareImage` (type by its bytes, upright, shrunk to 2000 px, size check), and the file that
//     goes up is the redrawn one, so the camera and location data of the original never leave the device (T-11-55).
//   - One file at a time: the pressed control is pending (WEB-09) while the file is prepared and sent.
//   - The slot is reused by the link preview picture ("Picture" instead of "Photo") and the gallery window.
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { useToast } from '@/components/feedback';
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
import { ConfirmDialog } from '@/components/overlays';
import { LazyImage } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { imageRulesQuery } from '@/modules/admin/hooks/useImageRulesQuery';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import {
  cleanFileName,
  pickFailureMessage,
  pickIssue,
  toImageRules,
  type ImageRules,
} from '@/modules/admin/orderPhotosSchemas';
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
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import { prepareImage, type PrepareResult } from '@/utils/images';

const COPY = SITE_CONTENT_COPY.photoSlot;
const REASONS = ORDER_PHOTOS_COPY.reasons;

/** The types the pick offers: the server's list, never `image/*`, so a phone's chooser shows photos only (IMG-02). */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

/** A photo as the Manager's detail reads it. */
export interface SlotPhoto {
  src: string;
  srcSet: string;
  width: number | string;
  height: number | string;
}

/** How a send ended: the shape of a useSubmission outcome, so `submit` can be handed back as it is. */
export type SlotOutcome = { readonly ok: true } | { readonly ok: false; readonly error: unknown };

/** The shape of a frame. */
export type SlotRatio = '4/5' | '1/1' | '1.91/1';

/** A toast the slot shows after a send went through. */
export interface SlotToast {
  title: string;
  message: string;
}

/** The question before a photo is taken off. */
export interface SlotRemoveConfirm {
  title: string;
  message: string;
  action: string;
}

export interface PhotoSlotProps {
  /** The slot's name: "Main photo", "Back view", "Fabric detail". */
  label: string;
  /** "Photo" (default) or "Picture": the word in the buttons. */
  noun?: 'Photo' | 'Picture' | undefined;
  ratio: SlotRatio;
  /** The saved photo, or null for an empty slot. */
  photo: SlotPhoto | null;
  /** The name of the preview of a saved photo. */
  alt: string;
  /** What an empty slot shows: the drawn jersey or a labelled box. */
  placeholder: ReactNode;
  /** Sends the prepared file. It resolves with how it ended and never rejects. */
  onUpload: (file: File) => Promise<SlotOutcome>;
  /** Takes the photo off. It resolves with how it ended and never rejects. A slot with no `onRemove` has no Remove button. */
  onRemove?: (() => Promise<SlotOutcome>) | undefined;
  removeConfirm?: SlotRemoveConfirm | undefined;
  savedToast: SlotToast;
  removedToast?: SlotToast | undefined;
  /** The type and size line under the preview. */
  hint?: string | undefined;
  /** Another slot of the same card is saving: every action here waits (aria-disabled, focus kept). */
  locked?: boolean | undefined;
  /** Told when this slot starts and stops saving, so its card can hold the other slots. */
  onBusyChange?: ((busy: boolean) => void) | undefined;
}

/** Why a send failed, in words the person can use: the server's own line for a refusal, plain words for the rest (as the order photo queue). */
function failureReason(error: unknown): string {
  if (!isHttpError(error)) {
    return REASONS.server(undefined);
  }
  if (error.kind === 'network' || error.kind === 'timeout') {
    return REASONS.network;
  }
  if (error.kind !== 'http') {
    return REASONS.server(error.traceId);
  }
  if (error.status === 429) {
    return REASONS.rateLimited;
  }
  const detail = error.problem?.detail?.trim();
  if (detail !== undefined && detail !== '') {
    return detail;
  }
  const field = Object.values(error.fieldErrors)[0]?.[0];
  if (field !== undefined && field.trim() !== '') {
    return field;
  }
  return error.status >= 500 ? REASONS.server(error.traceId) : REASONS.refused;
}

/** The control that was pressed to pick, so only that one shows the spinner. */
type Pressed = 'choose' | 'take';

interface PickError {
  fileName: string;
  reason: string;
}

export function PhotoSlot({
  label,
  noun = 'Photo',
  ratio,
  photo,
  alt,
  placeholder,
  onUpload,
  onRemove,
  removeConfirm,
  savedToast,
  removedToast,
  hint,
  locked = false,
  onBusyChange,
}: PhotoSlotProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const chooseInputRef = useRef<HTMLInputElement>(null);
  const takeInputRef = useRef<HTMLInputElement>(null);
  const [pressed, setPressed] = useState<Pressed | null>(null);
  const [saved, setSaved] = useState(false);
  const [refused, setRefused] = useState<readonly PickError[]>([]);
  const [removing, setRemoving] = useState(false);
  const [asking, setAsking] = useState(false);
  // Counts the removals, so focus moves to Choose Photo once the Remove button is gone.
  const [focusTick, setFocusTick] = useState(0);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const working = pressed !== null;
  const busy = working || removing;
  const canRemove = onRemove !== undefined && removeConfirm !== undefined;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (focusTick > 0) {
      chooseRef.current?.focus();
    }
  }, [focusTick]);

  /** The picked file, checked and redrawn in the browser, then sent. */
  const run = async (file: File): Promise<void> => {
    const fileName = cleanFileName(file.name);
    const refuse = (reason: string): void => {
      setRefused([{ fileName, reason }]);
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
      refuse(pickFailureMessage(prepared.reason, file.name, rules));
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
    // The picked file's own time is kept, so choosing the same file again is the same upload and keeps its Idempotency-Key.
    const outcome = await onUpload(
      new File([prepared.file], prepared.name, { type: prepared.type, lastModified: file.lastModified }),
    );
    if (outcome.ok) {
      setSaved(true);
      toast.show({ title: savedToast.title, message: savedToast.message });
    } else {
      refuse(failureReason(outcome.error));
    }
  };

  const pick = (control: Pressed) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || working) {
      return;
    }
    setPressed(control);
    setSaved(false);
    setRefused([]);
    void run(file).finally(() => {
      setPressed(null);
    });
  };

  /** The removal, once the person has agreed: the dialog stays open and shows the failure when it does not go through. */
  const confirmRemove = async (): Promise<SlotOutcome> => {
    if (onRemove === undefined) {
      return { ok: true };
    }
    setRemoving(true);
    const outcome = await onRemove();
    setRemoving(false);
    if (outcome.ok) {
      setAsking(false);
      setSaved(false);
      setRefused([]);
      setFocusTick((tick) => tick + 1);
      if (removedToast !== undefined) {
        toast.show({ title: removedToast.title, message: removedToast.message });
      }
    }
    return outcome;
  };

  /** Whether a control other than the pressed one waits: another slot saves, or this one does. */
  const waiting = (control: Pressed | 'remove'): boolean => locked || (busy && pressed !== control);

  return (
    <fieldset className={slotClasses}>
      <legend className={slotLabelClasses}>{label}</legend>
      <div data-ratio={ratio} className={slotFrameClasses[ratio]}>
        {photo === null ? (
          placeholder
        ) : (
          <LazyImage
            src={photo.src}
            srcSet={photo.srcSet}
            width={Number(photo.width)}
            height={Number(photo.height)}
            alt={alt}
            ratio={ratio.replace('/', ' / ')}
            className="size-full"
          />
        )}
      </div>
      {hint !== undefined && <p className={slotHintClasses}>{hint}</p>}
      <div className={slotActionsClasses}>
        <Button
          ref={chooseRef}
          variant="secondary"
          size="sm"
          icon="cloud-upload"
          pending={pressed === 'choose'}
          aria-disabled={waiting('choose')}
          onClick={() => {
            chooseInputRef.current?.click();
          }}
        >
          {photo === null ? COPY.choose(noun) : COPY.replace(noun)}
        </Button>
        {photo === null && (
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
              {COPY.take(noun)}
            </Button>
          </span>
        )}
        {photo !== null && canRemove && (
          <Button
            variant="ghost-danger"
            size="sm"
            icon="trash-2"
            aria-disabled={waiting('remove')}
            onClick={() => {
              setAsking(true);
            }}
          >
            {COPY.remove(noun)}
          </Button>
        )}
      </div>
      <div role="status" aria-live="polite" className={slotStatusClasses}>
        {pressed !== null && (
          <>
            <span className={statusIconClasses}>
              <Icon name="loader-circle" size={14} className={spinnerClasses} />
            </span>
            {COPY.uploading}
          </>
        )}
        {pressed === null && saved && (
          <>
            <span className={statusIconClasses}>
              <Icon name="check" size={14} />
            </span>
            {COPY.saved}
          </>
        )}
      </div>
      {refused.length > 0 && (
        <div className={clsx(pickErrorClasses, slotPickErrorClasses)} role="alert">
          <span className={pickErrorIconClasses}>
            <Icon name="triangle-alert" size={16} />
          </span>
          <div className={pickErrorBodyClasses}>
            <ul className={pickErrorListClasses}>
              {refused.map((error) => (
                <li key={error.fileName}>
                  <span className={pickErrorNameClasses}>{error.fileName}</span>
                  <span className={pickErrorReasonClasses}>{error.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <input ref={chooseInputRef} type="file" accept={ACCEPT} hidden onChange={pick('choose')} />
      <input ref={takeInputRef} type="file" accept="image/*" capture="environment" hidden onChange={pick('take')} />
      {canRemove && (
        <ConfirmDialog
          open={asking}
          title={removeConfirm.title}
          message={removeConfirm.message}
          confirmLabel={removeConfirm.action}
          pendingLabel={COPY.removing}
          onConfirm={confirmRemove}
          onCancel={() => {
            setAsking(false);
          }}
        />
      )}
    </fieldset>
  );
}
