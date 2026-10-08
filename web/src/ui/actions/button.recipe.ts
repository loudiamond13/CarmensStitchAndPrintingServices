// The button look (App. B `.csp-btn*`, D-33). Shared by Button, ButtonLink and SkipLink (UI-SPEC "Where class strings
// live"). Stub for the RED step of plan 02-14: no utilities yet.
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ghost-danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonClassOptions {
  readonly variant: ButtonVariant;
  readonly size: ButtonSize;
  readonly block?: boolean;
  readonly iconOnly?: boolean;
  readonly className?: string | undefined;
}

export function buttonClasses({ className }: ButtonClassOptions): string {
  return clsx(className);
}
