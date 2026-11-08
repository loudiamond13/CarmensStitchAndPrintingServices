import type { StaffBalancesTableQuery } from '@/modules/admin/hooks/useStaffBalancesQuery';
import type { StaffBalance } from '@/modules/admin/services/moneyService';

export interface StaffBalancesTableProps {
  query: StaffBalancesTableQuery;
  /** Hand Over was pressed on a leaver's row; `trigger` is that button, so focus can go back to it. */
  onHandOver: (row: StaffBalance, trigger: HTMLElement) => void;
  /** Makes the table caption a focus target. */
  captionId?: string | undefined;
}

export function StaffBalancesTable(props: StaffBalancesTableProps) {
  void props;
  return null;
}
