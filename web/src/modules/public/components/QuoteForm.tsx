// The Get a Quote form of the Contact page (UI-SPEC Q1 and Q3). It checks every field with the server's rules before sending,
// waits the server's minimum time after it gets a ticket, and keeps what the visitor typed when a send fails.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/actions/Button';
import { UiLink } from '@/components/actions/UiLink';
import { useToast } from '@/components/feedback/ToastProvider';
import { Field } from '@/components/forms/Field';
import { Select, type SelectOption } from '@/components/forms/Select';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { isHttpError } from '@/core/api/errors';
import { newIdempotencyKey } from '@/lib/forms/idempotencyKey';
import { useSubmission } from '@/lib/forms/useSubmission';
import { cardHeadClasses, cardTitleClasses, formCardClasses, smallMutedClasses } from './contact.recipe';
import {
  quoteFormFooterClasses,
  quoteFormGridClasses,
  quoteFormMessageClasses,
  quoteFormNoticeClasses,
  quoteFormNoticeLinkClasses,
  quotePhotoSlotClasses,
  quoteFormSendClasses,
  quoteFormLiveClasses,
  quoteFormStatusClasses,
  quoteFormStatusTextClasses,
} from './quoteForm.recipe';
import { PUBLIC_COPY } from '../copy';
import { useProductLinesQuery } from '../hooks/useProductLinesQuery';
import { useQuoteProductPreselect } from '../hooks/useQuoteProductPreselect';
import { useQuoteTicket } from '../hooks/useQuoteTicket';
import { useSiteQuery } from '../hooks/useSiteQuery';
import {
  EMPTY_QUOTE_FORM,
  QUOTE_FIELD_ORDER,
  QUOTE_QUANTITIES,
  quoteFormSchema,
  toCreateQuoteRequest,
  type QuoteField,
  type QuoteFormValues,
} from '../quoteSchemas';
import { quoteService, type CreateQuoteBody, type QuoteService } from '../services/quoteService';
import { loadQuotePhotoKit, type QuotePhotoKit } from './lazyQuotePhotoKit';
import { loadQuoteSendAnswers, type QuoteSendAnswers } from './lazyQuoteSendAnswers';
import { QuoteSentResult } from './QuoteFormResult';
import type { QuotePhotoPickerHandle } from './QuotePhotoPicker';
import { QuotePhotoSlot } from './QuotePhotoSlot';

const COPY = PUBLIC_COPY.contact.form;

const TICKET_EXPIRED_CODE = 'quote-requests.ticket-expired';

/** The one resend an expired ticket starts: the replacement ticket and its own key, kept so a retry repeats it and never sends twice. */
interface Resend {
  readonly forKey: string;
  readonly key: string;
  readonly ticket: string;
}

/** What one send is made of: the checked values and the photos picked. */
interface QuoteSend {
  readonly values: QuoteFormValues;
  readonly photos: readonly File[];
}

/** How a send ended: the names of the photos that did not arrive, of how many sent, and the photo piece's note for them. */
interface QuoteSent {
  readonly missing: readonly string[];
  readonly total: number;
  readonly MissingPhotos?: QuotePhotoKit['QuoteMissingPhotos'];
}

