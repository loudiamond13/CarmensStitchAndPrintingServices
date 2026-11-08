// SPEC-GAP: T1 Transfer window (UI-SPEC T1, D-47, D-14, D-56, MONEY-04). Two modes in one window:
//   - `transfer`: the signed-in person hands part of the money they hold to a coworker: To (the recipients the server offers, never the
//     sender and never a figure), Amount, Date (the business today) and a Note. The sender is never sent: the server takes it from the
//     token. A Manager who picks a leaver who is owed money is also checked against the staff balances read when the window opened
//     (D-49); an Admin is never sent any figure and relies on the server's refusal.
//   - `handover` (Manager only, D-17): a Manager moves money held by a person who left to an active coworker. The leaver is the sender,
//     named in the body; the Manager only records it. To lists active staff with the Manager first as "{name} (you)", and the cap is what
//     the leaver holds, read again when the window opens (D-18). It asks nothing of the Manager's own money.
// Every rule is checked in the browser first with the server's own words (OR-3, moneySchemas.ts); the server decides. The window sits in
// the order windows' frame, so a changed window asks "Discard changes?" before it closes, and nothing closes while a save runs.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { MoneyInput } from '@/components/entry';
import { DateInput, Field, Select } from '@/components/forms';
import { useToast } from '@/components/feedback';
import { Modal } from '@/components/overlays';
import { Note, SkeletonText } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { serverFieldMessage } from '@/lib/forms/serverFieldMessage';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { orderWindowFullRowClasses, orderWindowGridClasses } from '@/modules/admin/components/orderWindow.recipe';
import { useBusinessToday } from '@/modules/admin/hooks/useBusinessToday';
import { useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import type { OrderWindowBanner } from '@/modules/admin/hooks/useOrderChildSave';
import { useSession } from '@/modules/admin/hooks/useSession';
import { useStaffBalancesQuery } from '@/modules/admin/hooks/useStaffBalancesQuery';
import { useTransferAction } from '@/modules/admin/hooks/useTransferAction';
import { useTransferRecipientsQuery } from '@/modules/admin/hooks/useTransferRecipientsQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import {
  handoverFormSchema,
  toHandoverBody,
  toTransferBody,
  transferFormSchema,
  type OwedLeaver,
  type TransferFormInput,
  type TransferFormOutput,
} from '@/modules/admin/moneySchemas';
import {
  pickHandoverRecipients,
  pickTransferRecipients,
  type StaffBalances,
  type TransferPerson,
  type TransferRecipient,
} from '@/modules/admin/services/moneyService';
import { formatPeso, round2 } from '@/utils/csps';
import { errorLine, type ErrorCopy } from '@/utils/describeHttpError';

const COPY = MONEY_COPY.transfer;
const HANDOVER = MONEY_COPY.handover;

const FIELD_ORDER = ['toUserId', 'amount', 'transferDate', 'note'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

/** The former staff member a Manager hands money over from: who they are, how they left, and what the All Staff row said they hold. */
export interface HandoverLeaver {
  userId: string;
  name: string;
  status: 'deactivated' | 'deleted';
  balance: number;
}

interface TransferModalCommon {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The button that opened the window. Safari does not focus a button on a click, so focus is sent back here once the window is closed. */
  returnFocusTo?: RefObject<HTMLElement | null> | undefined;
}

export type TransferModalProps = TransferModalCommon &
  ({ mode: 'transfer'; leaver?: undefined } | { mode: 'handover'; leaver: HandoverLeaver });

export function TransferModal({ open = true, leaver, onClose, returnFocusTo }: TransferModalProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opens, setOpens] = useState(0);
  // A new open mounts a fresh form, so the balance and the people are read again: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
    }
  }
  useEffect(() => {
    if (!open) {
      returnFocusTo?.current?.focus();
    }
  }, [open, returnFocusTo]);
  return <TransferWindow key={opens} leaver={leaver} open={open} onClose={onClose} />;
}

interface TransferWindowProps {
  /** Set in hand-over mode. */
  leaver: HandoverLeaver | undefined;
  open: boolean;
  onClose: () => void;
}

/** What leavers who are owed money are owed, by id, from the staff balances: only a Manager is given these (D-49). */
function owedLeavers(staff: StaffBalances | undefined): ReadonlyMap<string, OwedLeaver> | undefined {
  if (staff === undefined) return undefined;
  const owed = new Map<string, OwedLeaver>();
  for (const row of staff.rows) {
    if (row.status !== 'active' && round2(row.balance) < 0) {
      owed.set(row.userId, { name: row.name, owed: -row.balance });
    }
  }
  return owed;
}

