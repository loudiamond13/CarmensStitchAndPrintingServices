// SPEC-GAP: Pagination (UI-SPEC "SPEC-GAP Primitive Specs" → Pagination, Copywriting "Pagination"; WEB-06, WEB-10,
// A11Y-01). A `nav` named "Pagination": a secondary md "Previous" (chevron-left), "Page {p} of {n}" (14px `--ink-muted`,
// the numbers `--ink` 600 tabular) and a secondary md "Next" (chevron-right on the right), spread apart 12px; plus an
// optional "Rows per page" Select (10/20/50/100) in the `.s-toolbar-end` look. On phones the buttons are 44×44 icons
// that keep their names "Previous page" / "Next page" (each name contains its visible label, WCAG 2.5.3). It is not
// rendered for one page or none; Previous is disabled on page 1 and Next on the last page.
// The caller wires `onPageChange` to the list hook's setPage (a push) and `onPageSizeChange` to setPageSize (a replace
// that resets the page), so the WEB-10 history rules stay in createListParams. After a page change, focus moves to the
// results heading or the table caption named by `focusTargetId` (it needs tabIndex -1).
// UI-WR-15 (WCAG 2.4.3): focus is checked again once the new page has rendered. The button pressed may now be disabled
// (Next onto the last page, Previous onto the first) and the heading may have been re-created, either of which drops
// focus to the page. Then focus goes to the focus target, else to the first enabled button of the bar. The ends stay
// natively `disabled` (no visual change).
import { useEffect, useRef } from 'react';
import { PAGE_SIZES, type PageSize } from '@/lib/url-state/parsers';
import { Button } from '@/ui/actions';
import { Select } from '@/ui/forms';
import { LISTS_COPY } from './copy';
import {
  paginationButtonClasses,
  paginationClasses,
  paginationNumberClasses,
  paginationStatusClasses,
  toolbarEndClasses,
} from './lists.recipe';

export interface PaginationProps {
  /** The current page, from 1. */
  page: number;
  pageCount: number;
  /** The list hook's setPage (a push). */
  onPageChange: (page: number) => void;
  /** The id of the results heading or table caption that takes focus after a page change (tabIndex -1). */
  focusTargetId?: string | undefined;
  /** The rows per page; with `onPageSizeChange` it shows the "Rows per page" Select. */
  pageSize?: PageSize | undefined;
  /** The list hook's setPageSize (a replace that resets the page). */
  onPageSizeChange?: ((size: PageSize) => void) | undefined;
}

const SIZE_OPTIONS = PAGE_SIZES.map((size) => String(size));

function toPageSize(value: string): PageSize | undefined {
  return PAGE_SIZES.find((size) => String(size) === value);
}

/** True when focus is nowhere useful: on the page itself, or on a control the page change disabled. */
function focusLost(nav: HTMLElement): boolean {
  const active = document.activeElement;
  return (
    active === null ||
    active === document.body ||
    !active.isConnected ||
    (nav.contains(active) && active instanceof HTMLButtonElement && active.disabled)
  );
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  focusTargetId,
  pageSize,
  onPageSizeChange,
}: PaginationProps) {
  const navRef = useRef<HTMLElement>(null);
  // Set by a page change from this bar; read once the new page has rendered.
  const checkFocus = useRef(false);
  useEffect(() => {
    const nav = navRef.current;
    if (!checkFocus.current || nav === null) {
      return;
    }
    checkFocus.current = false;
    if (!focusLost(nav)) {
      return;
    }
    const target = focusTargetId === undefined ? null : document.getElementById(focusTargetId);
    (target ?? nav.querySelector<HTMLElement>('button:not(:disabled)'))?.focus();
  }, [page, focusTargetId]);

  if (pageCount <= 1) {
    return null;
  }
  const copy = LISTS_COPY.pagination;
  const goTo = (target: number): void => {
    checkFocus.current = true;
    onPageChange(target);
    if (focusTargetId !== undefined) {
      document.getElementById(focusTargetId)?.focus();
    }
  };
  return (
    <nav ref={navRef} aria-label="Pagination" className={paginationClasses}>
      <Button
        variant="secondary"
        size="md"
        icon="chevron-left"
        aria-label={copy.previousPage}
        disabled={page <= 1}
        className={paginationButtonClasses}
        onClick={() => {
          goTo(page - 1);
        }}
      >
        {copy.previous}
      </Button>
      <p className={paginationStatusClasses}>
        {copy.page} <strong className={paginationNumberClasses}>{page}</strong> {copy.of}{' '}
        <strong className={paginationNumberClasses}>{pageCount}</strong>
      </p>
      <Button
        variant="secondary"
        size="md"
        iconRight="chevron-right"
        aria-label={copy.nextPage}
        disabled={page >= pageCount}
        className={paginationButtonClasses}
        onClick={() => {
          goTo(page + 1);
        }}
      >
        {copy.next}
      </Button>
      {onPageSizeChange !== undefined && pageSize !== undefined && (
        <div className={toolbarEndClasses}>
          <Select
            label={copy.rowsPerPage}
            options={SIZE_OPTIONS}
            value={String(pageSize)}
            onChange={(event) => {
              const size = toPageSize(event.target.value);
              if (size !== undefined) {
                onPageSizeChange(size);
              }
            }}
          />
        </div>
      )}
    </nav>
  );
}
