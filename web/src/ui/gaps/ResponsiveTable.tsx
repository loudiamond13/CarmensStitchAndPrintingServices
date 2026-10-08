// RED placeholder (plan 13 Task 1): replaced by the implementation in the GREEN commit.
import type { ReactNode } from 'react';
import type { IconName } from '@/ui';

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  label?: string;
  lead?: boolean;
  money?: boolean;
  actions?: boolean;
  className?: string;
}

export type ListStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface ResponsiveTableProps<T> {
  caption: string;
  captionId?: string;
  columns: readonly ResponsiveColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  isRowInactive?: (row: T) => boolean;
  status: ListStatus;
  things: string;
  error?: unknown;
  onRetry?: () => void;
  hasActiveFilters?: boolean;
  searchText?: string | null;
  filterSummary?: string;
  onClearFilters?: () => void;
  emptyIcon?: IconName;
  emptyMessage?: ReactNode;
  emptyAction?: ReactNode;
  isPlaceholderData?: boolean;
  footer?: ReactNode;
}

export function ResponsiveTable<T>({ columns, rows, getRowKey }: ResponsiveTableProps<T>) {
  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={getRowKey(row)}>
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CustomerCell({ team, customer }: { team?: string | null; customer: string }) {
  return (
    <div>
      {team}
      {customer}
    </div>
  );
}
