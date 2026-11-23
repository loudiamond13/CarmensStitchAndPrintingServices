// SPEC-GAP: quote requests status pills
import type { QuoteRequestCounts, QuoteStatusFilter as Status } from '@/modules/admin/services/quoteRequestsService';

export interface QuoteStatusFilterProps {
  selected: Status;
  counts: QuoteRequestCounts | undefined;
  onSelect: (status: Status) => void;
}

export function QuoteStatusFilter(_props: QuoteStatusFilterProps) {
  return null;
}
