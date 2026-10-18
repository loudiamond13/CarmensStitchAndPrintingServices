// U3 Edit User slide-over (UI-SPEC "U3 Edit User slide-over"; USER-03, USER-05, D-45, OR-3; plan 05-25). It reads the person
// with the edit version (SkeletonText in a LoadingRegion, then focus on First name), and edits names, email and role.
// Every rule the server checks first is checked here before a request goes out (updateUserSchema); server field messages
// win and put the cursor on the field. Save Changes sends the version the form was loaded with.
//   - Role differs from the saved role: a note says the person is signed out on every device (USER-05).
//   - Email differs from the saved one (compared after trim, ignoring letter case) and the person has a password: a choice
//     under the Email field, "Confirm by link" (preselected) or "Save at once" (D-45). `emailChange` is sent only when the
//     email changed. An invited person has no password: no choice is shown and `confirm` is sent (the server moves the
//     address at once and re-invites either way).
// The form lives in a part that is mounted again on every open, so each open reads the person fresh.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import clsx from 'clsx';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { RecordMeta } from '@/components/data';
import { RadioGroup, type RadioOption } from '@/components/entry';
import { Field, messageClasses } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { loginLinkClasses, srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConflictBanner, ErrorState, LoadingRegion, Note, SkeletonText, STATES_COPY } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission } from '@/lib/forms/useSubmission';
import { RoleField } from '@/modules/admin/components/RoleField';
import { RoleBadge, StatusBadges } from '@/modules/admin/components/UserBadges';
import {
  usersChoiceClasses,
  usersFormGridClasses,
  usersPanelBodyClasses,
  usersStatusClasses,
} from '@/modules/admin/components/users.recipe';
import { useUserQuery } from '@/modules/admin/hooks/useUserQuery';
import { usersService, type UpdateUserRequest, type UserDetailResponse } from '@/modules/admin/services/usersService';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import {
  emailChanged,
  updateUserSchema,
  USER_ROLES,
  type EmailChange,
  type UpdateUserValues,
  type UserRole,
} from '@/modules/admin/usersSchemas';
import { describeHttpError, errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const COPY = USERS_COPY.edit;
const FIELDS = USERS_COPY.add;

const EDIT_STALE = 'edit.stale';

/** The 422 answers a Manager can read but not fix by retyping: the last active Manager (D-18) and one's own account (D-19). */
const REFUSALS: ReadonlyMap<string, { title: string; body: string }> = new Map<string, { title: string; body: string }>(
  [
    ['users.last-active-manager', COPY.guards.lastManager],
    ['users.own-account', COPY.guards.ownAccount],
  ],
);

const FIELD_ORDER = ['firstName', 'lastName', 'email', 'emailChange', 'role'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

const EMAIL_CHANGE_OPTIONS: readonly RadioOption<EmailChange>[] = [
  { value: 'confirm', label: COPY.emailChange.confirm.label, description: COPY.emailChange.confirm.description },
  { value: 'now', label: COPY.emailChange.now.label, description: COPY.emailChange.now.description },
];

const EMPTY_VALUES: UpdateUserValues = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'Admin',
  emailChange: 'confirm',
  savedEmail: '',
};

/** The role the server holds, if it is one the form knows. */
function asRole(role: string): UserRole {
  return USER_ROLES.find((known) => known === role) ?? 'Admin';
}

function valuesOf(person: UserDetailResponse): UpdateUserValues {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    role: asRole(person.role),
    emailChange: 'confirm',
    savedEmail: person.email,
  };
}

/** The PUT body: the email always; the choice only when the email changed (an invited person always confirms). */
function toRequest(values: UpdateUserValues, person: UserDetailResponse): UpdateUserRequest {
  const request: UpdateUserRequest = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    role: values.role,
    version: person.version,
  };
  if (!emailChanged(values.email, person.email)) {
    return request;
  }
  const emailChange: EmailChange = person.hasPassword && values.emailChange !== '' ? values.emailChange : 'confirm';
  return { ...request, emailChange };
}

