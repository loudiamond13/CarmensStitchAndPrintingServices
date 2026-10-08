// RED placeholder (plan 02-10 Task 3).
export interface ErrorCopy {
  readonly title: string;
  readonly body: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
}

export function describeHttpError(error: unknown): ErrorCopy | null {
  void error;
  return { title: '', body: '' };
}
