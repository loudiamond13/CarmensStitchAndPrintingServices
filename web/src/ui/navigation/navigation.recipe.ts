// The navigation looks (App. B `/* ── Navigation ── */` and the `/* sidebar sits on nav-bg … */` context rules,
// CSPS-UI-SPEC.md §6.6) as complete Tailwind tokens (D-33). Every string here is a class list (the class gate compiles
// each one). The nav item itself (links, Logout) is in navItem.recipe.ts. Where App. B states a look twice for a context
// (`.csp-sidebar .csp-iconbtn`), the class list here is the computed result in that context. The tablet icon rail
// (App. C `.s-admin-side …`) belongs to the admin shell region (plan 02-31), not to these lists.
import { tw } from '@/ui/tw';

// ── Sidebar ──

/** `.csp-sidebar`: the Taupe column with its own ink and the width transition. The width is per layout. */
export const sidebarClasses = tw(
  'flex h-full min-h-[480px] flex-col border-r border-line bg-nav-bg text-nav-ink transition-[width] duration-200 ease-[ease]',
);

/** `.csp-sidebar { width }` and `.csp-sidebar.is-collapsed { width }`. */
export const sidebarWidthClasses = {
  expanded: tw('w-(--sidebar-width)'),
  collapsed: tw('w-(--sidebar-collapsed)'),
} as const;

/** `.csp-sidebar-top`: the lockup and the collapse toggle over a hairline. */
export const sidebarTopClasses = tw('flex items-center border-b border-line');

/** `.csp-sidebar-top { height; justify-content; padding }` and its collapsed column (`.is-collapsed .csp-sidebar-top`). */
export const sidebarTopLayoutClasses = {
  expanded: tw('h-(--topbar-height) justify-between pr-3 pl-5'),
  collapsed: tw('h-auto flex-col justify-center gap-2 px-0 py-3'),
} as const;

/** `.csp-iconbtn` inside `.csp-sidebar`: the nav ink at rest, and the nav-ink tint on hover. */
export const sidebarToggleClasses = tw(
  'inline-grid size-9 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-nav-ink hover:bg-[color-mix(in_srgb,var(--nav-ink)_12%,transparent)]',
);

/** `.csp-sidebar-nav`. */
export const sidebarNavClasses = tw('flex flex-1 flex-col gap-0.5 p-3');

/**
 * `.csp-nav-tag`: the "Manager" tag. D-02 FYI-01: full opacity instead of App. B's `.8`, so it keeps its contrast.
 * D-31 D-BL-02: hidden on the current row (the page title already says where you are), read from the link's
 * `group/nav` state.
 */
export const navTagClasses = tw(
  'ml-auto text-[10px] font-bold tracking-[.08em] text-nav-ink uppercase group-aria-[current=page]/nav:hidden',
);

/** `.csp-sidebar-foot`: the user chip and Logout over a hairline. */
export const sidebarFootClasses = tw('flex flex-col gap-2 border-t border-line p-3');

/** `.csp-sidebar-user`: the chip, with a dashed rule under it. */
export const sidebarUserClasses = tw(
  'mb-1 flex items-center gap-3 border-b-2 border-dashed border-line px-2 pt-2 pb-3',
);

/** `.csp-sidebar-user strong`. */
export const sidebarUserNameClasses = tw('block text-[14px] leading-[18px]');

/** `.csp-sidebar-user span`. */
export const sidebarUserRoleClasses = tw('text-[12px] leading-4 text-nav-ink');

// ── SiteHeader (public) ──
// App. B gives the header's phone and desktop looks twice: `@media (min-width: 768px)` in App. B and the frame-keyed
// `@container pg` rules in App. C ("system components: phone overrides keyed to the frame, not the window"), which win
// with `!important`. Inside the page root (`@container/pg`) the container rules decide, so the display utilities here
// are `pg-*` variants; App. B's media-only padding stays `md:`.

/** `.csp-site-header`: sticky, the page background at 82% over a 14px blur, a hairline under it. */
export const siteHeaderClasses = tw(
  'sticky top-0 z-(--z-header) border-b border-line bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] [backdrop-filter:blur(14px)]',
);

/** `.csp-site-header-in`: the 1200px row, 64px tall (56px on phones, App. C), 16px side padding (24px from 768px). */
export const siteHeaderInnerClasses = tw(
  'mx-auto flex h-(--header-height) max-w-(--container-max) items-center gap-6 px-4 md:px-6 pg-phone:h-14',
);

/** `.csp-site-logo`. */
export const siteLogoLinkClasses = tw('no-underline');

/** `.csp-site-nav`: hidden on phones, an inline row from 768px. */
export const siteNavClasses = tw('ml-auto hidden gap-1 pg-md-up:inline-flex');

/**
 * `.csp-site-link`, its hover and `.is-on` with the skewed orange underline (`::after`), read from
 * `aria-current="page"`; D-03 adds the weight 700 as the second cue (owner, C-35).
 */
export const siteLinkClasses = tw(
  "relative rounded-sm px-3 py-2 text-[15px] font-semibold text-ink-muted no-underline transition-[color] duration-150 ease-[ease] hover:text-ink aria-[current=page]:font-bold aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:right-3 aria-[current=page]:after:bottom-0 aria-[current=page]:after:left-3 aria-[current=page]:after:h-[3px] aria-[current=page]:after:[transform:skewX(-18deg)] aria-[current=page]:after:bg-accent aria-[current=page]:after:content-['']",
);

/** `.csp-site-cta`: the small primary "Get a Quote" hides on phones (layout glue passed to the Button it renders). */
export const siteCtaClasses = tw('pg-phone:hidden');

/** `.csp-iconbtn.csp-site-burger`: a 44px icon button in `--ink`, shown on phones only. */
export const siteBurgerClasses = tw(
  'ml-auto inline-grid size-11 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-ink hover:bg-surface-2 pg-md-up:hidden',
);

/** `.csp-site-drawer`: the phone drawer under the header. */
export const siteDrawerClasses = tw('flex flex-col gap-2 border-t border-line px-4 pt-2 pb-6 pg-md-up:hidden');

/**
 * `.csp-site-dlink` and `.is-on` (`--accent-ink`), read from `aria-current="page"`; D-31 O-3 adds the italic as the
 * second cue (the 800-italic face is already loaded).
 */
export const siteDrawerLinkClasses = tw(
  'flex items-center justify-between border-b-2 border-dashed border-line py-4 font-display text-[32px] leading-none font-heavy text-ink uppercase no-underline aria-[current=page]:text-accent-ink aria-[current=page]:italic',
);

/** `.csp-site-drawer .csp-btn { margin-top }` (layout glue passed to the block Button it renders). */
export const siteDrawerCtaClasses = tw('mt-4');

// RED stub (plan 02-26 Task 3): the Topbar looks arrive in GREEN.
export const topbarClasses = tw('');
export const topbarMenuClasses = tw('');
export const topbarRightClasses = tw('');
export const searchClasses = tw('');
export const searchInputClasses = tw('');
export const searchInputCompatClasses = tw('');
export const searchKbdClasses = tw('');
export const userMenuClasses = tw('');
export const userMenuTextClasses = tw('');
