// Badge (App. D.3 "Status", CSPS-UI-SPEC.md §6.2), converted to utilities (D-33) with the same props API and markup:
// an optional hidden dot, an optional 14px icon, then the text. The `csp-badge-<tone>` look is one complete literal per
// tone in status.recipe.ts, so a tone never builds a class name at run time.
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/brand';
import { badgeClasses, badgeDotClasses, badgeToneClasses } from './status.recipe';
import type { BadgeTone } from './tones';

export interface BadgeProps {
  tone?: BadgeTone | undefined;
  /** A leading dot in the badge's ink (StatusBadge and the Users table status). */
  dot?: boolean | undefined;
  /** A leading 14px icon, hidden from assistive technology (the text names the badge). */
  icon?: IconName | undefined;
  children?: ReactNode;
  /** Layout glue only (margin, placement); never a restyle (spec rule 3). */
  className?: string | undefined;
}

export function Badge({ tone = 'neutral', dot = false, icon, children, className }: BadgeProps) {
  return (
    <span className={clsx(badgeClasses, badgeToneClasses[tone], className)}>
      {dot && <span className={badgeDotClasses} aria-hidden="true" />}
      {icon !== undefined && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}
