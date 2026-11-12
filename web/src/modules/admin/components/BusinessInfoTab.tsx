// SPEC-GAP: business info
// S1 Business Info tab, /admin/site-content (CONT-01, PUB-03, OR-3, D-23..D-26, D-35; plan 11-12). One form of cards, saved by one
// "Save Business Info" with the settings version it was opened with.
//   - The form is filled from the settings once, when the tab has them. The version a save sends is the one the form was opened
//     with, never the live query data: a refetch from elsewhere cannot hide a stale save, the server refuses it (SEC-07).
//   - Every rule the server checks is checked here first (businessInfoSchema, OR-3): a field is checked when it is left, every rule runs
//     on submit, and after a submit a field with an error is checked again as it is typed in. Focus goes to the first invalid field.
//     Nothing is sent while a rule is broken. A server 400 lands on its own fields and wins.
//   - A stale save (409 edit.stale, SEC-07) shows the shared ConflictBanner at the top of the panel and keeps every typed value. Load Latest asks
//     "Discard changes?" first (08 D-58), then reads the settings again and replaces the typed values and the version (05 D-20).
//   - Undo Changes puts every field, the phone rows included, back to the saved values at once; it is aria-disabled while nothing changed.
//   - A save that goes through shows the toast, puts the saved settings in the query cache and clears the public data held in this
//     browser (invalidatePublicContent). Focus stays on Save.
//   - The tab tells its page whether anything is unsaved (`onDirtyChange`), so the page can ask before a tab change or a leave.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Controller, FormProvider, useForm, type Control, type Path } from 'react-hook-form';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { Field } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { ConfirmDialog } from '@/components/overlays';
import { RecordMeta } from '@/components/data';
import { ConflictBanner, ErrorState, LoadingRegion, SkeletonText } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { focusFirstInvalid } from '@/lib/forms/focusFirstInvalid';
import { describeHttpError } from '@/utils/describeHttpError';
import { PhoneNumbersField } from '@/modules/admin/components/PhoneNumbersField';
import {
  recordMetaClasses,
  recordMetaRowClasses,
  recordMetaTermClasses,
  recordMetaValueClasses,
} from '@/components/data/data.recipe';
import { expensesFullRowClasses } from '@/modules/admin/components/expenses.recipe';
import {
  profileCardBodyClasses,
  profileCardClasses,
  profileCardHeadClasses,
  profileCardHintClasses,
  profileCardTitleClasses,
  profileFormGridClasses,
} from '@/modules/admin/components/profile.recipe';
import { siteContentActionsClasses, siteContentStackClasses } from '@/modules/admin/components/siteContent.recipe';
import { useSiteSettingsQuery, useUpdateSiteSettings } from '@/modules/admin/hooks/useSiteSettingsQuery';
import type { SiteSettings } from '@/modules/admin/services/siteSettingsService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import {
  businessInfoSchema,
  businessInfoValuesOf,
  reduceEmbedCode,
  toSiteSettingsRequest,
  type BusinessInfoInput,
} from '@/modules/admin/siteContentSchemas';

const COPY = SITE_CONTENT_COPY.business;

/** The machine code of a save made against an old edit version (SEC-07). */
const EDIT_STALE = 'edit.stale';

/** The latest settings from the server, or why they could not be read. */
export type ReloadResult = { readonly settings: SiteSettings } | { readonly error: unknown };

/** The fields that hold one text. */
type TextName = Exclude<keyof BusinessInfoInput, 'phones'>;

const TEXT_NAMES: readonly TextName[] = [
  'businessName',
  'tagline',
  'aboutText',
  'turnaroundLine',
  'street',
  'townOrCity',
  'province',
  'postalCode',
  'directionsUrl',
  'mapEmbedUrl',
  'messengerUrl',
  'facebookUrl',
  'instagramUrl',
  'tiktokUrl',
  'contactEmail',
];

/** A phone row's key in the server's answer: `phones[1].number`. */
const PHONE_KEY = /^phones\[(\d{1,3})\]\.(number|label)$/i;

