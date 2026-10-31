// SPEC-GAP: PaidBySelect (CEXP-05). A Select of the people the staff lookup returns (D-32), and nobody else: not "the company",
// not a typed name. The signed-in user comes first as "{First Last} (you)", then the others in the lookup's order (first name,
// last name). While the lookup loads it is disabled and reads "Loading staff…"; when it fails the field says so and stays
// disabled. The hint "The staff member whose money paid for this." gives way to a given error. An edit passes the saved payer:
// one the lookup no longer holds stays listed and selected as "{name} (inactive)", or "{name} (former staff)" when the account
// was deleted (OQ-7), so the form can be saved without changing who paid. Phase 7 reuses it (ORD-22, ORD-23), and the order money windows reuse it with their own label, name and hint (Phase 8).
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
  /** The payer the expense already has (an edit); kept in the list when the lookup no longer holds them. */
  savedPayer?: { id: string; name: string; formerStaff: boolean } | null | undefined;
  /** A validation or server message; it replaces the hint. */
  error?: string | undefined;
  /** The field's label. Default "Paid by"; the order money windows pass "Received by" or "Refunded by". */
  label?: string;
  /** The submitted field name. Default "paidByUserId". */
  name?: string;
  /** The line under the field. Default the expense hint. */
  hint?: string;
}

export function PaidBySelect({
  value,
  onChange,
  currentUser,
  savedPayer,
  error,
  label = COPY.label,
  name = 'paidByUserId',
  hint = COPY.hint,
}: PaidBySelectProps) {
  const staff = useStaffLookupQuery();
  const loading = staff.isPending;
  const failed = staff.isError;
  const people = staff.data ?? [];
  const me = currentUser === null ? undefined : people.find((person) => person.id === currentUser.id);
  // Only a lookup that answered can say the saved payer is gone from it.
  const kept =
    savedPayer === null || savedPayer === undefined || !staff.isSuccess || people.some((p) => p.id === savedPayer.id)
      ? []
      : [
          {
            value: savedPayer.id,
            label: savedPayer.formerStaff ? COPY.formerStaff(savedPayer.name) : COPY.inactive(savedPayer.name),
          },
        ];
  const options = [
    ...(me === undefined ? [] : [{ value: me.id, label: COPY.you(currentUser?.name ?? me.name) }]),
    ...people.filter((person) => person.id !== me?.id).map((person) => ({ value: person.id, label: person.name })),
    ...kept,
  ];

  return (
    <Select
      label={label}
      name={name}
      required
      placeholder={loading ? COPY.loading : ''}
      disabled={loading || failed}
      options={options}
      value={loading ? '' : value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      error={error ?? (failed ? COPY.loadFailed : '')}
      hint={hint}
    />
  );
}
