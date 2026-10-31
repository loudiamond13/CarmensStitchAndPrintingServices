// ConfirmDialog (App. D.3 "Overlays", CSPS-UI-SPEC.md §6.5 and §9.3), converted to utilities (D-33) with the App. D.3
// props and markup: a Modal with the danger icon tile, the message, the cascade box (the `cascadeSentence()` lead, the
// six-tile tally with zero counts dimmed, and the cannot-be-undone warning), the optional type-to-confirm Field, and the
// Cancel and danger buttons. The danger button stays disabled until the trimmed text matches `confirmText` exactly.
// The looks are in overlays.recipe.ts.
//
// Delete safety (WEB-06, threat T-02-53) and the failure state (UI-SPEC "UI Considerations" → error | ConfirmDialog,
// T-02-54) are additions the frozen App. D.3 component does not have; see the SPEC-DEVIATION notes below.
import { useRef, useState, type ReactNode } from 'react';
import { CASCADE_LABELS, cascadeSentence, type CascadeCounts } from '@/utils/csps';
import { describeHttpError, type ErrorCopy } from '@/utils/describeHttpError';
import { formatCount } from '@/utils/format';
import { Button } from '@/components/actions';
import { Icon, type IconName } from '@/components/brand';
import { Field, messageClasses } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { SkeletonText } from '@/components/states';
import { Modal } from './Modal';
import {
  cascadeClasses,
  cascadeCountClasses,
  cascadeFootClasses,
  cascadeItemClasses,
  cascadeLeadClasses,
  cascadeListClasses,
  confirmClasses,
  confirmColumnClasses,
  confirmIconClasses,
  confirmMessageClasses,
} from './overlays.recipe';

export interface ConfirmDialogProps {
  /** False plays the close animation and then renders nothing; each new open starts clean (D-39). Default true. */
  open?: boolean;
  title?: string;
  message?: ReactNode;
  counts?: CascadeCounts | undefined;
  /** The counts are still being read: the cascade box shows a skeleton and the confirm stays disabled. */
  countsLoading?: boolean;
  /** The words a screen reader gets for the skeleton box. */
  countsLoadingLabel?: string;
  /** Keeps the confirm disabled for a reason the dialog cannot see (the counts could not be read). */
  confirmDisabled?: boolean;
  /** Type-to-confirm text (e.g. the order number). */
  confirmText?: string | undefined;
  confirmLabel?: string;
  /** The dismiss button's words and the Esc action's name. Default "Cancel". */
  cancelLabel?: string;
  /** The confirm button's icon. Default the trash. */
  confirmIcon?: IconName;
  /** The confirm button's words while the action runs ("Deleting"); the confirm label stays when it is not set. */
  pendingLabel?: string;
  // SPEC-DEVIATION: WEB-06 / T-02-53. App. D.3 took `() => void`. The action may now return a promise: while it is
  // pending the dialog ignores further confirms, Esc, the scrim and Cancel, and a rejection, or a resolved
  // `{ ok: false, error }` (a useSubmission outcome, so `onConfirm={() => submission.submit()}` works), is a failure.
  /** The confirmed action. Return its promise so the dialog can track the attempt. */
  onConfirm?: () => unknown;
  onCancel?: () => void;
  /** Words for a failure the caller recognises (a sentence, or title and body); null or undefined leaves the line to describeHttpError. */
  describeFailure?: (error: unknown) => ErrorCopy | string | null | undefined;
  inline?: boolean;
  loading?: boolean;
}

