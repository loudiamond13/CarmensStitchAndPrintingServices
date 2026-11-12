// The words of Site Content and its Business Info tab (UI-SPEC Copywriting Contract, "Admin screen copy", "Validation" and "Toasts";
// plan 11-12): one module, no wording in JSX. Every string is SPEC-GAP wording the owner reviews. The error messages are the
// server's own words (OR-3), so the browser and the API say the same thing. No long dash (OR-4).
export const SITE_CONTENT_COPY = {
  /** The document title is "{title} · CSPS Admin". */
  documentTitle: 'Site Content',
  title: 'Site Content',
  badge: 'Manager only',
  subline: 'What visitors see on the public website. Changes show there right away.',
  viewWebsite: 'View Website',
  /** Said after the link's name, for a screen reader only. */
  newTab: ' (opens in a new tab)',
  /** The tab labels (S0). */
  tabs: {
    business: 'Business Info',
    hours: 'Hours & Closures',
    products: 'Products',
    testimonials: 'Testimonials',
    gallery: 'Gallery',
  },
  /** The P8 "Discard changes?" dialog for a tab change, in-app navigation and Load Latest (08 D-58). */
  discard: {
    title: 'Discard changes?',
    message: "Your changes to this tab haven't been saved. If you leave now, they're lost.",
    loadLatestMessage: 'Load Latest replaces what you typed with the saved version. Your typed changes are lost.',
    keep: 'Keep Editing',
    discard: 'Discard Changes',
  },
  /** S1 Business Info. */
  business: {
    /** "Loading the business info…", "The business info loaded." and "Couldn't load the business info." */
    things: 'the business info',
    cards: {
      business: { title: 'Business', hint: 'The name and words visitors see.' },
      address: { title: 'Address and map', hint: 'Where to find the shop.' },
      phones: { title: 'Phone numbers', hint: 'The main number is the one the Call buttons dial.' },
      links: { title: 'Messenger and social links', hint: 'Leave a link empty to hide it on the website.' },
      email: { title: 'Email', hint: "For staff use only. It's not shown on the website." },
      zone: { title: 'Time zone and money', hint: 'These stay fixed so every date, status and total lines up.' },
    },
    fields: {
      businessName: { label: 'Business name', hint: 'Shown in the footer, link previews and search results.' },
      tagline: {
        label: 'Tagline',
        hint: "Shown in the footer and as the website's description in search results.",
      },
      aboutText: { label: 'About the shop', hint: 'Used in search results. Not shown on the pages yet.' },
      turnaroundLine: {
        label: 'Turnaround line',
        placeholder: 'e.g. Mockups in 24 hours; production starts as soon as the downpayment is in.',
        hint: 'Shown on the Home page under Fast turnaround. Leave it empty to make no time promise.',
      },
      street: { label: 'Street and barangay', placeholder: 'e.g. 12 Rizal St., Poblacion' },
      townOrCity: { label: 'Town or city' },
      province: { label: 'Province' },
      postalCode: { label: 'Postal code' },
      directionsUrl: { label: 'Directions link', hint: 'From Google Maps: Share, then Copy link.' },
      mapEmbedUrl: {
        label: 'Map embed link',
        hint: 'From Google Maps: Share, then Embed a map. Paste the code or the link.',
      },
      messengerUrl: {
        label: 'Messenger link',
        hint: 'Every Messenger button opens this, like https://m.me/yourpage.',
      },
      facebookUrl: { label: 'Facebook page' },
      instagramUrl: { label: 'Instagram' },
      tiktokUrl: { label: 'TikTok' },
      contactEmail: { label: 'Email' },
    },
    /** The read-only rows of the Time zone and money card (OQ-6 A, D-35). */
    zone: {
      timeZone: { label: 'Time zone', value: 'Asia/Manila (Philippine time)' },
      money: { label: 'Money and dates', value: 'Philippine peso (₱), en-PH' },
    },
    /** The phone repeater (D-23). */
    phones: {
      number: { label: 'Number', placeholder: '0917 123 4567' },
      label: { label: 'Label (optional)', placeholder: 'e.g. Globe' },
      main: 'Main number',
      /** The visually hidden end of one row's radio name, after the visible "Main number": ", 0917 123 4567". */
      mainFor: (number: string): string => `, ${number}`,
      add: 'Add Number',
      remove: (position: number): string => `Remove number ${String(position)}`,
      limit: 'You can list up to 4 numbers.',
      /** The polite line after the main number is removed. */
      nowMain: (number: string): string => `${number} is now the main number.`,
      /** The same line for a new main row that has no number typed yet. */
      nowMainNamed: (position: number): string => `Number ${String(position)} is now the main number.`,
    },
    actions: { undo: 'Undo Changes', save: 'Save Business Info', saving: 'Saving' },
    /** The polite line after Load Latest (the banner itself is the shared ConflictBanner, 05 D-20). */
    latestLoaded: 'Latest version loaded. Make your changes again.',
    toast: { title: 'Business info saved', message: 'The website shows the new details now.' },
  },
  /** S2 Hours & Closures, card A: the weekly hours (plan 11-16). */
  hours: {
    /** "Loading the opening hours…", "The opening hours loaded." and "Couldn't load the opening hours." */
    things: 'the opening hours',
    card: { title: 'Opening hours', hint: 'One opening and closing time per day.' },
    /** The day labels, Monday first. */
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    /** The visible words over a select, and the hidden words a screen reader hears first: "Monday opens". */
    opens: { label: 'Opens', name: (day: string): string => `${day} opens` },
    closes: { label: 'Closes', name: (day: string): string => `${day} closes` },
    closed: 'Closed',
    /** The line under the rows: the summary line of the current choices. */
    preview: (summary: string): string => `Visitors see: ${summary}`,
    previewClosed: 'Visitors see: Closed every day',
    actions: { undo: 'Undo Changes', save: 'Save Hours', saving: 'Saving' },
    /** The polite line after Load Latest. */
    latestLoaded: 'Latest hours loaded. Make your changes again.',
    toast: { title: 'Opening hours saved', message: 'The Contact page and the open status use them now.' },
    /** The server's own words (UI-SPEC Validation), so the browser and the API say the same thing. */
    errors: {
      opensRequired: 'Choose the opening time.',
      closesRequired: 'Choose the closing time.',
      closesAfterOpens: 'Closing time must be after opening time.',
      timeStep: 'Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM.',
    },
  },
  /** S2 Hours & Closures, card B: the holidays and closures, the closure window and the delete question (plan 11-16). */
  closures: {
    /** "Loading closures…", "The closures loaded." and "Couldn't load closures." */
    things: 'closures',
    card: {
      title: 'Holidays and closures',
      hint: 'Days the shop is closed. The Contact page lists them, and the open or closed status follows them.',
    },
    add: 'Add Closure',
    table: { caption: 'Upcoming closures', date: 'Date', note: 'Public note', actions: 'Actions' },
    /** A closure of several days: "Dec 30, 2026 to Jan 1, 2027". */
    range: (first: string, last: string): string => `${first} to ${last}`,
    rowActions: {
      edit: (date: string): string => `Edit closure on ${date}`,
      remove: (date: string): string => `Delete closure on ${date}`,
    },
    empty: {
      title: 'No closures coming up',
      message: "Add holidays and special closures so visitors know when you're closed.",
    },
    window: {
      addTitle: 'Add Closure',
      editTitle: 'Edit Closure',
      firstDay: 'First day',
      lastDay: 'Last day',
      lastDayHint: 'Leave empty for one day. Up to 31 days.',
      note: 'Public note',
      notePlaceholder: 'e.g. Christmas',
      noteHint: 'Shown on the Contact page, like Closed today for Christmas.',
      cancel: 'Cancel',
      save: 'Save Closure',
      saving: 'Saving',
      /** The polite line after Load Latest. */
      latestLoaded: 'Latest closure loaded. Make your changes again.',
      /** A save or Load Latest finds the closure gone (SPEC-GAP). */
      gone: "This closure wasn't found. It may have been deleted.",
    },
    /** The "Discard changes?" dialog over a changed window (08 D-58), the order windows' own words. */
    discard: {
      title: 'Discard changes?',
      message: "What you typed in this window hasn't been saved. If you close it now, it's lost.",
      keep: 'Keep Editing',
      discard: 'Discard Changes',
    },
    toast: {
      added: { title: 'Closure added', message: (date: string): string => `${date} shows as closed.` },
      saved: { title: 'Closure saved', message: 'The Contact page shows the change.' },
      deleted: { title: 'Closure deleted', message: (date: string): string => `${date} shows normal hours.` },
      alreadyDeleted: 'Already deleted',
    },
    remove: {
      title: 'Delete this closure?',
      message: (date: string): string => `${date}. The shop shows its normal hours that day.`,
      confirm: 'Delete Closure',
      pending: 'Deleting',
    },
    /** The server's own words (UI-SPEC Validation), so the browser and the API say the same thing. */
    errors: {
      firstRequired: 'Enter the first day.',
      notADate: 'Enter a real date.',
      firstInPast: 'Pick today or a later date.',
      lastBeforeFirst: 'The last day must be on or after the first day.',
      spanTooLong: 'A closure can be up to 31 days. Add another one for longer.',
      noteTooLong: 'Keep the note to 80 characters or fewer.',
    },
  },
  /** Inline errors: the server's own words (UI-SPEC Validation). */
  errors: {
    businessNameRequired: 'Enter the business name.',
    businessNameTooLong: 'Keep the business name to 100 characters or fewer.',
    taglineRequired: 'Enter a tagline.',
    taglineTooLong: 'Keep the tagline to 160 characters or fewer.',
    turnaroundTooLong: 'Keep the turnaround line to 120 characters or fewer.',
    streetRequired: 'Enter the street and barangay.',
    townOrCityRequired: 'Enter the town or city.',
    provinceRequired: 'Enter the province.',
    tooLong: (max: number): string => `Keep this to ${String(max)} characters or fewer.`,
    postalCode: 'Use the 4-digit postal code, like 8600.',
    directionsUrl: 'Paste a Google Maps link, like https://maps.app.goo.gl/abc123.',
    mapEmbedUrl: 'Paste the embed code or link from Google Maps. It starts with https://www.google.com/maps/embed.',
    messengerUrl: 'Paste your Messenger link, like https://m.me/yourpage.',
    facebookUrl: 'Paste your Facebook page link, like https://www.facebook.com/yourpage.',
    instagramUrl: 'Paste your Instagram link, like https://www.instagram.com/yourpage.',
    tiktokUrl: 'Paste your TikTok link, like https://www.tiktok.com/@yourpage.',
    email: 'Enter a valid email, like name@gmail.com',
    phonesRequired: 'Add at least one phone number.',
    phonesTooMany: 'You can list up to 4 numbers.',
    phone: 'Enter a phone number, like 0917 123 4567 or 02 8123 4567.',
    phoneDuplicate: 'This number is already listed.',
    phoneLabelTooLong: 'Keep the label to 20 characters or fewer.',
    mainPhone: 'Choose the main number.',
    /** Text that still holds a square-bracket placeholder (the server's provisional wording, P11-BL-02). */
    placeholderText: 'Replace the text in square brackets with the real words.',
  },
} as const;
