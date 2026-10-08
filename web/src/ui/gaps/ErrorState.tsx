// RED placeholder (plan 13 Task 1): replaced by the implementation in the GREEN commit.
export interface ErrorStateProps {
  things: string;
  error?: unknown;
  onRetry?: () => void;
}

export function ErrorState({ things }: ErrorStateProps) {
  return <div>{things}</div>;
}
