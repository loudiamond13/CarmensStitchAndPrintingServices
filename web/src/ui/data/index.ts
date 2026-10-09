// Data-display barrel (App. D.3 "Data display": OrderCard, DataTable and IncomeExpenseChart; plan 02-24). List screens
// use ResponsiveTable (the WEB-06 table, a later plan), not DataTable, which is kept for the `.csp-table` look.
export type { CellAlign } from './data.recipe';
export { DataTable } from './DataTable';
export type { DataTableColumn, DataTableProps } from './DataTable';
export { IncomeExpenseChart } from './IncomeExpenseChart';
export type { ChartDatum, IncomeExpenseChartProps } from './IncomeExpenseChart';
export { OrderCard } from './OrderCard';
export type { OrderCardProps } from './OrderCard';
