// The Business Info form's values and their mapping to and from the API (CONT-01, OR-3; plan 11-12). Every control is text, so
// the form holds strings: an empty optional value is "", and the request sends it as null (not set).
import type { SiteSettings, UpdateSiteSettingsRequest } from '@/modules/admin/services/siteSettingsService';

/** One phone row as the form holds it: the typed number, an optional label and whether it is the main number. */
export interface PhoneRowInput {
  number: string;
  label: string;
  isMain: boolean;
}

/** What the Business Info form holds while it is edited. */
export interface BusinessInfoInput {
  businessName: string;
  tagline: string;
  aboutText: string;
  turnaroundLine: string;
  street: string;
  townOrCity: string;
  province: string;
  postalCode: string;
  directionsUrl: string;
  mapEmbedUrl: string;
  messengerUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  contactEmail: string;
  phones: PhoneRowInput[];
}

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
