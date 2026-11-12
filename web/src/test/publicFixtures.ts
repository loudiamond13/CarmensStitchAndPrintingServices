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

/** Seven closed days, Monday (1) to Sunday (7): what a shop with no saved hours answers. */
const closedWeek: PublicSiteFixture['hours'] = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
  day,
  opensAt: null,
  closesAt: null,
}));

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
  hours: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    opensAt: day <= 6 ? '09:00' : null,
    closesAt: day <= 6 ? '18:00' : null,
  })),
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
