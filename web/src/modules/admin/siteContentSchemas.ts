// The Business Info form's schema and its mapping to and from the API (OR-3; CONT-01, D-23, D-24; plan 11-12). It mirrors the server's
// UpdateSiteSettingsRequestValidator, SiteLinks and PhilippinePhone rule for rule, with the server's own messages, so the browser
// checks every rule the server checks before a request is sent. Lengths count UTF-16 code units after the trim, the same unit as the
// server. An empty optional value is "not set" and is never checked. No rule uses a regular expression that can backtrack (CWE-1333).
// The accept and refuse cases are the files the .NET tests read too: tests/fixtures/philippine-phone-cases.json and
// tests/fixtures/site-link-cases.json. Only what the server alone can know stays server-side.
import { z } from 'zod';
import { isEmailShaped } from '@/modules/admin/authSchemas';
import type { SiteSettings, UpdateSiteSettingsRequest } from '@/modules/admin/services/siteSettingsService';
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
