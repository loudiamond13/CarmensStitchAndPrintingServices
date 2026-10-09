// SPEC-GAP: LoadingRegion (RED stub, plan 02-28 Task 2).
import type { ReactNode } from 'react';

export interface LoadingRegionProps {
  loading: boolean;
  things: string;
  failed?: boolean | undefined;
  children?: ReactNode;
  className?: string | undefined;
}

export function LoadingRegion({ children }: LoadingRegionProps) {
  return <div>{children}</div>;
}
