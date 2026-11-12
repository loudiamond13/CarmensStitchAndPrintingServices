// The Business Info form's schema and its mapping to and from the API (OR-3; CONT-01, D-23, D-24; plan 11-12). It mirrors the server's
// UpdateSiteSettingsRequestValidator, SiteLinks and PhilippinePhone rule for rule, with the server's own messages, so the browser
// checks every rule the server checks before a request is sent. Lengths count UTF-16 code units after the trim, the same unit as the
// server. An empty optional value is "not set" and is never checked. No rule uses a regular expression that can backtrack (CWE-1333).
// The accept and refuse cases are the files the .NET tests read too: tests/fixtures/philippine-phone-cases.json and
// tests/fixtures/site-link-cases.json. Only what the server alone can know stays server-side.
import { z } from 'zod';
import { ENTRY_COPY } from '@/components/entry/copy';
import { isEmailShaped } from '@/modules/admin/authSchemas';
import type { OpeningHours, UpdateOpeningHoursRequest } from '@/modules/admin/services/openingHoursService';
import type { ProductLineDetail, ProductLineRequest } from '@/modules/admin/services/productLinesService';
import type { ShopClosure, ShopClosureRequest } from '@/modules/admin/services/shopClosuresService';
import type { SiteSettings, UpdateSiteSettingsRequest } from '@/modules/admin/services/siteSettingsService';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { centavosToMoneyText } from '@/utils/format';
import { formatTime, type WeekDayHours } from '@/utils/hours';
import { SITE_CONTENT_COPY } from './siteContentCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const ERRORS = SITE_CONTENT_COPY.errors;

export const BUSINESS_NAME_MAX = 100;
export const TAGLINE_MAX = 160;
export const ABOUT_TEXT_MAX = 600;
export const TURNAROUND_MAX = 120;
export const STREET_MAX = 120;
export const TOWN_OR_CITY_MAX = 60;
export const PROVINCE_MAX = 60;
export const POSTAL_CODE_LENGTH = 4;
export const DIRECTIONS_URL_MAX = 300;
export const MAP_EMBED_URL_MAX = 1000;
export const MESSENGER_URL_MAX = 120;
export const FACEBOOK_URL_MAX = 300;
export const INSTAGRAM_URL_MAX = 300;
export const TIKTOK_URL_MAX = 300;
export const CONTACT_EMAIL_MAX = 254;
export const MAX_PHONES = 4;
export const PHONE_LABEL_MAX = 20;
/** The longest text a person may type for a number, counted as typed (PhilippinePhone.MaxInputLength). */
export const PHONE_INPUT_MAX = 32;

const MESSENGER_PREFIX = 'https://m.me/';
const MESSENGER_NAME_MAX = 100;
const MAP_EMBED_PREFIX = 'https://www.google.com/maps/embed?';
const HTTPS_PREFIX = 'https://';

/** True when a `[` is followed later by a `]`: text such as "[Shop address]" that was never replaced. */
export function hasBracketPlaceholder(value: string): boolean {
  const open = value.indexOf('[');
  return open >= 0 && value.includes(']', open + 1);
}

/** Visible ASCII only, so no space, control or look-alike character, and none that can close an attribute or open a tag. */
function isPlainLinkText(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    const refused =
      code <= 0x20 ||
      code > 0x7e ||
      code === 0x22 ||
      code === 0x27 ||
      code === 0x3c ||
      code === 0x3e ||
      code === 0x5c ||
      code === 0x60 ||
      code === 0x5b ||
      code === 0x5d;
    if (refused) {
      return false;
    }
  }
  return true;
}

/** An https link on the standard port with no sign-in part, in plain characters; the caller then checks the host. */
function parseHttps(value: string): URL | null {
  if (!value.startsWith(HTTPS_PREFIX) || !isPlainLinkText(value)) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return url.protocol === 'https:' && url.port === '' && url.username === '' && url.password === '' ? url : null;
}