export interface EditUserPanelProps {
  /** Whose details to edit. Null renders nothing (the panel was never opened). */
  userId: string | null;
  /** False plays the close animation and then renders nothing; each new open reads the person again. Default true. */
  open?: boolean;
  /** Closes the panel: Cancel, Close, Esc and the scrim (never while a request runs), and after a save. */
  onClose: () => void;
  /** The person was saved; the answer carries the new version and the saved names and role. */
  onSaved: (saved: UserDetailResponse) => void;
}

export function EditUserPanel({ open = true, userId, ...props }: EditUserPanelProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  return userId === null ? null : <EditUserForm key={opens} userId={userId} open={open} {...props} />;
}

function EditUserForm({ userId, open, onClose, onSaved }: EditUserPanelProps & { userId: string; open: boolean }) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const query = useUserQuery(userId, open);
  // The person the form was filled from; the version a save sends is this one's.
  const [person, setPerson] = useState<UserDetailResponse | null>(null);
  const fresh = query.isSuccess && query.isFetchedAfterMount ? query.data : null;
  if (person === null && fresh !== null) {
    setPerson(fresh);
  }
  // The one line above the fields for a failure that belongs to no field.
  const [failure, setFailure] = useState<string | null>(null);
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  // A refusal the Manager can read but not fix by retyping (D-18, D-19), and the person deleted meanwhile (D-09).
  const [refusal, setRefusal] = useState<{ title: string; body: string } | null>(null);
  const [deleted, setDeleted] = useState(false);
  // The polite line read out after Load Latest.
  const [status, setStatus] = useState('');

  const { control, handleSubmit, setError, setValue, reset } = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    mode: 'onBlur',
    defaultValues: EMPTY_VALUES,
    ...(person === null ? {} : { values: valuesOf(person) }),
  });
  const email = useWatch({ control, name: 'email' });
  const role = useWatch({ control, name: 'role' });

  const loaded = person !== null;
  const loadFailed = query.isError && !loaded;
  const gone = deleted || (loadFailed && isHttpError(query.error) && query.error.status === 404);
  const showChoice = loaded && person.hasPassword && emailChanged(email, person.email);

  const focusField = (name: FieldName): void => {
    const form = formRef.current;
    const target =
      name === 'emailChange'
        ? (form?.querySelector('input[name="emailChange"]:checked') ?? form?.querySelector('input[name="emailChange"]'))
        : form?.querySelector(`input[name="${name}"]`);
    if (target instanceof HTMLElement) {
      target.focus();
    }
  };

  const focusFirstName = (): void => {
    formRef.current?.querySelector<HTMLElement>('input[name="firstName"]')?.focus();
  };

  // The person has arrived: the cursor goes to the first field.
  useEffect(() => {
    if (loaded) {
      formRef.current?.querySelector<HTMLElement>('input[name="firstName"]')?.focus();
    }
  }, [loaded]);

  const showLine = (text: string): void => {
    setFailure(text);
    saveRef.current?.focus();
  };

  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    // D-20: a stale save keeps every typed value; the banner offers Load Latest, which takes focus.
    if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
      setConflicts((count) => count + 1);
      return;
    }
    if (isHttpError(error) && error.status === 422) {
      const guard = REFUSALS.get(error.code ?? '');
      if (guard !== undefined) {
        setRefusal(guard);
        saveRef.current?.focus();
        return;
      }
    }
    if (isHttpError(error) && error.status === 404) {
      setDeleted(true);
      return;
    }
    if (isHttpError(error) && error.status === 400) {
      let first: FieldName | null = null;
      for (const name of FIELD_ORDER) {
        const message = serverFieldMessage(error.fieldErrors, name);
        if (message !== undefined && (name !== 'emailChange' || showChoice)) {
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

  const submission = useSubmission<UpdateUserValues, UserDetailResponse>(
    (_key, values) => {
      if (person === null) {
        return Promise.reject(new Error('The person is not loaded.'));
      }
      return usersService.update(userId, toRequest(values, person));
    },
    {
      onSuccess: (saved) => {
        onSaved(saved);
        onClose();
      },
      onFailure: showFailure,
    },
  );
  const { submit, pending } = submission;

  const onValid = async (values: UpdateUserValues): Promise<void> => {
    setFailure(null);
    setRefusal(null);
    await submit(values);
  };

  /** Load Latest: the typed values are replaced only once the latest version has arrived. */
  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const result = await query.refetch();
    setLoadingLatest(false);
    if (result.isError) {
      if (isHttpError(result.error) && result.error.status === 404) {
        setDeleted(true);
        return;
      }
      const copy = describeHttpError(result.error);
      if (copy !== null) {
        setFailure(errorLine(copy));
      }
      return;
    }
    const latest = result.data;
    if (latest === undefined) {
      return;
    }
    setPerson(latest);
    reset(valuesOf(latest));
    setConflicts(0);
    setFailure(null);
    setRefusal(null);
    setStatus(STATES_COPY.conflict.loaded);
    focusFirstName();
  };

  const onInvalid = (errors: FieldErrors<UpdateUserValues>): void => {
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

  let loadState = <SkeletonText />;
  if (loadFailed) {
    loadState = gone ? (
      <></>
    ) : (
      <ErrorState
        things={COPY.things}
        error={query.error}
        align="start"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const main =
    person === null ? (
      loadState
    ) : (
      <>
        <div className={usersStatusClasses}>
          <RoleBadge role={person.role} />
          <StatusBadges status={person.status} inviteState={person.inviteState} />
        </div>
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
                  label={FIELDS.firstName}
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
                  label={FIELDS.lastName}
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
                label={FIELDS.email}
                type="email"
                name={field.name}
                value={field.value}
                onChange={(event) => {
                  field.onChange(event);
                  // Back to the saved address: the next change starts at "Confirm by link" again.
                  if (!emailChanged(event.target.value, person.email)) {
                    setValue('emailChange', 'confirm');
                  }
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                hint={FIELDS.emailHint}
                autoComplete="off"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            )}
          />
          {showChoice && (
            <Controller
              control={control}
              name="emailChange"
              render={({ field, fieldState }) => (
                <div className={usersChoiceClasses}>
                  <RadioGroup<EmailChange>
                    legend={COPY.emailChange.legend}
                    name={field.name}
                    value={field.value === 'now' ? 'now' : 'confirm'}
                    options={EMAIL_CHANGE_OPTIONS}
                    onChange={field.onChange}
                  />
                  {fieldState.error !== undefined && (
                    <p className={messageClasses({ error: true })}>
                      <Icon name="triangle-alert" size={14} />
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          )}
          <Controller
            control={control}
            name="role"
            render={({ field, fieldState }) => (
              <RoleField value={field.value} onChange={field.onChange} error={fieldState.error?.message}>
                {role !== asRole(person.role) && <Note icon="info">{COPY.roleChangeNote(person.firstName)}</Note>}
              </RoleField>
            )}
          />
        </form>
        <RecordMeta
          recordedBy={person.recordedBy}
          recordedAt={person.createdAt}
          lastChangedBy={person.lastChangedBy}
          lastChangedAt={person.updatedAt}
        />
        <UiLink
          to={`/admin/audit-log?target=${encodeURIComponent(person.id)}&range=all`}
          className={clsx(loginLinkClasses, hitAreaClasses)}
        >
          {COPY.activityLink}
        </UiLink>
      </>
    );

  // The banners sit at the top of the body (D-20): the deleted notice, else the stale-save banner, then a guard refusal.
  const body = (
    <>
      {gone && <ErrorState title={COPY.guards.deleted.title} message={COPY.guards.deleted.body} align="start" />}
      {!gone && conflicts > 0 && (
        <ConflictBanner
          key={conflicts}
          pending={loadingLatest}
          onLoadLatest={() => {
            void loadLatest();
          }}
        />
      )}
      {refusal !== null && <ErrorState title={refusal.title} message={refusal.body} align="start" />}
      {main}
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {status}
      </div>
    </>
  );

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
          <Button
            variant="primary"
            type="submit"
            form={formId}
            icon="check"
            pending={pending}
            aria-disabled={!loaded || gone}
            ref={saveRef}
          >
            {pending ? COPY.saving : COPY.save}
          </Button>
        </>
      }
    >
      <LoadingRegion loading={!loaded && !loadFailed} failed={loadFailed} things={COPY.things}>
        <div className={usersPanelBodyClasses}>{body}</div>
      </LoadingRegion>
    </Modal>
  );
}
