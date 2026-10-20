// The Audit Log's custom range (UI-SPEC A1 toolbar; AUDIT-02, D-26, OR-3; plan 05-33): the From and To date inputs, bounded by the
// start of the 8-month kept window and the business today. The dates are held here while they are typed; the range is applied
// (written to the URL) only once both are valid, and each message comes from the zod schema in auditRange.ts. A message shows
// once the person has touched that date, or filled the other one, so choosing "Custom range" does not open with errors.
import { useState } from 'react';
import { DateInput } from '@/components/forms';
import { AUDIT_COPY } from '@/modules/admin/auditCopy';
import { customRangeErrors, keptFloor } from '@/modules/admin/auditRange';

export interface AuditCustomRangeProps {
  /** The applied dates from the URL, or null. */
  from: string | null;
  to: string | null;
  /** The business today (YYYY-MM-DD): the latest date, and what the earliest is counted back from. */
  today: string;
  /** Both dates are valid. */
  onApply: (from: string, to: string) => void;
}

type Field = 'from' | 'to';

export function AuditCustomRange({ from, to, today, onApply }: AuditCustomRangeProps) {
  const [draft, setDraft] = useState({ from: from ?? '', to: to ?? '' });
  const [touched, setTouched] = useState({ from: false, to: false });
  // The URL moved (Back, a clear, a shared link): the inputs follow it. Adjusted during render, not in an effect.
  const [seen, setSeen] = useState({ from, to });
  if (seen.from !== from || seen.to !== to) {
    setSeen({ from, to });
    setDraft({ from: from ?? '', to: to ?? '' });
  }

  const errors = customRangeErrors(draft, today);
  const showFrom = errors.from !== null && (touched.from || draft.to !== '');
  const showTo = errors.to !== null && (touched.to || draft.from !== '');
  const floor = keptFloor(today);

  const change = (field: Field, value: string): void => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setTouched((current) => ({ ...current, [field]: true }));
    const nextErrors = customRangeErrors(next, today);
    if (nextErrors.from === null && nextErrors.to === null) {
      onApply(next.from, next.to);
    }
  };

  return (
    <>
      <DateInput
        label={AUDIT_COPY.toolbar.from}
        value={draft.from}
        min={floor}
        max={today}
        error={showFrom ? (errors.from ?? '') : ''}
        onChange={(value) => {
          change('from', value);
        }}
      />
      <DateInput
        label={AUDIT_COPY.toolbar.to}
        value={draft.to}
        min={floor}
        max={today}
        error={showTo ? (errors.to ?? '') : ''}
        onChange={(value) => {
          change('to', value);
        }}
      />
    </>
  );
}
