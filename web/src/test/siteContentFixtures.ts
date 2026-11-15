// Site Content fixtures for component, hook and service tests (plan 11-12): the staff view of the demo shop's settings as
// GET /api/v1/site-settings answers it, and an MSW backend that records every save. Every value is made up.
import { http, HttpResponse } from 'msw';
import { HttpError } from '@/core/api/errors';
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
  sharePicture: null,
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
  extra: { code?: string; detail?: string; errors?: Record<string, string[]> } = {},
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

export type SharePictureFixture = Schemas['SharePictureDto'];

/** The link preview picture as the settings read answers it, on the Testing image address. `id` tells two pictures apart. */
export function sharePicture(id = 'demo', overrides: Partial<SharePictureFixture> = {}): SharePictureFixture {
  const address = (size: string): string => `/api/testing/images/csps/content/share/${id}?size=${size}`;
  return {
    src320: address('csps_share_320'),
    src640: address('csps_share_640'),
    width: 1200,
    height: 630,
    ...overrides,
  };
}

/** The version the fake API gives the settings after picture change number `n` (a picture change moves the row version, 11-30). */
export function pictureVersionAfter(n: number): string {
  return `AAAAAAAAC${String(n).padStart(2, '0')}=`;
}

export interface SharePictureBackend {
  /** Every upload: its Idempotency-Key and content type (the form body is jsdom's, so it is not read). */
  uploads: { key: string | null; contentType: string | null }[];
  /** How many removals arrived. */
  removals: number;
}

export interface SharePictureBackendOptions {
  /** Answers an upload instead of the default success. Return undefined to let it go through (it may wait first). */
  onUpload?: (backend: SharePictureBackend) => Response | undefined | Promise<Response | undefined>;
  /** Answers a removal instead of the default 204. */
  onRemove?: (backend: SharePictureBackend) => Response | undefined | Promise<Response | undefined>;
}

/**
 * Answers POST and DELETE /api/v1/site-settings/share-picture on top of `settings`: an upload puts a new picture on the settings and moves the
 * row version, a removal empties it and moves the version again, and every call is recorded.
 */
