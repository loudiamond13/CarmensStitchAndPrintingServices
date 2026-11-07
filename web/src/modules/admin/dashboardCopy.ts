// The words of the dashboard (UI-SPEC Copywriting Contract, D1; plans 10-07 and 10-09): one module, no wording in JSX. No long dash (OR-4).
import { formatCount } from '@/utils/format';

/** The parts of the business day the server names. Any other value is not rendered. */
const GREETING_PARTS = ['morning', 'afternoon', 'evening'] as const;
type GreetingPart = (typeof GREETING_PARTS)[number];

function isGreetingPart(value: string): value is GreetingPart {
  return (GREETING_PARTS as readonly string[]).includes(value);
}

/** "{n} due this week", or "None due this week" for 0 (SPEC-GAP for the zero case). */
function dueFoot(dueThisWeek: number): string {
  return dueThisWeek === 0 ? 'None due this week' : `${formatCount(dueThisWeek)} due this week`;
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
  /** The KPI row (DASH-02, D-01 to D-07). Months are the short names of the summary's own dates, never the device clock. */
  kpis: {
    /** The noun of the loading region and of the failure line: "Loading the shop figures…", "Couldn't load the shop figures." */
    things: 'the shop figures',
    active: 'Active orders',
    receivables: 'Total receivables',
    /** "Collected · Nov"; without a readable date just "Collected". */
    collected: (month: string | null): string => (month === null ? 'Collected' : `Collected · ${month}`),
    expenses: (month: string | null): string => (month === null ? 'Company expenses' : `Company expenses · ${month}`),
    // SPEC-DEVIATION: D-02 App. 8.3 foot "{n} due this week"; overdue orders are added when there are any.
    // SPEC-GAP: the zero cases "None due this week" and "None due this week · {m} overdue".
    activeFoot: (dueThisWeek: number, overdue: number): string =>
      overdue === 0 ? dueFoot(dueThisWeek) : `${dueFoot(dueThisWeek)} · ${formatCount(overdue)} overdue`,
    receivablesFoot: 'Unpaid balances, all active orders',
    /** The Collected delta label: "vs Oct, same day". */
    againstSameDay: (month: string): string => `vs ${month}, same day`,
    // SPEC-DEVIATION: D-06 App. 8.3 always shows a percent; with nothing collected in the comparison it is hidden.
    nothingCollected: (month: string): string => `Nothing collected by this day in ${month}`,
    /** "23 entries · top: Rent", "1 entry · top: Rent"; no top category named leaves that part out. */
    expensesFoot: (count: number, topCategory: string | null): string => {
      const entries = count === 1 ? '1 entry' : `${formatCount(count)} entries`;
      return topCategory === null ? entries : `${entries} · top: ${topCategory}`;
    },
    // SPEC-GAP: the foot of the Company expenses card in a month with no entries.
    noExpenses: 'No expenses yet this month',
  },
} as const;