function isAsciiLetterOrDigit(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

/** `https://m.me/` plus 1 to 100 letters, digits or dots. */
export function isMessengerLink(value: string): boolean {
  if (!value.startsWith(MESSENGER_PREFIX)) {
    return false;
  }
  const name = value.slice(MESSENGER_PREFIX.length);
  if (name.length === 0 || name.length > MESSENGER_NAME_MAX) {
    return false;
  }
  for (let index = 0; index < name.length; index++) {
    const code = name.charCodeAt(index);
    if (!isAsciiLetterOrDigit(code) && code !== 0x2e) {
      return false;
    }
  }
  return true;
}

function isOnHost(value: string, hosts: readonly string[]): boolean {
  const url = parseHttps(value);
  return url !== null && hosts.includes(url.hostname);
}

/** An https link on facebook.com, www.facebook.com, m.facebook.com or fb.com. */
export function isFacebookLink(value: string): boolean {
  return isOnHost(value, ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com']);
}

/** An https link on instagram.com or www.instagram.com. */
export function isInstagramLink(value: string): boolean {
  return isOnHost(value, ['instagram.com', 'www.instagram.com']);
}

/** An https link on tiktok.com or www.tiktok.com. */
export function isTikTokLink(value: string): boolean {
  return isOnHost(value, ['tiktok.com', 'www.tiktok.com']);
}

function isUnderMaps(path: string): boolean {
  return path === '/maps' || path.startsWith('/maps/');
}

/** A Google Maps link: https on maps.app.goo.gl, goo.gl/maps, www.google.com/maps or maps.google.com. */
export function isDirectionsLink(value: string): boolean {
  const url = parseHttps(value);
  if (url === null) {
    return false;
  }
  switch (url.hostname) {
    case 'maps.app.goo.gl':
    case 'maps.google.com':
      return true;
    case 'goo.gl':
    case 'www.google.com':
      return isUnderMaps(url.pathname);
    default:
      return false;
  }
}

/** A link that starts with `https://www.google.com/maps/embed?`, in plain characters. */
export function isMapEmbedLink(value: string): boolean {
  return value.startsWith(MAP_EMBED_PREFIX) && isPlainLinkText(value);
}

// The first `src` attribute of pasted code, in double or single quotes; `data-src` is not one. The pattern has no nested repeats.
const SRC_ATTRIBUTE = /(?<![\w-])src\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/**
 * What a Manager pasted into Map embed link: the whole Google embed code is cut down to its `src` link (T-11-29). Text that is
 * already a link comes back trimmed. Code whose `src` is not a Google embed link, and any other text, comes back as typed, so the
 * rule refuses it. Nothing pasted is ever rendered as HTML.
 */
export function reduceEmbedCode(value: string): string {
  const text = value.trim();
  if (isMapEmbedLink(text)) {
    return text;
  }
  const found = SRC_ATTRIBUTE.exec(text);
  const source = (found?.[1] ?? found?.[2] ?? '').replaceAll('&amp;', '&');
  return source.startsWith(MAP_EMBED_PREFIX) ? source : value;
}

/** The number as `+63` and digits, or null when it is not a Philippine mobile or landline number (PhilippinePhone.TryParse). */
export function phoneE164(text: string): string | null {
  if (text.length > PHONE_INPUT_MAX) {
    return null;
  }
  let digits = '';
  let international = false;
  for (const character of text) {
    if (/\s/u.test(character) || character === '-' || character === '.' || character === '(' || character === ')') {
      continue;
    }
    if (character === '+' && digits.length === 0 && !international) {
      international = true;
      continue;
    }
    if (character < '0' || character > '9') {
      return null;
    }
    digits += character;
  }
  let national: string;
  if (international) {
    if (!digits.startsWith('63')) {
      return null;
    }
    national = `0${digits.slice(2)}`;
  } else {
    if (!digits.startsWith('0')) {
      return null;
    }
    national = digits;
  }
  // Mobile: 11 digits starting 09. Landline: 10 digits starting 0 and then 1 to 8.
  const second = national[1] ?? '';
  const shaped =
    (national.length === 11 && second === '9') || (national.length === 10 && second >= '1' && second <= '8');
  return shaped ? `+63${national.slice(1)}` : null;
}

/** A required text: empty, then too long, then a bracket placeholder, each with its own message. */
function requiredText(requiredMessage: string, max: number, tooLongMessage: string) {
  return z.string().superRefine((value, ctx) => {
    const text = value.trim();
    if (text.length === 0) {
      ctx.addIssue({ code: 'custom', message: requiredMessage });
    } else if (text.length > max) {
      ctx.addIssue({ code: 'custom', message: tooLongMessage });
    } else if (hasBracketPlaceholder(text)) {
      ctx.addIssue({ code: 'custom', message: ERRORS.placeholderText });
    }
  });
}

/** An optional text: too long, then a bracket placeholder. */
function optionalText(max: number, tooLongMessage: string) {
  return z.string().superRefine((value, ctx) => {
    const text = value.trim();
    if (text.length > max) {
      ctx.addIssue({ code: 'custom', message: tooLongMessage });
    } else if (hasBracketPlaceholder(text)) {
      ctx.addIssue({ code: 'custom', message: ERRORS.placeholderText });
    }
  });
}

/** An optional link: allowed by its rule, then within its column. */
function optionalLink(isAllowed: (link: string) => boolean, message: string, max: number) {
  return z.string().superRefine((value, ctx) => {
    const text = value.trim();
    if (text === '') {
      return;
    }
    if (!isAllowed(text)) {
      ctx.addIssue({ code: 'custom', message });
    } else if (text.length > max) {
      ctx.addIssue({ code: 'custom', message: ERRORS.tooLong(max) });
    }
  });
}

const postalCodeField = z.string().superRefine((value, ctx) => {
  const text = value.trim();
  if (text === '') {
    return;
  }
  let digits = text.length === POSTAL_CODE_LENGTH;
  for (let index = 0; digits && index < text.length; index++) {
    const code = text.charCodeAt(index);
    digits = code >= 0x30 && code <= 0x39;
  }
  if (!digits) {
    ctx.addIssue({ code: 'custom', message: ERRORS.postalCode });
  }
});

const emailField = z.string().superRefine((value, ctx) => {
  const text = value.trim();
  if (text === '') {
    return;
  }
  if (text.length > CONTACT_EMAIL_MAX || !isEmailShaped(text) || hasBracketPlaceholder(text)) {
    ctx.addIssue({ code: 'custom', message: ERRORS.email });
  }
});

const phoneRowSchema = z.object({
  number: z.string(),
  label: z.string(),
  isMain: z.boolean(),
});

/** The list rules and every row's rules, with each message on the row or the list it belongs to (the server's keys). */
const phonesSchema = z.array(phoneRowSchema).superRefine((rows, ctx) => {
  if (rows.length === 0) {
    ctx.addIssue({ code: 'custom', message: ERRORS.phonesRequired, path: ['root'] });
    return;
  }
  if (rows.length > MAX_PHONES) {
    ctx.addIssue({ code: 'custom', message: ERRORS.phonesTooMany, path: ['root'] });
  }
  if (rows.filter((row) => row.isMain).length !== 1) {
    ctx.addIssue({ code: 'custom', message: ERRORS.mainPhone, path: ['root'] });
  }
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const e164 = phoneE164(row.number);
    if (e164 === null) {
      ctx.addIssue({ code: 'custom', message: ERRORS.phone, path: [index, 'number'] });
    } else if (seen.has(e164)) {
      ctx.addIssue({ code: 'custom', message: ERRORS.phoneDuplicate, path: [index, 'number'] });
    } else {
      seen.add(e164);
    }
    const label = row.label.trim();
    if (label.length > PHONE_LABEL_MAX) {
      ctx.addIssue({ code: 'custom', message: ERRORS.phoneLabelTooLong, path: [index, 'label'] });
    } else if (hasBracketPlaceholder(label)) {
      ctx.addIssue({ code: 'custom', message: ERRORS.placeholderText, path: [index, 'label'] });
    }
  });
});

