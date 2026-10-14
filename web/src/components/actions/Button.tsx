// Button (App. D.3 "Actions"), converted to utilities (D-33) with the same props API and markup: an optional left icon,
// the label in a <span>, an optional right icon; no children makes it icon-only.
// SPEC-DEVIATION: L-13 the props are explicit (no {...rest} spread onto the button), so callers cannot restyle the
// primitive or pass unvetted attributes; the ones App. D/E callers use, plus the ARIA a menu or toggle trigger needs,
// are listed in ButtonProps.
import type { MouseEvent, ReactNode, Ref } from 'react';
import { Icon, type IconName } from '@/components/brand';
import {
  buttonClasses,
  buttonIconSize,
  buttonSpinnerClasses,
  type ButtonSize,
  type ButtonVariant,
} from './button.recipe';

export type { ButtonSize, ButtonVariant } from './button.recipe';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  /** App. D.3's busy flag. Same behaviour as `pending` (WEB-09). */
  loading?: boolean;
  /** A request is in flight (WEB-09): spinner, aria-busy, aria-disabled; focus stays, activation is ignored. */
  pending?: boolean;
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Layout glue only (margin, placement, width); never a restyle (spec rule 3). */
  className?: string;
  id?: string;
  title?: string;
  form?: string;
  name?: string;
  value?: string;
  'aria-describedby'?: string;
  'aria-controls'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'menu' | 'dialog' | 'listbox' | true;
  'aria-pressed'?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

// SPEC-DEVIATION: A11Y-04 App. D.3 accepts an icon-only Button (no children) without a name; here the type requires an
// aria-label for one, so an unnamed icon button is a compile error instead of an axe finding (button-name).
/** A labelled button (children), or an icon-only button (no children) that must carry an `aria-label`. */
export type ButtonProps = ButtonBaseProps &
  ({ children: ReactNode; 'aria-label'?: string } | { children?: undefined; 'aria-label': string });

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  pending = false,
  block = false,
  disabled,
  type = 'button',
  onClick,
  className,
  children,
  id,
  title,
  form,
  name,
  value,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-controls': ariaControls,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHasPopup,
  'aria-pressed': ariaPressed,
  ref,
}: ButtonProps) {
  // SPEC-DEVIATION: WEB-09 a busy button (pending, or App. D.3's loading) is aria-disabled instead of natively
  // disabled, so keyboard focus stays on it; activation is swallowed here instead (a click, Enter or Space, and so the
  // form submission a submit button would start). It looks exactly like the disabled button (owner, 2026-10-07).
  const busy = pending || loading;
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (busy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  const iconSize = buttonIconSize[size];
  return (
    <button
      ref={ref}
      type={type}
      id={id}
      title={title}
      form={form}
      name={name}
      value={value}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-pressed={ariaPressed}
      onClick={handleClick}
      className={buttonClasses({ variant, size, block, iconOnly: !children, className })}
    >
      {busy ? (
        <Icon name="loader-circle" size={18} className={buttonSpinnerClasses} />
      ) : (
        icon !== undefined && <Icon name={icon} size={iconSize} />
      )}
      {children != null && children !== false && <span>{children}</span>}
      {iconRight !== undefined && !busy && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
