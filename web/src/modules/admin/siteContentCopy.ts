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
      quoteAlerts: { title: 'Quote alerts', hint: 'Where we email you when a visitor sends a quote request.' },
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
      quoteAlertsEmail: {
        label: 'Quote alerts email',
        hint: 'Any inbox works, including the shop email. Leave it empty to get no emails; new requests still show in Quote Requests.',
      },
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
    /** The Link preview picture card (D-26; plan 11-34). SPEC-GAP: the alt text and the "Remove Picture" confirm are the plan's; the rest is the UI-SPEC's. */
    sharePicture: {
      card: { title: 'Link preview picture', hint: 'Shown when someone shares a page on Facebook or Messenger.' },
      empty: 'No picture yet',
      hint: 'JPG, PNG, WEBP or HEIC · up to 10 MB · 1200 × 630 pixels works best',
      note: 'Products and Gallery use their own newest photo when they have one.',
      /** The name of the preview of a saved picture, for a screen reader. */
      alt: 'The link preview picture',
      remove: {
        title: 'Remove the link preview picture?',
        message: 'Shared links show no picture until you add one.',
        action: 'Remove Picture',
      },
      toast: {
        saved: { title: 'Picture saved', message: 'Shared links use it now.' },
        removed: { title: 'Picture removed', message: 'Shared links show no picture.' },
      },
    },
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
  /** S3 Products tab: the ordered list of the product lines and its row actions (plan 11-20). */
  products: {
    /** "Loading product lines…", "The product lines loaded." and "Couldn't load product lines." */
    things: 'product lines',
    card: {
      title: 'Product lines',
      hint: 'Shown on the Home and Products pages, in this order. The Gallery filters use the short names.',
    },
    add: 'Add Product Line',
    table: {
      caption: 'Product lines',
      line: 'Product line',
      startsAt: 'Starts at',
      orderTypes: 'Order types',
      gallery: 'Gallery',
      status: 'Status',
      actions: 'Actions',
    },
    status: { shown: 'Shown', hidden: 'Hidden' },
    /** "min. 10 pcs", under the price. */
    minimum: (pieces: number): string => `min. ${String(pieces)} ${pieces === 1 ? 'pc' : 'pcs'}`,
    /** The line under the table: hide versus delete. */
    caption:
      "A product line with photos, gallery items or linked order types can't be deleted. Hide it to take it off the website. Nothing is lost.",
    /** The polite line after a move: "Basketball Jerseys moved to position 2 of 6." */
    moved: (title: string, position: number, total: number): string =>
      `${title} moved to position ${String(position)} of ${String(total)}.`,
    rowActions: {
      up: (title: string): string => `Move ${title} up`,
      down: (title: string): string => `Move ${title} down`,
      edit: (title: string): string => `Edit ${title}`,
      hide: (title: string): string => `Hide ${title}`,
      show: (title: string): string => `Show ${title}`,
      remove: (title: string): string => `Delete ${title}`,
    },
    empty: {
      title: 'No product lines yet',
      message: 'Add your first product line to show it on the Home and Products pages.',
    },
    toast: {
      hidden: {
        title: (title: string): string => `${title} hidden`,
        message: 'It and its gallery photos are off the website. Nothing is deleted.',
      },
      shown: { title: (title: string): string => `${title} shown`, message: "It's on the website again." },
      deleted: { title: 'Product line deleted', message: (title: string): string => `${title} was removed.` },
      alreadyDeleted: 'Already deleted',
    },
    /** The danger toast of an immediate action that failed (SPEC-GAP); its message is the shared error line. */
    failed: {
      move: (title: string): string => `Couldn't move ${title}`,
      hide: (title: string): string => `Couldn't hide ${title}`,
      show: (title: string): string => `Couldn't show ${title}`,
    },
    remove: {
      title: (title: string): string => `Delete ${title}?`,
      message: "It's removed for good. This can't be undone.",
      confirm: 'Delete Product Line',
      pending: 'Deleting',
      /** The server's own words for a line that became used meanwhile (UI-SPEC Validation). */
      inUse: 'This product line is in use. Hide it instead.',
    },
  },
  /** S4 Product line editor: /admin/site-content/products/new and /:lineId (plan 11-20). */
  productLine: {
    /** "Loading the product line…", "The product line loaded." and "Couldn't load the product line." */
    things: 'the product line',
    /** The document title while there is no line to name it: "{title} · CSPS Admin". */
    documentTitle: 'Product Line',
    back: 'Site Content',
    newTitle: 'New Product Line',
    subline: 'Shown on the Home and Products pages.',
    hidden: 'Hidden',
    cards: {
      names: { title: 'Names', hint: 'How the line is named on the website.' },
      words: { title: 'Words', hint: 'The Home card text and the Products page description.' },
      customize: {
        title: 'What you can customize',
        hint: 'The five cards stay the same. Write what each offers for this line.',
      },
      price: { title: 'Price', hint: 'Leave the price empty to show Message us for a price.' },
      photos: {
        title: 'Photos',
        hint: 'Main photo, back view and fabric detail. Until a photo is added, the drawing shows.',
        saveFirst: 'Save the product line first, then add photos.',
      },
      types: {
        title: 'Order product types',
        hint: 'Orders with these product types are filed under this line when staff show them on the website.',
      },
    },
    fields: {
      show: 'Show on the website',
      title: { label: 'Title', placeholder: 'e.g. Basketball Jerseys' },
      shortName: {
        label: 'Short name',
        placeholder: 'e.g. Basketball',
        hint: 'Used on the Gallery filters and the See basketball work button.',
      },
      number: {
        label: 'Number on the drawing',
        placeholder: 'e.g. 23',
        hint: 'Shown on the drawn jersey and the empty photo boxes.',
      },
      cardText: { label: 'Card text', hint: 'Shown on the Home page card.' },
      description: { label: 'Description', hint: 'Shown on the Products page under the title.' },
      price: { label: 'Starts at, per piece' },
      minimum: { label: 'Minimum order, pieces' },
    },
    /** The three photo slots of the Photos card (D-02). The remove words are the UI-SPEC's "Remove the {main photo}?" / "{The drawn jersey} shows instead.". */
    photos: {
      hint: 'JPG, PNG, WEBP or HEIC · up to 10 MB',
      slots: {
        main: {
          label: 'Main photo',
          remove: { title: 'Remove the main photo?', message: 'The drawn jersey shows instead.' },
        },
        back: {
          label: 'Back view',
          remove: { title: 'Remove the back view?', message: 'The empty box shows instead.' },
        },
        fabric: {
          label: 'Fabric detail',
          remove: { title: 'Remove the fabric detail?', message: 'The empty box shows instead.' },
        },
      },
      removeAction: 'Remove Photo',
      /** The label and name of the empty Main photo: the drawing of the line shows there. */
      drawnJersey: 'Drawn jersey (no photo yet)',
      toast: {
        saved: { title: 'Photo saved', message: 'It shows on the website now.' },
        removed: { title: 'Photo removed', message: 'The drawing shows instead.' },
      },
    },
    /** The five fixed customize cards, in the order the public page draws them. */
    customize: {
      fabricText: 'Fabric',
      collarText: 'Collar style',
      cutText: 'Cut & fit',
      namesText: 'Names & numbers',
      logosText: 'Logos & sponsors',
    },
    /** The line under the price fields: what visitors will read. */
    preview: {
      startsAt: (price: string, minimum: string): string => `Visitors see: Starts at ${price} / pc${minimum}`,
      noPrice: (minimum: string): string => `Visitors see: Message us for a price${minimum}`,
      /** " · min. 10 pcs" */
      minimum: (pieces: number): string => ` · min. ${String(pieces)} ${pieces === 1 ? 'pc' : 'pcs'}`,
    },
    types: {
      /** "Loading order product types…" and "Couldn't load order product types." */
      things: 'order product types',
      legend: 'Order product types filed here',
      /** The line under the checklist. */
      hint: 'A product type belongs to one line. Ticking one from another line moves it here.',
      /** The end of a label whose type is filed under another line: " (now under Volleyball Jerseys)". */
      nowUnder: (title: string): string => ` (now under ${title})`,
      /** The note when there are no order product types: the middle word is a link to Settings. */
      none: { before: 'No order product types yet. Add them in ', link: 'Settings', after: '.' },
    },
    actions: { cancel: 'Cancel', saveNew: 'Save Product Line', saveEdit: 'Save Changes', saving: 'Saving' },
    notFound: {
      title: "This product line wasn't found.",
      message: 'It may have been deleted. Go back to the list.',
      back: 'Back to Products',
    },
    toast: {
      added: {
        title: 'Product line added',
        hiddenMessage: "It's hidden until you tick Show on the website.",
        shownMessage: "It's on the website now.",
      },
      saved: { title: 'Product line saved', message: 'The website shows the changes now.' },
    },
    /** The polite line after Load Latest. */
    latestLoaded: 'Latest version loaded. Make your changes again.',
    /** The "Discard changes?" dialog over a changed editor (08 D-58). */
    discard: {
      title: 'Discard changes?',
      message: "Your changes to this product line haven't been saved. If you leave now, they're lost.",
      keep: 'Keep Editing',
      discard: 'Discard Changes',
      loadLatestMessage: 'Load Latest replaces what you typed with the saved version. Your typed changes are lost.',
    },
    /** The server's own words (UI-SPEC Validation), so the browser and the API say the same thing. */
    errors: {
      titleRequired: 'Enter the title.',
      titleTooLong: 'Keep the title to 60 characters or fewer.',
      shortNameRequired: 'Enter a short name.',
      shortNameTooLong: 'Keep the short name to 20 characters or fewer.',
      number: 'Use up to 2 letters or digits, like 23 or 3X.',
      cardTextRequired: 'Enter the card text.',
      cardTextTooLong: 'Keep the card text to 140 characters or fewer.',
      descriptionRequired: 'Enter the description.',
      descriptionTooLong: 'Keep the description to 300 characters or fewer.',
      customizeRequired: (label: string): string => `Enter the ${label} text.`,
      customizeTooLong: 'Keep this to 120 characters or fewer.',
      priceDecimals: 'Use at most 2 decimal places.',
      priceTooLow: 'Enter a price of at least ₱0.01.',
      priceTooHigh: 'Enter a price up to ₱999,999.99.',
      minimum: 'Enter a whole number from 1 to 9,999.',
    },
  },
  /** S5 Testimonials tab: the ordered list, its row actions, the add and edit window and the delete question (plan 11-24). */
  testimonials: {
    /** "Loading testimonials…", "Testimonials loaded." and "Couldn't load testimonials." */
    things: 'testimonials',
    card: {
      title: 'Testimonials',
      hint: 'The first 3 shown testimonials appear on the Home page, in this order.',
    },
    add: 'Add Testimonial',
    table: {
      caption: 'Testimonials',
      quote: 'Quote',
      name: 'Name',
      stars: 'Stars',
      status: 'Status',
      actions: 'Actions',
    },
    status: { shown: 'Shown', hidden: 'Hidden' },
    /** Under the badge of each of the first 3 shown rows. */
    onHome: 'On the Home page',
    /** "5 stars" and "1 star": the Stars column and the options of the Stars group. */
    stars: (count: number): string => `${String(count)} ${count === 1 ? 'star' : 'stars'}`,
    /** The polite line after a move. SPEC-GAP wording: "Testimonial from Ana Reyes moved to position 2 of 4." */
    moved: (name: string, position: number, total: number): string =>
      `Testimonial from ${name} moved to position ${String(position)} of ${String(total)}.`,
    rowActions: {
      up: (name: string): string => `Move testimonial from ${name} up`,
      down: (name: string): string => `Move testimonial from ${name} down`,
      edit: (name: string): string => `Edit testimonial from ${name}`,
      hide: (name: string): string => `Hide testimonial from ${name}`,
      show: (name: string): string => `Show testimonial from ${name}`,
      remove: (name: string): string => `Delete testimonial from ${name}`,
    },
    empty: {
      title: 'No testimonials yet',
      message: 'Add what customers say about you. The Home page shows the first 3.',
    },
    toast: {
      added: { title: 'Testimonial added', message: 'The Home page shows the change.' },
      saved: { title: 'Testimonial saved', message: 'The Home page shows the change.' },
      hidden: { title: 'Testimonial hidden', message: 'The Home page shows the change.' },
      shown: { title: 'Testimonial shown', message: 'The Home page shows the change.' },
      deleted: { title: 'Testimonial deleted', message: 'The Home page shows the change.' },
      alreadyDeleted: 'Already deleted',
    },
    /** The danger toast of an immediate action that failed (SPEC-GAP); its message is the shared error line. */
    failed: {
      move: (name: string): string => `Couldn't move the testimonial from ${name}`,
      hide: (name: string): string => `Couldn't hide the testimonial from ${name}`,
      show: (name: string): string => `Couldn't show the testimonial from ${name}`,
    },
    remove: {
      title: 'Delete this testimonial?',
      /** "Juan Dela Cruz: “Seventeen pieces, names and numbers perfect…” It's removed for good." The start of the quote is cut at 50 characters. */
      message: (name: string, quoteStart: string): string => `${name}: “${quoteStart}” It's removed for good.`,
      confirm: 'Delete Testimonial',
      pending: 'Deleting',
    },
    window: {
      addTitle: 'Add Testimonial',
      editTitle: 'Edit Testimonial',
      quote: { label: 'Quote', hint: 'Write it the way the customer said it.' },
      name: { label: 'Name' },
      team: { label: 'Team or role', placeholder: 'e.g. Captain, Brgy. San Roque Ballers' },
      stars: 'Stars',
      show: 'Show on the website',
      cancel: 'Cancel',
      save: 'Save Testimonial',
      saving: 'Saving',
      /** The polite line after Load Latest. */
      latestLoaded: 'Latest testimonial loaded. Make your changes again.',
      /** A save or Load Latest finds the testimonial gone (SPEC-GAP). */
      gone: "This testimonial wasn't found. It may have been deleted.",
    },
    /** The "Discard changes?" dialog over a changed window (08 D-58), the order windows' own words. */
    discard: {
      title: 'Discard changes?',
      message: "What you typed in this window hasn't been saved. If you close it now, it's lost.",
      keep: 'Keep Editing',
      discard: 'Discard Changes',
    },
    /** The server's own words (UI-SPEC Validation), so the browser and the API say the same thing. */
    errors: {
      quoteRequired: 'Enter the quote.',
      quoteTooLong: 'Keep the quote to 300 characters or fewer.',
      nameRequired: 'Enter the name.',
      nameTooLong: 'Keep the name to 60 characters or fewer.',
      teamTooLong: 'Keep this to 80 characters or fewer.',
      stars: 'Choose 1 to 5 stars.',
    },
  },
  /** S6 Gallery tab and its window (GAL-03, plan 11-32). SPEC-GAP wording where the UI-SPEC is silent; the owner reviews it. */
  gallery: {
    /** "Loading gallery items…", "Gallery items loaded." and "Couldn't load gallery items." */
    things: 'gallery items',
    card: {
      title: 'Gallery',
      hint: 'Every photo on the public Gallery, in this order. New items start at the top.',
    },
    add: 'Add Photo',
    table: {
      caption: 'Gallery items',
      photo: 'Photo',
      source: 'Source',
      status: 'Status',
      actions: 'Actions',
    },
    filter: {
      label: 'Product line',
      all: 'All lines',
      /** The name of the toolbar landmark that holds the Select. */
      landmark: 'Filter the gallery',
      hidden: (title: string): string => `${title} (hidden)`,
    },
    /** The result bar's nouns: "Showing 6 items · in gallery order" and "Showing 1 item". */
    resultThing: 'item',
    resultThings: 'items',
    orderNote: 'in gallery order',
    /** The Source of an item that was added here rather than shown from an order. */
    uploaded: 'Uploaded',
    status: { shown: 'Shown', hidden: 'Hidden' },
    lineHidden: 'Line hidden',
    /** "Basketball · 17 pcs", "Basketball", "17 pcs": the short name and the pieces under the name. */
    pieces: (count: number): string => `${String(count)} ${count === 1 ? 'pc' : 'pcs'}`,
    rowActions: {
      up: (team: string): string => `Move ${team} up`,
      down: (team: string): string => `Move ${team} down`,
      edit: (team: string): string => `Edit ${team}`,
      hide: (team: string): string => `Hide ${team}`,
      show: (team: string): string => `Show ${team}`,
      remove: (team: string): string => `Delete ${team}`,
      /** An order item is changed on its order, not here (D-27). */
      change: (team: string, orderNumber: string): string => `Change ${team} on order ${orderNumber}`,
    },
    /** The polite lines after a move: across a page edge (UI-SPEC), and within a page (SPEC-GAP). */
    movedToPage: (team: string, page: number): string => `${team} moved to page ${String(page)}.`,
    moved: (team: string, place: number, total: number): string =>
      `${team} moved to place ${String(place)} of ${String(total)}.`,
    empty: {
      title: 'No gallery photos yet',
      message: 'Show an order from its order page, or add a photo of older work.',
    },
    emptyLine: {
      title: (line: string): string => `No items in ${line} yet.`,
      showAll: 'Show All Lines',
    },
    toast: {
      added: { title: 'Photo added', message: "It's at the top of the Gallery." },
      saved: { title: 'Photo saved' },
      hidden: { title: 'Photo hidden', message: "It's off the Gallery. Nothing is deleted." },
      shown: { title: 'Photo shown' },
      deleted: { title: 'Photo deleted' },
      alreadyDeleted: 'Already deleted',
    },
    /** The danger toast of an immediate action that failed (SPEC-GAP); its message is the shared error line. */
    failed: {
      move: (team: string): string => `Couldn't move ${team}`,
      hide: (team: string): string => `Couldn't hide ${team}`,
      show: (team: string): string => `Couldn't show ${team}`,
    },
    remove: {
      title: 'Delete this photo?',
      message: (team: string): string => `${team}. It's removed from the Gallery for good.`,
      confirm: 'Delete Photo',
      pending: 'Deleting',
    },
    window: {
      addTitle: 'Add Photo',
      editTitle: 'Edit Photo',
      note: 'Only add photos the customer said you may show.',
      photo: 'Photo',
      team: { label: 'Team or name' },
      line: { label: 'Product line', placeholder: 'Choose a product line' },
      pieces: { label: 'Pieces' },
      noteField: { label: 'Note', placeholder: 'e.g. Dri-fit mesh, V-neck', hint: 'Shown in the photo viewer.' },
      show: 'Show on the website',
      cancel: 'Cancel',
      save: 'Save Photo',
      uploading: 'Uploading',
      saving: 'Saving',
      /** The picked file's name above the preview, and the empty frame's text (SPEC-GAP). */
      noPhoto: 'No photo chosen yet',
      photoHint: 'JPG, PNG, WEBP or HEIC · up to 10 MB',
      /** The status line once a photo is chosen and prepared, before it is sent. */
      photoChosen: 'Photo chosen',
      previewAlt: (team: string): string => (team === '' ? 'The chosen photo' : `Photo of ${team}`),
      /** The polite line after Load Latest. */
      latestLoaded: 'Latest photo loaded. Make your changes again.',
      /** A save or Load Latest finds the photo gone, or no longer on the page the list shows (SPEC-GAP). */
      gone: "This photo wasn't found. It may have been deleted or moved to another page.",
      /** The lines list could not be read, so the Product line Select has nothing to offer (SPEC-GAP). */
      linesFailed: "Couldn't load the product lines. Close this window and try again.",
    },
    /** The "Discard changes?" dialog over a changed window (08 D-58), the order windows' own words. */
    discard: {
      title: 'Discard changes?',
      message: "What you typed in this window hasn't been saved. If you close it now, it's lost.",
      keep: 'Keep Editing',
      discard: 'Discard Changes',
    },
    /** The server's own words (UI-SPEC Validation), so the browser and the API say the same thing. */
    errors: {
      photoRequired: 'Choose a photo.',
      teamRequired: 'Enter the team or name.',
      teamTooLong: 'Keep this to 80 characters or fewer.',
      lineRequired: 'Choose the product line.',
      pieces: 'Enter a whole number from 1 to 9,999.',
      noteTooLong: 'Keep the note to 120 characters or fewer.',
    },
  },
  /**
   * One photo place (PhotoSlot; plan 11-22), shared by the line photos, the link preview picture and the gallery window. The noun is "Photo" or
   * "Picture". SPEC-GAP: the UI-SPEC names the buttons, the status line and the toasts; the rest is new wording the owner reviews.
   */
  photoSlot: {
    choose: (noun: string): string => `Choose ${noun}`,
    take: (noun: string): string => `Take ${noun}`,
    replace: (noun: string): string => `Replace ${noun}`,
    remove: (noun: string): string => `Remove ${noun}`,
    /** The status line while the file is prepared and sent, and once it is saved. */
    uploading: 'Uploading',
    saved: 'Saved',
    /** The confirm button's words while the photo is taken off. */
    removing: 'Removing',
    /** The name of the preview of a slot with a photo, for a screen reader: "Main photo of Polo Shirts". */
    previewAlt: (label: string, title: string): string => `${label} of ${title}`,
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
    quoteAlertsEmailTooLong: 'Keep the email to 254 characters or fewer.',
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
