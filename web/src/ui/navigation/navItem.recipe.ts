// The nav-item look (App. B `.csp-nav`, `.csp-nav:hover`, `.csp-nav.is-on`, `.csp-nav.is-on .csp-icon`,
// `.csp-nav.is-on::before` and `.csp-sidebar.is-collapsed .csp-nav`; CSPS-UI-SPEC.md §6.6) as complete Tailwind tokens
// (D-33). One recipe serves the Sidebar links, the D-27 Logout button and, in plan 02-32, the UserMenu items (UI-SPEC
// "Where class strings live"). Every string here is a class list (the class gate compiles each one). Axes set disjoint
// properties: the base never sets the inline padding or the justification, which only the layout map sets.
//   - App. B gives `.csp-nav` `--ink-muted`, then a second rule `--nav-ink`; the computed colour is `--nav-ink`.
//   - The current item (`.is-on`) is read from `aria-current="page"` (UI-SPEC rule 6), with the D-03 weight 700 as its
//     second cue (owner, C-35). App. B's `:hover` and `.is-on` have the same specificity and `.is-on` comes later, so
//     hovering the current item keeps the current look: the hover background is guarded with `not-aria-[current=page]`.
//   - `group/nav` names the item, so a child reads its state (`group-aria-[current=page]/nav:`): the current icon
//     colour here, and the D-31 D-BL-02 hidden "Manager" tag in navigation.recipe.ts.
import clsx from 'clsx';
import { tw } from '@/ui/tw';

/** `.csp-nav`, its hover, and `.csp-nav.is-on` with its `::before` accent marker bar just outside the left edge. */
const base = tw(
  "group/nav relative flex h-11 items-center gap-3 rounded-sm text-[14px] font-semibold whitespace-nowrap text-nav-ink no-underline transition-[background-color,color] duration-150 ease-[ease] hover:not-aria-[current=page]:bg-[color-mix(in_srgb,var(--nav-ink)_12%,transparent)] aria-[current=page]:bg-primary aria-[current=page]:font-bold aria-[current=page]:text-on-primary aria-[current=page]:before:absolute aria-[current=page]:before:top-2.5 aria-[current=page]:before:bottom-2.5 aria-[current=page]:before:-left-3 aria-[current=page]:before:w-1 aria-[current=page]:before:rounded-[0_3px_3px_0] aria-[current=page]:before:bg-accent aria-[current=page]:before:content-['']",
);

/** `padding: 0 var(--space-3)`, and on the collapsed sidebar `justify-content: center; padding: 0`. */
const layouts = {
  expanded: tw('px-3'),
  collapsed: tw('justify-center p-0'),
} as const;

/** The nav-item classes for a link or a button; `collapsed` gives the icon-only layout of the collapsed sidebar. */
export function navItemClasses({ collapsed = false }: { collapsed?: boolean } = {}): string {
  return clsx(base, collapsed ? layouts.collapsed : layouts.expanded);
}

/**
 * D-27: a `<button>` with the nav-item look (the Logout, later the UserMenu items), computed-equal to the approved
 * `<a>` (the reference rulings layer's D-27 `button.csp-nav` rule resets the same properties). The browser gives a
 * button `appearance: button` and centred text, and preflight gives it no `cursor: pointer` (an `<a href>` gets one
 * from the browser); the full width matches the link, a stretched flex item of the sidebar foot.
 */
export const navButtonClasses = tw('w-full cursor-pointer appearance-none text-start');

/** `.csp-nav.is-on .csp-icon { color: var(--on-primary) }`: the Sidebar passes it to the icons it renders (rule 21a). */
export const navIconClasses = tw('group-aria-[current=page]/nav:text-on-primary');

/** `.csp-sidebar.is-collapsed .csp-nav-label { display: none }`: the label stays in the DOM, hidden. */
export const navLabelHiddenClasses = tw('hidden');
