// Every public-site string (UI-SPEC Copywriting Contract, Public copy and Meta descriptions), grouped by page. No string
// holds an em dash, en dash or arrow (OR-4). Strings marked SPEC-GAP are new; the owner reviews them before release.
// The titles and descriptions are the strings the server sends in the page head (PublicPageHeads.cs), so the client
// sets the same text on navigation. Text with a value in it is a small function next to the strings.

/** The approved shop tagline: Home's description and the default footer line until the stored one is read (plan 11-07). */
const TAGLINE = 'Custom tailoring and full-sublimation printing for teams, leagues and riding groups.';

const COUNT_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
] as const;

/** SPEC-GAP: the count of product lines in words up to twelve, then digits ("13"). */
export function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

/** "1 pc" or "17 pcs". */
export function piecesText(count: number): string {
  return `${String(count)} ${count === 1 ? 'pc' : 'pcs'}`;
}

export const PUBLIC_COPY = {
  tagline: TAGLINE,
  titles: {
    home: 'CSPS · Custom Team Jerseys and Tailoring',
    products: 'Products and Prices · CSPS',
    gallery: 'Our Work · Gallery · CSPS',
    contact: 'Contact Us and Get a Quote · CSPS',
    notFound: 'Page Not Found · CSPS',
  },
  descriptions: {
    home: TAGLINE,
    products:
      'See our product lines, starting prices and everything you can customize, from fabric to names and numbers.',
    gallery: 'Photos of real team orders from leagues, schools, riding clubs and offices.',
    contact: 'Message us on Messenger or call the shop. See our hours, address and map.',
    notFound: "This page couldn't be found.",
  },
  crumbs: { label: 'Breadcrumb', home: 'Home', products: 'Products', gallery: 'Gallery', contact: 'Contact' },
  // The shared actions: every "Get a Quote" goes to /contact (D-19).
  actions: { getQuote: 'Get a Quote', viewWork: 'View Our Work', messageUs: 'Message Us' },
  home: {
    hero: {
      eyebrow: 'Custom sublimation · Philippines',
      headline: { plain: 'Built for the', accent: 'whole team.' },
      lead: "Full-sublimation basketball, volleyball and moto jerseys: names, numbers and logos printed edge to edge. Send us your idea and we'll send back a mockup.",
      chips: ['Full sublimation', 'Names & numbers', 'Team orders welcome'],
    },
    heroTag: {
      label: 'Recent order',
      set: (pieces: number) => `${String(pieces)}-piece set · mockup to pickup`,
    },
    categories: {
      eyebrow: 'What we make',
      headline: { plain: 'Pick your', accent: 'kit.' },
      lead: (lines: number) =>
        lines === 1
          ? 'One way to suit up, fully customizable, from fabric to the last digit on the back.'
          : `${countWord(lines)} ways to suit up, every one fully customizable, from fabric to the last digit on the back.`,
      allProducts: 'All products',
    },
    why: {
      eyebrow: 'Why CSPS',
      headline: { plain: 'Made to', accent: 'move.', rest: 'Made to last.' },
      items: [
        {
          icon: 'printer',
          title: 'Full sublimation',
          text: 'Ink is dyed into the fabric, not printed on top. No cracking, peeling or fading after washes.',
        },
        {
          icon: 'shirt',
          title: 'Names & numbers',
          text: 'Every piece personalized. Send the lineup and sizes; we handle the layout.',
        },
        {
          icon: 'users',
          title: 'Team orders',
          text: 'From a five-player barkada to a full liga, kids to 4XL, in one order.',
        },
        {
          icon: 'scissors',
          title: 'Quality stitching',
          text: 'Reinforced seams and clean hems, finished in-house by our tailoring team.',
        },
      ],
      turnaround: {
        icon: 'clock',
        title: 'Fast turnaround',
        fallback: 'Mockups come fast; production starts as soon as the downpayment is in.',
      },
    },
    steps: {
      eyebrow: 'How ordering works',
      headline: { plain: 'Idea to jersey in', accent: 'four steps.' },
      items: [
        {
          icon: 'message-circle',
          title: 'Send your design',
          text: 'Message us your logo, colors or just an idea. Sketches welcome.',
        },
        {
          icon: 'palette',
          title: 'Approve the mockup',
          text: 'We send a digital mockup. Revise until every detail is right.',
        },
        {
          icon: 'printer',
          title: 'Downpayment & production',
          text: 'Pay the downpayment via GCash, Maya or bank transfer and we start printing.',
        },
        {
          icon: 'truck',
          title: 'Pickup or delivery',
          text: 'Settle the balance, then pick up in-store or get it delivered.',
        },
      ],
    },
    recent: {
      eyebrow: 'Fresh off the press',
      headline: { plain: 'Recent', accent: 'work.' },
      viewGallery: 'View gallery',
      // The pieces are left out when unknown.
      caption: (line: string, pieces: number | null) => (pieces === null ? line : `${line} · ${piecesText(pieces)}`),
    },
    testimonials: {
      eyebrow: 'From the court and the road',
      headline: { plain: 'Teams that', accent: 'suit up', rest: 'with us.' },
      // SPEC-GAP: the carousel region's name.
      region: 'Testimonials',
    },
    cta: {
      headline: "Got a team? Let's suit them up.",
      lead: "Send your design, logo or rough idea. We'll reply with a mockup and a quote.",
      messenger: 'Message us on Messenger',
    },
  },
  products: {
    eyebrow: 'Products & services',
    headline: { plain: 'Every kit,', accent: 'your way.' },
    lead: (lines: number) =>
      lines === 1
        ? 'One product line, printed by full sublimation and finished by our tailors. Pick a base, then make every detail yours.'
        : `${countWord(lines)} product lines, all printed by full sublimation and finished by our tailors. Pick a base, then make every detail yours.`,
    // SPEC-GAP: the pill nav's name.
    pillNav: 'Product lines',
    article: {
      customize: 'What you can customize',
      cards: ['Fabric', 'Collar style', 'Cut & fit', 'Names & numbers', 'Logos & sponsors'],
      startsAt: 'Starts at',
      perPiece: '/ pc',
      minimum: (pieces: number) => ` · min. ${piecesText(pieces)}`,
      noPrice: 'Message us for a price',
      seeWork: (shortName: string) => `See ${shortName.toLowerCase()} work`,
      frontAlt: (title: string) => `${title}, front`,
      backAlt: (title: string) => `${title}, back view`,
      fabricAlt: (title: string) => `${title}, fabric detail`,
      backPlaceholder: 'Back view',
      fabricPlaceholder: 'Fabric detail',
    },
    help: {
      eyebrow: 'Not sure what to pick?',
      headline: "Tell us the sport. We'll suggest the rest.",
      messageUs: 'Message us',
    },
    empty: {
      title: 'Our product list is being updated',
      message: "Message us on Messenger or call the shop, and we'll tell you what we can make for your team.",
    },
  },
  gallery: {
    eyebrow: 'Our work',
    headline: { plain: 'Worn on', accent: 'court & road.' },
    lead: 'Real orders from barangay leagues, school teams, riding clubs and offices. Tap any piece to see it up close.',
    filterBar: 'Filter by category',
    all: 'All',
    // The visually hidden word after a pill's number; the space before it is its own text node.
    itemsHidden: 'items',
    // SPEC-GAP: the polite announcement after a filter change.
    showing: (count: number) => `Showing ${String(count)} ${count === 1 ? 'item' : 'items'}`,
    tileName: (team: string, line: string) => `Open ${team}, ${line}`,
    // "{Basketball} · {17} pcs"; the pieces are left out when unknown (an upload with none).
    caption: (line: string, pieces: number | null) => (pieces === null ? line : `${line} · ${piecesText(pieces)}`),
    showMore: 'Show More Photos',
    wantOne: 'Want one like these? Get a Quote',
    empty: { title: 'No photos yet', message: 'Photos of our latest team orders show here soon.' },
    lightbox: {
      dialog: 'Gallery image viewer',
      position: (index: number, total: number) => `${String(index)} / ${String(total)}`,
      positionHidden: (index: number, total: number) => `Item ${String(index)} of ${String(total)}`,
      close: 'Close viewer',
      previousImage: 'Previous image',
      nextImage: 'Next image',
      previousPhoto: 'Previous photo',
      nextPhoto: 'Next photo',
      showPhoto: (index: number, total: number) => `Show photo ${String(index)} of ${String(total)}`,
      alt: (team: string, line: string) => `${team}, ${line} work`,
      altPhoto: (team: string, line: string, index: number, total: number) =>
        `${team}, ${line} work, photo ${String(index)} of ${String(total)}`,
      // "{Basketball} · {17} pcs · {Dri-fit mesh, V-neck}"; the pieces and the note are left out when missing.
      meta: (line: string, pieces: number | null, note: string | null) =>
        [line, pieces === null ? '' : piecesText(pieces), note ?? ''].filter((part) => part !== '').join(' · '),
      getQuote: 'Get a quote for something like this',
      announceItem: (index: number, total: number, team: string, line: string) =>
        `Item ${String(index)} of ${String(total)}: ${team}, ${line}`,
      announcePhoto: (index: number, total: number) => `Photo ${String(index)} of ${String(total)}`,
    },
  },
  contact: {
    eyebrow: 'Get a quote',
    headline: { plain: "Let's build", accent: 'your kit.' },
    // SPEC-GAP (D-18): the lead until the inquiry form returns in Phase 13.
    lead: "Tell us about your team and what you need. Message us on Messenger or call the shop, and we'll reply with a mockup and price, usually the same day.",
    now: {
      title: 'Message us',
      intro: 'The fastest way to get a mockup and a price.',
      messenger: 'Message us on Messenger',
      messengerNote: 'Fastest reply · send photos of your design',
      call: (phone: string) => `Call ${phone}`,
      whatToSend: 'What to send',
      sendItems: [
        'Your team or group name',
        'What you need and about how many pieces',
        'Your design, logo or a rough idea. A phone photo is fine.',
      ],
    },
    phones: {
      title: 'Call or text',
      main: 'Main',
      callName: (display: string, label: string | null) =>
        label === null ? `Call ${display}` : `Call ${display}, ${label}`,
    },
    map: {
      placeholder: 'Map placeholder showing the shop location',
      shopName: 'CSPS Shop',
      directions: 'Directions',
      showMap: 'Show Map',
      privacy: 'The map loads from Google when you tap Show Map.',
      frameTitle: (businessName: string) => `Map of ${businessName}`,
      newTab: ' (opens in a new tab)',
    },
    bar: { messenger: 'Messenger', call: 'Call us' },
    // The Get a Quote form (UI-SPEC Q1 and Q3; D-31 words). The error words are the server's own (QuoteRequestRules, OR-3).
    form: {
      title: 'Inquiry form',
      caption: 'Fields marked * are required.',
      name: { label: 'Your name', placeholder: 'Juan Dela Cruz' },
      number: {
        label: 'Contact number',
        placeholder: '0917 123 4567',
        hint: "We'll text or call about your mockup.",
      },
      team: { label: 'Team / organization', placeholder: 'Brgy. San Roque Ballers' },
      email: { label: 'Email', placeholder: 'you@gmail.com' },
      product: {
        label: 'Product type',
        placeholder: 'Choose a product',
        // The two fixed choices that follow the product lines (D-24).
        custom: 'Custom design',
        notSure: 'Not sure yet',
      },
      quantity: {
        label: 'Quantity (estimate)',
        placeholder: 'How many pieces?',
        options: [
          { value: '1-9', label: '1-9 pcs' },
          { value: '10-20', label: '10-20 pcs' },
          { value: '21-50', label: '21-50 pcs' },
          { value: '51-100', label: '51-100 pcs' },
          { value: '100+', label: '100+ pcs' },
        ],
      },
      message: {
        label: 'Message',
        placeholder: 'Colors, sport, deadline, sizes, anything you have in mind…',
      },
      // The honeypot (INQ-03, D-25): hidden from sight and from assistive technology.
      honeypot: 'Leave this field empty',
      // The accurate privacy notice (INQ-08, D-27); "Privacy Policy" is the link to /privacy.
      notice: {
        before:
          "We use your details only to reply to this request and prepare your quote. We keep requests that don't become orders for 6 months. See our ",
        link: 'Privacy Policy',
        after: '.',
      },
      submit: 'Send Inquiry',
      sending: 'Sending',
      success: {
        title: 'Inquiry sent',
        message: "Thanks! We'll message you with a mockup and quote, usually the same day.",
        another: 'Send Another',
        toastTitle: 'Inquiry sent',
        toastMessage: "We'll message you soon.",
      },
      sendFailed:
        "Couldn't send your inquiry. Check your internet connection and try again. What you typed is still here.",
      errors: {
        nameRequired: 'Enter your name.',
        nameTooLong: 'Keep your name to 100 characters or fewer.',
        teamTooLong: 'Keep the team name to 100 characters or fewer.',
        numberInvalid: 'Enter a mobile number, like 0917 123 4567.',
        emailInvalid: 'Enter a valid email, like name@gmail.com',
        emailTooLong: 'Keep the email to 254 characters or fewer.',
        productInvalid: 'Choose a product from the list.',
        quantityInvalid: 'Choose a quantity from the list.',
        messageTooLong: 'Keep your message to 2,000 characters or fewer.',
      },
    },
    // The reference photo picker of the quote form (UI-SPEC Q2; D-01, D-02, D-06).
    photos: {
      label: 'Reference photos',
      optional: '(optional)',
      dropTitle: 'Drop your logo, sketch or photo, or ',
      browse: 'browse',
      takePhoto: 'Take Photo',
      choosePhotos: 'Choose Photos',
      hint: (limit: string, max: number) =>
        `JPG, PNG, WebP or HEIC photos, up to ${limit} each, up to ${String(max)}. Have a PDF or AI file? Send it to us on Messenger.`,
      listName: 'Photos to send',
      remove: (fileName: string) => `Remove ${fileName}`,
      count: (count: number, max: number) => `${String(count)} of ${String(max)} photos`,
      noPreview: 'No preview',
      limit: (max: number) => `That's ${String(max)} photos, the most one request can take. Remove one to add another.`,
      // The server's own words for a refused file (D-01, D-02, D-06).
      refused: {
        type: (fileName: string) =>
          `${fileName} isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.`,
        size: (fileName: string, limit: string) =>
          `${fileName} is over ${limit}. Send a smaller photo, or send it on Messenger.`,
        unreadable: (fileName: string) => `${fileName} couldn't be read. Try another photo.`,
      },
      leftOut: (max: number, count: number) =>
        count === 1
          ? `You can send up to ${String(max)} photos. 1 of the photos you picked wasn't added.`
          : `You can send up to ${String(max)} photos. ${String(count)} of the photos you picked weren't added.`,
    },
  },
  footer: {
    columns: { shop: 'Shop', visit: 'Visit', contact: 'Contact' },
    links: { products: 'Products', gallery: 'Gallery', getQuote: 'Get a Quote' },
    messenger: 'Message us on Messenger',
    // D-33 (OQ-4): the squares show the short letters; the spoken name is the letters and the network.
    socials: {
      facebook: { short: 'FB', name: 'FB, CSPS on Facebook' },
      instagram: { short: 'IG', name: 'IG, CSPS on Instagram' },
      tiktok: { short: 'TT', name: 'TT, CSPS on TikTok' },
    },
    staffLogin: 'Staff Login',
    // SPEC-GAP: FT the Legal row: the three legal pages in order (D-72).
    legal: {
      label: 'Legal',
      links: [
        { text: 'Privacy Policy', to: '/privacy' },
        { text: 'Terms of Use', to: '/terms' },
        { text: 'Accessibility Statement', to: '/accessibility' },
      ],
    },
    copyright: (year: number, businessName: string) => `© ${String(year)} ${businessName}. All rights reserved.`,
    baseCopyright: (year: number, businessName: string) => `© ${String(year)} ${businessName}`,
  },
  notFound: {
    eyebrow: 'Error 404',
    headline: { plain: 'Out of', accent: 'bounds.' },
    lead: "We couldn't find that page. The link may be old or mistyped.",
    home: 'Go to Home',
    work: 'View Our Work',
  },
  states: {
    // SPEC-GAP: the loading regions' names.
    loading: {
      page: 'Loading the page…',
      products: 'Loading the product lines…',
      gallery: 'Loading the gallery…',
      contact: 'Loading our contact details…',
    },
    // SPEC-GAP: what a loading region says when it is done.
    loaded: { products: 'The product lines loaded.', page: 'The page loaded.', gallery: 'The gallery loaded.' },
    errors: {
      products: "Couldn't load the product lines.",
      gallery: "Couldn't load the gallery.",
      contact: "Couldn't load our contact details.",
      body: 'Check your internet connection and try again.',
      retry: 'Try Again',
    },
  },
} as const;
