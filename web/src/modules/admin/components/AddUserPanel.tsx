// U2 Add User slide-over (UI-SPEC "U2 Add User slide-over", App. E.12; USER-02, D-12, D-15, OR-3; plan 05-22). First and
// last name, email and role (Admin preselected, D-15), then Create User. Every rule the server checks first is checked here
// before a request goes out (createUserSchema); a taken address comes back from the server under Email. A failure that
// belongs to no field shows one alert line above the fields and keeps the typed values. While the request runs, Esc, the
// scrim, Close and Cancel do nothing (WEB-09) and the one Idempotency-Key is kept for a retry. Each open starts clean: the
// form lives in a part that is mounted again on every open.
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { SegmentedControl, type SegmentOption } from '@/components/choice';
import { Field, labelClasses, messageClasses } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import {
  usersFormGridClasses,
  usersPanelBodyClasses,
  usersRoleBlockClasses,
} from '@/modules/admin/components/users.recipe';
import { usersService, type CreateUserRequest } from '@/modules/admin/services/usersService';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import { createUserSchema, type CreateUserValues, type UserAccess, type UserRole } from '@/modules/admin/usersSchemas';
import { errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const COPY = USERS_COPY.add;

const FIELD_ORDER = ['firstName', 'lastName', 'email', 'role', 'access', 'temporaryPassword'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

const ROLE_OPTIONS: readonly SegmentOption<UserRole>[] = [
  { value: 'Admin', label: COPY.role.admin, icon: 'user-round', showLabel: true },
  { value: 'Manager', label: COPY.role.manager, icon: 'shield-check', showLabel: true },
];

/** Who was added, for the page's toast and refetch. */
export interface CreatedUser {
  firstName: string;
  lastName: string;
  role: UserRole;
  access: UserAccess;
}

export interface AddUserPanelProps {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the panel: Cancel, Close, Esc and the scrim (never while a request runs), and after a success. */
  onClose: () => void;
  /** The person was added. */
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
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    role: values.role,
    access: values.access,
  };
}

function AddUserForm({ open, onClose, onCreated }: AddUserPanelProps & { open: boolean }) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  // The one line above the fields for a failure that belongs to no field.
  const [failure, setFailure] = useState<string | null>(null);
  const { control, handleSubmit, setError } = useForm<CreateUserValues>({
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

  const { submit, pending } = useSubmission<CreateUserValues, unknown>(
    (key, values) => usersService.create(toRequest(values), key),
    {
      onSuccess: (_created, values) => {
        onCreated({ firstName: values.firstName, lastName: values.lastName, role: values.role, access: values.access });
        onClose();
      },
      onFailure: showFailure,
    },
  );

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

  const close = (): void => {
    if (!pending) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      variant="slideover"
      title={COPY.title}
      description={COPY.description}
      onClose={close}
      loading={pending}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {COPY.cancel}
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="check" pending={pending} ref={createRef}>
            {pending ? COPY.creating : COPY.create}
          </Button>
        </>
      }
    >
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
      </form>
    </Modal>
  );
}
