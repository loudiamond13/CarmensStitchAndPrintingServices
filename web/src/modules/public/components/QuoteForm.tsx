// SPEC-GAP: quote form (UI-SPEC Q1 and Q3; INQ-01, INQ-03, D-26, D-31, D-35, D-38). The Get a Quote form of the Contact page: zod
// speaks first (every server rule runs here with the server's words), one Idempotency-Key per filled form, and nothing a visitor
// typed is cleared by a failure; only a success and Send Another clear it. It loads as its own piece after the page shows (D-35),
// so react-hook-form and zod never sit in the Contact page's first download.
// The ticket (Pitfall 4): the form waits out the server's minimum time after it gets the ticket, and an expired-ticket answer is
// resent once, at once, with the replacement ticket the server hands back (D-38) and a new Idempotency-Key.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/actions/Button';
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/ToastProvider';
import { Field } from '@/components/forms/Field';
import { Select, type SelectOption } from '@/components/forms/Select';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { pickErrorBodyClasses, pickErrorClasses, pickErrorIconClasses } from '@/components/media/media.recipe';
import { isHttpError } from '@/core/api/errors';
import { newIdempotencyKey } from '@/lib/forms/idempotencyKey';
import { useSubmission } from '@/lib/forms/useSubmission';
import { cardHeadClasses, cardTitleClasses, formCardClasses, smallMutedClasses } from './contact.recipe';
import { inlineLinkClasses } from './legal.recipe';
import {
  quoteFormFooterClasses,
  quoteFormGridClasses,
  quoteFormMessageClasses,
  quoteFormNoticeClasses,
  quoteFormSendClasses,
  quoteFormStatusClasses,
  quoteFormStatusTextClasses,
} from './quoteForm.recipe';
import { PUBLIC_COPY } from '../copy';
import { useProductLinesQuery } from '../hooks/useProductLinesQuery';
import { useQuoteTicket } from '../hooks/useQuoteTicket';
import {
  EMPTY_QUOTE_FORM,
  QUOTE_QUANTITIES,
  quoteFormSchema,
  toCreateQuoteRequest,
  type QuoteFormValues,
} from '../quoteSchemas';
import { quoteService, type CreateQuoteAnswer } from '../services/quoteService';

const COPY = PUBLIC_COPY.contact.form;

const TICKET_EXPIRED_CODE = 'quote-requests.ticket-expired';

/** The fields in page order: the first one with an error takes focus. */
const FIELD_ORDER = ['customerName', 'teamName', 'contactNumber', 'email', 'product', 'quantity', 'message'] as const;

/** The one resend an expired ticket starts: the replacement ticket and its own key, kept so a retry repeats it and never sends twice. */
interface Resend {
  readonly forKey: string;
  readonly key: string;
  readonly ticket: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function QuoteForm() {
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const resendRef = useRef<Resend | undefined>(undefined);
  const focusNameNext = useRef(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();
  const tickets = useQuoteTicket();
  const lines = useProductLinesQuery();
  // The visible lines in the Products page order, then the two fixed choices. Until the lines arrive, or when the read fails,
  // only the two fixed choices show and no message is shown (D-24).
  const productOptions: SelectOption[] = [
    ...(lines.status === 'success'
      ? lines.data.lines.map((line) => ({ value: `line:${line.key}`, label: line.title }))
      : []),
    { value: 'custom', label: COPY.product.custom },
    { value: 'not-sure', label: COPY.product.notSure },
  ];
  const { control, handleSubmit, reset } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    mode: 'onBlur',
    shouldFocusError: false,
    defaultValues: EMPTY_QUOTE_FORM,
  });

  const focusField = (name: (typeof FIELD_ORDER)[number]): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  // Sends the checked values, one Idempotency-Key per filled form (WEB-09), and answers an expired ticket once with its replacement.
  const send = async (key: string, values: QuoteFormValues): Promise<CreateQuoteAnswer> => {
    const body = toCreateQuoteRequest(values);
    const repeat = resendRef.current;
    if (repeat?.forKey === key) {
      return quoteService.create({ ...body, ticket: repeat.ticket }, repeat.key);
    }
    const held = await tickets.ready();
    const remaining = held === null ? 0 : held.issuedAt + held.minimumSeconds * 1000 - Date.now();
    if (remaining > 0) {
      await wait(remaining);
    }
    try {
      return await quoteService.create({ ...body, ticket: held?.ticket ?? null }, key);
    } catch (error: unknown) {
      const problem = isHttpError(error) && error.code === TICKET_EXPIRED_CODE ? error.problem : undefined;
      const replacement = problem?.replacementTicket;
      if (replacement === undefined) {
        throw error;
      }
      tickets.adopt(replacement, problem?.minimumSeconds ?? held?.minimumSeconds ?? 0);
      const resend: Resend = { forKey: key, key: newIdempotencyKey(), ticket: replacement };
      resendRef.current = resend;
      return quoteService.create({ ...body, ticket: replacement }, resend.key);
    }
  };

