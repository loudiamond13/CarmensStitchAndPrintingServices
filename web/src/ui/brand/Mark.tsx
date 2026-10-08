// RED stub (plan 02-18): replaced by the JSX mark in the GREEN commit.
export interface MarkProps {
  size?: number;
  label?: string;
  className?: string;
}

export function Mark({ size = 40 }: MarkProps) {
  return <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden />;
}
