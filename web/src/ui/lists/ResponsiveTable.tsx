// SPEC-GAP: ResponsiveTable (RED stub, plan 02-30).
import type { ReactNode } from 'react';
import type { IconName } from '@/ui/brand';
import type { EmptyStateHeadingLevel } from '@/ui/feedback';

export interface ResponsiveTableColumn<T> {
  key: string;
  header: string;
  label?: string | undefined;
  cell: (row: T) => ReactNode;
  lead?: boolean | undefined;
  actions?: boolean | undefined;
  money?: boolean | undefined;
  muted?: boolean | undefined;
}

export interface ResponsiveTableProps<T> {
  caption: string;
  captionId?: string | undefined;
  columns: readonly ResponsiveTableColumn<T>[];
  rows: readonly T[] | undefined;
  rowKey: (row: T) => string;
  isInactive?: ((row: T) => boolean) | undefined;
  things: string;
  pending?: boolean | undefined;
  refetching?: boolean | undefined;
  failed?: boolean | undefined;
  error?: unknown;
  onRetry?: (() => void) | undefined;
  filtered?: boolean | undefined;
  search?: string | null | undefined;
  filterSummary?: string | undefined;
  onClearFilters?: (() => void) | undefined;
  emptyIcon?: IconName | undefined;
  emptyMessage?: ReactNode;
  emptyAction?: ReactNode;
  emptyLevel?: EmptyStateHeadingLevel | undefined;
  footer?: Readonly<Record<string, ReactNode>> | undefined;
}

export function ResponsiveTable<T>(props: ResponsiveTableProps<T>) {
  void props;
  return <div />;
}
