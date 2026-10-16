// SPEC-GAP: the confirm dialog behind "Sign Out Device" and "Sign Out Other Devices" (UI-SPEC "S7", "Interaction Contract").
// A Modal composed like ConfirmDialog, but with a secondary "keep" button that has the initial focus and a primary log-out
// button instead of the danger delete look. ConfirmDialog's failure rule applies: while the action is pending, Esc, the
// scrim, Close and "keep" do nothing and the confirm button shows its pending label; a failed outcome or a rejection keeps
// the dialog open with the describeHttpError line in a role alert, and "confirm" takes focus back for a retry. It renders in
// the page root, never inside a ResponsiveTable cell (the frame's paint containment would trap its scrim).
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { messageClasses } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { confirmMessageClasses } from '@/components/overlays/overlays.recipe';
import { describeHttpError, type ErrorCopy } from '@/utils/describeHttpError';

export interface SignOutDialogProps {
  title: string;
  /** The paragraph under the title. */
  message: ReactNode;
  keepLabel: string;
  confirmLabel: string;
  /** The confirm button's words while the request runs ("Signing out"). */
  pendingLabel: string;
  /** The confirmed action. Return its promise (a failed submission outcome or a rejection is a failure). */
  onConfirm: () => unknown;
  onCancel: () => void;
}

/** A submission outcome that failed (`{ ok: false, error }`). */
function isFailedOutcome(value: unknown): value is { readonly ok: false; readonly error: unknown } {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false && 'error' in value;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

/** One line of failure copy: the title as a sentence, then the body (which carries "Reference: {traceId}"). */
function failureText({ title, body }: ErrorCopy): string {
  const sentence = /[.!?]$/.test(title) ? title : `${title}.`;
  return body === '' ? sentence : `${sentence} ${body}`;
}

export function SignOutDialog({
  title,
  message,
  keepLabel,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onCancel,
}: SignOutDialogProps) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ErrorCopy | null>(null);
  const inFlight = useRef(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const fail = (error: unknown) => {
    setFailure(describeHttpError(error));
    confirmRef.current?.focus();
  };

  const settle = (value: unknown) => {
    inFlight.current = false;
    setPending(false);
    if (isFailedOutcome(value)) {
      fail(value.error);
    }
  };

  const confirm = () => {
    // One attempt at a time: a second click or Enter while the first is pending does nothing.
    if (pending || inFlight.current) {
      return;
    }
    let result: unknown;
    try {
      result = onConfirm();
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
    result.then(settle, (error: unknown) => {
      settle({ ok: false, error });
    });
  };

  const cancel = () => {
    if (!pending) {
      onCancel();
    }
  };

  return (
    <Modal
      title={title}
      onClose={onCancel}
      loading={pending}
      initialFocus={keepRef}
      footer={
        <>
          <Button variant="secondary" onClick={cancel} ref={keepRef}>
            {keepLabel}
          </Button>
          <Button variant="primary" icon="log-out" loading={pending} onClick={confirm} ref={confirmRef}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className={confirmMessageClasses}>{message}</p>
        {failure !== null && (
          <p className={messageClasses({ error: true })} role="alert">
            <Icon name="triangle-alert" size={14} />
            {failureText(failure)}
          </p>
        )}
      </div>
    </Modal>
  );
}