/** UpdateSiteSettingsRequestValidator: every Business Info rule the server checks. */
export const businessInfoSchema = z.object({
  businessName: requiredText(ERRORS.businessNameRequired, BUSINESS_NAME_MAX, ERRORS.businessNameTooLong),
  tagline: requiredText(ERRORS.taglineRequired, TAGLINE_MAX, ERRORS.taglineTooLong),
  aboutText: optionalText(ABOUT_TEXT_MAX, ERRORS.tooLong(ABOUT_TEXT_MAX)),
  turnaroundLine: optionalText(TURNAROUND_MAX, ERRORS.turnaroundTooLong),
  street: requiredText(ERRORS.streetRequired, STREET_MAX, ERRORS.tooLong(STREET_MAX)),
  townOrCity: requiredText(ERRORS.townOrCityRequired, TOWN_OR_CITY_MAX, ERRORS.tooLong(TOWN_OR_CITY_MAX)),
  province: requiredText(ERRORS.provinceRequired, PROVINCE_MAX, ERRORS.tooLong(PROVINCE_MAX)),
  postalCode: postalCodeField,
  directionsUrl: optionalLink(isDirectionsLink, ERRORS.directionsUrl, DIRECTIONS_URL_MAX),
  mapEmbedUrl: optionalLink(isMapEmbedLink, ERRORS.mapEmbedUrl, MAP_EMBED_URL_MAX),
  messengerUrl: optionalLink(isMessengerLink, ERRORS.messengerUrl, MESSENGER_URL_MAX),
  facebookUrl: optionalLink(isFacebookLink, ERRORS.facebookUrl, FACEBOOK_URL_MAX),
  instagramUrl: optionalLink(isInstagramLink, ERRORS.instagramUrl, INSTAGRAM_URL_MAX),
  tiktokUrl: optionalLink(isTikTokLink, ERRORS.tiktokUrl, TIKTOK_URL_MAX),
  contactEmail: emailField,
  phones: phonesSchema,
});

