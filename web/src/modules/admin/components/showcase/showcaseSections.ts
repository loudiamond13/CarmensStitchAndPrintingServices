// Which showcase section shows which scenario (D-22; UI-SPEC "Phase 2 pages" → ComponentShowcase). The sections come
// in the UI-SPEC group order (1 Brand & icons … 7 Media), then three the UI-SPEC list predates, so that every shared
// building block appears: Navigation (Sidebar, SiteHeader, Topbar, and the plan 02-32 user menu and drawer),
// Marketing (CategoryCard, ProcessSteps, TestimonialCard) and Sign-in and devices (plan 04-32: the S1 to S6 cards, S7,
// the sign-out dialogs, the four-item user menu, the session toasts and the Note uses), Staff and audit (plan 05-42: no
// scenarios, only the live demos of the Phase 5 pieces) and Expenses and settings (plan 06-18: the same for the Phase 6 pieces). A section takes whole scenario groups (the groups/*.ts
// files) in the order listed, except the scenarios an id prefix moves to another section (LazyImage and
// MediaPlaceholder belong to Media). The whole-page layout groups are left out: each is a page with its own h1, main
// and skip link, shown by its own route (/, /admin/…), never inside this page.
import type { Scenario } from '@/dev/scenarios/types';

export const SHOWCASE_SECTIONS = [
  { id: 'brand', title: 'Brand & icons', groups: ['brand'] },
  { id: 'buttons', title: 'Buttons', groups: ['actions'] },
  { id: 'status', title: 'Status', groups: ['status'] },
  { id: 'forms', title: 'Forms', groups: ['forms', 'entry', 'choice'] },
  { id: 'data', title: 'Data', groups: ['money', 'data', 'lists', 'lists-states'] },
  { id: 'feedback', title: 'Feedback', groups: ['feedback', 'states', 'overlays'] },
  { id: 'media', title: 'Media', groups: ['media'] },
  { id: 'navigation', title: 'Navigation', groups: ['navigation', 'navigation-gaps'] },
  { id: 'marketing', title: 'Marketing', groups: ['marketing'] },
  { id: 'auth', title: 'Sign-in and devices', groups: ['auth-gaps'] },
  { id: 'staff', title: 'Staff and audit', groups: [] },
  { id: 'expenses', title: 'Expenses and settings', groups: [] },
] as const;

export type ShowcaseSectionId = (typeof SHOWCASE_SECTIONS)[number]['id'];

/** Groups that are whole pages (see the header). */
export const LAYOUT_GROUPS: readonly string[] = [
  'auth-brand',
  'layouts-admin',
  'layouts-admin-boundaries',
  'layouts-auth',
  'layouts-public',
];

/** Scenarios moved out of their group's section by id prefix, shown first in their new section. */
const MOVED: readonly (readonly [RegExp, ShowcaseSectionId])[] = [
  [/^lazy-image-/, 'media'],
  [/^media-placeholder-/, 'media'],
];

function movedTo(scenario: Scenario): ShowcaseSectionId | undefined {
  return MOVED.find(([pattern]) => pattern.test(scenario.id))?.[1];
}

/**
 * The scenarios of each section, in display order. Throws on a scenario group no section takes and that is no layout,
 * so a new group file has to be placed before the showcase renders.
 */
export function scenariosBySection(all: readonly Scenario[]): ReadonlyMap<ShowcaseSectionId, readonly Scenario[]> {
  const placed = new Set<string>([...LAYOUT_GROUPS, ...SHOWCASE_SECTIONS.flatMap((section) => section.groups)]);
  const unplaced = all.find((scenario) => !placed.has(scenario.group));
  if (unplaced !== undefined) {
    throw new Error(`No showcase section takes the scenario group "${unplaced.group}".`);
  }
  return new Map(
    SHOWCASE_SECTIONS.map((section) => {
      const groups: readonly string[] = section.groups;
      const moved = all.filter((scenario) => movedTo(scenario) === section.id);
      const own = groups.flatMap((group) =>
        all.filter((scenario) => scenario.group === group && movedTo(scenario) === undefined),
      );
      return [section.id, [...moved, ...own]];
    }),
  );
}
