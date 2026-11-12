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
    http.post('*/api/v1/product-lines/:id/hide', async ({ params }) => {
      const id = String(params.id);
      backend.hides.push(id);
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

/** Answers GET /api/v1/product-types with the editor's product types (both roles may list them). */
export function lineProductTypesAre(types: ProductTypeFixture[] = demoLineProductTypes): void {
  server.use(http.get('*/api/v1/product-types', () => HttpResponse.json(types)));
}
