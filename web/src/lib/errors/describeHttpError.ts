// RED placeholder (02-16 Task 2): the final types with an inert body.

/** What a toast, banner or dialog shows: a bold first line and a muted second line. */
export interface ErrorCopy {
  readonly title: string;
  readonly body: string;
}

export function describeHttpError(error: unknown): ErrorCopy | null {
  return { title: '', body: String(error === null) };
}
