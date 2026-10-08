// RED placeholder (plan 13 Task 1): replaced by the implementation in the GREEN commit.
import type { ReactNode } from 'react';

export interface LoadingRegionProps {
  busy: boolean;
  things: string;
  children?: ReactNode;
  className?: string;
}

export function LoadingRegion({ children }: LoadingRegionProps) {
  return <div>{children}</div>;
}
