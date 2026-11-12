// SPEC-GAP: contact before quote form (UI-SPEC C1, D-17, D-18). Until the inquiry form returns in Phase 13, the left column
// of Contact is this card: "Message us", the two big buttons (Messenger and Call) and "What to send". It sits where the
// form sits, in the `.s-formcard` look, so Phase 13 can put the form in its place and move the two buttons back to the aside.
// SPEC-DEVIATION: D-18 App. E.4's left column is the inquiry form; here it is this card (owner ruling).
// SPEC-DEVIATION: D-23 the Call button dials the main number, and every number is in "Call or text".
// While the shop facts load the card shows its title and intro and two 92px skeleton blocks in place of the buttons.
import { Icon } from '@/components/brand/Icon';
import type { IconName } from '@/components/brand/icons';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PUBLIC_COPY } from '../copy';
import type { PublicSite } from '../services/siteService';
import { mainPhone, telHref } from '../siteFacts';
import { BigContactButton } from './BigContactButton';
import {
  bigButtonsClasses,
  cardHeadClasses,
  cardTitleClasses,
  formCardClasses,
  labelClasses,
  sendBlockClasses,
  sendIconClasses,
  sendListClasses,
  sendRowClasses,
  smallMutedClasses,
} from './contact.recipe';

const { now: NOW } = PUBLIC_COPY.contact;
const SEND_ICONS: readonly IconName[] = ['users', 'shirt', 'palette'];

export interface ContactNowCardProps {
  /** The shop facts, or undefined while they load. */
  site: PublicSite | undefined;
}

export function ContactNowCard({ site }: ContactNowCardProps) {
  const phone = site === undefined ? undefined : mainPhone(site);
  return (
    <div className={formCardClasses}>
      <div className={cardHeadClasses}>
        <h2 className={cardTitleClasses}>{NOW.title}</h2>
        <p className={smallMutedClasses}>{NOW.intro}</p>
      </div>
      <div className={bigButtonsClasses}>
        {site === undefined ? (
          <>
            <Skeleton height={92} radius={12} />
            <Skeleton height={92} radius={12} />
          </>
        ) : (
          <>
            {site.messengerUrl !== null && (
              <BigContactButton
                tone="primary"
                href={site.messengerUrl}
                icon="message-circle"
                title={NOW.messenger}
                note={NOW.messengerNote}
              />
            )}
            {phone !== undefined && (
              <BigContactButton
                tone="outline"
                href={telHref(phone)}
                icon="phone"
                iconSize={24}
                title={NOW.call(phone.display)}
              />
            )}
          </>
        )}
      </div>
      <div className={sendBlockClasses}>
        <h3 className={labelClasses}>{NOW.whatToSend}</h3>
        <ul className={sendListClasses}>
          {NOW.sendItems.map((text, index) => (
            <li key={text} className={sendRowClasses}>
              <Icon name={SEND_ICONS[index] ?? 'users'} size={18} className={sendIconClasses} />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
