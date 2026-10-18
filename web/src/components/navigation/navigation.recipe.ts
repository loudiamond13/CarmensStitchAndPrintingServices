// The navigation looks (App. B `/* ── Navigation ── */` and the `/* sidebar sits on nav-bg … */` context rules,
// CSPS-UI-SPEC.md §6.6) as complete Tailwind tokens (D-33). Every string here is a class list (the class gate compiles
// each one). The nav item itself (links, Logout) is in navItem.recipe.ts. Where App. B states a look twice for a context
// (`.csp-sidebar .csp-iconbtn`), the class list here is the computed result in that context.
//
// The tablet icon rail (App. C `@container pg (min-width: 768px) and (max-width: 1023px)` → `.s-admin-side …`, plan
// 02-31) is a context look of the admin shell's side column: every rail rule is a
// `pg-tablet:in-data-[ui=s-admin-side]:` variant here (the column carries `data-ui="s-admin-side"`), with App. C's own
// query text, so it applies from 768 to 1023px and only inside the shell. App. C's collapsed-sidebar rules
// (`.csp-sidebar.is-collapsed …`) outrank the rail rules there, so the rail padding and centring live in the expanded
// layout maps only.
import { tw } from '@/ui/tw';

// ── Sidebar ──

/**
 * `.csp-sidebar`: the Taupe column with its own ink and the width transition. The width is per layout. In the admin
 * shell's side column (App. C `.s-admin-side .csp-sidebar`, plan 02-31) it sticks to the top. Under the real layouts' viewport
 * marker (D-02, D-03) it is exactly the viewport tall, so its nav scrolls inside it and the footer stays at the bottom.
 */
export const sidebarClasses = tw(
  'flex h-full min-h-[480px] flex-col border-r border-line bg-nav-bg text-nav-ink transition-[width] duration-200 ease-[ease] in-data-[ui=s-admin-side]:sticky in-data-[ui=s-admin-side]:top-0 in-data-[ui=s-admin-side]:min-h-full in-data-[fill=viewport]:in-data-[ui=s-admin-side]:h-dvh in-data-[fill=viewport]:in-data-[ui=s-admin-side]:min-h-0 pg-tablet:in-data-[ui=s-admin-side]:w-(--sidebar-collapsed)',
);

/** `.csp-sidebar { width }` and `.csp-sidebar.is-collapsed { width }`. */
export const sidebarWidthClasses = {
  expanded: tw('w-(--sidebar-width)'),
  collapsed: tw('w-(--sidebar-collapsed)'),
} as const;

/** `.csp-sidebar-top`: the lockup and the collapse toggle over a hairline. */
export const sidebarTopClasses = tw('flex items-center border-b border-line');

/**
 * `.csp-sidebar-top { height; justify-content; padding }` and its collapsed column (`.is-collapsed .csp-sidebar-top`).
 * On the rail the expanded top centres the lone mark with no padding (`.s-admin-side .csp-sidebar-top`).
 */
export const sidebarTopLayoutClasses = {
  expanded: tw(
    'h-(--topbar-height) justify-between pr-3 pl-5 pg-tablet:in-data-[ui=s-admin-side]:justify-center pg-tablet:in-data-[ui=s-admin-side]:p-0',
  ),
  collapsed: tw('h-auto flex-col justify-center gap-2 px-0 py-3'),
} as const;

/** `.csp-iconbtn` inside `.csp-sidebar`: the nav ink at rest, and the nav-ink tint on hover; none on the rail. */
export const sidebarToggleClasses = tw(
  'inline-grid size-9 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-nav-ink hover:bg-[color-mix(in_srgb,var(--nav-ink)_12%,transparent)] pg-tablet:in-data-[ui=s-admin-side]:hidden',
);

/** `.csp-sidebar-nav`; on the rail 12px 8px with the items centred. In the pinned side column it scrolls on its own (D-03). */
export const sidebarNavClasses = tw(
  'flex flex-1 flex-col gap-0.5 p-3 in-data-[fill=viewport]:in-data-[ui=s-admin-side]:min-h-0 in-data-[fill=viewport]:in-data-[ui=s-admin-side]:overflow-y-auto in-data-[fill=viewport]:in-data-[ui=s-admin-side]:overscroll-contain pg-tablet:in-data-[ui=s-admin-side]:items-center pg-tablet:in-data-[ui=s-admin-side]:px-2 pg-tablet:in-data-[ui=s-admin-side]:py-3',
);