/** A useSubmission outcome that failed (`{ ok: false, error }`). */
function isFailedOutcome(value: unknown): value is { readonly ok: false; readonly error: unknown } {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false && 'error' in value;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/** One line of failure copy: the title as a sentence, then the body (which carries "Reference: {traceId}"). */
function failureText({ title, body }: ErrorCopy): string {
  const sentence = /[.!?]$/.test(title) ? title : `${title}.`;
  return body === '' ? sentence : `${sentence} ${body}`;
}

export function ConfirmDialog({
  open = true,
  title = 'Delete this?',
  message,
  counts,
  countsLoading = false,
  countsLoadingLabel = 'Loading',
  confirmDisabled = false,
  confirmText,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmIcon = 'trash-2',
  pendingLabel,
  onConfirm,
  onCancel,
  describeFailure,
  inline = false,
  loading = false,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ErrorCopy | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  const inFlight = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // A new open starts clean: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTyped('');
      setPending(false);
      setFailure(null);
    }
  }

  const hasConfirmText = confirmText !== undefined && confirmText !== '';
  const ok = (!hasConfirmText || typed.trim() === confirmText) && !countsLoading && !confirmDisabled;
  const busy = loading || pending;
  const cascade = counts === undefined ? '' : cascadeSentence(counts);

  const fail = (error: unknown) => {
    const words = describeFailure?.(error);
    setFailure(typeof words === 'string' ? { title: words, body: '' } : (words ?? describeHttpError(error)));
    // The button leaves its pending state and takes focus back for a retry.
    confirmRef.current?.focus();
  };

  const confirm = () => {
    // One confirm per attempt: a second click, Enter or a programmatic click while the first is pending does nothing.
    if (busy || !ok || inFlight.current) {
      return;
    }
    // SPEC-DEVIATION: UI-WR-06 an action that throws before it returns a promise (a guard, a null deref) is a failure
    // too: the dialog stays open and shows the failure line, instead of the error escaping the click handler unseen.
    let result: unknown;
    try {
      result = onConfirm?.();
    } catch (error: unknown) {
      fail(error);
      return;
    }
    if (!isPromiseLike(result)) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    result.then(
      (value) => {
        inFlight.current = false;
        setPending(false);
        if (isFailedOutcome(value)) {
          fail(value.error);
        }
      },
      (error: unknown) => {
        inFlight.current = false;
        setPending(false);
        fail(error);
      },
    );
  };

  const cancel = () => {
    if (!busy) {
      onCancel?.();
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      inline={inline}
      loading={busy}
      // SPEC-DEVIATION: A11Y-02 (UI-SPEC Interaction Contract). With no type-to-confirm field, Cancel takes the focus
      // on open, so Enter never confirms a destructive action by accident.
      initialFocus={hasConfirmText ? undefined : cancelRef}
      footer={
        <>
          <Button variant="secondary" onClick={cancel} ref={cancelRef}>
            {cancelLabel}
          </Button>
          <Button variant="danger" icon={confirmIcon} disabled={!ok} loading={busy} onClick={confirm} ref={confirmRef}>
            {pending && pendingLabel !== undefined ? pendingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className={confirmClasses}>
        <span className={confirmIconClasses}>
          <Icon name="triangle-alert" size={22} />
        </span>
        <div className={confirmColumnClasses}>
          {Boolean(message) && <p className={confirmMessageClasses}>{message}</p>}
          {countsLoading && (
            <div className={cascadeClasses} role="status">
              <SkeletonText lines={2} />
              <span className={srOnlyClasses}>{countsLoadingLabel}</span>
            </div>
          )}
          {!countsLoading && cascade !== '' && counts !== undefined && (
            <div className={cascadeClasses} role="alert">
              <p className={cascadeLeadClasses}>{cascade}</p>
              <ul className={cascadeListClasses}>
                {CASCADE_LABELS.map(([key, one]) => {
                  const count = counts[key] ?? 0;
                  return (
                    <li key={key} className={cascadeItemClasses}>
                      <span className={cascadeCountClasses({ zero: count === 0 })}>{formatCount(count)}</span>
                      {count === 1 ? one : key}
                    </li>
                  );
                })}
              </ul>
              <p className={cascadeFootClasses}>This can't be undone.</p>
            </div>
          )}
          {hasConfirmText && (
            <Field
              label={
                <>
                  Type <strong>{confirmText}</strong> to confirm
                </>
              }
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
              }}
              autoComplete="off"
            />
          )}
          {/* SPEC-DEVIATION: WEB-06 (UI-SPEC "UI Considerations" → error | ConfirmDialog, T-02-54). After a failed
              action the dialog stays open and shows the describeHttpError copy (fixed text plus the traceId, never
              server text) in the field-error look above the buttons. It exists only in the failure state. */}
          {failure !== null && (
            <p className={messageClasses({ error: true })} role="alert">
              <Icon name="triangle-alert" size={14} />
              {failureText(failure)}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
