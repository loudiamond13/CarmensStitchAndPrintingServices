// U3 Edit User slide-over (UI-SPEC "U3 Edit User slide-over"; USER-03, USER-05, D-45, OR-3; plan 05-25). It reads the person
// with the edit version (SkeletonText in a LoadingRegion, then focus on First name), and edits names, email and role.
// Every rule the server checks first is checked here before a request goes out (updateUserSchema); server field messages
// win and put the cursor on the field. Save Changes sends the version the form was loaded with.
//   - Role differs from the saved role: a note says the person is signed out on every device (USER-05).
//   - Email differs from the saved one (compared after trim, ignoring letter case) and the person has a password: a choice
//     under the Email field, "Confirm by link" (preselected) or "Save at once" (D-45). `emailChange` is sent only when the
//     email changed. An invited person has no password: no choice is shown and `confirm` is sent (the server moves the
//     address at once and re-invites either way).
//   - Email differs from the saved one: a note under the field says what will happen, by invitation state and by the choice
//     (the invited person's invitation moves; a link goes to the new address; or it changes at once). While a change waits
//     for the new inbox a note names the address and "Cancel Email Change" calls it off (C-9). The save tells the roster
//     whether a link was sent (pending), the email moved at once (moved) or neither (plain) so its toast can say so.
//   - Account access (USER-03, USER-07, D-16, D-21; plan 05-30): Resend Invitation, Send Reset Link, Lock (through LockUserDialog)
//     and Unlock act at once on the latest state, with no version. They wait (aria-disabled, with a hint) while the form has unsaved changes. After one
//     succeeds the person is read again, the roster is told through `onAccountChanged`, and a toast says what happened. Set
//     Temporary Password opens TemporaryPasswordDialog (stacked); closing it after a success reads the person again.
// The form lives in a part that is mounted again on every open, so each open reads the person fresh.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import clsx from 'clsx';
import { Button, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { RecordMeta } from '@/components/data';
import { useToast } from '@/components/feedback';
import { RadioGroup, type RadioOption } from '@/components/entry';
import { Field, messageClasses } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { loginLinkClasses, srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConflictBanner, ErrorState, LoadingRegion, Note, SkeletonText, STATES_COPY } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { useSubmission, type SubmissionState } from '@/lib/forms/useSubmission';
import { LockUserDialog } from '@/modules/admin/components/LockUserDialog';
import { RoleField } from '@/modules/admin/components/RoleField';
import { TemporaryPasswordDialog } from '@/modules/admin/components/TemporaryPasswordDialog';
import { RoleBadge, StatusBadges } from '@/modules/admin/components/UserBadges';
import {
  usersAccessButtonClasses,
  usersAccessButtonsClasses,
  usersAccessClasses,
  usersAccessHeadingClasses,
  usersCaptionClasses,
  usersChoiceClasses,
  usersFormGridClasses,
  usersPanelBodyClasses,
  usersPendingClasses,
  usersStatusClasses,
} from '@/modules/admin/components/users.recipe';
import { useUserQuery } from '@/modules/admin/hooks/useUserQuery';
import { usersService, type UpdateUserRequest, type UserDetailResponse } from '@/modules/admin/services/usersService';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import { describeUserGuard } from '@/modules/admin/usersGuards';
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
const ACCESS = COPY.accountAccess;
const PENDING = COPY.pendingEmail;
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

/** An account action's submission: it carries no data and nothing comes back. */
type AccessAction = SubmissionState<undefined, unknown>;

/** Which Account access buttons apply (UI-SPEC U3): the failed-password lockout and a deactivated person get none (D-16, D-18). */
interface AccessButtons {
  resend: boolean;
  sendReset: boolean;
  setTemporary: boolean;
  lock: boolean;
  unlock: boolean;
}

function accessButtonsFor(person: UserDetailResponse): AccessButtons {
  const locked = person.status === 'locked' || person.managerLocked;
  const usable = !locked && person.status !== 'inactive';
  return {
    resend: usable && !person.hasPassword,
    sendReset: usable && person.hasPassword,
    setTemporary: usable,
    lock: usable,
    unlock: person.managerLocked,
  };
}

function anyAccess(buttons: AccessButtons): boolean {
  return Object.values(buttons).some(Boolean);
}

/** How the save treated the email, for the roster's toast: a link went out, the email moved at once, or neither. */
function savedEmailOf(
  saved: UserDetailResponse,
  values: UpdateUserValues,
  person: UserDetailResponse | null,
): SavedEmail {
  if (saved.pendingEmail !== null) {
    return 'pending';
  }
  const movedAtOnce =
    person !== null && person.hasPassword && emailChanged(values.email, person.email) && values.emailChange === 'now';
  return movedAtOnce ? 'moved' : 'plain';
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

/** How a save treated the email: left alone or an invited person's move (plain), a link sent to the new address (pending), or moved at once (moved). */
export type SavedEmail = 'plain' | 'pending' | 'moved';

export interface EditUserPanelProps {
  /** Whose details to edit. Null renders nothing (the panel was never opened). */
  userId: string | null;
  /** False plays the close animation and then renders nothing; each new open reads the person again. Default true. */
  open?: boolean;
  /** Closes the panel: Cancel, Close, Esc and the scrim (never while a request runs), and after a save. */
  onClose: () => void;
  /** The person was saved; the answer carries the new version and the saved names and role. */
  onSaved: (saved: UserDetailResponse, email: SavedEmail) => void;
  /** An account action (lock, unlock, resend, reset link, temporary password, cancel email change) changed the person. */
  onAccountChanged?: () => void;
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

function EditUserForm({
  userId,
  open,
  onClose,
  onSaved,
  onAccountChanged,
}: EditUserPanelProps & { userId: string; open: boolean }) {
  const formId = useId();
  const accessHeadingId = useId();
  const dirtyHintId = useId();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const unlockRef = useRef<HTMLButtonElement>(null);
  // Where focus goes once the person has been read again: the Unlock button that replaces Lock, or Email after a cancelled change.
  const focusAfterReload = useRef<'unlock' | 'email' | null>(null);
  const [lockOpen, setLockOpen] = useState(false);
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  // True once a temporary password was set in the open dialog: closing it then reads the person again.
  const temporarySet = useRef(false);
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

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { isDirty },
  } = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    mode: 'onBlur',
    defaultValues: EMPTY_VALUES,
    ...(person === null ? {} : { values: valuesOf(person) }),
  });
  const email = useWatch({ control, name: 'email' });
  const role = useWatch({ control, name: 'role' });
  const emailChoice = useWatch({ control, name: 'emailChange' });

  const loaded = person !== null;
  const loadFailed = query.isError && !loaded;
  const gone = deleted || (loadFailed && isHttpError(query.error) && query.error.status === 404);
  const emailDiffers = loaded && emailChanged(email, person.email);
  const showChoice = emailDiffers && person.hasPassword;

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
      onSuccess: (saved, values) => {
        onSaved(saved, savedEmailOf(saved, values, person));
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

  /** Reads the person again; the typed values are replaced only once the latest version has arrived. Null when it did not. */
  const readLatest = async (): Promise<UserDetailResponse | null> => {
    const result = await query.refetch();
    if (result.isError) {
      if (isHttpError(result.error) && result.error.status === 404) {
        setDeleted(true);
        return null;
      }
      const copy = describeHttpError(result.error);
      if (copy !== null) {
        setFailure(errorLine(copy));
      }
      return null;
    }
    const latest = result.data;
    if (latest === undefined) {
      return null;
    }
    setPerson(latest);
    reset(valuesOf(latest));
    setConflicts(0);
    setFailure(null);
    setRefusal(null);
    return latest;
  };

  /** Load Latest: after a stale save, the banner's button. */
  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const latest = await readLatest();
    setLoadingLatest(false);
    if (latest !== null) {
      setStatus(STATES_COPY.conflict.loaded);
      focusFirstName();
    }
  };

  // Account access (D-21): each action acts on the latest state with no version, so it never makes the open form stale; the
  // buttons wait while the form has unsaved changes. After an action the person is read again (the form was clean) and the
  // roster is told.
  const lockAction = useSubmission<undefined, unknown>((key) => usersService.lock(userId, key));
  const unlockAction = useSubmission<undefined, unknown>((key) => usersService.unlock(userId, key));
  const cancelEmailAction = useSubmission<undefined, unknown>(() => usersService.cancelEmailChange(userId));
  const resendAction = useSubmission<undefined, unknown>((key) => usersService.resendInvitation(userId, key));
  const resetLinkAction = useSubmission<undefined, unknown>((key) => usersService.sendResetLink(userId, key));
  const waiting = isDirty || pending;
  // The buttons point at the hint only while it shows.
  const describedBy = isDirty ? { 'aria-describedby': dirtyHintId } : {};

  const afterAction = async (action: AccessAction): Promise<void> => {
    await readLatest();
    action.reset();
    onAccountChanged?.();
  };

  // A failed action with no dialog is a danger toast that stays until closed, with the mapper line.
  const failAction = (title: string, error: unknown): void => {
    if (isHttpError(error) && error.status === 404) {
      setDeleted(true);
    }
    const copy = describeUserGuard(error) ?? describeHttpError(error);
    if (copy !== null) {
      toast.show({ tone: 'danger', title, message: errorLine(copy) });
    }
  };

  const runAction = async (
    action: AccessAction,
    done: { title: string; message: string },
    failedTitle: string,
    focusAfter: 'email' | null = null,
  ): Promise<void> => {
    const outcome = await action.submit();
    if (!outcome.ok) {
      failAction(failedTitle, outcome.error);
      return;
    }
    toast.show({ title: done.title, message: done.message });
    focusAfterReload.current = focusAfter;
    await afterAction(action);
  };

  const confirmLock = async (name: string) => {
    const outcome = await lockAction.submit();
    if (outcome.ok) {
      setLockOpen(false);
      toast.show({
        title: COPY.accountAccess.toast.locked.title,
        message: COPY.accountAccess.toast.locked.message(name),
      });
      focusAfterReload.current = 'unlock';
      void afterAction(lockAction);
    }
    return outcome;
  };

  // Closing the temporary password dialog reads the person again when a password was set (the account's version moved).
  const closeTemporary = (): void => {
    setTemporaryOpen(false);
    if (temporarySet.current) {
      temporarySet.current = false;
      void readLatest().then(() => {
        onAccountChanged?.();
      });
    }
  };

  // Focus moves on once the person has been read again: to the Unlock button that replaced Lock, or to Email once the waiting
  // change is gone.
  useEffect(() => {
    if (focusAfterReload.current === 'unlock' && person?.managerLocked === true) {
      focusAfterReload.current = null;
      unlockRef.current?.focus();
    } else if (focusAfterReload.current === 'email' && person?.pendingEmail === null) {
      focusAfterReload.current = null;
      formRef.current?.querySelector<HTMLElement>('input[name="email"]')?.focus();
    }
  }, [person]);

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

  const personName = person === null ? '' : `${person.firstName} ${person.lastName}`.trim();
  const shown = person === null ? null : accessButtonsFor(person);

  const main =
    person === null || shown === null ? (
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
          {person.pendingEmail !== null && (
            <div className={usersPendingClasses}>
              <Note icon="info">
                {PENDING.before}
                <strong>{person.pendingEmail}</strong>
                {PENDING.after}
              </Note>
              <Button
                variant="ghost"
                size="sm"
                aria-disabled={waiting}
                {...describedBy}
                pending={cancelEmailAction.pending}
                onClick={() => {
                  void runAction(
                    cancelEmailAction,
                    {
                      title: PENDING.toast.title,
                      message: PENDING.toast.message(person.firstName, person.email),
                    },
                    PENDING.failed,
                    'email',
                  );
                }}
              >
                {PENDING.cancel}
              </Button>
            </div>
          )}
          {emailDiffers && !person.hasPassword && <Note icon="info">{COPY.emailNote.invited}</Note>}
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
                  <Note icon="info">
                    {emailChoice === 'now' ? COPY.emailNote.now(person.firstName) : COPY.emailNote.confirm}
                  </Note>
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
        <section aria-labelledby={accessHeadingId} className={usersAccessClasses}>
          <h3 id={accessHeadingId} className={usersAccessHeadingClasses}>
            {ACCESS.heading}
          </h3>
          {isDirty && (
            <p id={dirtyHintId} className={usersCaptionClasses}>
              {ACCESS.dirtyHint}
            </p>
          )}
          {anyAccess(shown) && (
            <div className={usersAccessButtonsClasses}>
              {shown.resend && (
                <Button
                  icon="mail"
                  className={usersAccessButtonClasses}
                  aria-disabled={waiting}
                  {...describedBy}
                  pending={resendAction.pending}
                  onClick={() => {
                    void runAction(
                      resendAction,
                      { title: ACCESS.toast.resent.title, message: ACCESS.toast.resent.message(person.firstName) },
                      ACCESS.failed.email,
                    );
                  }}
                >
                  {ACCESS.resend}
                </Button>
              )}
              {shown.sendReset && (
                <Button
                  icon="mail"
                  className={usersAccessButtonClasses}
                  aria-disabled={waiting}
                  {...describedBy}
                  pending={resetLinkAction.pending}
                  onClick={() => {
                    void runAction(
                      resetLinkAction,
                      {
                        title: ACCESS.toast.resetSent.title,
                        message: ACCESS.toast.resetSent.message(person.firstName),
                      },
                      ACCESS.failed.email,
                    );
                  }}
                >
                  {ACCESS.sendReset}
                </Button>
              )}
              {shown.setTemporary && (
                <Button
                  icon="key-round"
                  className={usersAccessButtonClasses}
                  aria-disabled={waiting}
                  {...describedBy}
                  onClick={() => {
                    setTemporaryOpen(true);
                  }}
                >
                  {ACCESS.setTemporary}
                </Button>
              )}
              {shown.lock && (
                <Button
                  icon="lock"
                  className={usersAccessButtonClasses}
                  aria-disabled={waiting}
                  {...describedBy}
                  onClick={() => {
                    setLockOpen(true);
                  }}
                >
                  {ACCESS.lock}
                </Button>
              )}
              {shown.unlock && (
                <Button
                  icon="lock-open"
                  className={usersAccessButtonClasses}
                  aria-disabled={waiting}
                  {...describedBy}
                  pending={unlockAction.pending}
                  ref={unlockRef}
                  onClick={() => {
                    void runAction(
                      unlockAction,
                      {
                        title: ACCESS.toast.unlocked.title,
                        message: ACCESS.toast.unlocked.message(personName),
                      },
                      ACCESS.failed.unlock(personName),
                    );
                  }}
                >
                  {ACCESS.unlock}
                </Button>
              )}
            </div>
          )}
        </section>
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
    <>
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
      {person !== null && (
        <TemporaryPasswordDialog
          open={temporaryOpen}
          user={person}
          onSet={(temporaryPassword, idempotencyKey) =>
            usersService.setTemporaryPassword(userId, temporaryPassword, idempotencyKey).then(() => {
              temporarySet.current = true;
            })
          }
          onClose={closeTemporary}
        />
      )}
      {person !== null && (
        <LockUserDialog
          open={lockOpen}
          user={person}
          onConfirm={() => confirmLock(personName)}
          onCancel={() => {
            setLockOpen(false);
          }}
        />
      )}
    </>
  );
}
