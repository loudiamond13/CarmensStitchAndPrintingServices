// SPEC-GAP: ErrorState (RED stub, plan 02-28 Task 1).
export interface ErrorStateProps {
  things?: string;
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: (() => void) | undefined;
}

export function ErrorState({ title }: ErrorStateProps) {
  return <div data-title={title} />;
}
