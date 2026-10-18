// U2 Add User slide-over (UI-SPEC "U2 Add User slide-over", App. E.12; USER-02, C-4, D-12, D-14, D-15, OR-3; plan 05-22).
// First and last name, email, role (Admin preselected, D-15) and how they get access, then Create User. Every rule the
// server checks first is checked here before a request goes out (createUserSchema); a taken address comes back from the
// server under Email. A failure that belongs to no field shows one alert line above the fields and keeps the typed values.
// While the request runs, Esc, the scrim, Close and Cancel do nothing (WEB-09) and the one Idempotency-Key is kept for a
// retry. Each open starts clean: the form lives in a part that is mounted again on every open.
//   - Invitation (default): success reports who was added and closes the panel.
//   - Temporary password: the field appears for that choice only, prefilled with a random readable value; success swaps the
//     panel to the shown-once step with the password in a read-only field. The password is kept in component state only
//     and dropped as soon as the panel is closed; closing by any means reports who was added.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useEffectEvent, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { SegmentedControl, type SegmentOption } from '@/components/choice';
import { RadioGroup, type RadioOption } from '@/components/entry';
import { Field, labelClasses, messageClasses, PasswordField } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { Note } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import { CopyField } from '@/modules/admin/components/CopyField';
import {
  usersFormGridClasses,
  usersPanelBodyClasses,
  usersRoleBlockClasses,
  usersSuggestionClasses,
} from '@/modules/admin/components/users.recipe';
import { usersService, type CreateUserRequest } from '@/modules/admin/services/usersService';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import { createUserSchema, type CreateUserValues, type UserAccess, type UserRole } from '@/modules/admin/usersSchemas';
import { errorLine, type ErrorCopy } from '@/utils/describeHttpError';
import { newTemporaryPassword } from '@/utils/temporaryPassword';

const COPY = USERS_COPY.add;

const FIELD_ORDER = ['firstName', 'lastName', 'email', 'role', 'access', 'temporaryPassword'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

const ROLE_OPTIONS: readonly SegmentOption<UserRole>[] = [
  { value: 'Admin', label: COPY.role.admin, icon: 'user-round', showLabel: true },
  { value: 'Manager', label: COPY.role.manager, icon: 'shield-check', showLabel: true },
];

// SPEC-DEVIATION: D-12 App. E.12 always set a fixed temporary password; here the Manager chooses between an emailed
// invitation (the default) and a temporary password (OQ-10, D-47: two radio rows with one-line descriptions).
const ACCESS_OPTIONS: readonly RadioOption<UserAccess>[] = [
  { value: 'invitation', label: COPY.access.invitation.label, description: COPY.access.invitation.description },
  { value: 'temporary-password', label: COPY.access.temporary.label, description: COPY.access.temporary.description },
];

/** A little longer than the slide-over's exit animation, so nothing changes on screen while it plays out. */
const DISCARD_MS = 350;

/** Who was added, for the page's refetch and toast. */
export interface CreatedUser {
  firstName: string;
  lastName: string;
  role: UserRole;
  access: UserAccess;
}

/** The shown-once step: who was added, and the password the Manager has to hand over. */
interface ShownOnce {
  created: CreatedUser;
  password: string;
}

export interface AddUserPanelProps {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the panel: Cancel, Close, Esc and the scrim (never while a request runs), Done, and after an invitation. */
  onClose: () => void;
  /** The person was added: after an invitation at once, after a temporary password when its step is closed. */
  onCreated: (created: CreatedUser) => void;
}

export function AddUserPanel({ open = true, ...props }: AddUserPanelProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  return <AddUserForm key={opens} open={open} {...props} />;
}

function toRequest(values: CreateUserValues): CreateUserRequest {
  const request: CreateUserRequest = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    role: values.role,
    access: values.access,
  };
  // The password travels only on its own route; an invitation never carries one.
  return values.access === 'temporary-password' ? { ...request, temporaryPassword: values.temporaryPassword } : request;
}

