// RED stub (plan 02-17): replaced by the ButtonLink with the button look in the GREEN step.
import type { IconName } from '@/ui/brand';
import type { ButtonSize, ButtonVariant } from './button.recipe';
import { UiLink, type UiLinkProps } from './UiLink';

export interface ButtonLinkProps extends UiLinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
}

export function ButtonLink({ to, children }: ButtonLinkProps) {
  return <UiLink to={to}>{children}</UiLink>;
}
