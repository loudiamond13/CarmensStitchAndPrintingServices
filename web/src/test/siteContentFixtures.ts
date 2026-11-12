// Site Content fixtures for component, hook and service tests (plan 11-12): the staff view of the demo shop's settings as
// GET /api/v1/site-settings answers it, and an MSW backend that records every save. Every value is made up.
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { buildOrderList } from '@/test/orderFixtures';
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

// Hours and closures (plan 11-16): the staff view of the weekly hours and the closure list as the API answers them, with an MSW backend
// for each that records every call.
export type OpeningHoursFixture = Schemas['OpeningHoursDto'];
export type OpeningHoursBody = Schemas['UpdateOpeningHoursRequest'];
export type ShopClosureFixture = Schemas['ShopClosureDto'];
export type ShopClosureBody = Schemas['ShopClosureRequest'];

/** The demo week: Monday to Saturday 9:00 AM to 6:00 PM, Sunday closed. */
export const demoOpeningHours: OpeningHoursFixture = {
  days: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    opensAt: day <= 6 ? '09:00' : null,
    closesAt: day <= 6 ? '18:00' : null,
  })),
  updatedByName: 'Carmen Reyes',
  updatedAtUtc: '2026-10-06T02:30:00Z',
  version: 'AAAAAAAAC9E=',
};

/** The version the fake API gives the week after save number `n`. */
export function hoursVersionAfter(n: number): string {
  return `AAAAAAAAC${String(n).padStart(2, '0')}=`;
}

export interface OpeningHoursBackend {
  current: OpeningHoursFixture;
  gets: number;
  puts: OpeningHoursBody[];
}

export interface OpeningHoursBackendOptions {
  /** Answers a save instead of the default success. Return undefined to let it go through (it may wait first). */
  onPut?: (
    body: OpeningHoursBody,
    backend: OpeningHoursBackend,
  ) => Response | undefined | Promise<Response | undefined>;
  /** Answers a read instead of the default success. */
  onGet?: (backend: OpeningHoursBackend) => Response | undefined;
}

/** Answers GET and PUT /api/v1/opening-hours from `initial`, keeps what a save left, and records every call. */
export function openingHoursBackend(
  initial: OpeningHoursFixture = demoOpeningHours,
  options: OpeningHoursBackendOptions = {},
): OpeningHoursBackend {
  const backend: OpeningHoursBackend = { current: initial, gets: 0, puts: [] };
  server.use(
    http.get('*/api/v1/opening-hours', () => {
      backend.gets += 1;
      return options.onGet?.(backend) ?? HttpResponse.json(backend.current);
    }),
    http.put('*/api/v1/opening-hours', async ({ request }) => {
      const body = (await request.json()) as OpeningHoursBody;
      backend.puts.push(body);
      const answer = await options.onPut?.(body, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.current = {
        ...backend.current,
        days: (body.days ?? []).map((day) => ({ ...day })),
        version: hoursVersionAfter(backend.puts.length),
        updatedByName: 'Carmen Reyes',
        updatedAtUtc: '2026-10-07T03:00:00Z',
      };
      return HttpResponse.json(backend.current);
    }),
  );
  return backend;
}

/** Two upcoming closures: one day with a note, and three days with none. */
export const demoClosures: ShopClosureFixture[] = [
  {
    id: '6f1c2a10-0000-4000-8000-000000000001',
    firstDay: '2026-12-25',
    lastDay: '2026-12-25',
    note: 'Christmas',
    version: 'AAAAAAAAD01=',
  },
  {
    id: '6f1c2a10-0000-4000-8000-000000000002',
    firstDay: '2026-12-30',
    lastDay: '2027-01-01',
    note: null,
    version: 'AAAAAAAAD02=',
  },
];

export interface ShopClosuresBackend {
  /** The closures the API lists, by first day. */
  current: ShopClosureFixture[];
  gets: number;
  /** Every add: the body and the Idempotency-Key it carried. */
  posts: { body: ShopClosureBody; key: string | null }[];
  /** Every edit: the closure id and the body. */
  puts: { id: string; body: ShopClosureBody }[];
  /** The id of every delete. */
  deletes: string[];
}

export interface ShopClosuresBackendOptions {
  onPost?: (
    body: ShopClosureBody,
    backend: ShopClosuresBackend,
  ) => Response | undefined | Promise<Response | undefined>;
  onPut?: (
    id: string,
    body: ShopClosureBody,
    backend: ShopClosuresBackend,
  ) => Response | undefined | Promise<Response | undefined>;
  onDelete?: (id: string, backend: ShopClosuresBackend) => Response | undefined | Promise<Response | undefined>;
  onGet?: (backend: ShopClosuresBackend) => Response | undefined;
}

function byFirstDay(list: ShopClosureFixture[]): ShopClosureFixture[] {
  return [...list].sort((a, b) => a.firstDay.localeCompare(b.firstDay));
}

/** Answers the four /api/v1/shop-closures routes from `initial`, keeps what the writes left, and records every call. */
export function shopClosuresBackend(
  initial: ShopClosureFixture[] = demoClosures,
  options: ShopClosuresBackendOptions = {},
): ShopClosuresBackend {
  const backend: ShopClosuresBackend = { current: initial, gets: 0, posts: [], puts: [], deletes: [] };
  const closureOf = (body: ShopClosureBody, id: string, version: string): ShopClosureFixture => ({
    id,
    firstDay: body.firstDay ?? '',
    lastDay: body.lastDay ?? body.firstDay ?? '',
    note: body.note,
    version,
  });
  server.use(
    http.get('*/api/v1/shop-closures', () => {
      backend.gets += 1;
      return options.onGet?.(backend) ?? HttpResponse.json(byFirstDay(backend.current));
    }),
    http.post('*/api/v1/shop-closures', async ({ request }) => {
      const body = (await request.json()) as ShopClosureBody;
      backend.posts.push({ body, key: request.headers.get('Idempotency-Key') });
      const answer = await options.onPost?.(body, backend);
      if (answer !== undefined) {
        return answer;
      }
      const id = `6f1c2a10-0000-4000-8000-0000000001${String(backend.posts.length).padStart(2, '0')}`;
      const made = closureOf(body, id, 'AAAAAAAAD99=');
      backend.current = [...backend.current, made];
      return HttpResponse.json(made, { status: 201 });
    }),
    http.put('*/api/v1/shop-closures/:id', async ({ request, params }) => {
      const id = String(params.id);
      const body = (await request.json()) as ShopClosureBody;
      backend.puts.push({ id, body });
      const answer = await options.onPut?.(id, body, backend);
      if (answer !== undefined) {
        return answer;
      }
      const made = closureOf(body, id, hoursVersionAfter(backend.puts.length));
      backend.current = backend.current.map((closure) => (closure.id === id ? made : closure));
      return HttpResponse.json(made);
    }),
    http.delete('*/api/v1/shop-closures/:id', async ({ params }) => {
      const id = String(params.id);
      backend.deletes.push(id);
      const answer = await options.onDelete?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.current = backend.current.filter((closure) => closure.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return backend;
}

/** Answers the small business-today call that closure forms make (the date comes from the server, never the device). */
export function businessTodayIs(today: string): void {
  server.use(http.get('*/api/v1/orders', () => HttpResponse.json(buildOrderList([], { today }))));
}
