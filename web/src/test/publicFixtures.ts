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

/** Puts the server's boot block into the document, as the shell carries it; /products also carries the product lines. */
export function putBootBlock(site: PublicSiteFixture, productLines?: PublicProductLinesFixture): void {
  removeBootBlock();
  const block = document.createElement('script');
  block.type = 'application/json';
  block.id = 'csps-boot';
  block.textContent = JSON.stringify(productLines === undefined ? { site } : { site, productLines });
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
