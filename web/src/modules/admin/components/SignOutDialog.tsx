// SPEC-GAP: the confirm dialog behind "Sign Out Device" and "Sign Out Other Devices" (UI-SPEC "S7", "Interaction Contract").
// A Modal composed like ConfirmDialog, but with a secondary "keep" button that has the initial focus and a primary log-out
// button instead of the danger delete look. ConfirmDialog's failure rule applies: while the action is pending, Esc, the
// scrim, Close and "keep" do nothing and the confirm button shows its pending label; a failed outcome or a rejection keeps
// the dialog open with the describeHttpError line in a role alert, and "confirm" takes focus back for a retry. It renders in
// the page root, never inside a ResponsiveTable cell (the frame's paint containment would trap its scrim). The confirm icon
// defaults to log-out (DeactivateUserDialog passes user-x), and a caller that knows its own refusals (the last active Manager)
// can word them through describeFailure; anything it does not name gets the describeHttpError line.
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/actions';
import { Icon, type IconName } from '@/components/brand';
import { messageClasses } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { confirmMessageClasses } from '@/components/overlays/overlays.recipe';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';

export interface SignOutDialogProps {
  /** False plays the close animation and then renders nothing; each new open starts clean (D-39). Default true. */
  open?: boolean;
  title: string;
  /** The paragraph under the title. */
  message: ReactNode;
  keepLabel: string;
  confirmLabel: string;
  /** The confirm button's words while the request runs ("Signing out"). */
  pendingLabel: string;
  /** The confirm button's icon. Default `log-out`. */
  confirmIcon?: IconName;
  /** The confirmed action. Return its promise (a failed submission outcome or a rejection is a failure). */
  onConfirm: () => unknown;
  onCancel: () => void;
  /** Words for a failure the caller recognises; undefined leaves the line to describeHttpError. */
  describeFailure?: (error: unknown) => ErrorCopy | undefined;
}

/** A submission outcome that failed (`{ ok: false, error }`). */
function isFailedOutcome(value: unknown): value is { readonly ok: false; readonly error: unknown } {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false && 'error' in value;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

export function SignOutDialog({
  open = true,
  title,
  message,
  keepLabel,
  confirmLabel,
  pendingLabel,
  confirmIcon = 'log-out',
  onConfirm,
  onCancel,
  describeFailure,
}: SignOutDialogProps) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ErrorCopy | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  const inFlight = useRef(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // A new open starts clean: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPending(false);
      setFailure(null);
    }
  }

  const fail = (error: unknown) => {
    setFailure(describeFailure?.(error) ?? describeHttpError(error));
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
      open={open}
      title={title}
      onClose={onCancel}
      loading={pending}
      initialFocus={keepRef}
      footer={
        <>
          <Button variant="secondary" onClick={cancel} ref={keepRef}>
            {keepLabel}
          </Button>
          <Button variant="primary" icon={confirmIcon} loading={pending} onClick={confirm} ref={confirmRef}>
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
            {errorLine(failure)}
          </p>
        )}
      </div>
    </Modal>
  );
}
