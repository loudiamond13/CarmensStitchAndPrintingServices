// U5 TemporaryPasswordDialog (UI-SPEC "U5 Set Temporary Password dialog"; USER-07, C-4, 04 D-21, D-14, OR-3, T-05-87; plan
// 05-30). A Modal stacked over the Edit panel with two steps:
//   - Set: the password field prefilled with a readable suggestion (editable, New Suggestion replaces it), the basic rule
//     checked in the browser first (temporaryPasswordSchema), and the Note that says who is signed out and emailed.
//   - Shown once: the password in a read-only CopyField with the shown-once Note and only Done.
// The caller owns the request (`onSet`); this part owns the Idempotency-Key, so a retry after a failure that may have run
// sends the same key. While the request runs, Esc, the scrim, Close and Cancel do nothing (WEB-09). The password lives in
// component state only: it is dropped as soon as the dialog has closed and played its exit, and each open starts with a fresh
// suggestion (the form lives in a part that is mounted again on every open).
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useEffectEvent, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { messageClasses, PasswordField } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { Note } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import { CopyField } from '@/modules/admin/components/CopyField';
import { usersPanelBodyClasses, usersSuggestionClasses } from '@/modules/admin/components/users.recipe';
import type { UserListItem } from '@/modules/admin/services/usersService';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import { describeUserGuard } from '@/modules/admin/usersGuards';
import { temporaryPasswordSchema, type TemporaryPasswordValues } from '@/modules/admin/usersSchemas';
import { errorLine, type ErrorCopy } from '@/utils/describeHttpError';
import { newTemporaryPassword } from '@/utils/temporaryPassword';

const COPY = USERS_COPY.temporary;
const FIELD = USERS_COPY.add.temporaryPassword;
const SHOWN = USERS_COPY.add.shownOnce;

/** A little longer than the dialog's exit animation, so nothing changes on screen while it plays out. */
const DISCARD_MS = 350;

export interface TemporaryPasswordDialogProps {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  user: Pick<UserListItem, 'firstName' | 'lastName'>;
  /** Sends the password with the submission's Idempotency-Key; resolve on success, reject with the HttpError otherwise. */
  onSet: (temporaryPassword: string, idempotencyKey: string) => Promise<unknown>;
  /** Closes the dialog: Cancel, Close, Esc and the scrim (never while a request runs), and Done. */
  onClose: () => void;
}

export function TemporaryPasswordDialog({ open = true, ...props }: TemporaryPasswordDialogProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  return <TemporaryPasswordForm key={opens} open={open} {...props} />;
}

function TemporaryPasswordForm({ open, user, onSet, onClose }: TemporaryPasswordDialogProps & { open: boolean }) {
  const formId = useId();
  const setRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The one line above the field for a failure that belongs to no field.
  const [failure, setFailure] = useState<string | null>(null);
  // The password once it is set, for the shown-once step.
  const [shown, setShown] = useState<string | null>(null);
  const [suggestion] = useState(() => newTemporaryPassword());
  const { control, handleSubmit, setError, setValue, getValues, clearErrors, reset } = useForm<TemporaryPasswordValues>(
    {
      resolver: zodResolver(temporaryPasswordSchema),
      mode: 'onBlur',
      defaultValues: { temporaryPassword: suggestion },
    },
  );
  const name = `${user.firstName} ${user.lastName}`.trim();

  const focusField = (): void => {
    formRef.current?.querySelector<HTMLElement>('input[name="temporaryPassword"]')?.focus();
  };

  const showLine = (text: string): void => {
    setFailure(text);
    setRef.current?.focus();
  };

  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    if (isHttpError(error) && error.status === 400) {
      const message = serverFieldMessage(error.fieldErrors, 'temporaryPassword');
      if (message !== undefined) {
        setError('temporaryPassword', { type: 'server', message });
        focusField();
        return;
      }
      // No rendered field matches: say what the server said.
      showLine(Object.values(error.fieldErrors)[0]?.[0] ?? errorLine(copy));
      return;
    }
    showLine(errorLine(describeUserGuard(error) ?? copy));
  };

  const submission = useSubmission<TemporaryPasswordValues, unknown>(
    (key, values) => onSet(values.temporaryPassword, key),
    {
      onSuccess: (_result, values) => {
        // The password now lives in the shown-once step only: the form and the submission forget it.
        setShown(values.temporaryPassword);
        reset({ temporaryPassword: '' });
        submission.reset();
      },
      onFailure: showFailure,
    },
  );
  const { submit, pending } = submission;

  // Once the dialog is closed and has played its exit, nothing of the password is kept (T-05-87).
  const discard = useEffectEvent(() => {
    setShown(null);
    reset({ temporaryPassword: '' });
    submission.reset();
  });
  useEffect(() => {
    if (open) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      discard();
    }, DISCARD_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  const onValid = async (values: TemporaryPasswordValues): Promise<void> => {
    setFailure(null);
    await submit(values);
  };

  const suggestAgain = (): void => {
    setValue('temporaryPassword', newTemporaryPassword(getValues('temporaryPassword')));
    clearErrors('temporaryPassword');
  };

  const close = (): void => {
    if (shown !== null || !pending) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={shown === null ? COPY.title : COPY.doneTitle}
      description={COPY.description(name)}
      onClose={close}
      loading={pending}
      footer={
        shown === null ? (
          <>
            <Button variant="secondary" onClick={close}>
              {COPY.cancel}
            </Button>
            <Button variant="primary" type="submit" form={formId} icon="key-round" pending={pending} ref={setRef}>
              {pending ? COPY.setting : COPY.set}
            </Button>
          </>
        ) : (
          <Button variant="primary" icon="check" onClick={close}>
            {SHOWN.done}
          </Button>
        )
      }
    >
      {shown === null ? (
        <form
          id={formId}
          ref={formRef}
          noValidate
          className={usersPanelBodyClasses}
          onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
            void handleSubmit(onValid, focusField)(event);
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
            name="temporaryPassword"
            render={({ field, fieldState }) => (
              <PasswordField
                label={FIELD.label}
                showStrength
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                hint={FIELD.hint}
                autoComplete="off"
              />
            )}
          />
          <div className={usersSuggestionClasses}>
            <Button variant="secondary" size="sm" onClick={suggestAgain}>
              {FIELD.newSuggestion}
            </Button>
          </div>
          <Note icon="info">{COPY.note(user.firstName)}</Note>
        </form>
      ) : (
        <div className={usersPanelBodyClasses}>
          <CopyField label={SHOWN.fieldLabel(user.firstName)} value={shown} focusOnMount />
          <Note icon="shield-check">{SHOWN.note(user.firstName)}</Note>
        </div>
      )}
    </Modal>
  );
}
