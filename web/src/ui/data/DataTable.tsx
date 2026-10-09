// DataTable (App. D.3 "Data display", CSPS-UI-SPEC.md §6.4). RED stub: inert until the GREEN step.
import type { ReactNode } from 'react';
import type { CellAlign } from './data.recipe';

export interface DataTableColumn<R> {
  key: string;
  label: ReactNode;
  align?: CellAlign | undefined;
  width?: number | string | undefined;
  money?: boolean | undefined;
  render?: ((row: R) => ReactNode) | undefined;
}

export interface DataTableProps<R> {
  columns: DataTableColumn<R>[];
  rows: R[];
  rowKey?: (keyof R & string) | undefined;
  loading?: boolean | undefined;
  error?: string | undefined;
  empty?: ReactNode;
  caption?: string | undefined;
}

export function DataTable<R extends Record<string, unknown>>(_props: DataTableProps<R>) {
  return <div />;
}
