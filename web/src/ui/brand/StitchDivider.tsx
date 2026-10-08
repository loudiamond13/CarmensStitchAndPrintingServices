// RED stub (plan 02-18): replaced by the converted divider in the GREEN commit.
import type { ReactNode } from 'react';

export interface StitchDividerProps {
  label?: ReactNode;
  className?: string;
}

export function StitchDivider(_props: StitchDividerProps) {
  return <div role="separator" />;
}
