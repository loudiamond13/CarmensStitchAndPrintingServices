// The Phase 13 demos of the Component Showcase (UI-SPEC Component Inventory "Component Showcase additions"; plan 13-23), in the
// "Quote requests" section: the status pills with and without counts, the six status badges in Blush and Espresso, the NavCount chip
// at 0, 1 and 99+ and on the collapsed rail, and the dashboard strip at 0, 3, loading and failed. The parts are the real ones fed
// made-up values; nothing reads or writes a record, and a press on a link stays on the showcase.
import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Sidebar, type AdminSection } from '@/components';
import { QuoteRequestsStrip } from '@/modules/admin/components/QuoteRequestsStrip';
import { QuoteStatusBadge } from '@/modules/admin/components/QuoteRequestsTable';
import { QuoteStatusFilter } from '@/modules/admin/components/QuoteStatusFilter';
import { DemoCase } from '@/modules/admin/components/showcase/Phase5Demos';
import {
  badgesRowClasses,
  frameClasses,
  moneyCaseColumnClasses,
  staffStackClasses,
  stillClasses,
} from '@/modules/admin/components/showcase/showcase.recipe';
import type { NewQuoteCountQuery } from '@/modules/admin/hooks/useNewQuoteCountQuery';
import { QUOTE_STATUSES } from '@/modules/admin/quoteStatus';
import type { QuoteRequestCounts, QuoteStatusFilter as Pill } from '@/modules/admin/services/quoteRequestsService';

/** A press on a static case does nothing: no link is followed. */
function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

function Still({ children }: { children: ReactNode }) {
  return (
    <div className={stillClasses} onClickCapture={swallow}>
      {children}
    </div>
  );
}

// QuoteStatusFilter (R1).

/** The UI-SPEC example counts. */
const COUNTS: QuoteRequestCounts = { open: 4, converted: 12, closed: 3, spam: 1, all: 20 };

/** The pills with live selection on demo counts; a press only changes the selected pill. */
function FilterDemo({ counts }: { counts: QuoteRequestCounts | undefined }) {
  const [selected, setSelected] = useState<Pill>('open');
  return <QuoteStatusFilter selected={selected} counts={counts} onSelect={setSelected} />;
}

// The status badges (Color, status tones).

function BadgesDemo({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div data-theme={theme} className={frameClasses}>
      <div className={badgesRowClasses}>
        {QUOTE_STATUSES.map((status) => (
          <QuoteStatusBadge key={status} status={status} />
        ))}
      </div>
    </div>
  );
}

// The NavCount chip (R4).

interface NavDemoProps {
  count: number;
  active?: AdminSection | null;
  collapsed?: boolean;
}

function NavDemo({ count, active = null, collapsed = false }: NavDemoProps) {
  return (
    <Still>
      <Sidebar active={active} collapsed={collapsed} withQuoteRequests counts={{ quotes: count }} />
    </Still>
  );
}

// QuoteRequestsStrip (R4).

const noop = (): undefined => undefined;

/** The count query as the strip reads it, in one fixed state. */
function countQuery(state: Partial<NewQuoteCountQuery>): NewQuoteCountQuery {
  return {
    data: undefined,
    isError: false,
    isFetching: false,
    errorUpdatedAt: 0,
    dataUpdatedAt: 0,
    refetch: noop,
    ...state,
  };
}

const STRIP_ZERO = countQuery({ data: 0, dataUpdatedAt: 1 });
const STRIP_THREE = countQuery({ data: 3, dataUpdatedAt: 1 });
const STRIP_LOADING = countQuery({ isFetching: true });
const STRIP_FAILED = countQuery({ isError: true, errorUpdatedAt: 1 });

function StripDemo({ query }: { query: NewQuoteCountQuery }) {
  return (
    <Still>
      <div className={moneyCaseColumnClasses}>
        <QuoteRequestsStrip query={query} />
      </div>
    </Still>
  );
}

/** Every Phase 13 demo, one case under another. */
export function Phase13Demos() {
  return (
    <div className={staffStackClasses}>
      <DemoCase id="quote-status-filter">
        <FilterDemo counts={COUNTS} />
      </DemoCase>
      <DemoCase id="quote-status-filter-loading">
        <FilterDemo counts={undefined} />
      </DemoCase>
      <DemoCase id="quote-status-badges-blush">
        <BadgesDemo theme="light" />
      </DemoCase>
      <DemoCase id="quote-status-badges-espresso">
        <BadgesDemo theme="dark" />
      </DemoCase>
      <DemoCase id="nav-count-0">
        <NavDemo count={0} />
      </DemoCase>
      <DemoCase id="nav-count-1">
        <NavDemo count={1} />
      </DemoCase>
      <DemoCase id="nav-count-99-plus">
        <NavDemo count={150} active="quotes" />
      </DemoCase>
      <DemoCase id="nav-count-collapsed">
        <NavDemo count={3} collapsed />
      </DemoCase>
      <DemoCase id="quote-strip-0">
        <StripDemo query={STRIP_ZERO} />
      </DemoCase>
      <DemoCase id="quote-strip-3">
        <StripDemo query={STRIP_THREE} />
      </DemoCase>
      <DemoCase id="quote-strip-loading">
        <StripDemo query={STRIP_LOADING} />
      </DemoCase>
      <DemoCase id="quote-strip-failed">
        <StripDemo query={STRIP_FAILED} />
      </DemoCase>
    </div>
  );
}
