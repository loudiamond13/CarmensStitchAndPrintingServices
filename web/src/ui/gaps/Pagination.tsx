// SPEC-GAP: Pagination (02-UI-SPEC SPEC-GAP "Pagination"; WEB-06, WEB-10, A11Y-01). nav[aria-label=Pagination]:
// secondary md "Previous" (chevron-left), "Page {p} of {n}" (Body text, the numbers in .csp-money: --ink, 600,
// tabular) and secondary md "Next" (chevron-right), plus an optional "Rows per page" Select in .s-toolbar-end. On
// phones the buttons are icon-only 44px squares and keep the names "Previous page" / "Next page". It is not rendered
// for one page or none. The caller wires onPageChange to the list hook's setPage (a push) and onPageSizeChange to
// setPageSize (a replace that resets the page), so the WEB-10 history rules live in one place.
import { PAGE_SIZES } from '@/lib/url-state/parsers';
import { Button, Select } from '@/ui';
import { PAGINATION_COPY } from './copy';

export interface PaginationProps {
  /** The current page, from 1. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** The results heading or table caption that takes focus after a page change (it needs tabIndex -1). */
  focusTargetId?: string;
  pageSize?: number;
  /** The sizes the list offers; 10/20/50/100 by default (PAGE_SIZES). */
  pageSizes?: readonly number[];
  /** Shows the "Rows per page" Select. */
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  focusTargetId,
  pageSize,
  pageSizes = PAGE_SIZES,
  onPageSizeChange,
}: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }
  const goTo = (target: number): void => {
    onPageChange(target);
    if (focusTargetId !== undefined) {
      document.getElementById(focusTargetId)?.focus();
    }
  };
  return (
    <nav aria-label={PAGINATION_COPY.label} className="csp-pagination">
      <div className="csp-pagination-pager">
        <Button
          variant="secondary"
          size="md"
          icon="chevron-left"
          aria-label={PAGINATION_COPY.previousPage}
          disabled={page <= 1}
          onClick={() => {
            goTo(page - 1);
          }}
        >
          {PAGINATION_COPY.previous}
        </Button>
        <p className="body-sm csp-pagination-status">
          {PAGINATION_COPY.page} <strong className="csp-money">{page}</strong> {PAGINATION_COPY.of}{' '}
          <strong className="csp-money">{pageCount}</strong>
        </p>
        <Button
          variant="secondary"
          size="md"
          iconRight="chevron-right"
          aria-label={PAGINATION_COPY.nextPage}
          disabled={page >= pageCount}
          onClick={() => {
            goTo(page + 1);
          }}
        >
          {PAGINATION_COPY.next}
        </Button>
      </div>
      {onPageSizeChange && pageSize !== undefined && (
        <div className="s-toolbar-end">
          <Select
            label={PAGINATION_COPY.rowsPerPage}
            options={pageSizes.map((size) => String(size))}
            value={String(pageSize)}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
            }}
          />
        </div>
      )}
    </nav>
  );
}
