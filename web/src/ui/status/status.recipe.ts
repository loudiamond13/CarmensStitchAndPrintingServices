// The status and identity looks (App. B `/* ── Badge ── */` and `.csp-avatar`, CSPS-UI-SPEC.md §6.2) as complete
// Tailwind tokens (D-33). Every string in this file is a class list (the class gate reads them all). Axes set disjoint
// properties: the badge base never sets a background or a colour; only the tone map does.
import type { BadgeTone } from './tones';
import { tw } from '@/ui/tw';

/** `.csp-badge`: 24px tall, radius 4, 12px/16px 600 with .02em tracking, one line. */
export const badgeClasses = tw(
  'inline-flex h-6 items-center gap-1.5 rounded-xs px-2 text-[12px] leading-4 font-semibold tracking-[.02em] whitespace-nowrap',
);

/** `.csp-badge-<tone>`: the soft background and its ink, one complete literal per tone. */
export const badgeToneClasses = {
  neutral: tw('bg-neutral-soft text-ink-muted'),
  accent: tw('bg-accent-soft text-accent-ink'),
  success: tw('bg-success-soft text-success'),
  warning: tw('bg-warning-soft text-warning'),
  info: tw('bg-info-soft text-info'),
  mockup: tw('bg-mockup-soft text-mockup'),
  danger: tw('bg-danger-soft text-danger'),
  solid: tw('bg-accent text-on-accent'),
} as const satisfies Record<BadgeTone, string>;

/** `.csp-badge-dot`: a 7px dot in the badge's own ink. */
export const badgeDotClasses = tw('size-[7px] rounded-pill bg-current');

/**
 * `.csp-avatar`: a circle of initials in the display face. Its size and font size are per instance (a number prop), so
 * Avatar reads them from custom properties next to its style (UI-SPEC "Inline style rule").
 */
export const avatarClasses = tw(
  'inline-grid flex-none place-items-center rounded-pill bg-surface-2 font-display font-bold tracking-[.02em] text-ink [box-shadow:inset_0_0_0_1px_var(--line-strong)]',
);
