// SPEC-GAP: quote alerts card
// R5 Quote alerts card of the Business Info tab (INQ-04, D-07, OR-3; plan 13-07): the one optional staff address that gets an email
// for each quote request. It sits inside the tab's form, so Save Business Info saves it with the rest in one settings version, and it
// is checked on leave, on submit and then while typed in, like every other field of the tab. Send Test Email (D-11) sits outside the
// save flow and emails the saved address.
import { Controller, type Control } from 'react-hook-form';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { Field } from '@/components/forms';
import { useSubmission } from '@/lib/forms/useSubmission';
import { siteSettingsService } from '@/modules/admin/services/siteSettingsService';
import { SiteContentCard } from '@/modules/admin/components/SiteContentCard';
import { SITE_CONTENT_COPY } from '@/modules/admin/siteContentCopy';
import type { BusinessInfoInput } from '@/modules/admin/siteContentSchemas';

const COPY = SITE_CONTENT_COPY.business;
const TEST = COPY.quoteAlertTest;

export interface QuoteAlertsCardProps {
  control: Control<BusinessInfoInput>;
  /** The address the server holds: the test goes there, never to what is typed. */
  savedAddress: string;
}

export function QuoteAlertsCard({ control, savedAddress }: QuoteAlertsCardProps) {
  const toast = useToast();
  const test = useSubmission<undefined, undefined>((key) => siteSettingsService.sendQuoteAlertTest(key));

  const sendTest = async (): Promise<void> => {
    const outcome = await test.submit();
    if (outcome.ok) {
      toast.show({ title: TEST.sent.title, message: TEST.sent.message(savedAddress) });
      // Each press is a new test, so the next one gets its own request key.
      test.reset();
    }
  };

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
      <Button
        variant="secondary"
        icon="mail"
        type="button"
        className="self-start"
        pending={test.pending}
        onClick={() => {
          void sendTest();
        }}
      >
        {test.pending ? TEST.pending : TEST.action}
      </Button>
    </SiteContentCard>
  );
}
