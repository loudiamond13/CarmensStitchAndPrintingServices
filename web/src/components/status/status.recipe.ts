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
  'inline-grid flex-none place-items-center rounded-pill font-display font-bold tracking-[.02em] [box-shadow:inset_0_0_0_1px_var(--line-strong)]',
);

export type AvatarContext = 'default' | 'sidebar' | 'cellUser' | 'profile';

/**
 * The avatar background and initials colour per context (plans 02-26 and 02-30): `.csp-avatar` (`--ink` on
 * `--surface-2`); in the sidebar user chip the App. B `.csp-sidebar .csp-avatar` `--surface-3` plus the 16px line
 * height the chip's `.csp-sidebar-user span` rule gives every span in it, the avatar included (its colour and font size
 * stay the avatar's own: the context rule and the size property win there); and in a list user cell (App. E.12) the
 * App. B `.csp-cell-user span` rule, which outranks `.csp-avatar` and turns the initials `--ink-muted` (its 12px loses to
 * the avatar's own size; rule 8, the approved computed result). In the My Profile header (App. C `.s-profile-head
 * .csp-avatar`, plan 05-13) the 3px `--accent-line` ring replaces the inset hairline.
 */
export const avatarContextClasses = {
  default: tw('bg-surface-2 text-ink'),
  sidebar: tw('bg-surface-3 leading-4 text-ink'),
  cellUser: tw('bg-surface-2 text-ink-muted'),
  profile: tw('bg-surface-2 text-ink [box-shadow:0_0_0_3px_var(--accent-line)]!'),
} as const satisfies Record<AvatarContext, string>;
