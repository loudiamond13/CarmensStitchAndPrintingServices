// Small readers over the public shop facts (PUB-02): the address line, the main phone and the social links. Every empty
// part is left out, so no page shows a gap, a bracket or a placeholder.
import type { PublicSite } from './services/siteService';

export type PublicPhone = PublicSite['phones'][number];

function parts(...values: readonly (string | null)[]): string[] {
  return values.filter((value): value is string => value !== null && value.trim() !== '');
}

/** "{street}, {town or city}, {province}, Philippines" without the empty parts and the postal code; '' with no part set. */
export function addressLine(address: PublicSite['address']): string {
  const set = parts(address.street, address.townOrCity, address.province);
  return set.length === 0 ? '' : [...set, 'Philippines'].join(', ');
}

/** "{street and barangay}, {town or city}" for the map label; '' with neither set. */
export function streetAndTown(address: PublicSite['address']): string {
  return parts(address.street, address.townOrCity).join(', ');
}

/** The number the Call buttons dial: the one marked main, else the first listed. */
export function mainPhone(site: PublicSite): PublicPhone | undefined {
  return site.phones.find((phone) => phone.isMain) ?? site.phones[0];
}

/** `tel:` link target for a number, always from its E.164 form. */
export function telHref(phone: PublicPhone): string {
  return `tel:${phone.e164}`;
}
