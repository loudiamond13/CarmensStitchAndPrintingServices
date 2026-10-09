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
