// SPEC-GAP: quote requests status pills (UI-SPEC R1 item 2, D-18). The GalleryFilterBar pill pattern rebuilt for the admin: a
// toolbar named "Show" with five 44px pills, "Open {4}" to "All {20}", each count from the server with a hidden " requests".
// The selected pill is maroon with aria-pressed. Until the first answer the pills show no count. Roving focus: one tab stop,
// Left and Right move with wrap, Home and End jump, Enter or Space selects (a native button). The row wraps at 320px.
import clsx from 'clsx';
import { useRef, useState, type KeyboardEvent } from 'react';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { QUOTE_REQUESTS_COPY } from '@/modules/admin/quoteRequestsCopy';
import {
  QUOTE_STATUS_FILTERS,
  type QuoteRequestCounts,
  type QuoteStatusFilter as Status,
} from '@/modules/admin/services/quoteRequestsService';
import { formatCount } from '@/utils/format';
import {
  quotePillClasses,
  quotePillCountClasses,
  quotePillOffClasses,
  quotePillOnClasses,
  quotePillsClasses,
} from './quoteRequests.recipe';

const COPY = QUOTE_REQUESTS_COPY.pills;
const MOVE_KEYS: readonly string[] = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

export interface QuoteStatusFilterProps {
  selected: Status;
  /** The server's pill counts; undefined until the first answer. */
  counts: QuoteRequestCounts | undefined;
  onSelect: (status: Status) => void;
}

export function QuoteStatusFilter({ selected, counts, onSelect }: QuoteStatusFilterProps) {
  const bar = useRef<HTMLDivElement>(null);
  // The pill the one tab stop is on: the last one focused, else the selected one.
  const [focused, setFocused] = useState<number | null>(null);
  const last = QUOTE_STATUS_FILTERS.length - 1;
  const tabStop = focused ?? QUOTE_STATUS_FILTERS.indexOf(selected);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!MOVE_KEYS.includes(event.key)) return;
    const buttons = Array.from(bar.current?.querySelectorAll('button') ?? []);
    const from = buttons.findIndex((button) => button === event.target);
    if (from === -1) return;
    event.preventDefault();
    const to =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowRight'
            ? (from + 1) % (last + 1)
            : (from + last) % (last + 1);
    buttons[to]?.focus();
  }

  return (
    <div ref={bar} role="toolbar" aria-label={COPY.toolbar} className={quotePillsClasses} onKeyDown={onKeyDown}>
      {QUOTE_STATUS_FILTERS.map((status, index) => {
        const on = status === selected;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={on}
            tabIndex={tabStop === index ? 0 : -1}
            className={clsx(quotePillClasses, on ? quotePillOnClasses : quotePillOffClasses)}
            onFocus={() => {
              setFocused(index);
            }}
            onClick={() => {
              onSelect(status);
            }}
          >
            {COPY.labels[status]}
            {counts !== undefined && (
              <>
                {' '}
                <span className={quotePillCountClasses}>
                  {formatCount(Number(counts[status]))} <span className={srOnlyClasses}>{COPY.hidden}</span>
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
