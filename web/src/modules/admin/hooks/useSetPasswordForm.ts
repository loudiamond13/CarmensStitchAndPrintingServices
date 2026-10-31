// The form state the three set-password screens share (S3, S5, S6; IN-18): the form, its schema for one account, field
// focus, the first-invalid-field focus and the mapping of the server's field messages. Each screen keeps its own save and
// its own failures (a gone link, a lost ticket, the breach lookup being down).
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { isHttpError } from '@/core/api/errors';
import { newPasswordSchema, type NewPasswordValues } from '@/modules/admin/authSchemas';
import type { AuthBanner } from '@/modules/admin/components/AuthCards';
import { describeHttpError } from '@/utils/describeHttpError';

const FIELD_ORDER = ['newPassword', 'confirmPassword'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

/** The account the password is for: D-15 keeps the password free of its email and names. */
export interface SetPasswordAccount {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

export function useSetPasswordForm({ email, firstName, lastName }: SetPasswordAccount) {
  const formRef = useRef<HTMLFormElement>(null);
  const [banner, setBanner] = useState<AuthBanner | null>(null);
  const schema = useMemo(() => newPasswordSchema({ email, firstName, lastName }), [email, firstName, lastName]);
  const { control, handleSubmit, setError } = useForm<NewPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  useEffect(() => {
    focusField('newPassword');
  }, []);

  const onInvalid = (errors: FieldErrors<NewPasswordValues>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  /** Puts the server's message for the first field it named on that field and focuses it. False when it named none. */
  const applyFieldErrors = (error: unknown): boolean => {
    if (!isHttpError(error) || error.status !== 400) {
      return false;
    }
    const entries = Object.entries(error.fieldErrors);
    // The server's words win over the screen's own.
    for (const name of FIELD_ORDER) {
      const message = entries.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1][0];
      if (message !== undefined) {
        setError(name, { type: 'server', message });
        focusField(name);
        return true;
      }
    }
    return false;
  };

  /** Shows the plain-English banner for a failure (nothing for an aborted call). */
  const showBanner = (error: unknown): void => {
    const described = describeHttpError(error);
    if (described !== null) {
      setBanner({ title: described.title, message: described.body, error });
    }
  };

  /** The form's submit handler: clears the banner, then validates and calls `onValid`. */
  const submitHandler =
    (onValid: (values: NewPasswordValues) => Promise<void>) => (event: SyntheticEvent<HTMLFormElement>) => {
      setBanner(null);
      void handleSubmit(onValid, onInvalid)(event);
    };

  return { formRef, control, banner, setBanner, focusField, onInvalid, applyFieldErrors, showBanner, submitHandler };
}
