// Dev-only scenario wrapper (plan 02-22; never shipped, D-20): a ConfirmDialog after its action failed, the state the
// frozen App. D.3 ConfirmDialog does not have (implementation only, `parity: false`). It renders the converted
// ConfirmDialog with the scenario's props and an action that fails with a 500 carrying `traceId`, then, after mount,
// types the confirm text and presses the danger button, as a person would. The dialog keeps the typed text and shows
// the mapped error with the reference above its buttons (UI-SPEC "UI Considerations" → error | ConfirmDialog).
import { useEffect, useRef } from 'react';
import { HttpError } from '@/core/api/errors';
import { ConfirmDialog, type ConfirmDialogProps } from '@/components/overlays';
import { typeInto } from './typeInto';

export interface FailedConfirmDialogProps extends Omit<ConfirmDialogProps, 'onConfirm'> {
  /** The reference the failed request carries. */
  traceId: string;
}

export function FailedConfirmDialog({ traceId, ...props }: FailedConfirmDialogProps) {
  const done = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not press twice. The page shows one viewport case.
    if (done.current) {
      return;
    }
    done.current = true;
    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog?.querySelector('input');
    if (props.confirmText !== undefined && input !== null && input !== undefined) {
      typeInto(input, props.confirmText);
    }
    // After React has applied the typed text, so the button is enabled.
    window.setTimeout(() => {
      dialog?.querySelector<HTMLButtonElement>('footer button:last-child')?.click();
    }, 0);
  }, [props.confirmText]);
  const fail = () =>
    Promise.reject(
      new HttpError({
        kind: 'http',
        status: 500,
        problem: {
          type: undefined,
          title: 'Internal Server Error',
          status: 500,
          detail: undefined,
          instance: undefined,
          traceId,
          code: undefined,
          errors: {},
        },
      }),
    );
  return <ConfirmDialog {...props} onConfirm={fail} />;
}
