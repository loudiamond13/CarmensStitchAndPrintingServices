// The From and To inputs of the Company Expenses toolbar (UI-SPEC E1 toolbar; CEXP-01, D-23, OR-3; plan 06-07). They show the
// range the list is using: the pair in the URL, else the window the server resolved. The dates are held here while they are
// typed; the range is applied (written to the URL) only once both are valid real dates and From is on or before To, and each
// message comes from the zod schema in expensesSchemas.ts. Until then the list keeps the last applied range. A message shows
// once a date has been touched, so the inputs never open with errors.
import { useState } from 'react';
import { DateInput } from '@/components/forms';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { expenseRangeErrors } from '@/modules/admin/expensesSchemas';

const COPY = EXPENSES_COPY.dates;

export interface ExpensesDateRangeProps {
  /** The range in use (YYYY-MM-DD), or '' while the server's window is not known yet. */
  from: string;
  to: string;
  /** Both dates are valid and From is on or before To. */
  onApply: (from: string, to: string) => void;
}

type Field = 'from' | 'to';

export function ExpensesDateRange({ from, to, onApply }: ExpensesDateRangeProps) {
  const [draft, setDraft] = useState({ from, to });
  const [touched, setTouched] = useState(false);
  // The range in use moved (Back, a cleared chip, the window arriving): the inputs follow it. Adjusted during render.
  const [seen, setSeen] = useState({ from, to });
  if (seen.from !== from || seen.to !== to) {
    setSeen({ from, to });
    setDraft({ from, to });
    setTouched(false);
  }

  const errors = expenseRangeErrors(draft);

  const change = (field: Field, value: string): void => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setTouched(true);
    const nextErrors = expenseRangeErrors(next);
    if (nextErrors.from === null && nextErrors.to === null) {
      onApply(next.from, next.to);
    }
  };

  return (
    <>
      <DateInput
        label={COPY.from}
        value={draft.from}
        error={touched ? (errors.from ?? '') : ''}
        onChange={(value) => {
          change('from', value);
        }}
      />
      <DateInput
        label={COPY.to}
        value={draft.to}
        error={touched ? (errors.to ?? '') : ''}
        onChange={(value) => {
          change('to', value);
        }}
      />
    </>
  );
}
