// RED placeholder (plan 13 Task 1): replaced by the implementation in the GREEN commit.
import type { ReactNode } from 'react';

export interface SkeletonTableColumn {
  key: string;
  header: ReactNode;
}

export function SkeletonTable({ columns }: { columns: readonly SkeletonTableColumn[]; rows?: number }) {
  return <div>{columns.length}</div>;
}