/** What the Business Info form holds while it is edited: every control is text, an empty optional value is "". */
export type BusinessInfoInput = z.input<typeof businessInfoSchema>;

/** One phone row as the form holds it: the typed number, an optional label and whether it is the main number. */
export type PhoneRowInput = BusinessInfoInput['phones'][number];

/** The form values of the saved settings: a value that is not set shows as an empty field. */
export function businessInfoValuesOf(settings: SiteSettings): BusinessInfoInput {
  return {
    businessName: settings.businessName,
    tagline: settings.tagline,
    aboutText: settings.aboutText ?? '',
    turnaroundLine: settings.turnaroundLine ?? '',
    street: settings.street ?? '',
    townOrCity: settings.townOrCity ?? '',
    province: settings.province ?? '',
    postalCode: settings.postalCode ?? '',
    directionsUrl: settings.directionsUrl ?? '',
    mapEmbedUrl: settings.mapEmbedUrl ?? '',
    messengerUrl: settings.messengerUrl ?? '',
    facebookUrl: settings.facebookUrl ?? '',
    instagramUrl: settings.instagramUrl ?? '',
    tiktokUrl: settings.tiktokUrl ?? '',
    contactEmail: settings.contactEmail ?? '',
    phones: settings.phones.map((phone) => ({ number: phone.number, label: phone.label ?? '', isMain: phone.isMain })),
  };
}

/** Trimmed text, or null when nothing is left: the API stores "not set" as null. */
function optional(value: string): string | null {
  const text = value.trim();
  return text === '' ? null : text;
}

/** The save request for the form's values: trimmed, an empty optional value as null, and the version the form was opened with. */
export function toSiteSettingsRequest(values: BusinessInfoInput, version: string): UpdateSiteSettingsRequest {
  return {
    version,
    businessName: values.businessName.trim(),
    tagline: values.tagline.trim(),
    aboutText: optional(values.aboutText),
    turnaroundLine: optional(values.turnaroundLine),
    street: values.street.trim(),
    townOrCity: values.townOrCity.trim(),
    province: values.province.trim(),
    postalCode: optional(values.postalCode),
    directionsUrl: optional(values.directionsUrl),
    mapEmbedUrl: optional(values.mapEmbedUrl),
    messengerUrl: optional(values.messengerUrl),
    facebookUrl: optional(values.facebookUrl),
    instagramUrl: optional(values.instagramUrl),
    tiktokUrl: optional(values.tiktokUrl),
    contactEmail: optional(values.contactEmail),
    phones: values.phones.map((phone) => ({
      number: phone.number.trim(),
      label: optional(phone.label),
      isMain: phone.isMain,
    })),
  };
}

// ---- The weekly hours form (CONT-01, D-21; plan 11-16) -------------------------------------------------------------------------------
// It mirrors UpdateOpeningHoursRequestValidator and OpeningHours.Check with the server's own messages: an open day needs both times, each on
// the half hour from 5:00 AM to 11:30 PM, and closing must be after opening. A closed day is never checked.

