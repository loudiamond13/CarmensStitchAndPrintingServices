// Site Content fixtures for component, hook and service tests (plan 11-12): the staff view of the demo shop's settings as
// GET /api/v1/site-settings answers it, and an MSW backend that records every save. Every value is made up.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type SiteSettingsFixture = Schemas['SiteSettingsDto'];
export type SiteSettingsBody = Schemas['UpdateSiteSettingsRequest'];

/** The demo shop as a Manager's form opens it: every optional value set except TikTok, two numbers with the Globe one main. */
export const demoSiteSettings: SiteSettingsFixture = {
  businessName: 'Sample Shop',
  tagline: 'Custom tailoring and full-sublimation printing for teams, leagues and riding groups.',
  aboutText: 'A demo shop for tests.',
  turnaroundLine: null,
  street: '12 Sample St., Poblacion',
  townOrCity: 'Sample City',
  province: 'Sample Province',
  postalCode: '1000',
  directionsUrl: 'https://maps.app.goo.gl/cspsdemo',
  mapEmbedUrl: 'https://www.google.com/maps/embed?pb=cspsdemo',
  messengerUrl: 'https://m.me/cspsdemo',
  facebookUrl: 'https://www.facebook.com/cspsdemo',
  instagramUrl: 'https://www.instagram.com/cspsdemo',
  tiktokUrl: null,
  contactEmail: 'shop@example.test',
  phones: [
    { number: '0917 123 4567', label: 'Globe', isMain: true },
    { number: '02 8123 4567', label: null, isMain: false },
  ],
  timeZoneId: 'Asia/Manila',
  currencyCode: 'PHP',
  locale: 'en-PH',
  version: 'AAAAAAAAB9E=',
  updatedByName: 'Carmen Reyes',
  updatedAtUtc: '2026-10-06T02:30:00Z',
};

/** The version the fake API gives the settings after save number `n`. */
export function versionAfter(n: number): string {
  return `AAAAAAAAB${String(n).padStart(2, '0')}=`;
}

/** What the fake API holds and received. */
export interface SiteSettingsBackend {
  /** The settings the API answers a read with; a save replaces it. */
  current: SiteSettingsFixture;
  /** How many reads and saves arrived. */
  gets: number;
  /** Every save body, in order. */
  puts: SiteSettingsBody[];
}

export interface SiteSettingsBackendOptions {
  /** Answers a save instead of the default success (a 409, a 400). Return undefined to let the save go through (it may wait first). */
  onPut?: (
    body: SiteSettingsBody,
    backend: SiteSettingsBackend,
  ) => Response | undefined | Promise<Response | undefined>;
}

/** The settings a save leaves behind: the body's values, the next version and the signed-in Manager as the last changer. */
export function savedSettings(
  body: SiteSettingsBody,
  previous: SiteSettingsFixture,
  version: string,
): SiteSettingsFixture {
  return {
    ...previous,
    businessName: body.businessName ?? '',
    tagline: body.tagline ?? '',
    aboutText: body.aboutText,
    turnaroundLine: body.turnaroundLine,
    street: body.street,
    townOrCity: body.townOrCity,
    province: body.province,
    postalCode: body.postalCode,
    directionsUrl: body.directionsUrl,
    mapEmbedUrl: body.mapEmbedUrl,
    messengerUrl: body.messengerUrl,
    facebookUrl: body.facebookUrl,
    instagramUrl: body.instagramUrl,
    tiktokUrl: body.tiktokUrl,
    contactEmail: body.contactEmail,
    phones: (body.phones ?? []).map((phone) => ({
      number: phone.number ?? '',
      label: phone.label,
      isMain: phone.isMain,
    })),
    version,
    updatedByName: 'Carmen Reyes',
    updatedAtUtc: '2026-10-07T03:00:00Z',
  };
}

/** A problem+json answer with a machine code and, for a 400, the server's field errors. */
export function problemAnswer(
  status: number,
  extra: { code?: string; errors?: Record<string, string[]> } = {},
): Response {
  return new HttpResponse(JSON.stringify({ title: 'x', status, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/** Answers GET and PUT /api/v1/site-settings from `initial`, keeps what a save left, and records every call. */
export function siteSettingsBackend(
  initial: SiteSettingsFixture = demoSiteSettings,
  options: SiteSettingsBackendOptions = {},
): SiteSettingsBackend {
  const backend: SiteSettingsBackend = { current: initial, gets: 0, puts: [] };
  server.use(
    http.get('*/api/v1/site-settings', () => {
      backend.gets += 1;
      return HttpResponse.json(backend.current);
    }),
    http.put('*/api/v1/site-settings', async ({ request }) => {
      const body = (await request.json()) as SiteSettingsBody;
      backend.puts.push(body);
      const answer = await options.onPut?.(body, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.current = savedSettings(body, backend.current, versionAfter(backend.puts.length));
      return HttpResponse.json(backend.current);
    }),
  );
  return backend;
}
