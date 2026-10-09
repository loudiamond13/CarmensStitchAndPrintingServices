// SPEC-GAP: SkeletonTable (RED stub, plan 02-30).
import type { ResponsiveTableColumn } from './ResponsiveTable';

export type SkeletonTableColumn = Pick<
  ResponsiveTableColumn<never>,
  'key' | 'header' | 'label' | 'lead' | 'actions' | 'money'
>;

export function SkeletonTable({ columns }: { columns: readonly SkeletonTableColumn[] }) {
  void columns;
  return <div />;
}
