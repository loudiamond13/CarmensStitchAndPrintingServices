// RED stub (plan 02-19 Task 1): replaced in GREEN.
import type { ReactNode } from 'react';
import type { IconName } from '@/ui/brand';
import type { BadgeTone } from './tones';

export interface BadgeProps {
  tone?: BadgeTone | undefined;
  dot?: boolean | undefined;
  icon?: IconName | undefined;
  children?: ReactNode;
  className?: string | undefined;
}

export function Badge({ children }: BadgeProps) {
  return <span>{children}</span>;
}
