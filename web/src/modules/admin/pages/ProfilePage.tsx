// P1 My Profile, /admin/profile (UI-SPEC "P1 My Profile"; PROF-01, D-23, D-20, OR-3; plan 05-13). The App. E.13 header card,
// then the D-23 tabs: Details (Personal Information), Security (Signed-in Devices) and Appearance.
//   - The tab is the URL `tab` parameter (useProfileTab). All three panels stay mounted and the inactive ones are hidden,
//     so what is typed in a form survives a tab change.
//   - The name form carries the edit version it was opened with, not the live query data: a profile changed in another
//     tab is refetched into the header on window focus, and the stale save is refused with a 409 (D-20).
//   - Appearance: the Theme choice changes the admin layout's one theme state at once (useAdminTheme); nothing is saved on the
//     account (D-22).
//   - A failed save keeps every typed value. A 400 puts the server's messages under the fields; a 409 edit.stale shows the
//     shared ConflictBanner, and only Load Latest replaces the typed values with the latest version; anything else is a toast.
//   - After a save the session is refreshed, so the sidebar chip and the top bar show the new name (AdminLayout reads it).
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, ButtonLink } from '@/components/actions';
import { getTabPanelProps, SegmentedControl, Tabs, type SegmentOption, type TabItem } from '@/components/choice';
import { Skeleton, useToast } from '@/components/feedback';
import { Field } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConflictBanner, ErrorState, LoadingRegion, SkeletonText, STATES_COPY } from '@/components/states';
import { Avatar, Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { useSubmission } from '@/lib/forms/useSubmission';
import { profileKey } from '@/lib/query/keys';
import {
  profileCardBodyClasses,
  profileCardClasses,
  profileCardFootClasses,
  profileCardHeadClasses,
  profileCardHintClasses,
  profileCardsClasses,
  profileCardTitleClasses,
  profileFormGridClasses,
  profileHeadClasses,
  profileIdentityClasses,
  profileMetaClasses,
  profileNameClasses,
  profileNameRowClasses,
  profilePageClasses,
  profileStripeClasses,
} from '@/modules/admin/components/profile.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useAdminTheme } from '@/modules/admin/hooks/useAdminTheme';
import { useProfileQuery } from '@/modules/admin/hooks/useProfileQuery';
import { PROFILE_TABS, useProfileTab, type ProfileTab } from '@/modules/admin/hooks/useProfileTab';
import { PROFILE_COPY } from '@/modules/admin/profileCopy';
import { profileNameSchema, type ProfileNameValues } from '@/modules/admin/profileSchemas';
import { profileService, type ProfileResponse } from '@/modules/admin/services/profileService';
import { refreshSession } from '@/modules/admin/services/session';
import type { Theme } from '@/modules/admin/theme';
import { describeHttpError } from '@/utils/describeHttpError';
import { formatBusinessDate } from '@/utils/format';

const COPY = PROFILE_COPY;
const ID_BASE = 'profile';

const TAB_ITEMS: readonly TabItem<ProfileTab>[] = PROFILE_TABS.map((id) => ({ id, label: COPY.tabs[id] }));

const THEME_OPTIONS: readonly SegmentOption<Theme>[] = [
  { value: 'light', label: COPY.appearance.light, icon: 'sun', showLabel: true },
  { value: 'dark', label: COPY.appearance.dark, icon: 'moon', showLabel: true },
];

type NameField = keyof ProfileNameValues;

/** The machine code of a save made against an old edit version (SEC-07). */
const EDIT_STALE = 'edit.stale';

/** The latest profile from the server, or why it could not be read. */
type ReloadResult = { readonly profile: ProfileResponse } | { readonly error: unknown };

/** The server's first message for a field; the server writes the field name in any casing. */
function serverMessage(errors: Readonly<Record<string, readonly string[]>>, field: NameField): string | undefined {
  return Object.entries(errors).find(([key]) => key.toLowerCase() === field.toLowerCase())?.[1][0];
}

function ProfileHeader({ profile }: { profile: ProfileResponse }) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const since = formatBusinessDate(profile.memberSince);
  const manager = profile.role === 'Manager';
  return (
    <section className={profileHeadClasses}>
      <div className={profileStripeClasses} aria-hidden="true" />
      <Avatar name={name} size={72} context="profile" />
      <div className={profileIdentityClasses}>
        <div className={profileNameRowClasses}>
          <h1 className={profileNameClasses}>{name}</h1>
          {manager ? (
            <Badge tone="accent" icon="shield-check">
              {profile.role}
            </Badge>
          ) : (
            <Badge tone="neutral">{profile.role}</Badge>
          )}
        </div>
        <p className={profileMetaClasses}>{since === null ? profile.email : COPY.header.meta(profile.email, since)}</p>
      </div>
    </section>
  );
}

