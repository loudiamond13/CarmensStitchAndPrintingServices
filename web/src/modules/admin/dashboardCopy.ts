// The words of the dashboard (UI-SPEC Copywriting Contract, D1; plan 10-07): one module, no wording in JSX. No long dash (OR-4).

/** The parts of the business day the server names. Any other value is not rendered. */
const GREETING_PARTS = ['morning', 'afternoon', 'evening'] as const;
type GreetingPart = (typeof GREETING_PARTS)[number];

function isGreetingPart(value: string): value is GreetingPart {
  return (GREETING_PARTS as readonly string[]).includes(value);
}

export const DASHBOARD_COPY = {
  /** The document title is "{title} · CSPS Admin", and the h1 until the summary arrives. */
  title: 'Dashboard',
  /** "Good evening, Carmen"; null for a part of the day this page does not know, so the h1 stays "Dashboard". */
  greeting: (part: string, firstName: string): string | null =>
    isGreetingPart(part) ? `Good ${part}, ${firstName}` : null,
  /** "Wednesday, Nov 4, 2026 · Here's how the shop is doing this month." */
  subline: (weekday: string, date: string): string => `${weekday}, ${date} · Here's how the shop is doing this month.`,
  viewOrders: 'View Orders',
  newOrder: 'New Order',
  // SPEC-GAP: plan 10-09 moves this line into the KPI row.
  loadFailed: "Couldn't load the shop figures.",
} as const;
