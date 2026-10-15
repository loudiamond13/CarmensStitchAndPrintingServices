// Dev-only scenario wrapper (plan 04-32; never shipped, D-20): the S1 Sign in page as AuthLayout draws it, with the
// real AuthFrame and SignInForm filled with the App. E.5 values for its `state` prop: the e-mail paolo.garcia@gmail.com;
// the password empty (default) or "tahi2026" (error, loading); the generic banner (error); the pending button
// (loading). "Keep me signed in" stays unticked (D-03). The skip link and the toast layer have no counterpart in
// App. E.5 and are left out. The frame is fixed at the mockup's 960px (production uses the viewport height). The
// reference side is web/visual/reference/fragments/LoginScreen.tsx.
import { useForm } from 'react-hook-form';
import { AuthFrame } from '@/layouts/AuthFrame';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import type { SignInValues } from '@/modules/admin/authSchemas';
import { SignInForm } from '@/modules/admin/components/SignInForm';

export interface LoginScreenProps {
  state?: 'default' | 'error' | 'loading';
}

function noop(): undefined {
  return undefined;
}

export function LoginScreen({ state = 'default' }: LoginScreenProps) {
  const { control } = useForm<SignInValues>({
    defaultValues: {
      email: 'paolo.garcia@gmail.com',
      password: state === 'default' ? '' : 'tahi2026',
      keepSignedIn: false,
    },
  });
  const failed = AUTH_COPY.signIn.failed;
  return (
    <AuthFrame minHeight={960}>
      <SignInForm
        control={control}
        onSubmit={noop}
        pending={state === 'loading'}
        banner={state === 'error' ? { title: failed.title, message: failed.body } : null}
      />
    </AuthFrame>
  );
}