const HOURS = SITE_CONTENT_COPY.hours.errors;

/** A ticked day with no times of its own starts at 9:00 AM to 6:00 PM. */
export const DEFAULT_OPENS = '09:00';
export const DEFAULT_CLOSES = '18:00';

const EARLIEST_MINUTE = 5 * 60;
const LATEST_MINUTE = 23 * 60 + 30;
const STEP_MINUTES = 30;
const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The minutes after midnight of a "HH:mm" time, or null when the text is not one. */
function minutesOf(time: string): number | null {
  const match = TIME_24H.exec(time);
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

function isChoosableMinute(minute: number): boolean {
  return minute >= EARLIEST_MINUTE && minute <= LATEST_MINUTE && minute % STEP_MINUTES === 0;
}

/** Every time a Manager can choose, as the select lists it: "05:00" written "5:00 AM", every 30 minutes to "23:30". */
export const HOURS_TIME_OPTIONS: readonly { readonly value: string; readonly label: string }[] = Array.from(
  { length: (LATEST_MINUTE - EARLIEST_MINUTE) / STEP_MINUTES + 1 },
  (_unused, index) => {
    const minute = EARLIEST_MINUTE + index * STEP_MINUTES;
    const value = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    return { value, label: formatTime(value) ?? value };
  },
);

/** One day as the form holds it: the weekday (1 Monday to 7 Sunday), whether it is open, and its two times as "HH:mm" or "". */
const hoursDaySchema = z.object({
  day: z.number(),
  open: z.boolean(),
  opensAt: z.string(),
  closesAt: z.string(),
});

/** What a time field says about itself: nothing chosen, a time that is not a choosable one, or its minutes. */
function readTime(time: string): 'blank' | 'unchoosable' | number {
  if (time === '') {
    return 'blank';
  }
  const minute = minutesOf(time);
  return minute !== null && isChoosableMinute(minute) ? minute : 'unchoosable';
}

/** OpeningHours.Check for every open day, each message on the field the server keys it to. */
export const hoursSchema = z.object({
  days: z.array(hoursDaySchema).superRefine((days, ctx) => {
    days.forEach((day, index) => {
      if (!day.open) {
        return;
      }
      const opens = readTime(day.opensAt);
      const closes = readTime(day.closesAt);
      if (opens === 'blank') {
        ctx.addIssue({ code: 'custom', message: HOURS.opensRequired, path: [index, 'opensAt'] });
      } else if (opens === 'unchoosable') {
        ctx.addIssue({ code: 'custom', message: HOURS.timeStep, path: [index, 'opensAt'] });
      }
      if (closes === 'blank') {
        ctx.addIssue({ code: 'custom', message: HOURS.closesRequired, path: [index, 'closesAt'] });
      } else if (closes === 'unchoosable') {
        ctx.addIssue({ code: 'custom', message: HOURS.timeStep, path: [index, 'closesAt'] });
      } else if (typeof opens === 'number' && closes <= opens) {
        ctx.addIssue({ code: 'custom', message: HOURS.closesAfterOpens, path: [index, 'closesAt'] });
      }
    });
  }),
});

/** What the hours form holds while it is edited. */
export type HoursInput = z.input<typeof hoursSchema>;

/** The form values of the saved week, Monday first: a closed day is unticked with no times. */
export function hoursValuesOf(hours: OpeningHours): HoursInput {
  return {
    days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const saved = hours.days.find((entry) => Number(entry.day) === weekday);
      const opensAt = saved?.opensAt ?? '';
      const closesAt = saved?.closesAt ?? '';
      return { day: weekday, open: opensAt !== '' && closesAt !== '', opensAt, closesAt };
    }),
  };
}

/** The save request for the form's values: all seven days, a closed day with no times, and the version the form was opened with. */
export function toOpeningHoursRequest(values: HoursInput, version: string): UpdateOpeningHoursRequest {
  return {
    version,
    days: values.days.map((day) =>
      day.open
        ? { day: day.day, opensAt: day.opensAt, closesAt: day.closesAt }
        : { day: day.day, opensAt: null, closesAt: null },
    ),
  };
}

