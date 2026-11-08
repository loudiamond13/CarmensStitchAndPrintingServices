// SPEC-GAP: T1 Transfer window (UI-SPEC T1, D-47, D-14, D-56, MONEY-04). The signed-in person hands part of the money they hold to a
// coworker: To (the recipients the server offers, never the sender and never a figure), Amount, Date (the business today) and a Note.
// The sender is never sent: the server takes it from the token. Every rule is checked in the browser first with the server's own words
// (OR-3, moneySchemas.ts); the server decides. The window sits in the order windows' frame, so a changed window asks "Discard changes?"
// before it closes, and nothing closes while a save runs. Plan 10-19 adds the hand-over mode.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { MoneyInput } from '@/components/entry';
import { DateInput, Field, Select } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { SkeletonText } from '@/components/states';
import { OrderWindow } from '@/modules/admin/components/OrderWindow';
import { orderWindowFullRowClasses, orderWindowGridClasses } from '@/modules/admin/components/orderWindow.recipe';
import { useBusinessToday } from '@/modules/admin/hooks/useBusinessToday';
import { useMyMoneyQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import type { OrderWindowBanner } from '@/modules/admin/hooks/useOrderChildSave';
import { useTransferAction } from '@/modules/admin/hooks/useTransferAction';
import { useTransferRecipientsQuery } from '@/modules/admin/hooks/useTransferRecipientsQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import {
  toTransferBody,
  transferFormSchema,
  type TransferFormInput,
  type TransferFormOutput,
} from '@/modules/admin/moneySchemas';
import type { TransferRecipient } from '@/modules/admin/services/moneyService';
import { formatPeso } from '@/utils/csps';
import { errorLine } from '@/utils/describeHttpError';

const COPY = MONEY_COPY.transfer;

const FIELD_ORDER = ['toUserId', 'amount', 'transferDate', 'note'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export interface TransferModalProps {
  /** False plays the close animation and then renders nothing; each new open starts clean. Default true. */
  open?: boolean;
  mode: 'transfer';
  /** Closes the window: Cancel, Esc, the scrim and the close button (after the discard question), and after a save. */
  onClose: () => void;
  /** The button that opened the window. Safari does not focus a button on a click, so focus is sent back here once the window is closed. */
  returnFocusTo?: RefObject<HTMLElement | null> | undefined;
}

export function TransferModal({ open = true, mode, onClose, returnFocusTo }: TransferModalProps) {
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
  return <TransferWindow key={opens} mode={mode} open={open} onClose={onClose} />;
}

interface TransferWindowProps {
  mode: 'transfer';
  open: boolean;
  onClose: () => void;
}

function TransferWindow({ open, onClose }: TransferWindowProps) {
  // Read when the window opens: the balance the Amount hint and the cap use, and the people To offers.
  const money = useMyMoneyQuery();
  const recipients = useTransferRecipientsQuery(open);
  // The server's business today, never the device clock (D-20). Once known it stays: a read that is marked old (the save marks the
  // money answers old) must not swap the form for a skeleton while the window closes.
  const heldToday = useBusinessToday(open);
  const [today, setToday] = useState(heldToday);
  if (heldToday !== null && heldToday !== today) {
    setToday(heldToday);
  }
  if (today === null) {
    return (
      <Modal open={open} title={COPY.title} onClose={onClose}>
        <SkeletonText />
      </Modal>
    );
  }
  return (
    <TransferForm
      open={open}
      today={today}
      name={money.data?.name ?? null}
      balance={money.data?.balance ?? null}
      recipients={recipients}
      onClose={onClose}
    />
  );
}

interface RecipientsState {
  readonly data: readonly TransferRecipient[] | undefined;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
}

interface TransferFormProps {
  open: boolean;
  today: string;
  /** The sender's name and balance from the money answer; null until it arrives. */
  name: string | null;
  balance: number | null;
  recipients: RecipientsState;
  onClose: () => void;
}

/** The label of one person in To: leavers carry the Paid by words. */
function recipientLabel(person: TransferRecipient): string {
  if (person.status === 'deactivated') return COPY.to.inactive(person.name);
  if (person.status === 'deleted') return COPY.to.formerStaff(person.name);
  return person.name;
}

function TransferForm({ open, today, name, balance, recipients, onClose }: TransferFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [banner, setBanner] = useState<OrderWindowBanner | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<TransferFormInput, unknown, TransferFormOutput>({
    resolver: zodResolver(transferFormSchema({ balance, today })),
    mode: 'onBlur',
    defaultValues: { toUserId: '', amount: '', transferDate: today, note: '' },
  });

  const action = useTransferAction({
    onSaved: onClose,
    onFailure: (copy) => {
      setBanner({ kind: 'message', text: errorLine(copy) });
    },
  });

  const focusField = (field: FieldName): void => {
    const element = formRef.current?.elements.namedItem(field);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  };

  // D-47: the cursor starts on To. It is disabled while the people load, so it takes the cursor once they have arrived, unless the
  // person has already started typing.
  const focusTo = useEffectEvent(() => {
    if (!isDirty) {
      focusField('toUserId');
    }
  });
  const peopleReady = recipients.isSuccess;
  useEffect(() => {
    if (peopleReady) {
      focusTo();
    }
  }, [peopleReady]);

  const onValid = (values: TransferFormOutput): void => {
    setBanner(null);
    void action.submit(toTransferBody(values));
  };

  const onInvalid = (errors: FieldErrors<TransferFormInput>): void => {
    const first = FIELD_ORDER.find((field) => errors[field] !== undefined);
    if (first !== undefined) {
      focusField(first);
    }
  };

  const loadingPeople = recipients.isPending;
  const people = recipients.data ?? [];
  // Active people first, then the owed leavers, each group in the order the server sent.
  const options = [
    ...people.filter((person) => person.status === 'active'),
    ...people.filter((person) => person.status !== 'active'),
  ].map((person) => ({ value: person.id, label: recipientLabel(person) }));

  return (
    <OrderWindow
      title={COPY.title}
      description={name === null || balance === null ? '' : COPY.description(name, formatPeso(balance))}
      open={open}
      isDirty={isDirty}
      pending={action.pending}
      banner={banner}
      saveLabel={COPY.save}
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
              {...(balance === null ? {} : { hint: COPY.amount.hint(formatPeso(balance)) })}
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
      </div>
    </OrderWindow>
  );
}
