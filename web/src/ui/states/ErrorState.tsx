// SPEC-GAP: ErrorState (UI-SPEC "SPEC-GAP Primitive Specs" → ErrorState; App. E.8 "Couldn't load"; WEB-06, A11Y-01).
// The App. E.8 banner in the `.s-banner.is-danger` look (states.recipe.ts): a 20px triangle-alert, a bold first line, a
// muted second line, and a secondary sm "Try Again" that calls the query's refetch. The banner is an alert, so it is
// announced when it appears. Only approved copy is shown: the list-load copy for `things`, or a caller's title and
// message (the shared describeHttpError copy, for a modal-level banner). The one server value is the traceId
// reference, so no server text can leak (T-02-62, CWE-209).
import { isHttpError } from '@/lib/api';
import { Button } from '@/ui/actions';
import { Icon } from '@/ui/brand';
import { STATES_COPY } from './copy';
import { bannerClasses, bannerTextClasses } from './states.recipe';

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
  message?: string | undefined;
}

export type ErrorStateProps = ListLoadError | CustomError;

export function ErrorState(props: ErrorStateProps) {
  const { error, onRetry } = props;
  const title = props.things === undefined ? props.title : STATES_COPY.error.loadFailedTitle(props.things);
  const message = props.things === undefined ? (props.message ?? '') : STATES_COPY.error.loadFailedBody;
  const traceId = isHttpError(error) ? error.traceId : undefined;
  const reference = traceId ? STATES_COPY.error.reference(traceId) : '';
  // The 5xx mapper copy already ends with the reference; never say it twice.
  const body = reference === '' || message.includes(reference) ? message : `${message} ${reference}`.trim();
  return (
    <div className={bannerClasses} role="alert">
      <Icon name="triangle-alert" size={20} />
      <div className={bannerTextClasses}>
        <strong>{title}</strong>
        {body !== '' && <span>{body}</span>}
      </div>
      {onRetry !== undefined && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {STATES_COPY.error.retry}
        </Button>
      )}
    </div>
  );
}