/** The week as utils/hours reads it, for the "Visitors see" line: a day with no pair of times is closed. */
export function weekOfValues(values: HoursInput): WeekDayHours[] {
  return values.days.map((day) => {
    const open = day.open && day.opensAt !== '' && day.closesAt !== '';
    return {
      day: day.day as WeekDayHours['day'],
      opensAt: open ? day.opensAt : null,
      closesAt: open ? day.closesAt : null,
    };
  });
}

/** True when the two forms would send the same week: a closed day's leftover times do not count. */
export function sameWeek(a: HoursInput, b: HoursInput): boolean {
  return JSON.stringify(toOpeningHoursRequest(a, '').days) === JSON.stringify(toOpeningHoursRequest(b, '').days);
}

// ---- The closure form (CONT-04, D-22; plan 11-16) -----------------------------------------------------------------------------------
// It mirrors ShopClosureRequestValidator and ShopClosure.Check with the server's own messages: a real first day that is today or later, a
// last day on or after it, at most 31 days in all, and a note of at most 80 characters. The business today comes from the server. An edit
// keeps a first day that is already past (a closure that is running can still have its note fixed); moving it is checked like an add (owner
// item OI-1 of plan 11-13, built as option A). An overlap with another closure is the one rule only the server can check.

const CLOSURE = SITE_CONTENT_COPY.closures.errors;

export const CLOSURE_NOTE_MAX = 80;
export const CLOSURE_MAX_DAYS = 31;

const MS_PER_DAY = 86_400_000;

/** The number of the day in a running count, for counting the days between two real `YYYY-MM-DD` dates. */
function dayNumberOf(day: string): number {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(year, month - 1, date) / MS_PER_DAY);
}

/** The schema of the closure form for this business today (null while it is not known) and, for an edit, the first day it was opened with. */
export function closureSchema(today: string | null, savedFirstDay: string | null = null) {
  return z
    .object({
      firstDay: z.string(),
      lastDay: z.string(),
      note: z.string(),
    })
    .superRefine((values, ctx) => {
      const first = values.firstDay.trim();
      const last = values.lastDay.trim();
      const firstRead = isCalendarDate(first);
      if (first === '') {
        ctx.addIssue({ code: 'custom', message: CLOSURE.firstRequired, path: ['firstDay'] });
      } else if (!firstRead) {
        ctx.addIssue({ code: 'custom', message: CLOSURE.notADate, path: ['firstDay'] });
      } else if (today !== null && first < today && first !== savedFirstDay) {
        ctx.addIssue({ code: 'custom', message: CLOSURE.firstInPast, path: ['firstDay'] });
      }

      if (last !== '') {
        if (!isCalendarDate(last)) {
          ctx.addIssue({ code: 'custom', message: CLOSURE.notADate, path: ['lastDay'] });
        } else if (firstRead && last < first) {
          ctx.addIssue({ code: 'custom', message: CLOSURE.lastBeforeFirst, path: ['lastDay'] });
        } else if (firstRead && dayNumberOf(last) - dayNumberOf(first) + 1 > CLOSURE_MAX_DAYS) {
          ctx.addIssue({ code: 'custom', message: CLOSURE.spanTooLong, path: ['lastDay'] });
        }
      }

      if (values.note.trim().length > CLOSURE_NOTE_MAX) {
        ctx.addIssue({ code: 'custom', message: CLOSURE.noteTooLong, path: ['note'] });
      }
    });
}

/** What the closure form holds while it is edited: every control is text, an empty optional value is "". */
export interface ClosureInput {
  firstDay: string;
  lastDay: string;
  note: string;
}

/** The form values: an add starts on the business today (empty while it is not known); an edit shows the saved closure, a one day closure with no last day. */
export function closureValuesOf(closure: ShopClosure | null, today: string | null): ClosureInput {
  if (closure === null) {
    return { firstDay: today ?? '', lastDay: '', note: '' };
  }
  return {
    firstDay: closure.firstDay,
    lastDay: closure.lastDay === closure.firstDay ? '' : closure.lastDay,
    note: closure.note ?? '',
  };
}

/** The save request: trimmed, an empty last day or note as null, and the version an edit was opened with (null for an add). */
export function toClosureRequest(values: ClosureInput, version: string | null): ShopClosureRequest {
  return {
    firstDay: values.firstDay.trim(),
    lastDay: optional(values.lastDay),
    note: optional(values.note),
    version,
  };
}

