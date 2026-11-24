// RED stub: the Notes card lands in the GREEN commit.
import type { QuoteRequestDetailResponse } from '@/modules/admin/services/quoteRequestsService';

export interface QuoteNotesCardProps {
  request: QuoteRequestDetailResponse;
  onAdded: (answer: unknown) => void;
  onConflict: () => void;
}

export function QuoteNotesCard(_props: QuoteNotesCardProps) {
  return null;
}
