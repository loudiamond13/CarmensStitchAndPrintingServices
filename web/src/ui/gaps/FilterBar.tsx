// SPEC-GAP: FilterBar, ResultBar and FilterChip (02-UI-SPEC SPEC-GAP "FilterBar"; App. E.7; WEB-06, WEB-10,
// PERF-03). The App. E.7 toolbar (.s-toolbar[role=search] with the SearchBox, the Selects and .s-toolbar-end), the
// result bar ("Showing **12** orders · sorted by due date") and one .s-filter-chip per non-default filter. The caller
// renders a chip only for a filter that differs from its default and wires its clear to the list hook's setFilter (a
// replace that resets the page). Chips wrap onto new lines and a long label ends in an ellipsis (spec-gaps.css).
import { Children, type ReactNode } from 'react';
import { Icon } from '@/ui';
import { FILTER_BAR_COPY, nounFor } from './copy';

export interface FilterBarProps {
  /** The SearchBox and the filter Selects. */
  children: ReactNode;
  /** The .s-toolbar-end slot, like the grid/table SegmentedControl. */
  end?: ReactNode;
  /** A landmark name, for a page with more than one search region. */
  label?: string;
}

export function FilterBar({ children, end, label }: FilterBarProps) {
  return (
    <div className="s-toolbar" role="search" aria-label={label}>
      {children}
      {end !== undefined && end !== null && <div className="s-toolbar-end">{end}</div>}
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
  sortLabel?: string;
  /** One FilterChip per non-default filter. */
  children?: ReactNode;
}

export function ResultBar({ count, thing, things, sortLabel, children }: ResultBarProps) {
  const chips = Children.toArray(children);
  if (count === 0 && chips.length === 0) {
    return null;
  }
  return (
    <div className="s-resultbar">
      {count > 0 && (
        <span>
          {FILTER_BAR_COPY.showing} <strong style={{ color: 'var(--ink)' }}>{count}</strong>{' '}
          {nounFor(count, thing, things)}
          {sortLabel !== undefined && FILTER_BAR_COPY.sortedBy(sortLabel)}
        </span>
      )}
      {chips.length > 0 && <span className="csp-filter-chips">{chips}</span>}
    </div>
  );
}

export interface FilterChipProps {
  /** The filter name, like "Status". */
  label: string;
  /** The chosen value's label, like "Active + recent". */
  value: string;
  onClear: () => void;
}

export function FilterChip({ label, value, onClear }: FilterChipProps) {
  return (
    <span className="s-filter-chip">
      <span className="csp-filter-chip-label">{FILTER_BAR_COPY.chip(label, value)}</span>
      <button
        type="button"
        className="s-iconbtn"
        style={{ width: 22, height: 22, color: 'inherit' }}
        aria-label={FILTER_BAR_COPY.clearFilter(label)}
        onClick={onClear}
      >
        <Icon name="x" size={14} />
      </button>
    </span>
  );
}