/**
 * `.csp-nav-tag`: the "Manager" tag. D-02 FYI-01: full opacity instead of App. B's `.8`, so it keeps its contrast.
 * D-31 D-BL-02: hidden on the current row (the page title already says where you are), read from the link's
 * `group/nav` state.
 */
export const navTagClasses = tw(
  'ml-auto text-[10px] font-bold tracking-[.08em] text-nav-ink uppercase group-aria-[current=page]/nav:hidden pg-tablet:in-data-[ui=s-admin-side]:hidden',
);

/** `.csp-sidebar-foot`: the user chip and Logout over a hairline; on the rail 12px 8px with Logout centred. */
export const sidebarFootClasses = tw(
  'flex flex-col gap-2 border-t border-line p-3 pg-tablet:in-data-[ui=s-admin-side]:items-center pg-tablet:in-data-[ui=s-admin-side]:px-2 pg-tablet:in-data-[ui=s-admin-side]:py-3',
);

/** `.csp-sidebar-user`: the chip, with a dashed rule under it; none on the rail. */
export const sidebarUserClasses = tw(
  'mb-1 flex items-center gap-3 border-b-2 border-dashed border-line px-2 pt-2 pb-3 pg-tablet:in-data-[ui=s-admin-side]:hidden',
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

// ── Topbar (admin) ──
// The phone rules are App. C's frame-keyed `@container pg (max-width: 767px)` copies of App. B's `@media` block (same
// values, `!important`), and the tablet padding and search width are App. C container rules, so all are `pg-*`. The
// sticky position is the admin shell's (App. C `.s-admin-main > .csp-topbar`), read from its `data-ui` marker.

/**
 * `.csp-topbar`: 64px on `--surface` over a hairline; 16px sides and 8px gaps on phones, 20px sides on tablets. In the
 * admin shell's main column (App. C `.s-admin-main > .csp-topbar`, plan 02-31) it sticks to the top above the body.
 */
export const topbarClasses = tw(
  'flex h-(--topbar-height) items-center gap-4 border-b border-line bg-surface px-6 in-data-[ui=s-admin-main]:sticky in-data-[ui=s-admin-main]:top-0 in-data-[ui=s-admin-main]:z-20 pg-phone:gap-2 pg-phone:px-4 pg-tablet:px-5',
);

/** `.csp-iconbtn.csp-topbar-menu`: the "Open navigation" icon button, shown on phones only. */
export const topbarMenuClasses = tw(
  'hidden size-9 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink pg-phone:inline-grid',
);

/**
 * `.csp-search` and its `:focus-within` ring: a 40px box that grows to 480px (no limit on tablets). It is the label of
 * its input, so a click anywhere on it focuses the field.
 * SPEC-DEVIATION: D-41 R2-01 (owner, 2026-10-13) the box may shrink below its content (`min-w-0`). App. B lets this
 * flex item shrink only to the search field's intrinsic width (about 234px, engine-dependent), so the Topbar row needed
 * a 398px (Chromium), 406px (WebKit) or 418px (Firefox) page and the admin pages scrolled sideways on small phones. Now
 * the row fits at 320px; the placeholder is cut shorter there (accepted by the owner). The rulings layer gives the
 * frozen reference the same rule, so the look-equality proof stays equal.
 */
export const searchClasses = tw(
  'flex h-10 max-w-[480px] min-w-0 flex-1 items-center gap-2 rounded-sm border border-line bg-surface-2 px-3 text-ink-muted focus-within:border-focus focus-within:[box-shadow:0_0_0_1px_var(--focus)] pg-tablet:max-w-none',
);

/**
 * `.csp-search input`: borderless, no outline (the box shows the focus), 14px text, and D-01 (C-34) 16px on phones so
 * iOS Safari does not zoom on focus.
 */
export const searchInputClasses = tw(
  'min-w-0 flex-1 border-0 text-[14px] text-ink [outline:none] placeholder:text-ink-muted pg-phone:text-[16px]',
);

/** App. A.3 compat: the `padding: 1px 2px` the browsers gave the input before preflight removed it. */
export const searchInputCompatClasses = tw('px-[2px] py-px');

/**
 * `.csp-search kbd`: the shortcut hint ("Ctrl K", or "⌘K" on Apple platforms, D-41 R2-04), hidden on phones. App. B resets the font to the inherited one (preflight gives `kbd`
 * the monospace family), so the family is restated as `inherit`.
 */
export const searchKbdClasses = tw(
  'rounded-[4px] border border-line-strong px-1.5 [font-family:inherit] text-[12px] text-ink-muted pg-phone:hidden',
);

/** `.csp-topbar-right`. */
export const topbarRightClasses = tw('ml-auto flex items-center gap-2');

/** `.csp-usermenu` and its hover: the pill button with the avatar, the name and role, and the chevron. */
export const userMenuClasses = tw(
  'flex cursor-pointer items-center gap-2 rounded-pill border-0 bg-transparent py-1 pr-2 pl-1 text-ink-muted hover:bg-surface-2',
);

/** `.csp-usermenu-text`: the name over the role, hidden on phones. */
export const userMenuTextClasses = tw('flex flex-col text-left leading-4 pg-phone:hidden');

/** `.csp-usermenu-text strong`. */
export const userMenuNameClasses = tw('text-[14px] leading-[18px] text-ink');

/** `.csp-usermenu-text span`. */
export const userMenuRoleClasses = tw('text-[12px]');

// ── Mobile navigation drawer (SPEC-GAP: mobile nav drawer, spec §2.10 #6; plan 02-32) ──
// Composed from existing tokens only (UI-SPEC "SPEC-GAP Primitive Specs" → MobileNavDrawer): the `--scrim` overlay at
// `--z-overlay` and the Sidebar's own 248px width. The layer is fixed inside the page root. The page root does not trap
// fixed children (probed in Chromium, Firefox and WebKit), so the layer covers the viewport; the panel is sticky at the
// viewport's height, so the whole Sidebar stays in view however far the page was scrolled. D-34: the scrim fades and the
// panel slides in from the left and back out (theme keyframes, `data-state` from MobileNavDrawer; none under reduced motion).

/** The drawer layer: the scrim over the whole page root at the overlay layer; the panel sits at its left edge. */
export const drawerClasses = tw(
  'fixed inset-0 z-(--z-overlay) flex animate-csp-fade items-start bg-scrim data-[state=closed]:pointer-events-none data-[state=closed]:animate-csp-fade-out motion-reduce:animate-none motion-reduce:data-[state=closed]:animate-none',
);

/** The panel: the full Sidebar at its 248px width and the viewport's height, scrolling inside when the phone is short. */
export const drawerPanelClasses = tw(
  'sticky top-0 h-dvh w-(--sidebar-width) animate-csp-drawer-in overflow-y-auto overscroll-contain data-[state=closed]:animate-csp-drawer-out motion-reduce:animate-none motion-reduce:data-[state=closed]:animate-none',
);

// ── User menu popover (SPEC-GAP: user menu, spec §6.6; plan 02-32) ──
// Composed from existing tokens only (UI-SPEC "SPEC-GAP Primitive Specs" → UserMenu). The Topbar is its containing
// block (sticky in the admin shell's main column), so the popover hangs from the bar's bottom edge at the bar's inline
// padding (24px, 20px on tablets, 16px on phones), right under the user-menu button, the bar's last item.

/** The popover: `--surface-3`, radius 12, `--shadow-2`, at least 200px wide, the nav-item rows 2px apart. */
export const userMenuPopoverClasses = tw(
  'absolute top-full right-6 mt-1 flex min-w-[200px] flex-col gap-0.5 rounded-md bg-surface-3 p-2 shadow-level-2 pg-phone:right-4 pg-tablet:right-5',
);