// ---- The product line form (CONT-02, D-04, D-07; plans 11-17 and 11-20) --------------------------------------------------------------
// It mirrors ProductLine.Check (the rules the request validator and the domain share) with the server's own messages. Every control is text;
// the price and minimum become numbers only for the request. What only the server can know (a short name another line uses) stays there.

const LINE = SITE_CONTENT_COPY.productLine.errors;

export const LINE_TITLE_MAX = 60;
export const LINE_SHORT_NAME_MAX = 20;
export const LINE_NUMBER_MAX = 2;
export const LINE_CARD_TEXT_MAX = 140;
export const LINE_DESCRIPTION_MAX = 300;
export const LINE_CUSTOMIZE_MAX = 120;
export const LINE_MINIMUM_MAX = 9999;

/** The most a price may be, in centavos (999,999.99 pesos). */
const LINE_PRICE_MAX_CENTAVOS = 99_999_999;

/** The five "what you can customize" fields of the form and the request, in the order the public page draws them. */
export const LINE_CUSTOMIZE_FIELDS = ['fabricText', 'collarText', 'cutText', 'namesText', 'logosText'] as const;
export type LineCustomizeField = (typeof LINE_CUSTOMIZE_FIELDS)[number];

/** The message under the price for `text`, or null when it is empty (no price) or from 0.01 to 999,999.99 with at most 2 decimals. */
export function linePriceError(text: string): string | null {
  const value = text.trim();
  if (value === '' || value === '.') {
    return null;
  }
  if (!/^\d*(\.\d*)?$/.test(value)) {
    return ENTRY_COPY.money.invalid;
  }
  const [whole = '', fraction = ''] = value.split('.');
  // The decimals are checked before the range, as the server does.
  if (fraction.length > 2) {
    return LINE.priceDecimals;
  }
  const pesos = whole.replace(/^0+/, '');
  if (pesos.length > 6) {
    return LINE.priceTooHigh;
  }
  const centavos = Number(pesos === '' ? '0' : pesos) * 100 + Number(fraction.padEnd(2, '0'));
  if (centavos < 1) {
    return LINE.priceTooLow;
  }
  return centavos > LINE_PRICE_MAX_CENTAVOS ? LINE.priceTooHigh : null;
}

/** The message under the minimum for `text`, or null when it is empty (no minimum) or a whole number from 1 to 9,999. */
export function lineMinimumError(text: string): string | null {
  const value = text.trim();
  if (value === '') {
    return null;
  }
  return /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= LINE_MINIMUM_MAX ? null : LINE.minimum;
}

/** The price a visitor would see for what is typed: null when there is none or the rules refuse it. */
export function readLinePrice(text: string): number | null {
  const value = text.trim();
  return value === '' || value === '.' || linePriceError(value) !== null ? null : Number(value);
}

/** The minimum a visitor would see for what is typed: null when there is none or the rules refuse it. */
export function readLineMinimum(text: string): number | null {
  const value = text.trim();
  return value === '' || lineMinimumError(value) !== null ? null : Number(value);
}

/** A required text: empty after the trim, then too long, each with its own message (the server counts after the trim too). */
function lineText(requiredMessage: string, max: number, tooLongMessage: string) {
  return z.string().superRefine((value, ctx) => {
    const length = value.trim().length;
    if (length === 0) {
      ctx.addIssue({ code: 'custom', message: requiredMessage });
    } else if (length > max) {
      ctx.addIssue({ code: 'custom', message: tooLongMessage });
    }
  });
}

