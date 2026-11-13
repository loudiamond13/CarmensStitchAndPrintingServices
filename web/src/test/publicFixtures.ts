// Public site fixtures for component and service tests (plan 11-10): fake shop facts as the API answers them, the
// same facts with every optional value left out, MSW handlers for GET /api/v1/public/site, and the boot block the
// server writes into the page. Every value is made up.
import { http, HttpResponse } from 'msw';
import { resetBootData } from '@/lib/public-data/bootData';
import { resetPublicResources } from '@/lib/public-data/publicResource';
import { server } from '@/test/msw';
import type { components } from '@/types/api.generated';

export type PublicSiteFixture = components['schemas']['PublicSiteDto'];
export type PublicPhoneFixture = components['schemas']['PublicPhoneDto'];

export type OpenStatusFixture = components['schemas']['OpenStatusDto'];
export type PublicProductLinesFixture = components['schemas']['PublicProductLinesDto'];
export type PublicProductLineFixture = components['schemas']['PublicProductLineDto'];
export type PublicPhotoFixture = components['schemas']['PublicPhotoDto'];
export type PublicHomeFixture = components['schemas']['PublicHomeDto'];
export type PublicHomeLineFixture = components['schemas']['PublicHomeLineDto'];
export type PublicTestimonialFixture = components['schemas']['PublicTestimonialDto'];

/** Seven closed days, Monday (1) to Sunday (7): what a shop with no saved hours answers. */
export const closedWeek: PublicSiteFixture['hours'] = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
  day,
  opensAt: null,
  closesAt: null,
}));

/** Monday to Saturday 9:00 AM to 6:00 PM, Sunday closed. */
export const demoWeek: PublicSiteFixture['hours'] = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
  day,
  opensAt: day <= 6 ? '09:00' : null,
  closesAt: day <= 6 ? '18:00' : null,
}));

/** Monday to Friday 9:00 AM to 6:00 PM, Saturday 9:00 AM to 5:00 PM, Sunday closed. */
export const mixedWeek: PublicSiteFixture['hours'] = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
  day,
  opensAt: day <= 6 ? '09:00' : null,
  closesAt: day <= 5 ? '18:00' : day === 6 ? '17:00' : null,
}));

const NO_CLOSURE = { closedToday: false, todayClosureNote: null } as const;

/** What the server answers at 8:59 AM on a Monday: still closed, opening today. */
export const openStatusAt0859: OpenStatusFixture = {
  isOpen: false,
  closesAt: null,
  ...NO_CLOSURE,
  nextOpening: { date: '2026-11-16', day: 1, opensAt: '09:00', when: 'today' },
};

/** At 9:00 AM on a Monday: open until 6:00 PM. */
export const openStatusAt0900: OpenStatusFixture = {
  isOpen: true,
  closesAt: '18:00',
  ...NO_CLOSURE,
  nextOpening: null,
};

/** At 5:59 PM on a Monday: still open until 6:00 PM. */
export const openStatusAt1759: OpenStatusFixture = { ...openStatusAt0900 };

/** At 6:00 PM on a Monday: closed, opening tomorrow. */
export const openStatusAt1800: OpenStatusFixture = {
  isOpen: false,
  closesAt: null,
  ...NO_CLOSURE,
  nextOpening: { date: '2026-11-17', day: 2, opensAt: '09:00', when: 'tomorrow' },
};

/** On a closure day (Christmas): closed, opening on Saturday. */
export const closureToday: OpenStatusFixture = {
  isOpen: false,
  closesAt: null,
  closedToday: true,
  todayClosureNote: 'Christmas',
  nextOpening: { date: '2026-12-26', day: 6, opensAt: '09:00', when: 'weekday' },
};

/** On a Sunday: closed, opening on Monday. */
export const sundayClosed: OpenStatusFixture = {
  isOpen: false,
  closesAt: null,
  ...NO_CLOSURE,
  nextOpening: { date: '2026-11-16', day: 1, opensAt: '09:00', when: 'weekday' },
};

