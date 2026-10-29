// Data-display barrel (App. D.3 "Data display": OrderCard, DataTable and IncomeExpenseChart; plan 02-24), plus the SEC-08
// actor views ActorName and RecordMeta (plan 05-25). List screens
// use ResponsiveTable (the WEB-06 table, a later plan), not DataTable, which is kept for the `.csp-table` look.
export { ORDER_CARD_COPY, RECORD_META_COPY, WALK_IN_CUSTOMER } from './copy';
export { ActorName } from './ActorName';
export type { ActorNameProps } from './ActorName';
export type { CellAlign } from './data.recipe';
export { DataTable } from './DataTable';
export type { DataTableColumn, DataTableProps } from './DataTable';
export { IncomeExpenseChart } from './IncomeExpenseChart';
export type { ChartDatum, IncomeExpenseChartProps } from './IncomeExpenseChart';
export { OrderCard } from './OrderCard';
export type { OrderCardCover, OrderCardOrder, OrderCardProps } from './OrderCard';
export { RecordMeta } from './RecordMeta';
export type { RecordMetaProps } from './RecordMeta';