function PersonalInformationCard({
  profile,
  reload,
}: {
  profile: ProfileResponse;
  reload: () => Promise<ReloadResult>;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const headingId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  // The edit version this form was opened with: changed only by a save of this form.
  const [version, setVersion] = useState(profile.version);
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  // The polite line read out after Load Latest.
  const [status, setStatus] = useState('');
  const { control, handleSubmit, setError, reset } = useForm<ProfileNameValues>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { firstName: profile.firstName, lastName: profile.lastName },
  });

  const focusField = (field: NameField): void => {
    formRef.current?.querySelector<HTMLInputElement>(`input[name="${field}"]`)?.focus();
  };

  const { submit, pending } = useSubmission<ProfileNameValues & { version: string }, ProfileResponse>(
    (_key, data) => profileService.updateName(data),
    {
      onSuccess: (saved) => {
        queryClient.setQueryData(profileKey, saved);
        setVersion(saved.version);
        setConflicts(0);
        reset({ firstName: saved.firstName, lastName: saved.lastName });
        toast.show({ title: COPY.toasts.saved.title, message: COPY.toasts.saved.message });
        // The shell shows the name from the session. A refresh that fails leaves the old name until the next refresh.
        void refreshSession().catch(() => undefined);
      },
      onFailure: (copy, error) => {
        if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
          setConflicts((count) => count + 1);
          return;
        }
        if (isHttpError(error) && error.status === 400) {
          const first = serverMessage(error.fieldErrors, 'firstName');
          const last = serverMessage(error.fieldErrors, 'lastName');
          if (first !== undefined) {
            setError('firstName', { type: 'server', message: first });
          }
          if (last !== undefined) {
            setError('lastName', { type: 'server', message: last });
          }
          if (first !== undefined || last !== undefined) {
            focusField(first === undefined ? 'lastName' : 'firstName');
            return;
          }
          // No rendered field matches (for example the version): say what the server said.
          const other = Object.values(error.fieldErrors)[0]?.[0];
          toast.show({ tone: 'danger', title: other ?? copy.title, message: other === undefined ? copy.body : '' });
          return;
        }
        toast.show({ tone: 'danger', title: copy.title, message: copy.body });
      },
    },
  );

  const onValid = async (values: ProfileNameValues): Promise<void> => {
    setStatus('');
    await submit({ ...values, version });
  };

  /** Load Latest: the typed values are replaced only once the latest version has arrived. */
  const loadLatest = async (): Promise<void> => {
    setLoadingLatest(true);
    const result = await reload();
    setLoadingLatest(false);
    if ('error' in result) {
      const copy = describeHttpError(result.error);
      if (copy !== null) {
        toast.show({ tone: 'danger', title: copy.title, message: copy.body });
      }
      return;
    }
    setVersion(result.profile.version);
    setConflicts(0);
    reset({ firstName: result.profile.firstName, lastName: result.profile.lastName });
    setStatus(STATES_COPY.conflict.loaded);
    focusField('firstName');
  };

  const onInvalid = (errors: Partial<Record<NameField, unknown>>): void => {
    focusField(errors.firstName === undefined ? 'lastName' : 'firstName');
  };

  return (
    <form
      ref={formRef}
      aria-labelledby={headingId}
      noValidate
      className={profileCardClasses}
      onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
        void handleSubmit(onValid, onInvalid)(event);
      }}
    >
      <div className={profileCardHeadClasses}>
        <div>
          <h2 id={headingId} className={profileCardTitleClasses}>
            {COPY.personal.title}
          </h2>
          <p className={profileCardHintClasses}>{COPY.personal.hint}</p>
        </div>
      </div>
      <div className={profileCardBodyClasses}>
        {conflicts > 0 && (
          <ConflictBanner
            key={conflicts}
            pending={loadingLatest}
            onLoadLatest={() => {
              void loadLatest();
            }}
          />
        )}
        <div className={profileFormGridClasses}>
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.personal.firstName}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                autoComplete="given-name"
              />
            )}
          />
          <Controller
            control={control}
            name="lastName"
            render={({ field, fieldState }) => (
              <Field
                label={COPY.personal.lastName}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                autoComplete="family-name"
              />
            )}
          />
        </div>
      </div>
      <div className={profileCardFootClasses}>
        <Button type="submit" variant="primary" icon="check" pending={pending}>
          {pending ? COPY.personal.saving : COPY.personal.save}
        </Button>
      </div>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {status}
      </div>
    </form>
  );
}

