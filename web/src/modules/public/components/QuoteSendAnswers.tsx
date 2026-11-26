// What the form shows after a send that did not go through (UI-SPEC Q3): the rate-limit box (D-26, D-37), the field messages of a
// 400 on their fields, "not sure it arrived", or "couldn't send". This piece loads when Send is pressed and keeps the form's own
// piece in its budget (D-43); when it cannot load, the visitor is offline and the form shows "couldn't send" itself.
import { useEffect, useRef } from 'react';
import { ButtonLink } from '@/components/actions/ButtonLink';
import { Icon } from '@/components/brand/Icon';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { PUBLIC_COPY } from '../copy';
import { QUOTE_FIELD_ORDER, type QuoteField } from '../quoteSchemas';
import {
  quoteFormAlertBodyClasses,
  quoteFormAlertClasses,
  quoteFormAlertIconClasses,
  quoteFormStatusTextClasses,
  quoteFormWarningClasses,
  quoteFormWarningIconClasses,
} from './quoteForm.recipe';

const COPY = PUBLIC_COPY.contact.form;

/** The danger box under the form: not sent (the default), or not sure it arrived. Every value and photo stays. */
function QuoteSendBox({ text = COPY.sendFailed }: { text?: string }) {
  return (
    <div className={quoteFormAlertClasses} role="alert">
      <span className={quoteFormAlertIconClasses}>
        <Icon name="triangle-alert" size={18} />
      </span>
      <div className={quoteFormAlertBodyClasses}>
        <p className={quoteFormStatusTextClasses}>{text}</p>
      </div>
    </div>
  );
}

/** Why a send did not go through: too many sends, a 400, maybe arrived (no answer came), or not sent. */
export type QuoteSendProblem = 'rate' | 'fields' | 'maybe' | 'failed';

/** Sorts a failed send. A dropped connection while online may have arrived; a 5xx is shown as not sent (UI-SPEC Q3). */
export function sendProblemOf(error: unknown, online: boolean): QuoteSendProblem {
  if (!isHttpError(error)) {
    return 'failed';
  }
  if (error.kind === 'http') {
    return error.status === 429 ? 'rate' : error.status === 400 ? 'fields' : 'failed';
  }
  return error.kind === 'timeout' || error.kind === 'parse' || (error.kind === 'network' && online)
    ? 'maybe'
    : 'failed';
}

/** The server's messages for the visible fields, in page order; the product field takes the productChoice and productLineKey ones. */
export function serverFieldErrors(error: unknown): [QuoteField, string][] {
  if (!isHttpError(error) || error.status !== 400) {
    return [];
  }
  const errors = error.fieldErrors;
  return QUOTE_FIELD_ORDER.flatMap((field): [QuoteField, string][] => {
    const message =
      field === 'product'
        ? (serverFieldMessage(errors, 'productChoice') ?? serverFieldMessage(errors, 'productLineKey'))
        : serverFieldMessage(errors, field);
    return message === undefined ? [] : [[field, message]];
  });
}

export interface SendStatusProps {
  /** The failed send's error. */
  error: unknown;
  /** Null when no link is set or the shop facts could not be read. */
  messengerUrl: string | null;
  /** Puts a server message on a field. */
  setFieldError: (field: QuoteField, message: string) => void;
  focusField: (field: QuoteField) => void;
}

/** The box for a failed send. A 400 puts its messages on their fields and focuses the first; with none, the send-failed box. */
export function SendStatus({ error, messengerUrl, setFieldError, focusField }: SendStatusProps) {
  const problem = sendProblemOf(error, navigator.onLine);
  const fields = problem === 'fields' ? serverFieldErrors(error) : [];

  // Once per answer, after the send ended and the fields take input again.
  const applied = useRef<unknown>(null);
  useEffect(() => {
    if (applied.current === error) {
      return;
    }
    applied.current = error;
    for (const [field, message] of fields) {
      setFieldError(field, message);
    }
    if (fields[0] !== undefined) {
      focusField(fields[0][0]);
    }
  });

  if (problem === 'maybe') {
    return <QuoteSendBox text={COPY.maybeSent} />;
  }
  if (problem !== 'rate') {
    return fields.length === 0 ? <QuoteSendBox /> : null;
  }
  return (
    <div className={quoteFormWarningClasses} role="alert">
      <span className={quoteFormWarningIconClasses}>
        <Icon name="triangle-alert" size={20} />
      </span>
      <div className={quoteFormAlertBodyClasses}>
        <p className={quoteFormStatusTextClasses}>{COPY.rateLimited}</p>
        {messengerUrl !== null && (
          <div>
            <ButtonLink variant="secondary" icon="message-circle" to={messengerUrl}>
              {COPY.success.messenger}
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
