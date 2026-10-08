// SPEC-GAP: ErrorState (02-UI-SPEC SPEC-GAP "ErrorState"; App. E.8 "Couldn't load"; WEB-06, A11Y-01). The App. E.8
// banner: .s-banner.is-danger[role=alert] with a 20px triangle-alert, a bold first line, a muted second line and a
// secondary sm "Try Again" that calls the query's refetch. Only approved copy is shown: the list-load copy for
// `things`, or a caller's title and message (the shared describeHttpError copy, for a modal-level banner). The one
// server value is the traceId reference, so no server text can leak (T-02-37, CWE-209).
import { isHttpError } from '@/lib/api';
import { Button, Icon } from '@/ui';
import { ERROR_STATE_COPY } from './copy';

interface ErrorStateCommon {
  /** The failure. An HttpError with a traceId ends the second line with "Reference: {traceId}". */
  error?: unknown;
  /** The query's refetch, behind "Try Again". No button without it. */
  onRetry?: (() => void) | undefined;
}

/** A failed list load: "Couldn't load {things}." over the approved reassurance line. */
interface ListLoadError extends ErrorStateCommon {
  /** The plural noun of the list, like "orders". */
  things: string;
  title?: undefined;
  message?: undefined;
}

/** Any other failure, with copy from the shared mapper (describeHttpError). */
interface CustomError extends ErrorStateCommon {
  things?: undefined;
  title: string;
  /** The second line. Empty (a 400 with field errors) leaves it out unless there is a reference. */
  message?: string;
}

export type ErrorStateProps = ListLoadError | CustomError;

export function ErrorState(props: ErrorStateProps) {
  const { error, onRetry } = props;
  const title = props.things === undefined ? props.title : ERROR_STATE_COPY.loadFailedTitle(props.things);
  const message = props.things === undefined ? (props.message ?? '') : ERROR_STATE_COPY.loadFailedBody;
  const traceId = isHttpError(error) ? error.traceId : undefined;
  const reference = traceId ? ERROR_STATE_COPY.reference(traceId) : '';
  // The 5xx mapper copy already ends with the reference; never say it twice.
  const body = reference === '' || message.includes(reference) ? message : `${message} ${reference}`.trim();
  return (
    <div className="s-banner is-danger" role="alert" style={{ alignItems: 'center' }}>
      <Icon name="triangle-alert" size={20} />
      <div style={{ flex: 1 }}>
        <strong>{title}</strong>
        {body !== '' && <span>{body}</span>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {ERROR_STATE_COPY.retry}
        </Button>
      )}
    </div>
  );
}
