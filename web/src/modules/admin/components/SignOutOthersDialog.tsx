// SPEC-GAP: SignOutOthersDialog (UI-SPEC "Admin shell session items" → "Sign Out Other Devices"; D-04, D-05, D-44). Confirms
// ending every other session of the signed-in account; this device stays signed in, so the wording says "other devices".
// It is always allowed (D-44): the caller never counts sessions first, and the server answers 204 with or without any to end.
// The S7 header button opens it here, and the user menu opens it in plan 04-30. "Keep Others Signed In" has the focus on
// open; focus returns to the opener when the dialog closes.
import { useToast } from '@/components/feedback';
import { useSubmission } from '@/lib/forms/useSubmission';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { SignOutDialog } from '@/modules/admin/components/SignOutDialog';
import { authService } from '@/modules/admin/services/authService';

export interface SignOutOthersDialogProps {
  /** False plays the close animation and then renders nothing (D-39). Default true. */
  open?: boolean;
  /** Closes the dialog: after the sign-out succeeded, and for "Keep Others Signed In", Esc and the scrim. */
  onClose: () => void;
  /** Runs once after the other devices were signed out (the S7 page refreshes its list). */
  onSignedOut?: (() => void) | undefined;
}

export function SignOutOthersDialog({ open = true, onClose, onSignedOut }: SignOutOthersDialogProps) {
  const copy = AUTH_COPY.signOutOthersDialog;
  const toast = useToast();
  const submission = useSubmission<undefined, undefined>(
    async () => {
      await authService.signOutOthers();
      return undefined;
    },
    {
      onSuccess: () => {
        toast.show({ title: AUTH_COPY.toasts.signedOutOthers.title, message: AUTH_COPY.toasts.signedOutOthers.body });
        onSignedOut?.();
        onClose();
      },
    },
  );
  return (
    <SignOutDialog
      open={open}
      title={copy.title}
      message={copy.body}
      keepLabel={copy.keep}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      onConfirm={() => submission.submit()}
      onCancel={onClose}
    />
  );
}
