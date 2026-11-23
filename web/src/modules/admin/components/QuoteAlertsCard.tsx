// SPEC-GAP: quote alerts card
// R5 Quote alerts card of the Business Info tab (INQ-04, D-07, OR-3; plan 13-07): the one optional staff address that gets an email
// for each quote request. It sits inside the tab's form, so Save Business Info saves it with the rest in one settings version, and it
// is checked on leave, on submit and then while typed in, like every other field of the tab. The Send Test Email button is plan 13-13.
import { Controller, type Control } from 'react-hook-form';
import { Field } from '@/components/forms';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import type { BusinessInfoInput } from '@/modules/admin/siteContentSchemas';

const COPY = SITE_CONTENT_COPY.business;

export interface QuoteAlertsCardProps {
  control: Control<BusinessInfoInput>;
}

export function QuoteAlertsCard({ control }: QuoteAlertsCardProps) {
  return (
    <SiteContentCard title={COPY.cards.quoteAlerts.title} hint={COPY.cards.quoteAlerts.hint}>
      <Controller
        control={control}
        name="quoteAlertsEmail"
        render={({ field, fieldState }) => (
          <Field
            label={COPY.fields.quoteAlertsEmail.label}
            hint={COPY.fields.quoteAlertsEmail.hint}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? ''}
            type="email"
            inputMode="email"
            autoComplete="off"
          />
        )}
      />
    </SiteContentCard>
  );
}