function TransferWindow({ leaver, open, onClose }: TransferWindowProps) {
  const { user } = useSession();
  const handover = leaver !== undefined;
  // Read when the window opens: the balance the Amount hint and the cap use, and the people To offers. A hand-over asks nothing of the
  // Manager's own money.
  const money = useMyMoneyQuery(!handover);
  const recipients = useTransferRecipientsQuery(open);
  // The staff balances: the leaver's balance for a hand-over, or a Manager's owed-leaver cap for a transfer. An Admin never reads them.
  const staff = useStaffBalancesQuery(open && (handover || user?.role === 'manager'));
  // The server's business today, never the device clock (D-20). Once known it stays: a read that is marked old (the save marks the
  // money answers old) must not swap the form for a skeleton while the window closes.
  const heldToday = useBusinessToday(open);
  const [today, setToday] = useState(heldToday);
  if (heldToday !== null && heldToday !== today) {
    setToday(heldToday);
  }
  if (today === null) {
    return (
      <Modal open={open} title={handover ? HANDOVER.title : COPY.title} onClose={onClose}>
        <SkeletonText />
      </Modal>
    );
  }
  // A leaver the fresh read no longer lists holds nothing now; until a fresh read arrives (or if it fails) the row's figure stands.
  const leaverRow = handover ? staff.data?.rows.find((row) => row.userId === leaver.userId) : undefined;
  const leaverBalance = !handover
    ? null
    : (leaverRow?.balance ?? (staff.isSuccess && !staff.isFetching ? 0 : leaver.balance));
  return (
    <TransferForm
      open={open}
      today={today}
      leaver={leaver}
      name={handover ? leaver.name : (money.data?.name ?? null)}
      balance={handover ? leaverBalance : (money.data?.balance ?? null)}
      owedByRecipient={handover ? undefined : owedLeavers(staff.data)}
      recipients={recipients}
      onRefreshBalance={() => {
        void (handover ? staff.refetch() : money.refetch());
      }}
      onRefreshPeople={() => {
        void recipients.refetch();
      }}
      onClose={onClose}
    />
  );
}

interface RecipientsState {
  readonly data: readonly TransferPerson[] | undefined;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
}

interface TransferFormProps {
  open: boolean;
  today: string;
  /** Set in hand-over mode: the former staff member the money comes from. */
  leaver: HandoverLeaver | undefined;
  /** The sender's name and balance: the signed-in person's own (null until the money answer arrives), or the leaver's. */
  name: string | null;
  balance: number | null;
  /** A Manager's transfer only: what each leaver is owed (D-49). */
  owedByRecipient: ReadonlyMap<string, OwedLeaver> | undefined;
  recipients: RecipientsState;
  /** Reads the sender's balance again, so the Amount hint and the cap follow it. */
  onRefreshBalance: () => void;
  /** Reads the people again, so To follows who can receive now. */
  onRefreshPeople: () => void;
  onClose: () => void;
}

/** The label of one person in To: leavers carry the Paid by words. */
function recipientLabel(person: TransferRecipient): string {
  if (person.status === 'deactivated') return COPY.to.inactive(person.name);
  if (person.status === 'deleted') return COPY.to.formerStaff(person.name);
  return person.name;
}

/** The people To offers: coworkers then owed leavers for a transfer; active staff with the Manager first for a hand-over. */
function toOptions(people: readonly TransferPerson[], handover: boolean): { value: string; label: string }[] {
  if (handover) {
    return pickHandoverRecipients(people).map((person) => ({
      value: person.id,
      label: person.isYou ? COPY.to.you(person.name) : person.name,
    }));
  }
  const others = pickTransferRecipients(people);
  // Active people first, then the owed leavers, each group in the order the server sent.
  return [
    ...others.filter((person) => person.status === 'active'),
    ...others.filter((person) => person.status !== 'active'),
  ].map((person) => ({ value: person.id, label: recipientLabel(person) }));
}

