// The one module that turns a failed request into the words staff and visitors see (UI-SPEC Copywriting Contract,
// "HttpError → message defaults" and "Server error, any 5xx"). Every string lives here. Server text never reaches the
// screen: the only server value shown is the traceId reference, so a stack trace or SQL message cannot leak (T-02-44,
// CWE-209).
import { isHttpError } from '@/core/api/errors';

/** What a toast, banner or dialog shows: a bold first line and a muted second line. */
export interface ErrorCopy {
  readonly title: string;
  readonly body: string;
}

const couldNotReach: ErrorCopy = {
  title: "Couldn't reach the server",
  body: 'Check your internet connection and try again.',
};

/** A 400 with field errors: the messages go under the fields, and the banner names no detail of its own. */
const checkFields: ErrorCopy = { title: 'Check the highlighted fields.', body: '' };

const serverError: ErrorCopy = { title: 'Something went wrong', body: 'Please try again.' };

/** Copy for the statuses the UI-SPEC names. Any other failure gets the server-error copy. */
const statusCopy: ReadonlyMap<number, ErrorCopy> = new Map([
  [403, { title: "You don't have access to this", body: 'Ask a Manager if you need it.' }],
  [404, { title: 'Not found', body: 'It may have been deleted. Go back and refresh the list.' }],
  [409, { title: 'Someone else changed this', body: 'Reload to see the latest version, then make your change again.' }],
  [429, { title: 'Too many tries', body: 'Wait a minute, then try again.' }],
]);

/** Ends the second line with "Reference: {traceId}" when the server sent one (UI-SPEC ErrorState). */
function withReference(copy: ErrorCopy, traceId: string | undefined): ErrorCopy {
  return traceId ? { title: copy.title, body: `${copy.body} Reference: ${traceId}` } : copy;
}

/**
 * Describes a failed request in plain English. Returns null when nothing should be shown: a 401 after the failed
 * refresh (the sign-in redirect takes over, Phase 4) or a request the user cancelled. A value that is not an HttpError
 * gets the server-error copy without a reference.
 */
export function describeHttpError(error: unknown): ErrorCopy | null {
  if (!isHttpError(error)) {
    return serverError;
  }
  switch (error.kind) {
    case 'aborted':
      return null;
    case 'network':
    case 'timeout':
      return couldNotReach;
    case 'parse':
      return withReference(serverError, error.traceId);
    case 'http':
      break;
  }
  if (error.status === 401) {
    return null;
  }
  if (error.status === 400 && Object.keys(error.fieldErrors).length > 0) {
    return checkFields;
  }
  return withReference(statusCopy.get(error.status) ?? serverError, error.traceId);
}

/** One line for a dialog: the title as a sentence, then the body (which carries "Reference: {traceId}" when there is one). */
export function errorLine({ title, body }: ErrorCopy): string {
  const sentence = /[.!?]$/.test(title) ? title : `${title}.`;
  return body === '' ? sentence : `${sentence} ${body}`;
}
