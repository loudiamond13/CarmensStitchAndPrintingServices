// SPEC-GAP: FilterBar, ResultBar and FilterChip (UI-SPEC "SPEC-GAP Primitive Specs" → FilterBar, Copywriting "Result
// bar / filter chip", UI consideration "overflow | FilterBar chips"; App. E.7; WEB-06, WEB-10, PERF-03).
//   - FilterBar is the App. E.7 toolbar: a search landmark (`role="search"`) marked `data-ui="s-toolbar"`, so every
//     Field and Select inside takes the toolbar look and the D-01 phone size by itself (02-20), holding the SearchBox,
//     the Selects and the `.s-toolbar-end` slot (the grid/table SegmentedControl).
//   - ResultBar is App. E.7's result bar: "Showing **12** orders · sorted by due date" ("Showing **1** order" for one),
//     then the chips. The chips wrap onto new lines 8px apart and never widen the page.
//   - FilterChip is one non-default filter: "Status: Active + recent" (the label truncates with an ellipsis, the full
//     text stays in the text node) and a 22px clear button named "Clear status filter" (O-8 size kept).
// The caller renders a chip only for a filter that differs from its default (defaults never show a chip or reach the
// URL) and wires each control and each chip's clear to the list hook's setFilter, a replace that resets the page.
// SPEC-DEVIATION: PERF-03 (UI-SPEC overflow row) the chips sit in their own wrapping group with the label in a
// truncating span, so four chips at 320px wrap instead of scrolling; App. E.7 puts its one chip straight in the bar.
import { Children, type ReactNode } from 'react';
import { Icon } from '@/components/brand';
import { LISTS_COPY, nounFor } from './copy';
import {
  chipGroupClasses,
  filterChipClasses,
  filterChipClearClasses,
  filterChipLabelClasses,
  resultBarClasses,
  resultCountClasses,
  toolbarClasses,
  toolbarEndClasses,
} from './lists.recipe';

export interface FilterBarProps {
  /** The SearchBox and the filter Selects. */
  children: ReactNode;
  /** The `.s-toolbar-end` slot, like the grid/table SegmentedControl. */
  end?: ReactNode;
  /** A landmark name, for a page with more than one search region. */
  label?: string | undefined;
}

export function FilterBar({ children, end, label }: FilterBarProps) {
  return (
    <div className={toolbarClasses} role="search" aria-label={label} data-ui="s-toolbar">
      {children}
      {end !== undefined && end !== null && <div className={toolbarEndClasses}>{end}</div>}
    </div>
  );
}

export interface ResultBarProps {
  /** The rows matching the filters (the server's total). */
  count: number;
  /** "order" */
  thing: string;
  /** "orders" */
  things: string;
  /** "due date", read as " · sorted by due date". */
  sortLabel?: string | undefined;
  /** A fixed order phrase, read as " · newest first" (the audit log, which cannot be sorted). */
  orderNote?: string | undefined;
  /** One FilterChip per non-default filter. */
  children?: ReactNode;
}

export function ResultBar({ count, thing, things, sortLabel, orderNote, children }: ResultBarProps) {
  const chips = Children.toArray(children);
  if (count === 0 && chips.length === 0) {
    return null;
  }
  return (
    <div className={resultBarClasses}>
      {count > 0 && (
        <span>
          {LISTS_COPY.showing} <strong className={resultCountClasses}>{count}</strong> {nounFor(count, thing, things)}
          {sortLabel !== undefined && LISTS_COPY.sortedBy(sortLabel)}
          {orderNote !== undefined && LISTS_COPY.orderNote(orderNote)}
        </span>
      )}
      {chips.length > 0 && <div className={chipGroupClasses}>{chips}</div>}
    </div>
  );
}

export interface FilterChipProps {
  /** The filter's name, like "Status". */
  label: string;
  /** The chosen value's label, like "Active + recent". */
  value: string;
  /** The list hook's setFilter(key, null): a replace that resets the page. */
  onClear: () => void;
}

export function FilterChip({ label, value, onClear }: FilterChipProps) {
  return (
    <span className={filterChipClasses}>
      <span className={filterChipLabelClasses}>{LISTS_COPY.chip(label, value)}</span>
      <button
        type="button"
        className={filterChipClearClasses}
        aria-label={LISTS_COPY.clearFilter(label)}
        onClick={onClear}
      >
        <Icon name="x" size={14} />
      </button>
    </span>
  );
}
