// The words of the Visitor Stats page (UI-SPEC Copywriting "Visitor Stats"; ANL-08, D-57, D-70): one module, no wording in JSX.
// SPEC-GAP: V1. No long dash (OR-4).

export const VISITOR_STATS_COPY = {
  /** The h1, the nav item and the document title "{title} · CSPS Admin". */
  title: 'Visitor Stats',
  /** "Oct 17 to Nov 15, 2026 · Page views on the public website. Staff signed in to admin aren't counted." SPEC-GAP, D-21. */
  subline: (dates: string): string =>
    `${dates} · Page views on the public website. Staff signed in to admin aren't counted.`,
  /** The noun of the loading region and the failure line: "Loading the visitor stats…", "Couldn't load the visitor stats." */
  things: 'the visitor stats',
  /** A failed later refresh (P10 D-111): "Showing figures from 9:41 AM. Couldn't refresh." with Try Again. */
  stale: (time: string): string => `Showing figures from ${time}. Couldn't refresh.`,
  retry: 'Try Again',
  /** The one EmptyState that replaces the trend and the list when the range has no page views. SPEC-GAP. */
  noVisits: {
    title: 'No page views in these dates',
    message: 'Page views show here after people open the website. Try a longer date range.',
  },
  toolbar: {
    dateRange: 'Date range',
    from: 'From',
    to: 'To',
    exportCsv: 'Export CSV',
  },
  /** Export CSV (D-25): the WEB-09 pending label and the two toasts. */
  export: {
    pending: 'Exporting',
    done: {
      title: 'Visitor stats exported',
      /** "visitor-stats-2026-10-17-to-2026-11-15.csv is in your downloads." */
      message: (fileName: string): string => `${fileName} is in your downloads.`,
    },
    failed: {
      title: "Couldn't export the visitor stats.",
      message: 'Check your internet connection and try again.',
    },
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
    pageViews: 'Page views',
    /** SPEC-GAP. */
    pageViewsHint: 'Every page opened on the public website',
  },
  /** The Trend card (UI-SPEC V1 item 4); the chart's own words are VISITOR_TREND_COPY. */
  trend: {
    title: 'Page views over time', // SPEC-GAP
    perDay: 'Per day',
    perMonth: 'Per month',
  },
  /** The Most viewed pages list (UI-SPEC V1 item 5, Copywriting "Lists"). */
  lists: {
    topPages: 'Most viewed pages',
    /** SPEC-GAP. */
    topPagesSub: 'The top 5. Export CSV for every page.',
    /** SPEC-GAP. */
    empty: 'No pages were opened in these dates.',
    /** "412 · 38%": the count and the server's share. */
    figure: (count: string, share: number): string => `${count} · ${String(share)}%`,
  },
  /** The name of each page key the server sends (D-28). */
  pages: {
    home: 'Home',
    products: 'Products',
    gallery: 'Gallery',
    contact: 'Contact',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    accessibility: 'Accessibility Statement',
    'not-found': 'Page not found',
  } as Readonly<Record<string, string>>,
} as const;
