// Shows the one-shot toast a sign-in screen left for the shell (for example "Password saved" after the must-change step).
// The auth layout's toast layer unmounts with its route, so the screen hands the toast over through the session module.
import { useEffect } from 'react';
import { useToast } from '@/components/feedback';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { takeSignedInToast } from '@/modules/admin/services/session';

export function usePostSignInToast(): void {
  const toast = useToast();
  useEffect(() => {
    if (takeSignedInToast() === 'password-saved') {
      toast.show({ title: AUTH_COPY.toasts.passwordSaved.title, message: AUTH_COPY.toasts.passwordSaved.body });
    }
  }, [toast]);
}
