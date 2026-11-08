// The Transfer button (D-46 strip, D-39 My Money header; UI-SPEC D1, M1) and the window it opens. The window is built only after the first
// press, so a screen that only shows the button reads no recipients. Focus goes back to the button once the window is closed.
import { useRef, useState } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/actions';
import { TransferModal } from '@/modules/admin/components/TransferModal';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.transfer;

export interface TransferButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function TransferButton({ variant = 'secondary', size = 'sm' }: TransferButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [built, setBuilt] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        ref={buttonRef}
        variant={variant}
        size={size}
        icon="arrow-right"
        onClick={() => {
          setBuilt(true);
          setOpen(true);
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