  const submission = useSubmission<QuoteFormValues, CreateQuoteAnswer>(send, {
    onSuccess: () => {
      resendRef.current = undefined;
      setSent(true);
      toast.show({ tone: 'success', title: COPY.success.toastTitle, message: COPY.success.toastMessage });
    },
  });

  // The success heading takes focus, so a screen reader hears it (UI-SPEC Q3); Send Another puts focus back on the first field.
  useEffect(() => {
    if (sent) {
      const heading = successRef.current?.querySelector('h2');
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus();
      }
    } else if (focusNameNext.current) {
      focusNameNext.current = false;
      focusField('customerName');
    }
  }, [sent]);

  const sendAnother = (): void => {
    reset(EMPTY_QUOTE_FORM);
    submission.reset();
    resendRef.current = undefined;
    tickets.refresh();
    focusNameNext.current = true;
    setSent(false);
  };

  const onInvalid = (errors: FieldErrors<QuoteFormValues>): void => {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  if (sent) {
    return (
      <div ref={successRef} className={formCardClasses}>
        <EmptyState
          icon="circle-check"
          level={2}
          title={COPY.success.title}
          message={COPY.success.message}
          action={
            <Button variant="secondary" onClick={sendAnother}>
              {COPY.success.another}
            </Button>
          }
        />
      </div>
    );
  }

  const { pending } = submission;
  return (
    <form
      ref={formRef}
      className={formCardClasses}
      noValidate
      aria-labelledby={titleId}
      onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
        void handleSubmit(async (values) => {
          await submission.submit(values);
        }, onInvalid)(event);
      }}
    >
      <div className={cardHeadClasses}>
        <h2 id={titleId} className={cardTitleClasses}>
          {COPY.title}
        </h2>
        <p className={smallMutedClasses}>{COPY.caption}</p>
      </div>
      <div className={quoteFormGridClasses}>
        <Controller
          control={control}
          name="customerName"
          render={({ field, fieldState }) => (
            <Field
              label={COPY.name.label}
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              placeholder={COPY.name.placeholder}
              autoComplete="name"
              readOnly={pending}
            />
          )}
        />
        <Controller
          control={control}
          name="teamName"
          render={({ field, fieldState }) => (
            <Field
              label={COPY.team.label}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              placeholder={COPY.team.placeholder}
              autoComplete="organization"
              readOnly={pending}
            />
          )}
        />
        <Controller
          control={control}
          name="contactNumber"
          render={({ field, fieldState }) => (
            <Field
              label={COPY.number.label}
              required
              type="tel"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              hint={COPY.number.hint}
              placeholder={COPY.number.placeholder}
              autoComplete="tel"
              inputMode="tel"
              readOnly={pending}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              label={COPY.email.label}
              type="email"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              placeholder={COPY.email.placeholder}
              autoComplete="email"
              inputMode="email"
              readOnly={pending}
            />
          )}
        />
        <Controller
          control={control}
          name="product"
          render={({ field, fieldState }) => (
            <Select
              label={COPY.product.label}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              placeholder={COPY.product.placeholder}
              options={productOptions}
              disabled={pending}
            />
          )}
        />
        <Controller
          control={control}
          name="quantity"
          render={({ field, fieldState }) => (
            <Select
              label={COPY.quantity.label}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              placeholder={COPY.quantity.placeholder}
              options={QUOTE_QUANTITIES}
              disabled={pending}
            />
          )}
        />
        <Controller
          control={control}
          name="message"
          render={({ field, fieldState }) => (
            <Field
              multiline
              rows={6}
              className={quoteFormMessageClasses}
              label={COPY.message.label}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              placeholder={COPY.message.placeholder}
              readOnly={pending}
            />
          )}
        />
        {/* The reference photo picker joins the form here (plan 13-12). */}
      </div>
      {/* The honeypot (INQ-03, D-25): off-screen, never display:none, out of the Tab order and hidden from assistive technology. */}
      <div aria-hidden="true" className={srOnlyClasses}>
        <Controller
          control={control}
          name="subjectLine"
          render={({ field }) => (
            <label>
              {COPY.honeypot}
              <input
                type="text"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          )}
        />
      </div>
      <div className={quoteFormFooterClasses}>
        <p className={quoteFormNoticeClasses}>
          {COPY.notice.before}
          <UiLink to="/privacy" className={inlineLinkClasses}>
            {COPY.notice.link}
          </UiLink>
          {COPY.notice.after}
        </p>
        <Button
          variant="primary"
          size="lg"
          type="submit"
          iconRight="arrow-right"
          pending={pending}
          className={quoteFormSendClasses}
        >
          {pending ? COPY.sending : COPY.submit}
        </Button>
      </div>
      <div className={quoteFormStatusClasses}>
        {submission.error !== undefined && (
          <div className={pickErrorClasses} role="alert">
            <span className={pickErrorIconClasses}>
              <Icon name="triangle-alert" size={18} />
            </span>
            <div className={pickErrorBodyClasses}>
              <p className={quoteFormStatusTextClasses}>{COPY.sendFailed}</p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

export default QuoteForm;
