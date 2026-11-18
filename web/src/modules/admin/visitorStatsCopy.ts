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
  /** A failed later refresh (P10 D-111): "Showing figures from 9:41 AM. Couldn't refresh." with Try Again. */
  stale: (time: string): string => `Showing figures from ${time}. Couldn't refresh.`,
  retry: 'Try Again',
  /** The one EmptyState that replaces the trend, lists and speed when the range has no page views. */
  noVisits: {
    title: 'No visits in these dates',
    message: 'Visits show here after people open the website. Try a longer date range.',
  },
  toolbar: {
    dateRange: 'Date range',
    from: 'From',
    to: 'To',
    exportCsv: 'Export CSV',
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
  /** The 13-month Note (D-27), shown when the range starts before the cut: "Before Oct 15, 2025, ...". */
  cutNote: (date: string): string =>
    `Unique visitors and visits are kept for 13 months. Before ${date}, this range shows page views, pages, referrers and devices only.`,
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
  /** The Trend card (UI-SPEC V1 item 4); the chart's own words are VISITOR_TREND_COPY. */
  trend: {
    title: 'Visits over time',
    perDay: 'Per day',
    perMonth: 'Per month',
  },
  /** The ranked list cards (UI-SPEC V1 items 5 to 7, Copywriting "Lists"). */
  lists: {
    topPages: 'Most viewed pages',
    topPagesSub: 'Every page opened',
    referrers: 'Where visitors came from',
    referrersSub: 'Visitors who allowed visitor stats',
    devices: 'Devices and browsers',
    devicesSub: 'Visitors who allowed visitor stats',
    device: 'Device',
    browser: 'Browser',
    empty: 'No visitors allowed visitor stats in these dates.',
    /** "412 · 38%": the count and the server's share. */
    figure: (count: string, share: number): string => `${count} · ${String(share)}%`,
  },
  /** The Page speed card (UI-SPEC V1 item 8, Copywriting "Page speed"; D-26). */
  speed: {
    title: 'Page speed',
    sub: "Measured on visitors' own phones and computers. 3 in 4 page views were this good or better.",
    lcp: 'Loading speed',
    lcpMeaning: 'How fast the main picture or text shows.',
    cls: 'Layout shifting',
    clsMeaning: 'How much the page jumps while it loads.',
    inp: 'Response to taps',
    inpMeaning: 'How fast the page reacts when you tap or click.',
    ratings: {
      good: 'Good',
      'needs-work': 'Needs work',
      poor: 'Poor',
    },
    /** "2.1 s", read as "2.1 seconds". */
    seconds: (value: string): string => `${value} s`,
    secondsSpoken: (value: string): string => `${value} seconds`,
    /** "0.04", read as "score 0.04". */
    scoreSpoken: (value: string): string => `score ${value}`,
    /** "180 ms", read as "180 milliseconds". */
    milliseconds: (value: string): string => `${value} ms`,
    millisecondsSpoken: (value: string): string => (value === '1' ? '1 millisecond' : `${value} milliseconds`),
    /** The hidden text of a measure with no sample in the range. */
    notMeasured: 'Not measured',
    /** The card line when no measure has a sample. */
    empty: 'No speed data for these dates yet.',
    /** The hidden text of each measure, and the card line, for a range wholly over 13 months ago (D-27). */
    notAvailable: 'Not available',
    notAvailableLine: 'Not available for dates over 13 months ago',
    /** "From 412 page views"; "From 1 page view" for one. */
    from: (count: number, formatted: string): string =>
      count === 1 ? 'From 1 page view' : `From ${formatted} page views`,
  },
  /** The name of each page key the server sends (D-28). */
  pages: {
    home: 'Home',
    products: 'Products',
    gallery: 'Gallery',
    contact: 'Contact',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Policy',
    terms: 'Terms of Use',
    accessibility: 'Accessibility Statement',
    'not-found': 'Page not found',
  } as Readonly<Record<string, string>>,
  /** The name of each device class the server sends. */
  devices: {
    Phone: 'Phone',
    Tablet: 'Tablet',
    Computer: 'Computer',
    Other: 'Other',
  } as Readonly<Record<string, string>>,
} as const;
