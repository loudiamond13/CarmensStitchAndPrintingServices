// The one module that turns an HttpError into the words staff and visitors see (UI-SPEC Copywriting: "HttpError ->
// message defaults" and "Server error, any 5xx"). Every string lives here. Server text never reaches the screen: the
// only server value shown is the traceId reference, so a stack trace or SQL message cannot leak (T-02-30, CWE-209).
import { isHttpError } from '@/lib/api';

/** What a banner, toast or dialog shows: a bold first line and a muted second line. */
export interface ErrorCopy {
  readonly title: string;
  /** Empty for a 400 with field errors: the messages go under the fields instead. */
  readonly body: string;
  /** The server's messages per field, only for a 400 with field errors. */
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
}

const couldNotReach: ErrorCopy = {
  title: "Couldn't reach the server",
  body: 'Check your internet connection and try again.',
};

/** Copy for the statuses the UI-SPEC names. Any other failure gets the 5xx copy. */
const statusCopy: Readonly<Partial<Record<number, ErrorCopy>>> = {
  403: { title: "You don't have access to this", body: 'Ask a Manager if you need it.' },
  404: { title: 'Not found', body: 'It may have been deleted. Go back and refresh the list.' },
  409: { title: 'Someone else changed this', body: 'Reload to see the latest version, then make your change again.' },
  429: { title: 'Too many tries', body: 'Wait a minute, then try again.' },
};

function somethingWentWrong(traceId: string | undefined): ErrorCopy {
  return {
    title: 'Something went wrong',
    body: traceId ? `Please try again. Reference: ${traceId}` : 'Please try again.',
  };
}

/**
 * Describes a failed request in plain English. Returns null when nothing should be shown: a 401 (the sign-in redirect
 * takes over, Phase 4) or a request the user cancelled. A value that is not an HttpError gets the 5xx copy.
 */
export function describeHttpError(error: unknown): ErrorCopy | null {
  if (!isHttpError(error)) {
    return somethingWentWrong(undefined);
  }
  switch (error.kind) {
    case 'aborted':
      return null;
    case 'network':
    case 'timeout':
      return couldNotReach;
    case 'parse':
      return somethingWentWrong(error.traceId);
    case 'http':
      break;
  }
  if (error.status === 401) {
    return null;
  }
  if (error.status === 400 && Object.keys(error.fieldErrors).length > 0) {
    return { title: 'Check the highlighted fields.', body: '', fieldErrors: error.fieldErrors };
  }
  return statusCopy[error.status] ?? somethingWentWrong(error.traceId);
}