function AddUserForm({ open, onClose, onCreated }: AddUserPanelProps & { open: boolean }) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  // The one line above the fields for a failure that belongs to no field.
  const [failure, setFailure] = useState<string | null>(null);
  const [shown, setShown] = useState<ShownOnce | null>(null);
  const { control, handleSubmit, setError, setValue, getValues, clearErrors, reset } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: 'Admin',
      access: 'invitation',
      temporaryPassword: '',
    },
  });
  const access = useWatch({ control, name: 'access' });

  const focusField = (name: FieldName): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  const showLine = (text: string): void => {
    setFailure(text);
    createRef.current?.focus();
  };

  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    if (isHttpError(error) && error.status === 400) {
      let first: FieldName | null = null;
      for (const name of FIELD_ORDER) {
        const message = serverFieldMessage(error.fieldErrors, name);
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
    showLine(errorLine(copy));
  };

  const submission = useSubmission<CreateUserValues, unknown>(
    (key, values) => usersService.create(toRequest(values), key),
    {
      onSuccess: (_created, values) => {
        const created: CreatedUser = {
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role,
          access: values.access,
        };
        if (values.access === 'invitation') {
          onCreated(created);
          onClose();
          return;
        }
        // The password now lives in the shown-once step only: the form and the submission forget it.
        setShown({ created, password: values.temporaryPassword });
        reset();
        submission.reset();
      },
      onFailure: showFailure,
    },
  );
  const { submit, pending } = submission;

  // Once the panel is closed and has played its exit, nothing of the password is kept (D-14).
  const discard = useEffectEvent(() => {
    setShown(null);
    reset();
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

  const onValid = async (values: CreateUserValues): Promise<void> => {
    setFailure(null);
    await submit(values);
  };

  const onInvalid = (errors: FieldErrors<CreateUserValues>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  // SPEC-DEVIATION: D-12 the suggestion is random and fresh each time (App. E.12 always set a fixed value); it appears only
  // for the temporary choice, and choosing the invitation again drops it.
  const chooseAccess = (next: UserAccess): void => {
    setValue('temporaryPassword', next === 'temporary-password' ? newTemporaryPassword() : '');
    clearErrors('temporaryPassword');
  };

  const suggestAgain = (): void => {
    setValue('temporaryPassword', newTemporaryPassword(getValues('temporaryPassword')));
    clearErrors('temporaryPassword');
  };

  const finish = (): void => {
    if (shown !== null) {
      onCreated(shown.created);
    }
    onClose();
  };

  const close = (): void => {
    if (shown !== null) {
      finish();
    } else if (!pending) {
      onClose();
    }
  };

  // One Modal for both views, so focus returns to the trigger when it finally closes.
  const body =
    shown === null ? null : (
      <div className={usersPanelBodyClasses}>
        <CopyField label={COPY.shownOnce.fieldLabel(shown.created.firstName)} value={shown.password} focusOnMount />
        <Note icon="shield-check">{COPY.shownOnce.note(shown.created.firstName)}</Note>
      </div>
    );

  return (
    <Modal
      open={open}
      variant="slideover"
      title={shown === null ? COPY.title : COPY.shownOnce.title}
      description={
        shown === null
          ? access === 'temporary-password'
            ? COPY.description.temporary
            : COPY.description.invitation
          : COPY.shownOnce.description(`${shown.created.firstName} ${shown.created.lastName}`, shown.created.role)
      }
      onClose={close}
      loading={pending}
      footer={
        shown === null ? (
          <>
            <Button variant="secondary" onClick={close}>
              {COPY.cancel}
            </Button>
            <Button variant="primary" type="submit" form={formId} icon="check" pending={pending} ref={createRef}>
              {pending ? COPY.creating : COPY.create}
            </Button>
          </>
        ) : (
          <Button variant="primary" icon="check" onClick={finish}>
            {COPY.shownOnce.done}
          </Button>
        )
      }
    >
      {body ?? (
        <form
          id={formId}
          ref={formRef}
          noValidate
          className={usersPanelBodyClasses}
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
          <div className={usersFormGridClasses}>
            <Controller
              control={control}
              name="firstName"
              render={({ field, fieldState }) => (
                <Field
                  label={COPY.firstName}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message ?? ''}
                  autoComplete="off"
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="lastName"
              render={({ field, fieldState }) => (
                <Field
                  label={COPY.lastName}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message ?? ''}
                  autoComplete="off"
                  required
                />
              )}
            />
          </div>
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.email}
                type="email"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                hint={COPY.emailHint}
                autoComplete="off"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="role"
            render={({ field, fieldState }) => (
              <div className={usersRoleBlockClasses}>
                <span className={labelClasses}>{COPY.role.label}</span>
                <SegmentedControl<UserRole>
                  label={COPY.role.label}
                  options={ROLE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
                <p className={messageClasses({ error: fieldState.error !== undefined })}>
                  {fieldState.error !== undefined && <Icon name="triangle-alert" size={14} />}
                  {fieldState.error?.message ?? COPY.role.hint[field.value]}
                </p>
              </div>
            )}
          />
          <Controller
            control={control}
            name="access"
            render={({ field }) => (
              <RadioGroup<UserAccess>
                legend={COPY.access.legend}
                name={field.name}
                value={field.value}
                options={ACCESS_OPTIONS}
                onChange={(next) => {
                  field.onChange(next);
                  chooseAccess(next);
                }}
              />
            )}
          />
          {access === 'temporary-password' && (
            <div className={usersPanelBodyClasses}>
              <Controller
                control={control}
                name="temporaryPassword"
                render={({ field, fieldState }) => (
                  <PasswordField
                    label={COPY.temporaryPassword.label}
                    showStrength
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? ''}
                    hint={COPY.temporaryPassword.hint}
                    autoComplete="off"
                  />
                )}
              />
              <div className={usersSuggestionClasses}>
                <Button variant="secondary" size="sm" onClick={suggestAgain}>
                  {COPY.temporaryPassword.newSuggestion}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
