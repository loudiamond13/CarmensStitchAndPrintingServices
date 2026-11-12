// SPEC-GAP: business info
// S1 Business Info tab, /admin/site-content (CONT-01, PUB-03, D-23..D-26, D-35; plan 11-12). One form of cards, saved by one
// "Save Business Info" with the settings version it was opened with.
//   - The form is filled from the settings once, when the tab has them. The version a save sends is the one the form was opened
//     with, never the live query data: a refetch from elsewhere cannot hide a stale save, the server refuses it (SEC-07).
//   - A save that goes through shows the toast, puts the saved settings in the query cache and clears the public data held in this
//     browser (invalidatePublicContent). Focus stays on Save.
//   - The tab tells its page whether anything is unsaved (`onDirtyChange`), so the page can ask before a tab change or a leave.
import { useEffect, useId, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { Field } from '@/components/forms';
import { ErrorState, LoadingRegion, SkeletonText } from '@/components/states';
import { siteContentActionsClasses, siteContentStackClasses } from '@/modules/admin/components/siteContent.recipe';
import {
  profileCardBodyClasses,
  profileCardClasses,
  profileCardHeadClasses,
  profileCardHintClasses,
  profileCardTitleClasses,
  profileFormGridClasses,
} from '@/modules/admin/components/profile.recipe';
import { expensesFullRowClasses } from '@/modules/admin/components/expenses.recipe';
import { useSiteSettingsQuery, useUpdateSiteSettings } from '@/modules/admin/hooks/useSiteSettingsQuery';
import type { SiteSettings } from '@/modules/admin/services/siteSettingsService';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import {
  businessInfoValuesOf,
  toSiteSettingsRequest,
  type BusinessInfoInput,
} from '@/modules/admin/siteContentSchemas';

const COPY = SITE_CONTENT_COPY.business;

/** The fields that hold one text. */
type TextName = Exclude<keyof BusinessInfoInput, 'phones'>;

interface TextFieldProps {
  control: Control<BusinessInfoInput>;
  name: TextName;
  label: string;
  hint?: string | undefined;
  placeholder?: string | undefined;
  /** A textarea of this many rows. */
  rows?: number | undefined;
  required?: boolean;
  className?: string;
}

function TextField({ control, name, label, hint, placeholder, rows, required = false, className }: TextFieldProps) {
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
          onBlur: field.onBlur,
          error: fieldState.error?.message ?? '',
          required,
          autoComplete: 'off',
          ...(className === undefined ? {} : { className }),
        };
        return rows === undefined ? <Field {...shared} /> : <Field multiline rows={rows} {...shared} />;
      }}
    />
  );
}

interface CardProps {
  title: string;
  hint: string;
  children: React.ReactNode;
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
}

function BusinessInfoForm({ settings, onDirtyChange }: BusinessInfoFormProps) {
  const toast = useToast();
  // The settings version this form was opened with: changed only by a save of this form.
  const [version, setVersion] = useState(settings.version);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<BusinessInfoInput>({ defaultValues: businessInfoValuesOf(settings) });

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

  const { submit, pending } = useUpdateSiteSettings({
    onSuccess: (saved) => {
      setVersion(saved.version);
      reset(businessInfoValuesOf(saved));
      toast.show({ title: COPY.toast.title, message: COPY.toast.message });
    },
    onFailure: (copy) => {
      toast.show({ tone: 'danger', title: copy.title, message: copy.body });
    },
  });

  const onValid = async (values: BusinessInfoInput): Promise<void> => {
    await submit(toSiteSettingsRequest(values, version));
  };

  return (
    <form
      noValidate
      className={siteContentStackClasses}
      onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
        void handleSubmit(onValid)(event);
      }}
    >
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
      <div className={siteContentActionsClasses}>
        <Button type="submit" variant="primary" icon="check" pending={pending}>
          {pending ? COPY.actions.saving : COPY.actions.save}
        </Button>
      </div>
    </form>
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
  let content;
  if (settings !== undefined) {
    content = <BusinessInfoForm settings={settings} onDirtyChange={onDirtyChange} />;
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
