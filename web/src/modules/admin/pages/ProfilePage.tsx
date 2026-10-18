// P1 My Profile, /admin/profile (UI-SPEC "P1 My Profile"; PROF-01, D-23, D-20, OR-3; plan 05-13). The App. E.13 header card,
// then the D-23 tabs: Details (Personal Information), Security (Signed-in Devices) and Appearance.
//   - The tab is the URL `tab` parameter (useProfileTab). All three panels stay mounted and the inactive ones are hidden,
//     so what is typed in a form survives a tab change.
//   - The name form carries the edit version it was opened with, not the live query data: a profile changed in another
//     tab is refetched into the header on window focus, and the stale save is refused with a 409 (D-20).
//   - A failed save keeps every typed value. A 400 puts the server's messages under the fields; anything else is a toast.
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, ButtonLink } from '@/components/actions';
import { getTabPanelProps, Tabs, type TabItem } from '@/components/choice';
import { Skeleton, useToast } from '@/components/feedback';
import { Field } from '@/components/forms';
import { ErrorState, LoadingRegion, SkeletonText } from '@/components/states';
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
import { useProfileQuery } from '@/modules/admin/hooks/useProfileQuery';
import { PROFILE_TABS, useProfileTab, type ProfileTab } from '@/modules/admin/hooks/useProfileTab';
import { PROFILE_COPY } from '@/modules/admin/profileCopy';
import { profileNameSchema, type ProfileNameValues } from '@/modules/admin/profileSchemas';
import { profileService, type ProfileResponse } from '@/modules/admin/services/profileService';
import { formatBusinessDate } from '@/utils/format';

const COPY = PROFILE_COPY;
const ID_BASE = 'profile';

const TAB_ITEMS: readonly TabItem<ProfileTab>[] = PROFILE_TABS.map((id) => ({ id, label: COPY.tabs[id] }));

type NameField = keyof ProfileNameValues;

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

function PersonalInformationCard({ profile }: { profile: ProfileResponse }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const headingId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  // The edit version this form was opened with: changed only by a save of this form.
  const [version, setVersion] = useState(profile.version);
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
        reset({ firstName: saved.firstName, lastName: saved.lastName });
        toast.show({ title: COPY.toasts.saved.title, message: COPY.toasts.saved.message });
      },
      onFailure: (copy, error) => {
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
    await submit({ ...values, version });
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
    </form>
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

function ProfileView({
  profile,
  tab,
  onTab,
}: {
  profile: ProfileResponse;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
}) {
  return (
    <>
      <ProfileHeader profile={profile} />
      <Tabs idBase={ID_BASE} items={TAB_ITEMS} value={tab} onChange={onTab} />
      <div {...getTabPanelProps(ID_BASE, 'details')} hidden={tab !== 'details'} className={profileCardsClasses}>
        <PersonalInformationCard profile={profile} />
      </div>
      <div {...getTabPanelProps(ID_BASE, 'security')} hidden={tab !== 'security'} className={profileCardsClasses}>
        <DevicesCard />
      </div>
      <div {...getTabPanelProps(ID_BASE, 'appearance')} hidden={tab !== 'appearance'} className={profileCardsClasses} />
    </>
  );
}

export function ProfileRoute() {
  const query = useProfileQuery();
  const { tab, setTab } = useProfileTab();

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const profile = query.data;
  let content;
  if (profile !== undefined) {
    content = <ProfileView profile={profile} tab={tab} onTab={setTab} />;
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