/** The Theme card: a choice that applies at once, with no save button (D-22). The shell keeps the one theme state. */
function AppearanceCard() {
  const { theme, setTheme } = useAdminTheme();
  const headingId = useId();
  // The theme this card last announced. A change made elsewhere (the top bar toggle) ends that announcement.
  const [announced, setAnnounced] = useState<Theme | null>(null);
  if (announced !== null && announced !== theme) {
    setAnnounced(null);
  }
  const choose = (next: Theme): void => {
    if (next === theme) {
      return;
    }
    setTheme(next);
    setAnnounced(next);
  };
  return (
    <section aria-labelledby={headingId} className={profileCardClasses}>
      <div className={profileCardHeadClasses}>
        <div>
          <h2 id={headingId} className={profileCardTitleClasses}>
            {COPY.appearance.title}
          </h2>
          <p className={profileCardHintClasses}>{COPY.appearance.hint}</p>
        </div>
      </div>
      <div className={profileCardBodyClasses}>
        <div>
          <SegmentedControl<Theme>
            label={COPY.appearance.label}
            options={THEME_OPTIONS}
            value={theme}
            onChange={choose}
          />
        </div>
        <p className={profileCardHintClasses}>{COPY.appearance.note}</p>
      </div>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {announced === null ? '' : COPY.appearance.changed[announced]}
      </div>
    </section>
  );
}

function DevicesCard() {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={profileCardClasses}>
      <div className={profileCardHeadClasses}>
        <div>
          <h2 id={headingId} className={profileCardTitleClasses}>
            {COPY.devices.title}
          </h2>
          <p className={profileCardHintClasses}>{COPY.devices.hint}</p>
        </div>
      </div>
      <div className={profileCardBodyClasses}>
        <div>
          <ButtonLink to={COPY.devices.path} icon="shield-check">
            {COPY.devices.cta}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/** The header card and a card, as grey blocks, while the first answer is on its way. */
function ProfileSkeleton() {
  return (
    <>
      <section className={profileHeadClasses} aria-hidden="true">
        <Skeleton width={72} height={72} radius={999} />
        <div className={profileIdentityClasses}>
          <Skeleton width={220} height={34} />
          <Skeleton width={280} height={14} />
        </div>
      </section>
      <section className={profileCardClasses} aria-hidden="true">
        <div className={profileCardHeadClasses}>
          <Skeleton width={180} height={22} />
        </div>
        <div className={profileCardBodyClasses}>
          <SkeletonText />
        </div>
      </section>
    </>
  );
}

interface ProfileViewProps {
  profile: ProfileResponse;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
  /** Reads the profile from the server again (Load Latest). */
  reload: () => Promise<ReloadResult>;
}

function ProfileView({ profile, tab, onTab, reload }: ProfileViewProps) {
  return (
    <>
      <ProfileHeader profile={profile} />
      <Tabs idBase={ID_BASE} items={TAB_ITEMS} value={tab} onChange={onTab} />
      <div {...getTabPanelProps(ID_BASE, 'details')} hidden={tab !== 'details'} className={profileCardsClasses}>
        <PersonalInformationCard profile={profile} reload={reload} />
      </div>
      <div {...getTabPanelProps(ID_BASE, 'security')} hidden={tab !== 'security'} className={profileCardsClasses}>
        <DevicesCard />
      </div>
      <div {...getTabPanelProps(ID_BASE, 'appearance')} hidden={tab !== 'appearance'} className={profileCardsClasses}>
        <AppearanceCard />
      </div>
    </>
  );
}

export function ProfileRoute() {
  const query = useProfileQuery();
  const { tab, setTab } = useProfileTab();

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const reload = async (): Promise<ReloadResult> => {
    const result = await query.refetch();
    return result.isError || result.data === undefined ? { error: result.error } : { profile: result.data };
  };

  const profile = query.data;
  let content;
  if (profile !== undefined) {
    content = <ProfileView profile={profile} tab={tab} onTab={setTab} reload={reload} />;
  } else if (query.isError) {
    content = (
      <ErrorState
        things={COPY.things}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else {
    content = <ProfileSkeleton />;
  }
  return (
    <LoadingRegion
      loading={query.isPending}
      failed={query.isError}
      things={COPY.things}
      announce={COPY.loading}
      className={profilePageClasses}
    >
      {content}
    </LoadingRegion>
  );
}
