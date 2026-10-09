// RED stub (plan 02-24): the converted IncomeExpenseChart arrives in GREEN.
export interface ChartDatum {
  month: string;
  income: number;
  expenses: number;
  label?: string | undefined;
}

export interface IncomeExpenseChartProps {
  data: ChartDatum[];
  height?: number | undefined;
}

export function IncomeExpenseChart(_props: IncomeExpenseChartProps) {
  return <figure />;
}