/** The demo shop: every optional value set except TikTok, two numbers with the Globe one main. */
export const demoSite: PublicSiteFixture = {
  businessName: 'Sample Shop',
  tagline: 'Custom tailoring and full-sublimation printing for teams, leagues and riding groups.',
  aboutText: 'A demo shop for tests.',
  turnaroundLine: null,
  address: {
    street: '12 Sample St., Poblacion',
    townOrCity: 'Sample City',
    province: 'Sample Province',
    postalCode: '1000',
  },
  phones: [
    { display: '0917 123 4567', e164: '+639171234567', label: 'Globe', isMain: true },
    { display: '02 8123 4567', e164: '+63281234567', label: null, isMain: false },
  ],
  messengerUrl: 'https://m.me/cspsdemo',
  facebookUrl: 'https://www.facebook.com/cspsdemo',
  instagramUrl: 'https://www.instagram.com/cspsdemo',
  tiktokUrl: null,
  directionsUrl: 'https://maps.app.goo.gl/cspsdemo',
  mapEmbedUrl: 'https://www.google.com/maps/embed?pb=cspsdemo',
  year: 2026,
  hours: demoWeek,
  upcomingClosures: [],
};

/** The same shop with every optional value left out: one number, no links, no postal code. */
export const siteWithoutOptionals: PublicSiteFixture = {
  businessName: 'Sample Shop',
  tagline: 'Sample tagline',
  aboutText: null,
  turnaroundLine: null,
  address: {
    street: '12 Sample St., Poblacion',
    townOrCity: 'Sample City',
    province: 'Sample Province',
    postalCode: null,
  },
  phones: [{ display: '0917 123 4567', e164: '+639171234567', label: null, isMain: true }],
  messengerUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  directionsUrl: null,
  mapEmbedUrl: null,
  year: 2026,
  hours: closedWeek,
  upcomingClosures: [],
};

/** The demo shop with three numbers: the main one, a landline and a labelled mobile. */
export const siteWithThreePhones: PublicSiteFixture = {
  ...demoSite,
  phones: [
    { display: '0917 123 4567', e164: '+639171234567', label: null, isMain: true },
    { display: '02 8123 4567', e164: '+63281234567', label: null, isMain: false },
    { display: '0918 765 4321', e164: '+639187654321', label: 'Globe', isMain: false },
  ],
};

/** An MSW handler that answers GET /api/v1/public/site with `site`. */
export function siteHandler(site: PublicSiteFixture) {
  return http.get('*/api/v1/public/site', () => HttpResponse.json(site));
}