/** The number on the drawing: optional, up to 2 ASCII letters or digits, so it always draws on the jersey. */
const lineNumberField = z.string().superRefine((value, ctx) => {
  const text = value.trim();
  let plain = text.length <= LINE_NUMBER_MAX;
  for (let index = 0; plain && index < text.length; index++) {
    const code = text.charCodeAt(index);
    plain = (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
  }
  if (!plain) {
    ctx.addIssue({ code: 'custom', message: LINE.number });
  }
});

/** One "what you can customize" text: required with its card title in the message, at most 120 characters. */
function lineCustomizeText(field: LineCustomizeField) {
  return lineText(
    LINE.customizeRequired(SITE_CONTENT_COPY.productLine.customize[field]),
    LINE_CUSTOMIZE_MAX,
    LINE.customizeTooLong,
  );
}

/** A value checked by one of the message functions above: null is fine. */
function lineChecked(messageOf: (text: string) => string | null) {
  return z.string().superRefine((value, ctx) => {
    const message = messageOf(value);
    if (message !== null) {
      ctx.addIssue({ code: 'custom', message });
    }
  });
}

/** ProductLine.Check: every product line rule the server checks, with its message. */
export const productLineSchema = z.object({
  isActive: z.boolean(),
  title: lineText(LINE.titleRequired, LINE_TITLE_MAX, LINE.titleTooLong),
  shortName: lineText(LINE.shortNameRequired, LINE_SHORT_NAME_MAX, LINE.shortNameTooLong),
  number: lineNumberField,
  cardText: lineText(LINE.cardTextRequired, LINE_CARD_TEXT_MAX, LINE.cardTextTooLong),
  description: lineText(LINE.descriptionRequired, LINE_DESCRIPTION_MAX, LINE.descriptionTooLong),
  fabricText: lineCustomizeText('fabricText'),
  collarText: lineCustomizeText('collarText'),
  cutText: lineCustomizeText('cutText'),
  namesText: lineCustomizeText('namesText'),
  logosText: lineCustomizeText('logosText'),
  startsAtPrice: lineChecked(linePriceError),
  minimumQuantity: lineChecked(lineMinimumError),
  productTypeIds: z.array(z.string()),
});

/** What the product line form holds while it is edited. */
export type ProductLineInput = z.input<typeof productLineSchema>;

/** A saved price as money text with two decimals ("650.00"); empty for none. */
function priceTextOf(price: number | string | null): string {
  if (price === null) {
    return '';
  }
  const centavos = Math.round(Number(price) * 100);
  return Number.isSafeInteger(centavos) && centavos >= 0 && centavos <= 99_999_999_999
    ? centavosToMoneyText(centavos)
    : String(price);
}

/** The form values of a saved line, or of a new one (null): hidden, every text empty, no price and no product type. */
export function productLineValuesOf(line: ProductLineDetail | null): ProductLineInput {
  if (line === null) {
    return {
      isActive: false,
      title: '',
      shortName: '',
      number: '',
      cardText: '',
      description: '',
      fabricText: '',
      collarText: '',
      cutText: '',
      namesText: '',
      logosText: '',
      startsAtPrice: '',
      minimumQuantity: '',
      productTypeIds: [],
    };
  }
  return {
    isActive: line.isActive,
    title: line.title,
    shortName: line.shortName,
    number: line.number,
    cardText: line.cardText,
    description: line.description,
    fabricText: line.fabricText,
    collarText: line.collarText,
    cutText: line.cutText,
    namesText: line.namesText,
    logosText: line.logosText,
    startsAtPrice: priceTextOf(line.startsAtPrice),
    minimumQuantity: line.minimumQuantity === null ? '' : String(Number(line.minimumQuantity)),
    productTypeIds: [...line.productTypeIds],
  };
}

/**
 * The save request for the form's values: texts trimmed, the price and minimum as numbers (null for none), and the version an edit was opened
 * with (null for an add). The product type list is the whole set, so the form keeps the ids of types its checklist does not show (retired
 * ones) in `productTypeIds` and they stay filed.
 */
export function toProductLineRequest(values: ProductLineInput, version: string | null): ProductLineRequest {
  const price = values.startsAtPrice.trim();
  const minimum = values.minimumQuantity.trim();
  return {
    version,
    title: values.title.trim(),
    shortName: values.shortName.trim(),
    number: values.number.trim(),
    cardText: values.cardText.trim(),
    description: values.description.trim(),
    fabricText: values.fabricText.trim(),
    collarText: values.collarText.trim(),
    cutText: values.cutText.trim(),
    namesText: values.namesText.trim(),
    logosText: values.logosText.trim(),
    startsAtPrice: price === '' || price === '.' ? null : Number(price),
    minimumQuantity: minimum === '' ? null : Number(minimum),
    isActive: values.isActive,
    productTypeIds: [...values.productTypeIds],
  };
}
