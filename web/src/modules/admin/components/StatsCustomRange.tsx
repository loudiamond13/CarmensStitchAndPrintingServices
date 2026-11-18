// The Visitor Stats custom range (UI-SPEC V1 item 1; D-24, D-04, OR-3). SPEC-GAP: V1. The From and To inputs, bounded by the
// 3-year floor and the business today from the server (useBusinessToday, never the device clock). The dates are held here while
// they are typed and applied (written to the URL) only once both pass the checks in visitorStatsRange.ts. A message shows once
// that date was touched, or the other one filled, so choosing "Custom range" does not open with errors.
import { useState } from 'react';
import { DateInput } from '@/components';
import { useBusinessToday } from '@/modules/admin/hooks/useBusinessToday';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { statsCustomRangeErrors, statsFloor } from '@/modules/admin/visitorStatsRange';

const COPY = VISITOR_STATS_COPY.toolbar;

export interface StatsCustomRangeProps {
  /** The applied dates from the URL, or null. */
  from: string | null;
  to: string | null;
  /** Both dates are valid. */
  onApply: (from: string, to: string) => void;
}

type Field = 'from' | 'to';

const NO_ERRORS = { from: null, to: null } as const;

export function StatsCustomRange({ from, to, onApply }: StatsCustomRangeProps) {
  const today = useBusinessToday();
  const [draft, setDraft] = useState({ from: from ?? '', to: to ?? '' });
  const [touched, setTouched] = useState({ from: false, to: false });
  // The URL moved (Back, a shared link): the inputs follow it. Adjusted during render, not in an effect.
  const [seen, setSeen] = useState({ from, to });
  if (seen.from !== from || seen.to !== to) {
    setSeen({ from, to });
    setDraft({ from: from ?? '', to: to ?? '' });
  }

  const errors = today === null ? NO_ERRORS : statsCustomRangeErrors(draft, today);
  const showFrom = errors.from !== null && (touched.from || draft.to !== '');
  const showTo = errors.to !== null && (touched.to || draft.from !== '');
  const bounds = today === null ? {} : { min: statsFloor(today), max: today };

  const change = (field: Field, value: string): void => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setTouched((current) => ({ ...current, [field]: true }));
    if (today === null) return;
    const nextErrors = statsCustomRangeErrors(next, today);
    if (nextErrors.from === null && nextErrors.to === null) {
      onApply(next.from, next.to);
    }
  };

  return (
    <>
      <DateInput
        label={COPY.from}
        value={draft.from}
        {...bounds}
        error={showFrom ? (errors.from ?? '') : ''}
        onChange={(value) => {
          change('from', value);
        }}
      />
      <DateInput
        label={COPY.to}
        value={draft.to}
        {...bounds}
        error={showTo ? (errors.to ?? '') : ''}
        onChange={(value) => {
          change('to', value);
        }}
      />
    </>
  );
}