/** An MSW handler that answers GET /api/v1/public/site with a failure. */
export function siteFailureHandler(status = 500) {
  return http.get('*/api/v1/public/site', () =>
    HttpResponse.json(
      { title: 'Something went wrong.', status },
      { status, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  );
}

/** Answers the site read with `site` for the rest of the test. */
export function answerSite(site: PublicSiteFixture): void {
  server.use(siteHandler(site));
}

/** An MSW handler that answers GET /api/v1/public/open-status with `status`. */
export function openStatusHandler(status: OpenStatusFixture) {
  return http.get('*/api/v1/public/open-status', () => HttpResponse.json(status));
}

/** An MSW handler that answers GET /api/v1/public/open-status with a failure. */
export function openStatusFailureHandler(status = 500) {
  return http.get('*/api/v1/public/open-status', () =>
    HttpResponse.json(
      { title: 'Something went wrong.', status },
      { status, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  );
}

/** Answers the open-status read with `status` for the rest of the test. */
export function answerOpenStatus(status: OpenStatusFixture): void {
  server.use(openStatusHandler(status));
}

/** Puts the server's boot block into the document, as the shell carries it; /products also carries the product lines and / the home data. */
export function putBootBlock(
  site: PublicSiteFixture,
  productLines?: PublicProductLinesFixture,
  home?: PublicHomeFixture,
): void {
  removeBootBlock();
  const block = document.createElement('script');
  block.type = 'application/json';
  block.id = 'csps-boot';
  block.textContent = JSON.stringify({
    site,
    ...(productLines === undefined ? {} : { productLines }),
    ...(home === undefined ? {} : { home }),
  });
  document.head.append(block);
}

/** Takes the boot block out of the document. */
export function removeBootBlock(): void {
  document.getElementById('csps-boot')?.remove();
}

/** Forgets every public read and the boot block, so one test never sees another's data. */
export function resetPublicData(): void {
  removeBootBlock();
  resetBootData();
  resetPublicResources();
}

const NO_PHOTOS: PublicProductLineFixture['photos'] = { main: null, back: null, fabric: null };

/** A product line as the API answers it; every part can be overridden. Made-up texts. */
export function makeLine(overrides: Partial<PublicProductLineFixture> & { key: string }): PublicProductLineFixture {
  return {
    title: 'Sample Jerseys',
    shortName: 'Sample',
    number: '00',
    cardText: 'A sample card text.',
    description: 'A sample description.',
    customize: {
      fabric: 'Sample fabric text',
      collar: 'Sample collar text',
      cut: 'Sample cut text',
      names: 'Sample names text',
      logos: 'Sample logos text',
    },
    startsAtPrice: null,
    minimumQuantity: null,
    placeholderArt: 'basketball',
    photos: NO_PHOTOS,
    hasGalleryItems: false,
    ...overrides,
  };
}

/** The six starting lines: basketball has a price, a minimum and gallery work; volleyball has neither price nor minimum. */
export const demoLines: PublicProductLinesFixture = {
  lines: [
    makeLine({
      key: 'basketball',
      title: 'Basketball Jerseys',
      shortName: 'Basketball',
      number: '23',
      description: 'Game-ready tops and shorts, printed edge to edge in any colorway.',
      customize: {
        fabric: 'Dri-fit mesh, aircool or spandex blend',
        collar: 'V-neck, round or layered',
        cut: "Standard, slim, women's fit and kids",
        names: 'Any font: front, back and shorts',
        logos: 'Team crest, sponsors and barangay seal in full color',
      },
      startsAtPrice: 650,
      minimumQuantity: 10,
      placeholderArt: 'basketball',
      hasGalleryItems: true,
    }),
    makeLine({
      key: 'volleyball',
      title: 'Volleyball Jerseys',
      shortName: 'Volleyball',
      number: '11',
      description: 'Light, stretchy and quick-drying for every dig and spike, indoor or beach.',
      placeholderArt: 'volleyball',
    }),
    makeLine({
      key: 'moto',
      title: 'Moto Riding Jerseys',
      shortName: 'Moto',
      number: '07',
      description: "Long-sleeve riding tops that breathe on long hauls and keep your club's colors loud on the road.",
      minimumQuantity: 5,
      placeholderArt: 'moto',
    }),
    makeLine({
      key: 'longsleeves',
      title: 'Long Sleeves',
      shortName: 'Long Sleeves',
      number: '14',
      description: 'Warm-ups, shooting shirts and everyday dri-fit long sleeves for training days and team events.',
      placeholderArt: 'longSleeves',
    }),
    makeLine({
      key: 'polo',
      title: 'Polo Shirts',
      shortName: 'Polo',
      number: '03',
      description: 'Clean polos for coaches, staff, reunions and company events, sublimated or plain.',
      startsAtPrice: 450,
      minimumQuantity: 1,
      placeholderArt: 'polo',
    }),
    makeLine({
      key: 'custom',
      title: 'Custom Designs',
      shortName: 'Custom',
      number: '00',
      description: 'Have only an idea or a phone photo? Our artists build the full design from scratch.',
      placeholderArt: 'custom',
    }),
  ],
};

/** One of the six starting lines by key. */
export function demoLine(key: string): PublicProductLineFixture {
  const found = demoLines.lines.find((line) => line.key === key);
  if (found === undefined) {
    throw new Error(`No demo line "${key}".`);
  }
  return found;
}

/** One shown line only. */
export const oneLine: PublicProductLinesFixture = { lines: demoLines.lines.slice(0, 1) };

/** Every line hidden by the Manager. */
export const noLines: PublicProductLinesFixture = { lines: [] };

/** A made-up delivered photo with its small sizes. */
export function photoFor(name: string): PublicPhotoFixture {
  const base = `https://res.cloudinary.com/sample-cloud/image/upload/${name}`;
  return { src: `${base}-800.jpg`, srcSet: `${base}-400.jpg 400w, ${base}-800.jpg 800w`, width: 800, height: 1000 };
}

/** The basketball line with all three photos set. */
export const lineWithPhotos: PublicProductLineFixture = {
  ...makeLine({ key: 'basketball', title: 'Basketball Jerseys', shortName: 'Basketball', number: '23' }),
  startsAtPrice: 650,
  minimumQuantity: 10,
  photos: { main: photoFor('main'), back: photoFor('back'), fabric: photoFor('fabric') },
};

/** An MSW handler that answers GET /api/v1/public/product-lines with `lines`. */
export function productLinesHandler(lines: PublicProductLinesFixture) {
  return http.get('*/api/v1/public/product-lines', () => HttpResponse.json(lines));
}

/** An MSW handler that answers GET /api/v1/public/product-lines with a failure. */
export function productLinesFailureHandler(status = 500) {
  return http.get('*/api/v1/public/product-lines', () =>
    HttpResponse.json(
      { title: 'Something went wrong.', status },
      { status, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  );
}

/** Answers the product lines read with `lines` for the rest of the test. */
export function answerProductLines(lines: PublicProductLinesFixture): void {
  server.use(productLinesHandler(lines));
}

const HOME_CARD_TEXTS: Readonly<Record<string, string>> = {
  basketball: 'Full sublimation tops and shorts, any colorway, names and numbers included.',
  volleyball: 'Lightweight, stretch-fit cuts for indoor and beach teams.',
  moto: 'Breathable long-sleeve riding tops with club crests and sponsor logos.',
  longsleeves: 'Warm-ups, shooting shirts and dri-fit long sleeves for training days.',
  polo: 'Sublimated or plain polos for coaches, staff, events and offices.',
  custom: 'Bring a sketch or just an idea. Our artists build the full design.',
};

/** A Home card for a line, as GET /api/v1/public/home answers it; every part can be overridden. */
export function makeHomeLine(
  line: PublicProductLineFixture,
  overrides: Partial<PublicHomeLineFixture> = {},
): PublicHomeLineFixture {
  return {
    key: line.key,
    number: line.number,
    title: line.title,
    cardText: HOME_CARD_TEXTS[line.key] ?? line.cardText,
    placeholderArt: line.placeholderArt,
    cardPhoto: null,
    ...overrides,
  };
}

/** A testimonial as the Home read answers it. Made-up names. */
export function makeTestimonial(overrides: Partial<PublicTestimonialFixture> = {}): PublicTestimonialFixture {
  return {
    quote: 'Seventeen pieces, names and numbers perfect.',
    name: 'Juan Dela Cruz',
    teamOrRole: 'Captain, Brgy. Sample Ballers',
    stars: 5,
    ...overrides,
  };
}

/** Three shown testimonials: five, five and four stars. */
export const demoTestimonials: readonly PublicTestimonialFixture[] = [
  makeTestimonial(),
  makeTestimonial({
    quote: 'The mockup came back in a day and the colors matched our crest.',
    name: 'Ana Reyes',
    teamOrRole: 'Coach, Sample City Spikers',
  }),
  makeTestimonial({
    quote: 'Light jerseys, and the sponsor logos printed sharp.',
    name: 'Ben Santos',
    teamOrRole: 'President, Sample Riders MC',
    stars: 4,
  }),
];

/** The demo Home: the six lines as cards (no photos), three testimonials, no recent work and no hero tag. */
export const demoHome: PublicHomeFixture = {
  lines: demoLines.lines.map((line) => makeHomeLine(line)),
  lineCount: demoLines.lines.length,
  testimonials: [...demoTestimonials],
  recentWork: [],
  heroTag: null,
};

/** Every line hidden: no category section. */
export const homeNoLines: PublicHomeFixture = { ...demoHome, lines: [], lineCount: 0 };

/** No testimonial shown: no testimonial section. */
export const homeNoTestimonials: PublicHomeFixture = { ...demoHome, testimonials: [] };

/** One shown line only. */
export const homeOneLine: PublicHomeFixture = {
  ...demoHome,
  lines: demoHome.lines.slice(0, 1),
  lineCount: 1,
};

/** An MSW handler that answers GET /api/v1/public/home with `home`. */
export function homeHandler(home: PublicHomeFixture) {
  return http.get('*/api/v1/public/home', () => HttpResponse.json(home));
}

/** An MSW handler that answers GET /api/v1/public/home with a failure. */
export function homeFailureHandler(status = 500) {
  return http.get('*/api/v1/public/home', () =>
    HttpResponse.json(
      { title: 'Something went wrong.', status },
      { status, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  );
}

/** Answers the Home read with `home` for the rest of the test. */
export function answerHome(home: PublicHomeFixture): void {
  server.use(homeHandler(home));
}

export type PublicGalleryFixture = components['schemas']['PublicGalleryDto'];
export type PublicGalleryItemFixture = components['schemas']['PublicGalleryItemDto'];
export type PublicGalleryPhotoFixture = components['schemas']['PublicGalleryPhotoDto'];
export type PublicGalleryPillFixture = components['schemas']['PublicGalleryPillDto'];
export type PublicRecentWorkFixture = components['schemas']['PublicRecentWorkDto'];

/** A made-up delivered gallery photo with its masonry, viewer and thumb addresses. */
export function galleryPhoto(name: string, width = 800, height = 1000): PublicGalleryPhotoFixture {
  const base = `https://res.cloudinary.com/sample-cloud/image/upload/${name}`;
  return {
    src: `${base}-560.jpg`,
    srcSet: `${base}-280.jpg 280w, ${base}-560.jpg 560w`,
    viewerSrc: `${base}-1200.jpg`,
    viewerSrcSet: `${base}-800.jpg 800w, ${base}-1200.jpg 1200w`,
    thumbSrc: `${base}-88.jpg`,
    width,
    height,
  };
}

const LINE_FACTS: Readonly<Record<string, { shortName: string; art: string }>> = {
  basketball: { shortName: 'Basketball', art: 'basketball' },
  volleyball: { shortName: 'Volleyball', art: 'volleyball' },
  moto: { shortName: 'Moto', art: 'moto' },
  longsleeves: { shortName: 'Long Sleeves', art: 'longSleeves' },
  polo: { shortName: 'Polo', art: 'polo' },
  custom: { shortName: 'Custom', art: 'custom' },
};

function slugOf(text: string): string {
  return text.replace(/\W+/g, '-').toLowerCase();
}

/** A gallery item as the API answers it; the line facts come from the key and every part can be overridden. */
export function makeGalleryItem(
  overrides: Partial<PublicGalleryItemFixture> & { team: string; lineKey: string },
): PublicGalleryItemFixture {
  const facts = LINE_FACTS[overrides.lineKey] ?? { shortName: 'Sample', art: 'custom' };
  return {
    id: `00000000-0000-4000-8000-${String(overrides.team.length).padStart(12, '0')}`,
    lineShortName: facts.shortName,
    note: null,
    photos: [galleryPhoto(slugOf(overrides.team))],
    pieces: 17,
    placeholderArt: facts.art,
    ...overrides,
  };
}

/** The pills for a list of items: one per line that has an item, in the order the lines first appear. */
export function pillsFor(items: readonly PublicGalleryItemFixture[]): PublicGalleryPillFixture[] {
  const pills: PublicGalleryPillFixture[] = [];
  for (const item of items) {
    const pill = pills.find((candidate) => candidate.key === item.lineKey);
    if (pill === undefined) {
      pills.push({ key: item.lineKey, shortName: item.lineShortName, count: 1 });
    } else {
      pill.count = Number(pill.count) + 1;
    }
  }
  return pills;
}

/** A gallery answer for the items: the pills and the total follow from them. */
export function makeGallery(items: readonly PublicGalleryItemFixture[]): PublicGalleryFixture {
  return { items: [...items], pills: pillsFor(items), total: items.length };
}

const DEMO_TEAMS: readonly (readonly [string, string])[] = [
  ['Brgy. Sample Ballers', 'basketball'],
  ['Sample City Hoops', 'basketball'],
  ['Poblacion Fastbreak', 'basketball'],
  ['Riverside Rim Rockers', 'basketball'],
  ['Sample City Spikers', 'volleyball'],
  ['Beach Dig Squad', 'volleyball'],
  ['Net Ninjas', 'volleyball'],
  ['Sample Riders MC', 'moto'],
  ['Trail Hawks Riding Club', 'moto'],
  ['Highway Brothers', 'moto'],
  ['Morning Run Club', 'longsleeves'],
  ['Shooting Shirts Co.', 'longsleeves'],
  ['Sample Office Polo', 'polo'],
  ['Alumni Reunion 2026', 'polo'],
  ['Barkada Custom One', 'custom'],
  ['Barkada Custom Two', 'custom'],
];

/** Photo sizes in turn: tall, square, wide, very wide, very tall, and no size at all (0 by 0). */
const DEMO_SIZES: readonly (readonly [number, number])[] = [
  [800, 1000],
  [900, 900],
  [1200, 900],
  [1000, 400],
  [300, 1000],
  [0, 0],
];

/** Sixteen shown items over the six lines (basketball 4, volleyball 3, moto 3, long sleeves 2, polo 2, custom 2); the first has four photos. */
export const demoGallery: PublicGalleryFixture = makeGallery(
  DEMO_TEAMS.map(([team, lineKey], index) => {
    const [width, height] = DEMO_SIZES[index % DEMO_SIZES.length] ?? [800, 1000];
    const slug = slugOf(team);
    return makeGalleryItem({
      team,
      lineKey,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      pieces: index === 5 ? null : index === 6 ? 1 : 10 + index,
      photos:
        index === 0
          ? [1, 2, 3, 4].map((number) => galleryPhoto(`${slug}-${String(number)}`, width, height))
          : [galleryPhoto(slug, width, height)],
    });
  }),
);

/** Nothing shown: no items and no pills. */
export const emptyGallery: PublicGalleryFixture = { items: [], pills: [], total: 0 };

/** Sixty items, 40 basketball then 20 volleyball, for the 24 at a time paging. */
export const largeGallery: PublicGalleryFixture = makeGallery(
  Array.from({ length: 60 }, (_, index) =>
    makeGalleryItem({
      team: `Team ${String(index + 1)}`,
      lineKey: index < 40 ? 'basketball' : 'volleyball',
      id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    }),
  ),
);

/** An MSW handler that answers GET /api/v1/public/gallery with `gallery`. */
export function galleryHandler(gallery: PublicGalleryFixture) {
  return http.get('*/api/v1/public/gallery', () => HttpResponse.json(gallery));
}

/** An MSW handler that answers GET /api/v1/public/gallery with a failure. */
export function galleryFailureHandler(status = 500) {
  return http.get('*/api/v1/public/gallery', () =>
    HttpResponse.json(
      { title: 'Something went wrong.', status },
      { status, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  );
}

/** Answers the gallery read with `gallery` for the rest of the test. */
export function answerGallery(gallery: PublicGalleryFixture): void {
  server.use(galleryHandler(gallery));
}

/** A Recent work tile as the Home read answers it, with a strip photo unless `photo` is null. */
export function makeRecentWork(
  overrides: Partial<PublicRecentWorkFixture> & { team: string; lineKey: string },
): PublicRecentWorkFixture {
  const facts = LINE_FACTS[overrides.lineKey] ?? { shortName: 'Sample', art: 'custom' };
  return {
    lineShortName: facts.shortName,
    photo: photoFor(slugOf(overrides.team)),
    pieces: 17,
    placeholderArt: facts.art,
    ...overrides,
  };
}

/** Six recent orders, newest first. */
export const demoRecentWork: readonly PublicRecentWorkFixture[] = [
  makeRecentWork({ team: 'Brgy. Sample Ballers', lineKey: 'basketball' }),
  makeRecentWork({ team: 'Sample City Spikers', lineKey: 'volleyball', pieces: 12 }),
  makeRecentWork({ team: 'Sample Riders MC', lineKey: 'moto', pieces: 1 }),
  makeRecentWork({ team: 'Sample Office Polo', lineKey: 'polo', photo: null }),
  makeRecentWork({ team: 'Barkada Custom One', lineKey: 'custom', pieces: null }),
  makeRecentWork({ team: 'Sample City Hoops', lineKey: 'basketball', pieces: 20 }),
];

/** The demo Home with six recent orders and the newest as the hero tag. */
export const homeWithWork: PublicHomeFixture = {
  ...demoHome,
  recentWork: [...demoRecentWork],
  heroTag: { name: 'Brgy. Sample Ballers', pieces: 17 },
};
