// SPEC-GAP: quote alerts card
// R5 Quote alerts card of the Business Info tab (INQ-04, D-07, OR-3; plan 13-07): the one optional staff address that gets an email
// for each quote request. It sits inside the tab's form, so Save Business Info saves it with the rest in one settings version, and it
// is checked on leave, on submit and then while typed in, like every other field of the tab. Send Test Email (D-11) sits outside the
// save flow and emails the saved address.
import { useId } from 'react';
import { Controller, useWatch, type Control } from 'react-hook-form';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { Field, messageClasses } from '@/components/forms';
import { isHttpError } from '@/core/api/errors';
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
  const reasonId = useId();
  const typed = useWatch({ control, name: 'quoteAlertsEmail' });
  // The saved address is the submission's data, so a newly saved address is a new test with a new key.
  const test = useSubmission<string, unknown>((key) => siteSettingsService.sendQuoteAlertTest(key));

  // Why the button waits: nothing saved yet, or the field holds an unsaved change (R5 empty and partial).
  const saved = savedAddress.trim();
  let reason: string | null = null;
  if (saved.length === 0) {
    reason = TEST.noAddress;
  } else if (typed.trim() !== saved) {
    reason = TEST.unsaved;
  }

  const sendTest = async (): Promise<void> => {
    const address = saved;
    const outcome = await test.submit(address);
    if (outcome.ok) {
      toast.show({ title: TEST.sent.title, message: TEST.sent.message(address) });
      // A sent test is done, so the next press is a new test with its own request key. A failed one keeps its key for a retry.
      test.reset();
      return;
    }
    const copy = isHttpError(outcome.error) && outcome.error.status === 429 ? TEST.limited : TEST.failed;
    toast.show({ tone: 'danger', title: copy.title, message: copy.message });
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
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="secondary"
          icon="mail"
          type="button"
          pending={test.pending}
          aria-disabled={reason !== null}
          {...(reason === null ? {} : { 'aria-describedby': reasonId })}
          onClick={() => {
            void sendTest();
          }}
        >
          {test.pending ? TEST.pending : TEST.action}
        </Button>
        {reason !== null && (
          <p id={reasonId} className={messageClasses({ error: false })}>
            {reason}
          </p>
        )}
      </div>
    </SiteContentCard>
  );
}
