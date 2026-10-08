// RED placeholder (plan 13 Task 2): replaced by the implementation in the GREEN commit.
export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  focusTargetId?: string;
  pageSize?: number;
  pageSizes?: readonly number[];
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({ page, pageCount }: PaginationProps) {
  return (
    <nav>
      {page}/{pageCount}
    </nav>
  );
}
