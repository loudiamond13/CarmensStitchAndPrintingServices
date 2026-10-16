// SPEC-GAP: SignOutDeviceDialog (UI-SPEC "S7 Signed-in devices" → "Per-row sign-out"; D-43). Confirms signing out one
// other device, so a mistaken tap on a 36px row icon cannot send a shared tablet back to the password-and-code sign-in.
// "Keep Signed In" has the focus on open. The caller owns the request and passes it as onConfirm.
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { deviceLabel, signedInText } from '@/modules/admin/components/deviceSummary';
import { SignOutDialog } from '@/modules/admin/components/SignOutDialog';
import type { SessionListItem } from '@/modules/admin/services/sessionsService';

export interface SignOutDeviceDialogProps {
  device: SessionListItem;
  /** Signs the device out; return the promise of the outcome so the dialog can follow it. */
  onConfirm: () => unknown;
  onCancel: () => void;
}

export function SignOutDeviceDialog({ device, onConfirm, onCancel }: SignOutDeviceDialogProps) {
  const copy = AUTH_COPY.sessions.deviceDialog;
  return (
    <SignOutDialog
      title={copy.title(deviceLabel(device))}
      message={copy.body(signedInText(device))}
      keepLabel={copy.keep}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
