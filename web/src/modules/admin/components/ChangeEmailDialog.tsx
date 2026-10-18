// SPEC-GAP: change email dialog (UI-SPEC "P2 Change Email dialog"; PROF-02, C-9, D-24, D-25, OR-3; plan 05-18).
// The new address and the current password in a Modal. Every rule the server checks first is checked here before a request
// goes out (changeEmailSchema); a taken address and a wrong password come back from the server and show under their fields
// with the cursor there. A lock or any other failure shows one alert line above the fields and keeps the typed values.
// While the request runs, Esc, the scrim, Close and Cancel do nothing (WEB-09) and the one Idempotency-Key is kept for a
// retry. Each open starts clean: the form lives in a part that is mounted again on every open.
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Field, messageClasses, PasswordField } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import { PROFILE_COPY } from '@/modules/admin/profileCopy';
import { changeEmailSchema, type ChangeEmailValues } from '@/modules/admin/profileSchemas';
import { profileService, type ProfileResponse } from '@/modules/admin/services/profileService';
import { errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const COPY = PROFILE_COPY.changeEmail;

/** The machine code of a request refused while the account is locked after too many wrong passwords (D-41 Q9). */
const PASSWORD_LOCKED = 'profile.password-locked';

const FIELD_ORDER = ['newEmail', 'currentPassword'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export interface ChangeEmailDialogProps {
  /** False plays the close animation and then renders nothing; each new open starts clean (D-39). Default true. */
  open?: boolean;
  /** The sign-in email now: the new address may not be the same. */
  currentEmail: string;
  /** Closes the dialog: Cancel, Close, Esc and the scrim, never while a request runs. */
  onClose: () => void;
  /** The server accepted the request: the new address, and the profile that now carries it as the pending email. */
  onSent: (newEmail: string, profile: ProfileResponse) => void;
}

export function ChangeEmailDialog({ open = true, ...props }: ChangeEmailDialogProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  return <ChangeEmailForm key={opens} open={open} {...props} />;
}

function ChangeEmailForm({ open, currentEmail, onClose, onSent }: ChangeEmailDialogProps & { open: boolean }) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  // The one line above the fields for a failure that belongs to no field.
  const [failure, setFailure] = useState<string | null>(null);
  const schema = useMemo(() => changeEmailSchema(currentEmail), [currentEmail]);
  const { control, handleSubmit, setError } = useForm<ChangeEmailValues>({
    resolver: zodResolver(schema),
    defaultValues: { newEmail: '', currentPassword: '' },
  });

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  const showLine = (text: string): void => {
    setFailure(text);
    sendRef.current?.focus();
  };

  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    if (isHttpError(error) && error.status === 400) {
      const messages = FIELD_ORDER.map((name) => [name, serverFieldMessage(error.fieldErrors, name)] as const);
      let first: FieldName | null = null;
      for (const [name, message] of messages) {
        if (message !== undefined) {
          setError(name, { type: 'server', message });
          first ??= name;
        }
      }
      if (first !== null) {
        focusField(first);
        return;
      }
      // No rendered field matches: say what the server said.
      showLine(Object.values(error.fieldErrors)[0]?.[0] ?? errorLine(copy));
      return;
    }
    if (isHttpError(error) && error.status === 429 && error.code === PASSWORD_LOCKED) {
      showLine(error.problem?.detail ?? PROFILE_COPY.errors.passwordLocked);
      return;
    }
    showLine(errorLine(copy));
  };

  const { submit, pending } = useSubmission<ChangeEmailValues, ProfileResponse>(
    (key, values) => profileService.requestEmailChange(values, key),
    {
      onSuccess: (profile, values) => {
        onSent(profile.pendingEmail ?? values.newEmail, profile);
      },
      onFailure: showFailure,
    },
  );

  const onValid = async (values: ChangeEmailValues): Promise<void> => {
    setFailure(null);
    await submit(values);
  };

  const onInvalid = (errors: FieldErrors<ChangeEmailValues>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  const close = (): void => {
    if (!pending) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={COPY.title}
      description={COPY.description}
      onClose={close}
      loading={pending}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {COPY.cancel}
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="mail" pending={pending} ref={sendRef}>
            {pending ? COPY.sending : COPY.send}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        ref={formRef}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
          void handleSubmit(onValid, onInvalid)(event);
        }}
      >
        {failure !== null && (
          <p className={messageClasses({ error: true })} role="alert">
            <Icon name="triangle-alert" size={14} />
            {failure}
          </p>
        )}
        <Controller
          control={control}
          name="newEmail"
          render={({ field, fieldState }) => (
            <Field
              label={COPY.newEmail}
              type="email"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-required="true"
            />
          )}
        />
        <Controller
          control={control}
          name="currentPassword"
          render={({ field, fieldState }) => (
            <PasswordField
              label={COPY.currentPassword}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              autoComplete="current-password"
              aria-required="true"
            />
          )}
        />
      </form>
    </Modal>
  );
}
