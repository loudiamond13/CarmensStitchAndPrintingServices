// ButtonLink (App. D.3 "Actions"), converted (D-33): the Button look on a router link, for navigation that looks like a
// button. Same markup as App. D.3: an optional left icon, the label as a direct text child (no <span>), an optional
// right icon. It shares buttonClasses with Button and SkipLink; hover and press are guarded with `not-disabled:` and
// `not-aria-disabled:`, which an <a> always matches, so the link keeps its hover (research Pitfall 27).
// SPEC-DEVIATION: L-13 the props are explicit (no {...rest} spread); they are UiLink's props plus the look.
import { Icon, type IconName } from '@/components/brand';
import { buttonClasses, buttonIconSize, type ButtonSize, type ButtonVariant } from './button.recipe';
import { UiLink, type UiLinkProps } from './UiLink';

export interface ButtonLinkProps extends UiLinkProps {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  icon?: IconName | undefined;
  iconRight?: IconName | undefined;
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  to,
  className,
  children,
  id,
  title,
  target,
  rel,
  onClick,
  'aria-label': ariaLabel,
  'aria-current': ariaCurrent,
  'aria-describedby': ariaDescribedBy,
  ref,
}: ButtonLinkProps) {
  const iconSize = buttonIconSize[size];
  return (
    <UiLink
      ref={ref}
      to={to}
      id={id}
      title={title}
      target={target}
      rel={rel}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      aria-describedby={ariaDescribedBy}
      className={buttonClasses({ variant, size, className })}
    >
      {icon !== undefined && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight !== undefined && <Icon name={iconRight} size={iconSize} />}
    </UiLink>
  );
}