/** The form field a server error key belongs to (the server keys in its own casing), or null when this form draws no such field. */
function formPathOf(key: string): Path<BusinessInfoInput> | null {
  const lower = key.toLowerCase();
  if (lower === 'phones') {
    return 'phones.root' as Path<BusinessInfoInput>;
  }
  const row = PHONE_KEY.exec(key);
  if (row?.[1] !== undefined && row[2] !== undefined) {
    return `phones.${String(Number(row[1]))}.${row[2].toLowerCase()}` as Path<BusinessInfoInput>;
  }
  return TEXT_NAMES.find((name) => name.toLowerCase() === lower) ?? null;
}

interface TextFieldProps {
  control: Control<BusinessInfoInput>;
  name: TextName;
  label: string;
  hint?: string;
  placeholder?: string;
  /** A textarea of this many rows. */
  rows?: number;
  required?: boolean;
  className?: string;
  type?: 'text' | 'email' | 'url';
  inputMode?: 'numeric' | 'email' | 'url';
  /** What the field holds once the person leaves it (the pasted embed code is cut down to its link). */
  onLeave?: (value: string) => string;
}

function TextField({
  control,
  name,
  label,
  hint,
  placeholder,
  rows,
  required = false,
  className,
  type,
  inputMode,
  onLeave,
}: TextFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const shared = {
          label,
          hint,
          placeholder,
          name: field.name,
          value: field.value,
          onChange: field.onChange,
          onBlur: () => {
            const left = onLeave?.(field.value);
            if (left !== undefined && left !== field.value) {
              field.onChange(left);
            }
            field.onBlur();
          },
          error: fieldState.error?.message ?? '',
          required,
          autoComplete: 'off',
          ...(className === undefined ? {} : { className }),
        };
        if (rows !== undefined) {
          return <Field multiline rows={rows} {...shared} />;
        }
        return (
          <Field
            {...shared}
            {...(type === undefined ? {} : { type })}
            {...(inputMode === undefined ? {} : { inputMode })}
          />
        );
      }}
    />
  );
}

interface CardProps {
  title: string;
  hint: string;
  children: ReactNode;
}

function Card({ title, hint, children }: CardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={profileCardClasses}>
      <div className={profileCardHeadClasses}>
        <div>
          <h2 id={headingId} className={profileCardTitleClasses}>
            {title}
          </h2>
          <p className={profileCardHintClasses}>{hint}</p>
        </div>
      </div>
      <div className={profileCardBodyClasses}>{children}</div>
    </section>
  );
}

interface BusinessInfoFormProps {
  settings: SiteSettings;
  onDirtyChange: ((dirty: boolean) => void) | undefined;
  /** Reads the settings from the server again (Load Latest). */
  reload: () => Promise<ReloadResult>;
}

