// SPEC-GAP: PaidBySelect (CEXP-05). A Select of the people the staff lookup returns (D-32), and nobody else: not "the company",
// not a typed name. The signed-in user comes first as "{First Last} (you)", then the others in the lookup's order (first name,
// last name). While the lookup loads it is disabled and reads "Loading staff…"; when it fails the field says so and stays
// disabled. The hint "The staff member whose money paid for this." gives way to a given error. Phase 7 reuses it (ORD-22, ORD-23).
import { Select } from '@/components/forms';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { useStaffLookupQuery } from '@/modules/admin/hooks/useStaffLookupQuery';

const COPY = EXPENSES_COPY.form.paidBy;

export interface PaidBySelectProps {
  /** The chosen person's id. */
  value: string;
  onChange: (userId: string) => void;
  /** The signed-in user, listed first as "(you)" when the lookup holds them. */
  currentUser: { id: string; name: string } | null;
  /** A validation or server message; it replaces the hint. */
  error?: string | undefined;
}

export function PaidBySelect({ value, onChange, currentUser, error }: PaidBySelectProps) {
  const staff = useStaffLookupQuery();
  const loading = staff.isPending;
  const failed = staff.isError;
  const people = staff.data ?? [];
  const me = currentUser === null ? undefined : people.find((person) => person.id === currentUser.id);
  const options = [
    ...(me === undefined ? [] : [{ value: me.id, label: COPY.you(currentUser?.name ?? me.name) }]),
    ...people.filter((person) => person.id !== me?.id).map((person) => ({ value: person.id, label: person.name })),
  ];

  return (
    <Select
      label={COPY.label}
      name="paidByUserId"
      required
      placeholder={loading ? COPY.loading : ''}
      disabled={loading || failed}
      options={options}
      value={loading ? '' : value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      error={error ?? (failed ? COPY.loadFailed : '')}
      hint={COPY.hint}
    />
  );
}
