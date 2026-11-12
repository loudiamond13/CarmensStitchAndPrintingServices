// SPEC-GAP: PhoneListCard (UI-SPEC C1, D-23). "Call or text" lists every number, the main one first with a Main badge. It is
// not rendered with fewer than two numbers: the Call button already holds the only one.
import { UiLink } from '@/components/actions/UiLink';
import { Badge } from '@/components/status/Badge';
import { PUBLIC_COPY } from '../copy';
import { telHref, type PublicPhone } from '../siteFacts';
import {
  infoCardClasses,
  infoTitleClasses,
  phoneLinkClasses,
  phoneRowClasses,
  smallMutedClasses,
} from './contact.recipe';

const { phones: PHONES } = PUBLIC_COPY.contact;

export interface PhoneListCardProps {
  phones: readonly PublicPhone[];
}

export function PhoneListCard({ phones }: PhoneListCardProps) {
  if (phones.length < 2) {
    return null;
  }
  const ordered = [...phones].sort((a, b) => Number(b.isMain) - Number(a.isMain));
  return (
    <div className={infoCardClasses}>
      <h2 className={infoTitleClasses}>{PHONES.title}</h2>
      <ul className="flex flex-col">
        {ordered.map((phone) => (
          <li key={phone.e164} className={phoneRowClasses}>
            <UiLink
              to={telHref(phone)}
              aria-label={PHONES.callName(phone.display, phone.label)}
              className={phoneLinkClasses}
            >
              {phone.display}
            </UiLink>
            {phone.label !== null && <span className={smallMutedClasses}>{phone.label}</span>}
            {phone.isMain && <Badge tone="neutral">{PHONES.main}</Badge>}
          </li>
        ))}
      </ul>
    </div>
  );
}
