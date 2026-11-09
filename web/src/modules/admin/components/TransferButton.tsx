// The Transfer button (D-46 strip, D-39 My Money header; UI-SPEC D1, M1) and the window it opens. D-14: with nothing on hand, or while
// the figure is not known, the button is aria-disabled but never hidden and keeps the keyboard cursor; with nothing on hand the screen
// also shows `TransferReason`, which the button names with aria-describedby, and while the figure loads or failed the strip's own
// line is named the same way (D-107). The window is built only after the first press, so a
// screen that only shows the button reads no recipients. Focus goes back to the button once the window is closed.
import { useRef, useState } from 'react';
import { Button, hitAreaClasses, type ButtonSize, type ButtonVariant } from '@/components/actions';
import { TransferModal } from '@/modules/admin/components/TransferModal';
import { transferReasonClasses } from '@/modules/admin/components/money.recipe';
import type { MyMoneyCardQuery } from '@/modules/admin/hooks/useMyMoneyQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import { round2 } from '@/utils/csps';

const COPY = MONEY_COPY.transfer;

/** What the money answer allows. */
export interface TransferGate {
  /** The button cannot be used now: the figure is loading or failed, or nothing is on hand. */
  readonly blocked: boolean;
  /** The money answer says nothing (or less) is on hand, so the reason is shown. */
  readonly nothingOnHand: boolean;
}

/** The server's figure decides: the browser only reads it. A figure that is missing or failed blocks the button without a reason. */
export function transferGate(query: Pick<MyMoneyCardQuery, 'data' | 'isError'>): TransferGate {
  const money = query.data;
  const known = money !== undefined && !query.isError;
  const nothingOnHand = known && round2(money.balance) <= 0;
  return { blocked: !known || nothingOnHand, nothingOnHand };
}

/** The visible reason beside a Transfer button that cannot be used (D-14). */
export function TransferReason({ id, className }: { id: string; className?: string }) {
  return (
    <p id={id} className={className ?? transferReasonClasses}>
      {COPY.nothingOnHand}
    </p>
  );
}

export interface TransferButtonProps {
  query: Pick<MyMoneyCardQuery, 'data' | 'isError'>;
  /** The id of the `TransferReason` on the screen; named by the button while nothing is on hand. */
  reasonId: string;
  /** The id of the line that says the figure is loading or failed; named by the button while it is blocked for that reason (D-107). */
  pendingReasonId?: string | undefined;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function TransferButton({
  query,
  reasonId,
  pendingReasonId,
  variant = 'secondary',
  size = 'sm',
}: TransferButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [built, setBuilt] = useState(false);
  const [open, setOpen] = useState(false);
  const gate = transferGate(query);
  const describedBy = gate.nothingOnHand ? reasonId : gate.blocked ? pendingReasonId : undefined;

  return (
    <>
      <Button
        ref={buttonRef}
        variant={variant}
        size={size}
        icon="arrow-right"
        // The small strip button (36px) gets the 44px tap area; the 44px header button needs none.
        {...(size === 'sm' ? { className: hitAreaClasses } : {})}
        aria-disabled={gate.blocked}
        {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })}
        onClick={() => {
          if (!gate.blocked) {
            setBuilt(true);
            setOpen(true);
          }
        }}
      >
        {COPY.button}
      </Button>
      {built && (
        <TransferModal
          open={open}
          mode="transfer"
          returnFocusTo={buttonRef}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
