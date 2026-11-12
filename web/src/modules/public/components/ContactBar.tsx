// ContactBar (UI-SPEC C1 item 4, PUB-06; App. E.4 `.s-mbar`): the sticky bar at the bottom of Contact on phones. "Messenger"
// goes to the stored Messenger link (same tab) and "Call us" dials the main number. It is hidden above 767px by a container
// class, never a script width check. Without a Messenger link "Call us" fills the bar. It waits for the shop facts: it is
// not rendered while they load or fail, or when there is nothing to offer.
import clsx from 'clsx';
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { PUBLIC_COPY } from '../copy';
import type { PublicSite } from '../services/siteService';
import { mainPhone, telHref } from '../siteFacts';
import { barClasses, barOneClasses, barPrimaryClasses, barSecondaryClasses, barTwoClasses } from './contact.recipe';

const { bar: BAR } = PUBLIC_COPY.contact;

export interface ContactBarProps {
  /** The shop facts, or undefined while they load or fail. */
  site: PublicSite | undefined;
}

export function ContactBar({ site }: ContactBarProps) {
  if (site === undefined) {
    return null;
  }
  const phone = mainPhone(site);
  if (phone === undefined && site.messengerUrl === null) {
    return null;
  }
  const both = phone !== undefined && site.messengerUrl !== null;
  return (
    <div data-contact-bar className={clsx(barClasses, both ? barTwoClasses : barOneClasses)}>
      {site.messengerUrl !== null && (
        <UiLink to={site.messengerUrl} className={barPrimaryClasses}>
          <Icon name="message-circle" size={20} />
          {BAR.messenger}
        </UiLink>
      )}
      {phone !== undefined && (
        <UiLink to={telHref(phone)} className={barSecondaryClasses}>
          <Icon name="phone" size={20} />
          {BAR.call}
        </UiLink>
      )}
    </div>
  );
}