export function sharePictureBackend(
  settings: SiteSettingsBackend,
  options: SharePictureBackendOptions = {},
): SharePictureBackend {
  const backend: SharePictureBackend = { uploads: [], removals: 0 };
  let changes = 0;
  const change = (picture: SharePictureFixture | null): void => {
    changes += 1;
    settings.current = {
      ...settings.current,
      sharePicture: picture,
      version: pictureVersionAfter(changes),
      updatedByName: 'Carmen Reyes',
      updatedAtUtc: '2026-10-08T03:00:00Z',
    };
  };
  server.use(
    http.post('*/api/v1/site-settings/share-picture', async ({ request }) => {
      backend.uploads.push({
        key: request.headers.get('Idempotency-Key'),
        contentType: request.headers.get('Content-Type'),
      });
      const answer = await options.onUpload?.(backend);
      if (answer !== undefined) {
        return answer;
      }
      const made = sharePicture(`upload-${String(backend.uploads.length)}`);
      change(made);
      return HttpResponse.json(made);
    }),
    http.delete('*/api/v1/site-settings/share-picture', async () => {
      backend.removals += 1;
      const answer = await options.onRemove?.(backend);
      if (answer !== undefined) {
        return answer;
      }
      change(null);
      return new HttpResponse(null, { status: 204 });
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

// Product lines (plan 11-20): the Manager's list and detail as /api/v1/product-lines answers them, the order product types the editor files
// under a line, and an MSW backend that keeps what each write left and records every call. Every value is made up.
export type ProductLineListFixture = Schemas['ProductLineListItemDto'];
export type ProductLineDetailFixture = Schemas['ProductLineDetailDto'];
export type ProductLineBody = Schemas['ProductLineRequest'];
export type MoveProductLineBody = Schemas['MoveProductLineRequest'];

/** The id of each demo line, in the Manager's order. */
export const LINE_IDS = {
  basketball: '8c1f4a20-0000-4000-8000-000000000001',
  volleyball: '8c1f4a20-0000-4000-8000-000000000002',
  moto: '8c1f4a20-0000-4000-8000-000000000003',
  longSleeves: '8c1f4a20-0000-4000-8000-000000000004',
  polo: '8c1f4a20-0000-4000-8000-000000000005',
  custom: '8c1f4a20-0000-4000-8000-000000000006',
} as const;

/** The order product types of the line editor. */
export const LINE_TYPE_IDS = {
  basketball: '5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0001',
  cycling: '5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0002',
  old: '5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0003',
  volleyball: '5d3a7c1e-0a41-4f6c-9d0b-2b1f6a8e0004',
} as const;

type ProductTypeFixture = Schemas['OrderListItem'];

function productType(id: string, name: string, status: 'active' | 'retired', tone: string): ProductTypeFixture {
  return { id, name, tone, status, isOthers: false, useCount: 0 };
}

/** The order product types as the API lists them: A to Z, one retired. */
export const demoLineProductTypes: ProductTypeFixture[] = [
  productType(LINE_TYPE_IDS.basketball, 'Basketball Jersey', 'active', 'accent'),
  productType(LINE_TYPE_IDS.cycling, 'Cycling Jersey', 'active', 'info'),
  productType(LINE_TYPE_IDS.old, 'Old Style Jersey', 'retired', 'neutral'),
  productType(LINE_TYPE_IDS.volleyball, 'Volleyball Jersey', 'active', 'success'),
];

interface DemoLineRow {
  key: keyof typeof LINE_IDS;
  title: string;
  shortName: string;
  number: string;
  price: number | null;
  minimum: number | null;
  art: string;
  types: string[];
}

const demoLineRows: readonly DemoLineRow[] = [
  {
    key: 'basketball',
    title: 'Basketball Jerseys',
    shortName: 'Basketball',
    number: '23',
    price: 650,
    minimum: 10,
    art: 'basketball',
    types: [LINE_TYPE_IDS.basketball],
  },
  {
    key: 'volleyball',
    title: 'Volleyball Jerseys',
    shortName: 'Volleyball',
    number: '7',
    price: null,
    minimum: null,
    art: 'volleyball',
    types: [LINE_TYPE_IDS.volleyball],
  },
  {
    key: 'moto',
    title: 'Moto and Riding Jerseys',
    shortName: 'Moto',
    number: '99',
    price: null,
    minimum: null,
    art: 'moto',
    types: [],
  },
  {
    key: 'longSleeves',
    title: 'Long Sleeves',
    shortName: 'Long Sleeves',
    number: '11',
    price: null,
    minimum: null,
    art: 'longSleeves',
    types: [],
  },
  {
    key: 'polo',
    title: 'Polo Shirts',
    shortName: 'Polo',
    number: '',
    price: null,
    minimum: null,
    art: 'polo',
    types: [],
  },
  {
    key: 'custom',
    title: 'Custom Designs',
    shortName: 'Custom',
    number: '',
    price: null,
    minimum: null,
    art: 'custom',
    types: [],
  },
];

/** One demo line as the editor reads it: shown, at its place in the order, with the five customize texts. */
export function demoLineDetail(
  key: keyof typeof LINE_IDS,
  overrides: Partial<ProductLineDetailFixture> = {},
): ProductLineDetailFixture {
  const index = demoLineRows.findIndex((row) => row.key === key);
  const row = demoLineRows[index];
  if (row === undefined) {
    throw new Error(`No demo line ${key}.`);
  }
  return {
    id: LINE_IDS[key],
    key: row.shortName.toLowerCase().replaceAll(' ', '-'),
    title: row.title,
    shortName: row.shortName,
    number: row.number,
    cardText: `Card text of ${row.title}.`,
    description: `Description of ${row.title}.`,
    fabricText: 'Light, stretchy fabric.',
    collarText: 'Round or V collar.',
    cutText: 'Regular or slim cut.',
    namesText: 'Any font for names and numbers.',
    logosText: 'Team and sponsor logos.',
    startsAtPrice: row.price,
    minimumQuantity: row.minimum,
    isActive: true,
    placeholderArt: row.art,
    position: index + 1,
    productTypeIds: row.types,
    createdAtUtc: '2026-10-06T02:30:00Z',
    updatedAtUtc: null,
    updatedByName: null,
    version: `AAAAAAAAE0${String(index + 1)}=`,
    photos: { main: null, back: null, fabric: null },
    ...overrides,
  };
}

/** The six demo lines, in order. */
export function demoLines(): ProductLineDetailFixture[] {
  return demoLineRows.map((row) => demoLineDetail(row.key));
}

/** What a line has filed under it besides product types: photos and shown gallery items, and the small main photo. */
export interface LineUse {
  photos?: number;
  gallery?: number;
  thumb?: string | null;
}

/** The list row of a line: Delete is offered when it has no product type, no photo and no gallery item. */
export function lineListItem(line: ProductLineDetailFixture, use: LineUse = {}): ProductLineListFixture {
  const photos = use.photos ?? 0;
  const gallery = use.gallery ?? 0;
  return {
    id: line.id,
    key: line.key,
    title: line.title,
    shortName: line.shortName,
    startsAtPrice: line.startsAtPrice,
    minimumQuantity: line.minimumQuantity,
    isActive: line.isActive,
    position: line.position,
    productTypeIds: line.productTypeIds,
    photoCount: photos,
    shownGalleryCount: gallery,
    mainPhotoThumb: use.thumb ?? null,
    canDelete: line.productTypeIds.length === 0 && photos === 0 && gallery === 0,
    version: line.version,
  };
}

/** The version the fake API gives a line after save number `n`. */
export function lineVersionAfter(n: number): string {
  return `AAAAAAAAF${String(n).padStart(2, '0')}=`;
}

export interface ProductLinesBackend {
  /** The lines the API holds, in order. */
  lines: ProductLineDetailFixture[];
  /** What is filed under a line besides product types, by line id (the list's counts). */
  used: Record<string, LineUse>;
  /** How many list reads and detail reads arrived. */
  listGets: number;
  gets: number;
  posts: { body: ProductLineBody; key: string | null }[];
  puts: { id: string; body: ProductLineBody }[];
  moves: { id: string; direction: string | null; key: string | null }[];
  hides: string[];
  /** The Idempotency-Key of every hide call, in order. */
  hideKeys: (string | null)[];
  shows: string[];
  deletes: string[];
}

type LineAnswer = Response | undefined | Promise<Response | undefined>;

export interface ProductLinesBackendOptions {
  onGetList?: (backend: ProductLinesBackend) => LineAnswer;
  onGet?: (id: string, backend: ProductLinesBackend) => LineAnswer;
  onPost?: (body: ProductLineBody, backend: ProductLinesBackend) => LineAnswer;
  onPut?: (id: string, body: ProductLineBody, backend: ProductLinesBackend) => LineAnswer;
  onMove?: (id: string, direction: string | null, backend: ProductLinesBackend) => LineAnswer;
  onHide?: (id: string, backend: ProductLinesBackend) => LineAnswer;
  onShow?: (id: string, backend: ProductLinesBackend) => LineAnswer;
  onDelete?: (id: string, backend: ProductLinesBackend) => LineAnswer;
}

/** Gives the lines the places 1, 2, 3 in the order they are in. */
function renumbered(lines: ProductLineDetailFixture[]): ProductLineDetailFixture[] {
  return lines.map((line, index) => ({ ...line, position: index + 1 }));
}

/** Answers the eight /api/v1/product-lines routes from `initial`, keeps what each write left, and records every call. */
export function productLinesBackend(
  initial: ProductLineDetailFixture[] = demoLines(),
  options: ProductLinesBackendOptions = {},
): ProductLinesBackend {
  const backend: ProductLinesBackend = {
    lines: renumbered([...initial].sort((a, b) => Number(a.position) - Number(b.position))),
    used: {},
    listGets: 0,
    gets: 0,
    posts: [],
    puts: [],
    moves: [],
    hides: [],
    hideKeys: [],
    shows: [],
    deletes: [],
  };
  const lineOf = (id: string): ProductLineDetailFixture | undefined => backend.lines.find((line) => line.id === id);
  const replace = (made: ProductLineDetailFixture): void => {
    backend.lines = backend.lines.map((line) => (line.id === made.id ? made : line));
  };
  const asLine = (
    body: ProductLineBody,
    base: ProductLineDetailFixture,
    version: string,
  ): ProductLineDetailFixture => ({
    ...base,
    title: body.title ?? '',
    shortName: body.shortName ?? '',
    number: body.number ?? '',
    cardText: body.cardText ?? '',
    description: body.description ?? '',
    fabricText: body.fabricText ?? '',
    collarText: body.collarText ?? '',
    cutText: body.cutText ?? '',
    namesText: body.namesText ?? '',
    logosText: body.logosText ?? '',
    startsAtPrice: body.startsAtPrice,
    minimumQuantity: body.minimumQuantity,
    isActive: body.isActive ?? base.isActive,
    productTypeIds: body.productTypeIds ?? base.productTypeIds,
    version,
    updatedByName: 'Carmen Reyes',
    updatedAtUtc: '2026-10-07T03:00:00Z',
  });
  const notFound = (): Response => problemAnswer(404, { code: 'product-lines.not-found' });
  server.use(
    http.get('*/api/v1/product-lines', async () => {
      backend.listGets += 1;
      const answer = await options.onGetList?.(backend);
      return answer ?? HttpResponse.json(backend.lines.map((line) => lineListItem(line, backend.used[line.id])));
    }),
    http.get('*/api/v1/product-lines/:id', async ({ params }) => {
      const id = String(params.id);
      backend.gets += 1;
      const answer = await options.onGet?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      const line = lineOf(id);
      return line === undefined ? notFound() : HttpResponse.json(line);
    }),
    http.post('*/api/v1/product-lines', async ({ request }) => {
      const body = (await request.json()) as ProductLineBody;
      backend.posts.push({ body, key: request.headers.get('Idempotency-Key') });
      const answer = await options.onPost?.(body, backend);
      if (answer !== undefined) {
        return answer;
      }
      const base = demoLineDetail('custom', {
        id: `8c1f4a20-0000-4000-8000-0000000001${String(backend.posts.length).padStart(2, '0')}`,
        position: backend.lines.length + 1,
        isActive: false,
        productTypeIds: [],
      });
      const made = asLine(body, base, lineVersionAfter(100 + backend.posts.length));
      backend.lines = [...backend.lines, made];
      return HttpResponse.json(made, { status: 201 });
    }),
    http.put('*/api/v1/product-lines/:id', async ({ request, params }) => {
      const id = String(params.id);
      const body = (await request.json()) as ProductLineBody;
      backend.puts.push({ id, body });
      const answer = await options.onPut?.(id, body, backend);
      if (answer !== undefined) {
        return answer;
      }
      const line = lineOf(id);
      if (line === undefined) {
        return notFound();
      }
      const made = asLine(body, line, lineVersionAfter(backend.puts.length));
      replace(made);
      return HttpResponse.json(made);
    }),
    http.post('*/api/v1/product-lines/:id/move', async ({ request, params }) => {
      const id = String(params.id);
      const body = (await request.json()) as MoveProductLineBody;
      backend.moves.push({ id, direction: body.direction, key: request.headers.get('Idempotency-Key') });
      const answer = await options.onMove?.(id, body.direction, backend);
      if (answer !== undefined) {
        return answer;
      }
      const index = backend.lines.findIndex((line) => line.id === id);
      const other = body.direction === 'up' ? index - 1 : index + 1;
      const line = backend.lines[index];
      const neighbour = backend.lines[other];
      if (line !== undefined && neighbour !== undefined) {
        const lines = [...backend.lines];
        lines[index] = neighbour;
        lines[other] = line;
        backend.lines = renumbered(lines);
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/v1/product-lines/:id/hide', async ({ request, params }) => {
      const id = String(params.id);
      backend.hides.push(id);
      backend.hideKeys.push(request.headers.get('Idempotency-Key'));
      const answer = await options.onHide?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      const line = lineOf(id);
      if (line !== undefined) {
        replace({ ...line, isActive: false });
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/v1/product-lines/:id/show', async ({ params }) => {
      const id = String(params.id);
      backend.shows.push(id);
      const answer = await options.onShow?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      const line = lineOf(id);
      if (line !== undefined) {
        replace({ ...line, isActive: true });
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete('*/api/v1/product-lines/:id', async ({ params }) => {
      const id = String(params.id);
      backend.deletes.push(id);
      const answer = await options.onDelete?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.lines = renumbered(backend.lines.filter((line) => line.id !== id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return backend;
}

export type LinePhotoSlotName = 'main' | 'back' | 'fabric';
export type LinePhotoFixture = Schemas['ProductLinePhotoDto'];

/** One line photo as the Manager's detail reads it, on the Testing image address. */
export function linePhoto(
  lineId: string,
  slot: LinePhotoSlotName,
  overrides: Partial<LinePhotoFixture> = {},
): LinePhotoFixture {
  const address = (size: string): string => `/api/testing/images/csps/content/lines/${lineId}/${slot}?size=${size}`;
  return {
    slot,
    src: address('csps_sq_400'),
    srcSet: `${address('csps_sq_200')} 200w, ${address('csps_sq_400')} 400w`,
    width: 1600,
    height: 2000,
    ...overrides,
  };
}

/** A demo line that already has photos in the given slots (all three by default). */
export function lineWithPhotos(
  key: keyof typeof LINE_IDS = 'polo',
  slots: readonly LinePhotoSlotName[] = ['main', 'back', 'fabric'],
  overrides: Partial<ProductLineDetailFixture> = {},
): ProductLineDetailFixture {
  const id = LINE_IDS[key];
  const photo = (slot: LinePhotoSlotName): LinePhotoFixture | null =>
    slots.includes(slot) ? linePhoto(id, slot) : null;
  return demoLineDetail(key, {
    photos: { main: photo('main'), back: photo('back'), fabric: photo('fabric') },
    ...overrides,
  });
}

export interface LinePhotosBackend {
  uploads: { lineId: string; slot: string; key: string | null; contentType: string | null }[];
  removals: { lineId: string; slot: string }[];
}

type PhotoAnswer = Response | undefined | Promise<Response | undefined>;

export interface LinePhotosBackendOptions {
  onUpload?: (lineId: string, slot: string, backend: ProductLinesBackend) => PhotoAnswer;
  onRemove?: (lineId: string, slot: string, backend: ProductLinesBackend) => PhotoAnswer;
}

/**
 * Answers POST and DELETE /api/v1/product-lines/{id}/photos/{slot} on top of `lines`: an upload fills the slot, a removal empties it, and
 * every call is recorded. The upload body is not read (the form is jsdom's, not Node's); the tests spy on the service for the file.
 */
export function linePhotosBackend(
  lines: ProductLinesBackend,
  options: LinePhotosBackendOptions = {},
): LinePhotosBackend {
  const backend: LinePhotosBackend = { uploads: [], removals: [] };
  const setSlot = (lineId: string, slot: LinePhotoSlotName, photo: LinePhotoFixture | null): void => {
    lines.lines = lines.lines.map((line) =>
      line.id === lineId ? { ...line, photos: { ...line.photos, [slot]: photo } } : line,
    );
  };
  server.use(
    http.post('*/api/v1/product-lines/:id/photos/:slot', async ({ request, params }) => {
      const lineId = String(params.id);
      const slot = String(params.slot);
      backend.uploads.push({
        lineId,
        slot,
        key: request.headers.get('Idempotency-Key'),
        contentType: request.headers.get('Content-Type'),
      });
      const answer = await options.onUpload?.(lineId, slot, lines);
      if (answer !== undefined) {
        return answer;
      }
      const made = linePhoto(lineId, slot as LinePhotoSlotName);
      setSlot(lineId, slot as LinePhotoSlotName, made);
      return HttpResponse.json(made);
    }),
    http.delete('*/api/v1/product-lines/:id/photos/:slot', async ({ params }) => {
      const lineId = String(params.id);
      const slot = String(params.slot);
      backend.removals.push({ lineId, slot });
      const answer = await options.onRemove?.(lineId, slot, lines);
      if (answer !== undefined) {
        return answer;
      }
      setSlot(lineId, slot as LinePhotoSlotName, null);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return backend;
}

/** Answers GET /api/v1/product-types with the editor's product types (both roles may list them). */
export function lineProductTypesAre(types: ProductTypeFixture[] = demoLineProductTypes): void {
  server.use(http.get('*/api/v1/product-types', () => HttpResponse.json(types)));
}

// Testimonials (plan 11-24): the Manager's list as /api/v1/testimonials answers it and an MSW backend that keeps what each write left and
// records every call. Every value is made up.
export type TestimonialFixture = Schemas['TestimonialDto'];
export type TestimonialBody = Schemas['TestimonialRequest'];
export type MoveTestimonialBody = Schemas['MoveTestimonialRequest'];

export const TESTIMONIAL_IDS = {
  juan: '3a7d9e10-0000-4000-8000-000000000001',
  ana: '3a7d9e10-0000-4000-8000-000000000002',
  ben: '3a7d9e10-0000-4000-8000-000000000003',
  carlo: '3a7d9e10-0000-4000-8000-000000000004',
} as const;

/** The four demo testimonials the Testing seed makes: three shown in order, then one hidden. */
export function demoTestimonials(): TestimonialFixture[] {
  return [
    {
      id: TESTIMONIAL_IDS.juan,
      quote: 'Seventeen pieces, names and numbers perfect.',
      name: 'Juan Dela Cruz',
      teamOrRole: 'Captain, Brgy. Sample Ballers',
      stars: 5,
      position: 1,
      isShown: true,
      version: 'AAAAAAAAG01=',
    },
    {
      id: TESTIMONIAL_IDS.ana,
      quote: 'The mockup came back in a day and the colors matched our crest.',
      name: 'Ana Reyes',
      teamOrRole: 'Coach, Sample City Spikers',
      stars: 5,
      position: 2,
      isShown: true,
      version: 'AAAAAAAAG02=',
    },
    {
      id: TESTIMONIAL_IDS.ben,
      quote: 'Light jerseys, and the sponsor logos printed sharp.',
      name: 'Ben Santos',
      teamOrRole: 'President, Sample Riders MC',
      stars: 4,
      position: 3,
      isShown: true,
      version: 'AAAAAAAAG03=',
    },
    {
      id: TESTIMONIAL_IDS.carlo,
      quote: 'A hidden demo testimonial for tests.',
      name: 'Carlo Mendoza',
      teamOrRole: null,
      stars: 1,
      position: 4,
      isShown: false,
      version: 'AAAAAAAAG04=',
    },
  ];
}

/** The version the fake API gives a testimonial after save number `n`. */
export function testimonialVersionAfter(n: number): string {
  return `AAAAAAAAG${String(50 + n)}=`;
}

export interface TestimonialsBackend {
  /** The testimonials the API holds, in display order. */
  items: TestimonialFixture[];
  /** How many list reads arrived. */
  gets: number;
  posts: { body: TestimonialBody; key: string | null }[];
  puts: { id: string; body: TestimonialBody }[];
  moves: { id: string; direction: string | null; key: string | null }[];
  hides: string[];
  /** The Idempotency-Key of every hide call, in order. */
  hideKeys: (string | null)[];
  shows: string[];
  deletes: string[];
}

type TestimonialAnswer = Response | undefined | Promise<Response | undefined>;

export interface TestimonialsBackendOptions {
  onGet?: (backend: TestimonialsBackend) => TestimonialAnswer;
  onPost?: (body: TestimonialBody, backend: TestimonialsBackend) => TestimonialAnswer;
  onPut?: (id: string, body: TestimonialBody, backend: TestimonialsBackend) => TestimonialAnswer;
  onMove?: (id: string, direction: string | null, backend: TestimonialsBackend) => TestimonialAnswer;
  onHide?: (id: string, backend: TestimonialsBackend) => TestimonialAnswer;
  onShow?: (id: string, backend: TestimonialsBackend) => TestimonialAnswer;
  onDelete?: (id: string, backend: TestimonialsBackend) => TestimonialAnswer;
}

/** Gives the testimonials the places 1, 2, 3 in the order they are in. */
function renumberedTestimonials(items: TestimonialFixture[]): TestimonialFixture[] {
  return items.map((item, index) => ({ ...item, position: index + 1 }));
}

/** Answers the seven /api/v1/testimonials routes from `initial`, keeps what each write left, and records every call. */
export function testimonialsBackend(
  initial: TestimonialFixture[] = demoTestimonials(),
  options: TestimonialsBackendOptions = {},
): TestimonialsBackend {
  const backend: TestimonialsBackend = {
    items: renumberedTestimonials([...initial].sort((a, b) => Number(a.position) - Number(b.position))),
    gets: 0,
    posts: [],
    puts: [],
    moves: [],
    hides: [],
    hideKeys: [],
    shows: [],
    deletes: [],
  };
  const itemOf = (id: string): TestimonialFixture | undefined => backend.items.find((item) => item.id === id);
  const asItem = (body: TestimonialBody, base: TestimonialFixture, version: string): TestimonialFixture => ({
    ...base,
    quote: body.quote ?? '',
    name: body.name ?? '',
    teamOrRole: body.teamOrRole === '' ? null : body.teamOrRole,
    stars: Number(body.stars ?? 1),
    isShown: body.isShown ?? base.isShown,
    version,
  });
  const notFound = (): Response => problemAnswer(404, { code: 'testimonials.not-found' });
  server.use(
    http.get('*/api/v1/testimonials', async () => {
      backend.gets += 1;
      const answer = await options.onGet?.(backend);
      return answer ?? HttpResponse.json(backend.items);
    }),
    http.post('*/api/v1/testimonials', async ({ request }) => {
      const body = (await request.json()) as TestimonialBody;
      backend.posts.push({ body, key: request.headers.get('Idempotency-Key') });
      const answer = await options.onPost?.(body, backend);
      if (answer !== undefined) {
        return answer;
      }
      const base: TestimonialFixture = {
        id: `3a7d9e10-0000-4000-8000-0000000001${String(backend.posts.length).padStart(2, '0')}`,
        quote: '',
        name: '',
        teamOrRole: null,
        stars: 5,
        position: backend.items.length + 1,
        isShown: false,
        version: '',
      };
      const made = asItem(body, base, testimonialVersionAfter(100 + backend.posts.length));
      backend.items = [...backend.items, made];
      return HttpResponse.json(made, { status: 201 });
    }),
    http.put('*/api/v1/testimonials/:id', async ({ request, params }) => {
      const id = String(params.id);
      const body = (await request.json()) as TestimonialBody;
      backend.puts.push({ id, body });
      const answer = await options.onPut?.(id, body, backend);
      if (answer !== undefined) {
        return answer;
      }
      const item = itemOf(id);
      if (item === undefined) {
        return notFound();
      }
      const made = asItem(body, item, testimonialVersionAfter(backend.puts.length));
      backend.items = backend.items.map((candidate) => (candidate.id === id ? made : candidate));
      return HttpResponse.json(made);
    }),
    http.post('*/api/v1/testimonials/:id/move', async ({ request, params }) => {
      const id = String(params.id);
      const body = (await request.json()) as MoveTestimonialBody;
      backend.moves.push({ id, direction: body.direction, key: request.headers.get('Idempotency-Key') });
      const answer = await options.onMove?.(id, body.direction, backend);
      if (answer !== undefined) {
        return answer;
      }
      const index = backend.items.findIndex((item) => item.id === id);
      const other = body.direction === 'up' ? index - 1 : index + 1;
      const item = backend.items[index];
      const neighbour = backend.items[other];
      if (item !== undefined && neighbour !== undefined) {
        const items = [...backend.items];
        items[index] = neighbour;
        items[other] = item;
        backend.items = renumberedTestimonials(items);
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/v1/testimonials/:id/hide', async ({ request, params }) => {
      const id = String(params.id);
      backend.hides.push(id);
      backend.hideKeys.push(request.headers.get('Idempotency-Key'));
      const answer = await options.onHide?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.items = backend.items.map((item) => (item.id === id ? { ...item, isShown: false } : item));
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/v1/testimonials/:id/show', async ({ params }) => {
      const id = String(params.id);
      backend.shows.push(id);
      const answer = await options.onShow?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.items = backend.items.map((item) => (item.id === id ? { ...item, isShown: true } : item));
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete('*/api/v1/testimonials/:id', async ({ params }) => {
      const id = String(params.id);
      backend.deletes.push(id);
      const answer = await options.onDelete?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.items = renumberedTestimonials(backend.items.filter((item) => item.id !== id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return backend;
}

// Gallery (plan 11-32): the Manager's list as /api/v1/gallery-items answers it and an MSW backend that keeps what each write left and records
// every call. Every value is made up.
export type GalleryItemFixture = Schemas['GalleryItemRowDto'];
export type GalleryUploadBody = Schemas['GalleryUploadRequest'];
export type MoveGalleryItemBody = Schemas['MoveGalleryItemRequest'];

export const GALLERY_IDS = {
  newUpload: '6b2e8f30-0000-4000-8000-000000000001',
  ballers: '6b2e8f30-0000-4000-8000-000000000002',
  spikers: '6b2e8f30-0000-4000-8000-000000000003',
  hoopers: '6b2e8f30-0000-4000-8000-000000000004',
  riders: '6b2e8f30-0000-4000-8000-000000000005',
  hiddenTeam: '6b2e8f30-0000-4000-8000-000000000006',
} as const;

export const GALLERY_ORDER_IDS = {
  ballers: '7c3f9a40-0000-4000-8000-000000000001',
  spikers: '7c3f9a40-0000-4000-8000-000000000002',
  riders: '7c3f9a40-0000-4000-8000-000000000003',
} as const;

/** The version the fake API gives an upload after save number `n`. */
export function galleryVersionAfter(n: number): string {
  return `AAAAAAAAH${String(n).padStart(2, '0')}=`;
}

/** One item with every field a row can hold; the thumb is the Testing image address. */
export function galleryItem(
  id: string,
  kind: 'order' | 'upload',
  overrides: Partial<GalleryItemFixture> = {},
): GalleryItemFixture {
  return {
    id,
    kind,
    name: 'Sample Team',
    lineId: LINE_IDS.basketball,
    lineShortName: 'Basketball',
    lineHidden: false,
    pieces: null,
    isShown: true,
    orderId: null,
    orderNumber: null,
    note: null,
    thumb: `/api/testing/images/gallery/${id}-88.jpg`,
    version: kind === 'upload' ? galleryVersionAfter(1) : null,
    ...overrides,
  };
}

/** The six demo items in gallery order: two uploads, three shown orders, and a hidden upload on a hidden line. */
export function demoGalleryItems(): GalleryItemFixture[] {
  return [
    galleryItem(GALLERY_IDS.newUpload, 'upload', {
      name: 'Sample Barangay Riders',
      lineId: LINE_IDS.moto,
      lineShortName: 'Moto',
      pieces: 12,
      note: 'Dri-fit mesh, V-neck',
    }),
    galleryItem(GALLERY_IDS.ballers, 'order', {
      name: 'Brgy. Sample Ballers',
      pieces: 17,
      orderId: GALLERY_ORDER_IDS.ballers,
      orderNumber: 'ORD-2026-0148',
    }),
    galleryItem(GALLERY_IDS.spikers, 'order', {
      name: 'Sample City Spikers',
      lineId: LINE_IDS.volleyball,
      lineShortName: 'Volleyball',
      pieces: 12,
      orderId: GALLERY_ORDER_IDS.spikers,
      orderNumber: 'ORD-2026-0149',
    }),
    galleryItem(GALLERY_IDS.hoopers, 'upload', {
      name: 'Sample Old Hoopers',
      pieces: 9,
      version: galleryVersionAfter(2),
    }),
    galleryItem(GALLERY_IDS.riders, 'order', {
      name: 'Sample Riders MC',
      lineId: LINE_IDS.moto,
      lineShortName: 'Moto',
      pieces: 20,
      orderId: GALLERY_ORDER_IDS.riders,
      orderNumber: 'ORD-2026-0150',
    }),
    galleryItem(GALLERY_IDS.hiddenTeam, 'upload', {
      name: 'Hidden Sample Team',
      lineId: LINE_IDS.polo,
      lineShortName: 'Polo',
      lineHidden: true,
      pieces: 8,
      isShown: false,
      version: galleryVersionAfter(3),
    }),
  ];
}

/** `count` uploads for paging tests, named "Sample Team 01", "Sample Team 02" and so on, all on the Basketball line. */
export function manyGalleryItems(count: number): GalleryItemFixture[] {
  return Array.from({ length: count }, (_unused, index) => {
    const number = String(index + 1).padStart(2, '0');
    return galleryItem(`6b2e8f30-0000-4000-8000-0000000002${number}`, 'upload', {
      name: `Sample Team ${number}`,
      pieces: index + 1,
    });
  });
}

/**
 * The refusal of a multipart upload as the HTTP client raises it. A real refusal cannot be answered by the fake API: jsdom's form body and
 * Node's fetch disagree about its length once the answer comes before the body is read, so the tests make the service reject instead.
 */
export function uploadRefused(
  status: number,
  extra: { code?: string; detail?: string; errors?: Record<string, string[]> } = {},
): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'Generic status words.',
      status,
      detail: extra.detail,
      instance: undefined,
      traceId: undefined,
      code: extra.code,
      errors: extra.errors ?? {},
    },
  });
}

export interface GalleryItemsBackend {
  /** The items the API holds, in gallery order. */
  items: GalleryItemFixture[];
  /** Every list read: the line, the page and the page size it asked for. */
  gets: { line: string | null; page: string | null; pageSize: string | null }[];
  /** An add: the headers only (the form is jsdom's, not Node's); the row it made comes from `nextUpload`. */
  posts: { key: string | null; contentType: string | null }[];
  puts: { id: string; body: GalleryUploadBody }[];
  photos: { id: string; key: string | null }[];
  moves: { id: string; direction: string | null; lineId: string | null | undefined; key: string | null }[];
  hides: string[];
  /** The Idempotency-Key of every hide call, in order. */
  hideKeys: (string | null)[];
  shows: string[];
  deletes: string[];
  /** The row the next add makes (it joins the top). */
  nextUpload: GalleryItemFixture;
}

type GalleryAnswer = Response | undefined | Promise<Response | undefined>;

export interface GalleryItemsBackendOptions {
  onGet?: (backend: GalleryItemsBackend) => GalleryAnswer;
  onPost?: (backend: GalleryItemsBackend) => GalleryAnswer;
  onPut?: (id: string, body: GalleryUploadBody, backend: GalleryItemsBackend) => GalleryAnswer;
  onPhoto?: (id: string, backend: GalleryItemsBackend) => GalleryAnswer;
  onMove?: (id: string, direction: string | null, backend: GalleryItemsBackend) => GalleryAnswer;
  onHide?: (id: string, backend: GalleryItemsBackend) => GalleryAnswer;
  onShow?: (id: string, backend: GalleryItemsBackend) => GalleryAnswer;
  onDelete?: (id: string, backend: GalleryItemsBackend) => GalleryAnswer;
}

/** Answers the eight /api/v1/gallery-items routes from `initial`, keeps what each write left, and records every call. */
export function galleryItemsBackend(
  initial: GalleryItemFixture[] = demoGalleryItems(),
  options: GalleryItemsBackendOptions = {},
): GalleryItemsBackend {
  const backend: GalleryItemsBackend = {
    items: [...initial],
    gets: [],
    posts: [],
    puts: [],
    photos: [],
    moves: [],
    hides: [],
    hideKeys: [],
    shows: [],
    deletes: [],
    nextUpload: galleryItem('6b2e8f30-0000-4000-8000-000000000101', 'upload', {
      name: 'Sample New Upload',
      lineId: LINE_IDS.moto,
      lineShortName: 'Moto',
      pieces: 12,
    }),
  };
  const notFound = (): Response => problemAnswer(404, { code: 'gallery-items.not-found' });
  const itemOf = (id: string): GalleryItemFixture | undefined => backend.items.find((item) => item.id === id);
  const replace = (made: GalleryItemFixture): void => {
    backend.items = backend.items.map((item) => (item.id === made.id ? made : item));
  };
  server.use(
    http.get('*/api/v1/gallery-items', async ({ request }) => {
      const url = new URL(request.url);
      backend.gets.push({
        line: url.searchParams.get('line'),
        page: url.searchParams.get('page'),
        pageSize: url.searchParams.get('pageSize'),
      });
      const answer = await options.onGet?.(backend);
      if (answer !== undefined) {
        return answer;
      }
      const line = url.searchParams.get('line');
      const size = Number(url.searchParams.get('pageSize') ?? 20);
      const page = Number(url.searchParams.get('page') ?? 1);
      const matching = backend.items.filter((item) => line === null || item.lineId === line);
      return HttpResponse.json({
        rows: matching.slice((page - 1) * size, page * size),
        total: matching.length,
        page,
        size,
      });
    }),
    http.post('*/api/v1/gallery-items', async ({ request }) => {
      backend.posts.push({
        key: request.headers.get('Idempotency-Key'),
        contentType: request.headers.get('Content-Type'),
      });
      const answer = await options.onPost?.(backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.items = [backend.nextUpload, ...backend.items];
      return HttpResponse.json(backend.nextUpload, { status: 201 });
    }),
    http.put('*/api/v1/gallery-items/:id', async ({ request, params }) => {
      const id = String(params.id);
      const body = (await request.json()) as GalleryUploadBody;
      backend.puts.push({ id, body });
      const answer = await options.onPut?.(id, body, backend);
      if (answer !== undefined) {
        return answer;
      }
      const item = itemOf(id);
      if (item?.kind !== 'upload') {
        return notFound();
      }
      const made: GalleryItemFixture = {
        ...item,
        name: body.teamName ?? '',
        lineId: body.productLineId,
        pieces: body.pieces,
        note: body.note === '' ? null : body.note,
        isShown: body.isShown ?? item.isShown,
        version: galleryVersionAfter(10 + backend.puts.length),
      };
      replace(made);
      return HttpResponse.json(made);
    }),
    http.post('*/api/v1/gallery-items/:id/photo', async ({ request, params }) => {
      const id = String(params.id);
      backend.photos.push({ id, key: request.headers.get('Idempotency-Key') });
      const answer = await options.onPhoto?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      const item = itemOf(id);
      if (item?.kind !== 'upload') {
        return notFound();
      }
      const made = { ...item, version: galleryVersionAfter(30 + backend.photos.length) };
      replace(made);
      return HttpResponse.json(made);
    }),
    http.post('*/api/v1/gallery-items/:id/move', async ({ request, params }) => {
      const id = String(params.id);
      const body = (await request.json()) as MoveGalleryItemBody;
      backend.moves.push({
        id,
        direction: body.direction,
        lineId: body.lineId,
        key: request.headers.get('Idempotency-Key'),
      });
      const answer = await options.onMove?.(id, body.direction, backend);
      if (answer !== undefined) {
        return answer;
      }
      const inScope = (item: GalleryItemFixture): boolean => body.lineId == null || item.lineId === body.lineId;
      const scoped = backend.items.filter(inScope);
      const at = scoped.findIndex((item) => item.id === id);
      const other = scoped[body.direction === 'up' ? at - 1 : at + 1];
      const moving = scoped[at];
      if (moving !== undefined && other !== undefined) {
        const items = [...backend.items];
        const first = items.findIndex((item) => item.id === moving.id);
        const second = items.findIndex((item) => item.id === other.id);
        items[first] = other;
        items[second] = moving;
        backend.items = items;
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/v1/gallery-items/:id/hide', async ({ request, params }) => {
      const id = String(params.id);
      backend.hides.push(id);
      backend.hideKeys.push(request.headers.get('Idempotency-Key'));
      const answer = await options.onHide?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.items = backend.items.map((item) => (item.id === id ? { ...item, isShown: false } : item));
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/v1/gallery-items/:id/show', async ({ params }) => {
      const id = String(params.id);
      backend.shows.push(id);
      const answer = await options.onShow?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.items = backend.items.map((item) => (item.id === id ? { ...item, isShown: true } : item));
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete('*/api/v1/gallery-items/:id', async ({ params }) => {
      const id = String(params.id);
      backend.deletes.push(id);
      const answer = await options.onDelete?.(id, backend);
      if (answer !== undefined) {
        return answer;
      }
      backend.items = backend.items.filter((item) => item.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return backend;
}
