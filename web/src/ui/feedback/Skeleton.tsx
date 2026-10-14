// Skeleton (App. D.3 "Feedback", CSPS-UI-SPEC.md §6.5), converted to utilities (D-33) with the App. D.3 props and
// markup: one hidden span in the shimmer look. The look is skeletonClasses in feedback.recipe.ts.
// SPEC-DEVIATION: D-33 strict CSP: the width, height and radius go through the --sk-w, --sk-h and --sk-r custom
// properties, read by the utilities in skeletonClasses, instead of inline width, height and borderRadius (UI-SPEC
// "Inline style rule"). Numbers become px as React did for those properties, and no radius means App. B's 6px.
import clsx from 'clsx';
import { skeletonClasses } from './feedback.recipe';

export interface SkeletonProps {
  /** A number is px; a string is any CSS length (default the full width). */
  width?: number | string | undefined;
  /** A number is px; a string is any CSS length (default 16px). */
  height?: number | string | undefined;
  /** A number is px; a string is any CSS length (default App. B's 6px). */
  radius?: number | string | undefined;
  /** Layout glue only (margin, placement); never a restyle (spec rule 3). */
  className?: string | undefined;
}

/** A CSS length: React's px rule for numbers, strings as given. */
function length(value: number | string): string {
  return typeof value === 'number' ? `${String(value)}px` : value;
}

export function Skeleton({ width = '100%', height = 16, radius = 6, className }: SkeletonProps) {
  return (
    <span
      className={clsx(skeletonClasses, className)}
      style={{ '--sk-w': length(width), '--sk-h': length(height), '--sk-r': length(radius) }}
      aria-hidden="true"
    />
  );
}
