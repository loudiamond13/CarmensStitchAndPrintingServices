// CS2: the "Clear your cookies and data?" confirmation (ANL-04, D-19, D-35, D-41). Loaded with CS1 (its own lazy chunk).
// SPEC-GAP: CS2 has no spec markup beyond the UI-SPEC section; it is the shared ConfirmDialog with the danger confirm
// "Clear My Data" (pending "Clearing") and the dismiss button "Keep My Data" (this dialog only; the shared default stays
// "Cancel"). Focus starts on Keep My Data, and Esc, the scrim and Keep My Data wait while the call runs.
//   - The confirm runs the server call first. Only a 2xx lets the store clear this browser, and then `onCleared` runs.
//   - A failure leaves everything as it was: the dialog stays open with the failure line, or the wait-a-minute line for a 429.
import { ConfirmDialog } from '@/components/overlays/ConfirmDialog';
import { CONSENT_COPY } from '../consentCopy';
import { useConsent } from '../hooks/useConsent';

const { dialog: COPY } = CONSENT_COPY.clear;

export interface ClearDataDialogProps {
  /** False plays the close animation. Default true. */
  open?: boolean;
  /** The server and this browser are cleared. */
  onCleared: () => void;
  /** Keep My Data, Esc or the scrim. */
  onCancel: () => void;
}

export function ClearDataDialog({ open = true, onCleared, onCancel }: ClearDataDialogProps) {
  const { clearData } = useConsent();

  const confirm = async () => {
    const outcome = await clearData();
    if (outcome === 'cleared') {
      onCleared();
      return undefined;
    }
    return { ok: false as const, error: outcome };
  };

  return (
    <ConfirmDialog
      open={open}
      title={COPY.title}
      message={COPY.message}
      confirmLabel={COPY.confirm}
      confirmIcon="eraser"
      pendingLabel={COPY.pending}
      cancelLabel={COPY.keep}
      onConfirm={confirm}
      onCancel={onCancel}
      describeFailure={(error) => (error === 'rate-limited' ? COPY.rateLimited : COPY.failed)}
    />
  );
}
