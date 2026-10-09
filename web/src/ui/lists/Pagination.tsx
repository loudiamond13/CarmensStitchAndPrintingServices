// SPEC-GAP: Pagination (RED stub, plan 02-30).
import type { PageSize } from '@/lib/url-state/parsers';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  focusTargetId?: string | undefined;
  pageSize?: PageSize | undefined;
  onPageSizeChange?: ((size: PageSize) => void) | undefined;
}

export function Pagination(props: PaginationProps) {
  void props;
  return <div />;
}