function BusinessInfoForm({ settings, onDirtyChange, reload }: BusinessInfoFormProps) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  // The settings version this form was opened with: changed only by a save of this form.
  const [version, setVersion] = useState(settings.version);
  // What Undo Changes goes back to: the values the form opened with, then those of the last save or of Load Latest.
  const [baseline, setBaseline] = useState(() => businessInfoValuesOf(settings));
  // How many stale saves the server has refused since the form was last current; the banner shows from the first.
  const [conflicts, setConflicts] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [asking, setAsking] = useState(false);
  // The polite line read out after Load Latest.
  const [status, setStatus] = useState('');
  // Counts the times focus should move to the first flagged field once its message is on screen.
  const [focusTick, setFocusTick] = useState(0);
  const form = useForm<BusinessInfoInput>({
    resolver: zodResolver(businessInfoSchema),
    mode: 'onBlur',
    defaultValues: businessInfoValuesOf(settings),
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isDirty },
  } = form;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  // A tab that closes leaves nothing unsaved behind.
  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );
  useEffect(() => {
    if (focusTick > 0 && formRef.current !== null) {
      focusFirstInvalid(formRef.current);
    }
  }, [focusTick]);

  const { submit, pending } = useUpdateSiteSettings({
    onSuccess: (saved) => {
      const savedValues = businessInfoValuesOf(saved);
      setVersion(saved.version);
      setBaseline(savedValues);
      setConflicts(0);
      reset(savedValues);
      toast.show({ title: COPY.toast.title, message: COPY.toast.message });
    },
    onFailure: (copy, error) => {
      if (isHttpError(error) && error.status === 409 && error.code === EDIT_STALE) {
        setConflicts((count) => count + 1);
        return;
      }
      if (isHttpError(error) && error.status === 400) {
        let placed = 0;
        let other: string | undefined;
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          const message = messages[0];
          if (message === undefined) {
            continue;
          }
          const path = formPathOf(key);
          if (path === null) {
            other ??= message;
          } else {
            setError(path, { type: 'server', message });
            placed += 1;
          }
        }
        if (placed > 0) {
          setFocusTick((tick) => tick + 1);
          return;
        }
        // No rendered field matches: say what the server said.
        toast.show({ tone: 'danger', title: other ?? copy.title, message: other === undefined ? copy.body : '' });
        return;
      }
      toast.show({ tone: 'danger', title: copy.title, message: copy.body });
    },
  });

  /** Load Latest, once the person has agreed to lose what was typed: the values are replaced only when the latest version has arrived. */
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
    const latest = businessInfoValuesOf(result.settings);
    setVersion(result.settings.version);
    setBaseline(latest);
    setConflicts(0);
    reset(latest);
    setStatus(COPY.latestLoaded);
    formRef.current?.querySelector<HTMLElement>('input')?.focus();
  };

  const onValid = async (values: BusinessInfoInput): Promise<void> => {
    await submit(toSiteSettingsRequest(values, version));
  };

  const onInvalid = (): void => {
    setFocusTick((tick) => tick + 1);
  };

  const changedBy = settings.updatedByName === null ? null : { name: settings.updatedByName, formerStaff: false };

  return (
    <FormProvider {...form}>
      <form
        ref={formRef}
        noValidate
        className={siteContentStackClasses}
        onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
          void handleSubmit(onValid, onInvalid)(event);
        }}
      >
        {conflicts > 0 && (
          <ConflictBanner
            key={conflicts}
            pending={loadingLatest}
            onLoadLatest={() => {
              setAsking(true);
            }}
          />
        )}
        <Card title={COPY.cards.business.title} hint={COPY.cards.business.hint}>
          <div className={profileFormGridClasses}>
            <TextField
              control={control}
              name="businessName"
              label={COPY.fields.businessName.label}
              hint={COPY.fields.businessName.hint}
              className={expensesFullRowClasses}
              required
            />
            <TextField
              control={control}
              name="tagline"
              label={COPY.fields.tagline.label}
              hint={COPY.fields.tagline.hint}
              className={expensesFullRowClasses}
              rows={2}
              required
            />
            <TextField
              control={control}
              name="aboutText"
              label={COPY.fields.aboutText.label}
              hint={COPY.fields.aboutText.hint}
              className={expensesFullRowClasses}
              rows={4}
            />
            <TextField
              control={control}
              name="turnaroundLine"
              label={COPY.fields.turnaroundLine.label}
              hint={COPY.fields.turnaroundLine.hint}
              placeholder={COPY.fields.turnaroundLine.placeholder}
              className={expensesFullRowClasses}
              rows={2}
            />
          </div>
        </Card>
        <Card title={COPY.cards.address.title} hint={COPY.cards.address.hint}>
          <div className={profileFormGridClasses}>
            <TextField
              control={control}
              name="street"
              label={COPY.fields.street.label}
              placeholder={COPY.fields.street.placeholder}
              className={expensesFullRowClasses}
              required
            />
            <TextField control={control} name="townOrCity" label={COPY.fields.townOrCity.label} required />
            <TextField control={control} name="province" label={COPY.fields.province.label} required />
            <TextField control={control} name="postalCode" label={COPY.fields.postalCode.label} inputMode="numeric" />
            <TextField
              control={control}
              name="directionsUrl"
              label={COPY.fields.directionsUrl.label}
              hint={COPY.fields.directionsUrl.hint}
              className={expensesFullRowClasses}
              type="url"
              inputMode="url"
            />
            <TextField
              control={control}
              name="mapEmbedUrl"
              label={COPY.fields.mapEmbedUrl.label}
              hint={COPY.fields.mapEmbedUrl.hint}
              className={expensesFullRowClasses}
              onLeave={reduceEmbedCode}
            />
          </div>
        </Card>
        <Card title={COPY.cards.phones.title} hint={COPY.cards.phones.hint}>
          <PhoneNumbersField />
        </Card>
        <Card title={COPY.cards.links.title} hint={COPY.cards.links.hint}>
          <div className={profileFormGridClasses}>
            <TextField
              control={control}
              name="messengerUrl"
              label={COPY.fields.messengerUrl.label}
              hint={COPY.fields.messengerUrl.hint}
              className={expensesFullRowClasses}
              type="url"
              inputMode="url"
            />
            <TextField
              control={control}
              name="facebookUrl"
              label={COPY.fields.facebookUrl.label}
              className={expensesFullRowClasses}
              type="url"
              inputMode="url"
            />
            <TextField
              control={control}
              name="instagramUrl"
              label={COPY.fields.instagramUrl.label}
              className={expensesFullRowClasses}
              type="url"
              inputMode="url"
            />
            <TextField
              control={control}
              name="tiktokUrl"
              label={COPY.fields.tiktokUrl.label}
              className={expensesFullRowClasses}
              type="url"
              inputMode="url"
            />
          </div>
        </Card>
        <Card title={COPY.cards.email.title} hint={COPY.cards.email.hint}>
          <TextField
            control={control}
            name="contactEmail"
            label={COPY.fields.contactEmail.label}
            type="email"
            inputMode="email"
          />
        </Card>
        {/* SPEC-GAP: business info. The fixed time zone and money format, read only (OQ-6 A, D-35). */}
        <Card title={COPY.cards.zone.title} hint={COPY.cards.zone.hint}>
          <dl className={recordMetaClasses}>
            <div className={recordMetaRowClasses}>
              <dt className={recordMetaTermClasses}>{COPY.zone.timeZone.label}</dt>
              <dd className={recordMetaValueClasses}>{COPY.zone.timeZone.value}</dd>
            </div>
            <div className={recordMetaRowClasses}>
              <dt className={recordMetaTermClasses}>{COPY.zone.money.label}</dt>
              <dd className={recordMetaValueClasses}>{COPY.zone.money.value}</dd>
            </div>
          </dl>
        </Card>
        <RecordMeta
          recordedBy={null}
          recordedAt={null}
          lastChangedBy={changedBy}
          lastChangedAt={settings.updatedAtUtc}
        />
        <div className={siteContentActionsClasses}>
          <Button
            variant="secondary"
            aria-disabled={!isDirty || pending}
            onClick={() => {
              if (isDirty && !pending) {
                reset(baseline);
              }
            }}
          >
            {COPY.actions.undo}
          </Button>
          <Button type="submit" variant="primary" icon="check" pending={pending}>
            {pending ? COPY.actions.saving : COPY.actions.save}
          </Button>
        </div>
      </form>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {status}
      </div>
      <ConfirmDialog
        open={asking}
        title={SITE_CONTENT_COPY.discard.title}
        message={SITE_CONTENT_COPY.discard.loadLatestMessage}
        cancelLabel={SITE_CONTENT_COPY.discard.keep}
        confirmLabel={SITE_CONTENT_COPY.discard.discard}
        onConfirm={() => {
          setAsking(false);
          void loadLatest();
        }}
        onCancel={() => {
          setAsking(false);
        }}
      />
    </FormProvider>
  );
}

/** The cards, as grey blocks, while the first answer is on its way. */
function BusinessInfoSkeleton() {
  return (
    <section className={profileCardClasses} aria-hidden="true">
      <div className={profileCardBodyClasses}>
        <SkeletonText />
      </div>
    </section>
  );
}

export interface BusinessInfoTabProps {
  /** Called with true while any field differs from the saved settings, and with false when the tab closes. */
  onDirtyChange?: ((dirty: boolean) => void) | undefined;
}

export function BusinessInfoTab({ onDirtyChange }: BusinessInfoTabProps) {
  const query = useSiteSettingsQuery();
  const settings = query.data;
  const reload = async (): Promise<ReloadResult> => {
    const result = await query.refetch();
    return result.isError || result.data === undefined ? { error: result.error } : { settings: result.data };
  };
  let content;
  if (settings !== undefined) {
    content = <BusinessInfoForm settings={settings} onDirtyChange={onDirtyChange} reload={reload} />;
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
    content = <BusinessInfoSkeleton />;
  }
  return (
    <LoadingRegion loading={query.isPending} failed={query.isError} things={COPY.things}>
      {content}
    </LoadingRegion>
  );
}
