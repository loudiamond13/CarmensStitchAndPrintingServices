// SPEC-GAP: ErrorState (02-UI-SPEC SPEC-GAP "ErrorState"; App. E.8 "Couldn't load"; WEB-06). The App. E.8 banner:
// .s-banner.is-danger[role=alert] with a 20px triangle-alert, a bold first line, a muted second line and a secondary sm
// "Try Again" that calls the query's refetch. Only approved copy is shown; the one server value is the traceId
// reference, so no server text can leak (T-02-37, CWE-209).
import { isHttpError } from '@/lib/api';
import { Button, Icon } from '@/ui';
import { ERROR_STATE_COPY } from './copy';

export interface ErrorStateProps {
  /** The plural noun of the list that failed to load, like "orders". */
  things: string;
  /** The query error. An HttpError with a traceId adds "Reference: {traceId}" to the second line. */
  error?: unknown;
  /** The query's refetch. */
  onRetry?: (() => void) | undefined;
}

export function ErrorState({ things, error, onRetry }: ErrorStateProps) {
  const traceId = isHttpError(error) ? error.traceId : undefined;
  const body = traceId
    ? `${ERROR_STATE_COPY.loadFailedBody} ${ERROR_STATE_COPY.reference(traceId)}`
    : ERROR_STATE_COPY.loadFailedBody;
  return (
    <div className="s-banner is-danger" role="alert" style={{ alignItems: 'center' }}>
      <Icon name="triangle-alert" size={20} />
      <div style={{ flex: 1 }}>
        <strong>{ERROR_STATE_COPY.loadFailedTitle(things)}</strong>
        <span>{body}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {ERROR_STATE_COPY.retry}
        </Button>
      )}
    </div>
  );
}
