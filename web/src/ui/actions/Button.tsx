// Button (App. D.3 "Actions"). Stub for the RED step of plan 02-14: the App. D.3 markup without the look or the
// WEB-09 pending behaviour.
import type { MouseEvent, ReactNode } from 'react';
import type { IconName } from '@/ui/brand';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button.recipe';

export type { ButtonSize, ButtonVariant } from './button.recipe';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  pending?: boolean;
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
}

export function Button({ variant = 'secondary', size = 'md', type = 'button', className, children }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })}>
      <span>{children}</span>
    </button>
  );
}
