// The admin shell looks (App. C `/* ───────── admin ───────── */` and its `@container pg` rules, spec §8.1; plan 02-31)
// as complete Tailwind tokens (D-33). Every string here is a class list (the class gate compiles each one). The
// breakpoints are the `pg-*` container variants with App. C's own query text, so the shell switches at exactly the
// approved widths. Context looks of the components inside the shell (the sticky Sidebar and Topbar, the tablet icon
// rail) are `in-data-[ui=s-admin-side]:` / `in-data-[ui=s-admin-main]:` variants in the navigation recipes.
import { tw } from '@/ui/tw';

/** `.s-admin`: the sidebar column and the main column side by side. */
export const adminClasses = tw('flex min-h-full bg-bg text-ink in-data-[fill=viewport]:min-h-dvh');

/** `.s-admin-side`: the sidebar column (`data-ui="s-admin-side"`), hidden on phones. */
export const adminSideClasses = tw('relative flex-none pg-phone:hidden');

/** `.s-admin-main`: the topbar, the body and the phone tab bar in one column (`data-ui="s-admin-main"`). */
export const adminMainClasses = tw('flex min-w-0 flex-1 flex-col');

/** `.s-body`: 32 32 48 with 24px gaps, up to 1440px wide; 24 24 48 on tablets; 20 16 32 with 20px gaps on phones. */
export const adminBodyClasses = tw(
  'flex w-full max-w-[1440px] flex-col gap-6 px-8 pt-8 pb-12 pg-phone:gap-5 pg-phone:px-4 pg-phone:pt-5 pg-phone:pb-8 pg-tablet:px-6 pg-tablet:pt-6 pg-tablet:pb-12',
);

// ── Phone tab bar (App. C `/* mobile tab bar (admin) */`, App. E.6 `nav.s-tabbar`) ──
// App. C hides the bar everywhere and shows it as a grid only inside `@container pg (max-width: 767px)`, where all its
// other rules sit too. A hidden bar shows nothing, so here only its display depends on the container.

/** `.s-tabbar`: a sticky 4-column bar at the bottom of the main column, on the surface at 94% over a 12px blur,
 * with 12px of bottom padding plus the device's safe area (D-36). */
export const tabBarClasses = tw(
  'sticky bottom-0 z-30 mt-auto hidden grid-cols-4 border-t border-line bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-2 pt-[6px] pb-[calc(12px+env(safe-area-inset-bottom))] [backdrop-filter:blur(12px)] pg-phone:grid',
);

/**
 * `.s-tab-i`, `.s-tab-i.is-on` and its `::before` accent bar, read from `aria-current="page"`; D-03 (C-35) adds the
 * weight 700 as the second cue. `group/tab` lets the icon read the current state.
 */
export const tabItemClasses = tw(
  "group/tab flex flex-col items-center gap-0.5 rounded-sm py-[6px] text-[11px] leading-[14px] font-semibold text-ink-muted no-underline aria-[current=page]:font-bold aria-[current=page]:text-ink aria-[current=page]:before:mx-0 aria-[current=page]:before:mt-[-6px] aria-[current=page]:before:mb-[3px] aria-[current=page]:before:h-[3px] aria-[current=page]:before:w-6 aria-[current=page]:before:rounded-[2px] aria-[current=page]:before:bg-accent-line aria-[current=page]:before:content-['']",
);

/** `.s-tab-i.is-on .csp-icon`: the current tab's icon in the accent ink. */
export const tabIconClasses = tw('group-aria-[current=page]/tab:text-accent-ink');

// ── Route-chunk skeleton (UI-SPEC UI Considerations: loading, route chunks) ──

/** The skeleton page head's two lines sit in the `.s-ph-title` column, so the page head lands in the same place. */
export const skeletonHeadClasses = tw('flex min-w-0 flex-col gap-1');