/** Names a send for the double-press and retry guard: the values and each photo's name, size and time. */
const identityOf = ({ values, photos }: QuoteSend): string =>
  JSON.stringify([values, photos.map((file) => [file.name, file.size, file.lastModified])]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export interface QuoteFormProps {
  /** The ticket, create and photo calls; the showcase passes demo ones, so nothing is sent. Read once, on the first render. */
  service?: QuoteService;
}

export function QuoteForm({ service = quoteService }: QuoteFormProps = {}) {
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const resendRef = useRef<Resend | undefined>(undefined);
  const uploadKeyRef = useRef<{ forKey: string; uploadKey: string } | undefined>(undefined);
  const pickerRef = useRef<QuotePhotoPickerHandle>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const focusNameNext = useRef(false);
  // The server-answer piece: loaded on Send, or 'failed' when it could not load (the plain send-failed box shows then).
  const [answers, setAnswers] = useState<QuoteSendAnswers | 'failed' | null>(null);
  const [sent, setSent] = useState<QuoteSent | null>(null);
  const toast = useToast();
  // Read once: the ticket and the sends must use the same service.
  const [api] = useState(() => service);
  const tickets = useQuoteTicket(api);
  const site = useSiteQuery();
  const messengerUrl = site.status === 'success' ? site.data.messengerUrl : null;
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
  const { control, handleSubmit, reset, setError, setValue } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    mode: 'onBlur',
    shouldFocusError: false,
    defaultValues: EMPTY_QUOTE_FORM,
  });
  // A ?product= line is chosen once its line arrives, unless the visitor chose first (Q4).
  const preselect = useQuoteProductPreselect(
    lines.status === 'success' ? lines.data.lines : null,
    useWatch({ control, name: 'product' }),
  );
  useEffect(() => {
    if (preselect !== null) {
      setValue('product', `line:${preselect}`);
    }
  }, [preselect, setValue]);

  const focusField = (name: QuoteField): void => {
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  // Creates the request with one Idempotency-Key per filled form. An expired ticket is answered once, at once, with the replacement.
  const create = async (key: string, body: Omit<CreateQuoteBody, 'ticket'>) => {
    const repeat = resendRef.current;
    if (repeat?.forKey === key) {
      return api.create({ ...body, ticket: repeat.ticket }, repeat.key);
    }
    const held = await tickets.ready();
    const remaining = held === null ? 0 : held.issuedAt + held.minimumSeconds * 1000 - Date.now();
    if (remaining > 0) {
      await wait(remaining);
    }
    try {
      return await api.create({ ...body, ticket: held?.ticket ?? null }, key);
    } catch (error: unknown) {
      const problem = isHttpError(error) && error.code === TICKET_EXPIRED_CODE ? error.problem : undefined;
      const replacement = problem?.replacementTicket;
      if (replacement === undefined) {
        // No replacement came with the expired answer: the held ticket is dead, so the next send waits for a new one.
        if (problem !== undefined) {
          tickets.refresh();
        }
        throw error;
      }
      tickets.adopt(replacement, problem?.minimumSeconds ?? held?.minimumSeconds ?? 0);
      const resend: Resend = { forKey: key, key: newIdempotencyKey(), ticket: replacement };
      resendRef.current = resend;
      return api.create({ ...body, ticket: replacement }, resend.key);
    }
  };

  // The text is saved first; each photo then goes to its own place, and a photo that fails is only reported (D-03).
  const send = async (key: string, { values, photos: picked }: QuoteSend): Promise<QuoteSent> => {
    const body = toCreateQuoteRequest(values);
    if (picked.length === 0) {
      await create(key, body);
      return { missing: [], total: 0 };
    }
    const kit = await loadQuotePhotoKit();
    const missing = await kit.sendWithPhotos({
      key,
      body,
      photos: picked,
      held: uploadKeyRef,
      create: (withPhotos) => create(key, withPhotos),
      service: api,
    });
    return { missing, total: picked.length, MissingPhotos: kit.QuoteMissingPhotos };
  };

  const submission = useSubmission<QuoteSend, QuoteSent>(send, {
    identity: identityOf,
    onSuccess: (result) => {
      resendRef.current = undefined;
      uploadKeyRef.current = undefined;
      setSent(result);
      toast.show({ tone: 'success', title: COPY.success.toastTitle, message: COPY.success.toastMessage });
    },
  });

  // The success heading takes focus, so a screen reader hears it (UI-SPEC Q3); Send Another puts focus back on the first field.
  useEffect(() => {
    if (sent !== null) {
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

  // Send waits for photos still being loaded or checked (review W5 CR-01); the form shows it is sending meanwhile.
  const [settling, setSettling] = useState(false);
  const { pending: sending, error: sendError } = submission;
  const pending = sending || settling;

  // Starts loading the server-answer piece as a send starts, so a refusal shows at once.
  const loadAnswers = (): void => {
    if (answers !== null && answers !== 'failed') {
      return;
    }
    loadQuoteSendAnswers().then(setAnswers, () => {
      setAnswers('failed');
    });
  };

  const sendAnother = (): void => {
    reset(EMPTY_QUOTE_FORM);
    setPhotos([]);
    pickerRef.current?.clearErrors();
    submission.reset();
    resendRef.current = undefined;
    uploadKeyRef.current = undefined;
    tickets.refresh();
    focusNameNext.current = true;
    setSent(null);
  };

  const onInvalid = (errors: FieldErrors<QuoteFormValues>): void => {
    const first = QUOTE_FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  // The box under the form after a send that did not go through (UI-SPEC Q3), from the server-answer piece. When that piece could
  // not load, the visitor is offline: the send-failed words show as a plain line.
  const sendStatus = (): ReactNode => {
    if (sendError === undefined || answers === null) {
      return null;
    }
    if (answers === 'failed') {
      return (
        <p role="alert" className={quoteFormStatusTextClasses}>
          {COPY.sendFailed}
        </p>
      );
    }
    return (
      <answers.SendStatus
        error={sendError}
        messengerUrl={messengerUrl}
        setFieldError={(field, message) => {
          setError(field, { type: 'server', message });
        }}
        focusField={focusField}
      />
    );
  };

  if (sent !== null) {
    const { MissingPhotos } = sent;
    return (
      <div ref={successRef} className={formCardClasses}>
        <QuoteSentResult
          onSendAnother={sendAnother}
          photosNote={
            MissingPhotos !== undefined &&
            sent.missing.length > 0 && (
              <MissingPhotos missing={sent.missing} total={sent.total} messengerUrl={messengerUrl} />
            )
          }
        />
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className={formCardClasses}
      noValidate
      aria-labelledby={titleId}
      onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
        void handleSubmit(async (values) => {
          pickerRef.current?.clearErrors();
          loadAnswers();
          setSettling(true);
          const picked = (await pickerRef.current?.settled()) ?? photos;
          setSettling(false);
          await submission.submit({ values, photos: picked });
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
        <div className={quotePhotoSlotClasses}>
          <QuotePhotoSlot
            photos={photos}
            onChange={setPhotos}
            disabled={pending}
            limits={async () => (await tickets.ready())?.photoRules}
            handleRef={pickerRef}
          />
        </div>
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
          <UiLink to="/privacy" className={quoteFormNoticeLinkClasses}>
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
        {/* Always present, so a screen reader announces the text when it changes (WCAG 4.1.3). */}
        <p role="status" className={quoteFormLiveClasses}>
          {pending && photos.length > 0 && COPY.sendingPhotos}
        </p>
        {sendStatus()}
      </div>
    </form>
  );
}

export default QuoteForm;
