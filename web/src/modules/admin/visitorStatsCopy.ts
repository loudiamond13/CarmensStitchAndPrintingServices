// The words of the Visitor Stats page (UI-SPEC Copywriting "Visitor Stats"; ANL-08, D-27, D-33): one module, no wording in JSX.
// SPEC-GAP: V1. No long dash (OR-4).

export const VISITOR_STATS_COPY = {
  /** The h1, the nav item and the document title "{title} · CSPS Admin". */
  title: 'Visitor Stats',
  /** "Oct 17 to Nov 15, 2026 · Visits to the public website. Staff signed in to admin aren't counted." */
  subline: (dates: string): string =>
    `${dates} · Visits to the public website. Staff signed in to admin aren't counted.`,
  /** "Oct 17 to Nov 15, 2026". */
  dates: (from: string, to: string): string => `${from} to ${to}`,
  /** The noun of the loading region and the failure line: "Loading the visitor stats…", "Couldn't load the visitor stats." */
  things: 'the visitor stats',
  toolbar: {
    dateRange: 'Date range',
    from: 'From',
    to: 'To',
  },
  /** The Date range options, in the order the select lists them. */
  ranges: {
    'last-7-days': 'Last 7 days',
    'last-30-days': 'Last 30 days',
    'this-month': 'This month',
    'last-month': 'Last month',
    'this-year': 'This year',
    custom: 'Custom range',
  },
  /** The custom range messages: the server's own words (OR-3, UI-SPEC Validation). */
  errors: {
    startRequired: 'Enter a start date.',
    endRequired: 'Enter an end date.',
    notReal: 'Enter a real date.',
    order: 'The start date must be on or before the end date.',
    /** "Choose a date from Nov 15, 2023 to today." */
    outsideWindow: (floor: string): string => `Choose a date from ${floor} to today.`,
  },
  kpis: {
    uniqueVisitors: 'Unique visitors',
    uniqueVisitorsHint: 'Visitors who allowed visitor stats',
    visits: 'Visits',
    visitsHint: 'One sitting on the website. A new one starts after 30 minutes away.',
    pageViews: 'Page views',
    pageViewsHint: 'Every page opened, with or without cookies',
    /** The hidden text of a count the server does not have (D-27). */
    notAvailable: 'Not available',
    notAvailableHint: 'Not available for dates over 13 months ago',
    /** "Counted from Oct 15, 2025 only". */
    countedFrom: (date: string): string => `Counted from ${date} only`,
  },
} as const;
