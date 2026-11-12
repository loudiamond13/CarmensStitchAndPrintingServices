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

/** Puts the server's boot block into the document, as the shell carries it. */
export function putBootBlock(site: PublicSiteFixture): void {
  removeBootBlock();
  const block = document.createElement('script');
  block.type = 'application/json';
  block.id = 'csps-boot';
  block.textContent = JSON.stringify({ site });
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