function TransferForm({
  open,
  today,
  leaver,
  name,
  balance,
  owedByRecipient,
  recipients,
  onRefreshBalance,
  onRefreshPeople,
  onClose,
}: TransferFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [banner, setBanner] = useState<OrderWindowBanner | null>(null);
  const toast = useToast();
  const handover = leaver !== undefined;
  const schema = handover
    ? handoverFormSchema({ leaverName: leaver.name, leaverBalance: balance, today })
    : transferFormSchema({ balance, today, owedByRecipient });
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    getValues,
    formState: { isDirty },
  } = useForm<TransferFormInput, unknown, TransferFormOutput>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { toUserId: '', amount: '', transferDate: today, note: '' },
  });

  const focusField = (field: FieldName): void => {
    const element = formRef.current?.elements.namedItem(field);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  // The server decides what the browser could not know. A refusal lands under its field, the typed values stay, and the answer it
  // was based on is read again: the balance after an Amount refusal, the people after a To refusal.
  const showFailure = (copy: ErrorCopy, error: unknown): void => {
    if (isHttpError(error) && error.kind === 'http') {
      if (error.status === 400) {
        const refused = FIELD_ORDER.flatMap((field) => {
          const message = serverFieldMessage(error.fieldErrors, field);
          return message === undefined ? [] : [{ field, message }];
        });
        const first = refused[0];
        if (first !== undefined) {
          for (const { field, message } of refused) {
            setError(field, { type: 'server', message });
          }
          if (refused.some(({ field }) => field === 'amount')) onRefreshBalance();
          if (refused.some(({ field }) => field === 'toUserId')) onRefreshPeople();
          setBanner(null);
          focusField(first.field);
          return;
        }
        setBanner({ kind: 'message', text: Object.values(error.fieldErrors)[0]?.[0] ?? errorLine(copy) });
        return;
      }
      if (error.status === 409) {
        // Another change won the race (SEC-06): the server's own line, and the window stays so the same transfer can be sent again.
        toast.show({ tone: 'danger', title: error.problem?.detail ?? errorLine(copy) });
        return;
      }
    }
    setBanner({ kind: 'message', text: errorLine(copy) });
  };

  const action = useTransferAction({ onSaved: onClose, onFailure: showFailure, leaverName: leaver?.name });

  // D-47: the cursor starts on To. It is disabled while the people load, so it takes the cursor once they have arrived, unless the
  // person has already started typing.
  const focusTo = useEffectEvent(() => {
    if (!isDirty) {
      focusField('toUserId');
      // The window first puts the cursor on the first box that can take it (Amount, while To is disabled). Moving it to To is not the
      // person leaving Amount, so the blur check must not leave "Enter the amount." behind over the Amount hint.
      window.setTimeout(() => {
        clearErrors('amount');
      }, 0);
    }
  });
  const peopleReady = recipients.isSuccess;
  useEffect(() => {
    if (peopleReady) {
      focusTo();
    }
  }, [peopleReady]);

  const loadingPeople = recipients.isPending;
  const options = toOptions(recipients.data ?? [], handover);

  // A chosen person the re-read list no longer holds is cleared, so the hidden id can never be sent (the server's line stays under To).
  const offered = recipients.data === undefined ? undefined : options.map((option) => option.value).join(',');
  useEffect(() => {
    if (!peopleReady || offered === undefined) {
      return;
    }
    const chosen = getValues('toUserId');
    if (chosen !== '' && !offered.split(',').includes(chosen)) {
      setValue('toUserId', '', { shouldDirty: true });
    }
  }, [peopleReady, offered, getValues, setValue]);

  const onValid = (values: TransferFormOutput): void => {
    setBanner(null);
    void action.submit(leaver === undefined ? toTransferBody(values) : toHandoverBody(values, leaver.userId));
  };

  const onInvalid = (errors: FieldErrors<TransferFormInput>): void => {
    const first = FIELD_ORDER.find((field) => errors[field] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  let description = '';
  if (name !== null && balance !== null) {
    description =
      leaver === undefined
        ? COPY.description(name, formatPeso(balance))
        : HANDOVER.description(name, leaver.status, formatPeso(balance));
  }
  let amountHint: string | null = null;
  if (balance !== null) {
    amountHint =
      leaver === undefined
        ? COPY.amount.hint(formatPeso(balance))
        : HANDOVER.amount.hint(leaver.name, formatPeso(balance));
  }

  return (
    <OrderWindow
      title={handover ? HANDOVER.title : COPY.title}
      description={description}
      open={open}
      isDirty={isDirty}
      pending={action.pending}
      banner={banner}
      saveLabel={handover ? HANDOVER.save : COPY.save}
      formRef={formRef}
      onSave={() => {
        void handleSubmit(onValid, onInvalid)();
      }}
      onClose={onClose}
    >
      <div className={orderWindowGridClasses}>
        <div className={orderWindowFullRowClasses}>
          <Controller
            control={control}
            name="toUserId"
            render={({ field, fieldState }) => (
              <Select
                label={COPY.to.label}
                name={field.name}
                required
                placeholder={loadingPeople ? COPY.to.loading : COPY.to.placeholder}
                disabled={loadingPeople || recipients.isError}
                options={options}
                value={loadingPeople ? '' : field.value}
                onChange={(event) => {
                  field.onChange(event.target.value);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? (recipients.isError ? COPY.to.loadFailed : '')}
                hint={COPY.to.hint}
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <MoneyInput
              label={COPY.amount.label}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              {...(amountHint === null ? {} : { hint: amountHint })}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="transferDate"
          render={({ field, fieldState }) => (
            <DateInput
              label={COPY.date.label}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message ?? ''}
              hint={COPY.date.hint}
              required
            />
          )}
        />
        <div className={orderWindowFullRowClasses}>
          <Controller
            control={control}
            name="note"
            render={({ field, fieldState }) => (
              <Field
                multiline
                rows={3}
                label={COPY.note.label}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? ''}
                placeholder={COPY.note.placeholder}
                hint={COPY.note.hint}
                maxLength={200}
              />
            )}
          />
        </div>
        {leaver !== undefined && (
          <div className={orderWindowFullRowClasses}>
            <Note icon="info">{HANDOVER.note(leaver.name)}</Note>
          </div>
        )}
      </div>
    </OrderWindow>
  );
}
