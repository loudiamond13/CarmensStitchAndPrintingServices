// EmptyState (App. D.3 "Feedback", CSPS-UI-SPEC.md §6.5), converted to utilities (D-33) with the App. D.3 props and
// markup: the 64px icon tile turned -6deg with its 28px icon turned back upright, the title, an optional message and
// one action. The looks are in feedback.recipe.ts.
// SPEC-DEVIATION: A11Y-02 the title's heading level is a prop (default h2), so a screen's heading order never skips a
// level (App. D.3 always rendered an h3, which skips one under a page h1). The look is the same at every level.
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/brand';
import {
  emptyClasses,
  emptyIconClasses,
  emptyIconGlyphClasses,
  emptyMessageClasses,
  emptyTitleClasses,
} from './feedback.recipe';

export type EmptyStateHeadingLevel = 2 | 3 | 4;

export interface EmptyStateProps {
  icon?: IconName | undefined;
  title: string;
  message?: ReactNode;
  /** One action, usually a primary or secondary md Button. */
  action?: ReactNode;
  /** The title's heading level; pick the one that follows the heading above it. */
  level?: EmptyStateHeadingLevel | undefined;
}

const HEADING_TAG = { 2: 'h2', 3: 'h3', 4: 'h4' } as const satisfies Record<EmptyStateHeadingLevel, string>;

export function EmptyState({ icon = 'clipboard-list', title, message, action, level = 2 }: EmptyStateProps) {
  const Heading = HEADING_TAG[level];
  return (
    <div className={emptyClasses}>
      <span className={emptyIconClasses}>
        <Icon name={icon} size={28} className={emptyIconGlyphClasses} />
      </span>
      <Heading className={emptyTitleClasses}>{title}</Heading>
      {Boolean(message) && <p className={emptyMessageClasses}>{message}</p>}
      {action}
    </div>
  );
}
