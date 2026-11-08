// RED stub: the ledger table arrives with the GREEN commit.
import type { LedgerPage } from '@/modules/admin/services/moneyService';

export interface LedgerTableProps {
  page: LedgerPage | undefined;
}

export function LedgerTable({ page }: LedgerTableProps) {
  void page;
  return null;
}
