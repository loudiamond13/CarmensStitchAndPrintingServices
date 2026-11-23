// The two big contact buttons of the Contact aside (UI-SPEC Q1, App. E.4, D-18, D-23): Messenger, then Call. They lead the aside, above
// the hours card; the form carries the "what to send" questions now.
// SPEC-DEVIATION: D-23 the Call button dials the main number, and every number is in "Call or text".
// The Call button's second line is the open days (callButtonSummary, in CallHoursNote), left out when no day is open. It loads on
// its own so the page's first download stays inside the public budget (PERF-01).
// While the shop facts load, two 92px skeleton blocks stand in place of the buttons; a Messenger button is drawn only with a
// Messenger link.
import { Suspense } from 'react';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PUBLIC_COPY } from '../copy';
import type { PublicSite } from '../services/siteService';
import { mainPhone, telHref } from '../siteFacts';
import { BigContactButton } from './BigContactButton';
import { LazyCallHoursNote } from './lazyHours';
import { bigButtonsClasses } from './contact.recipe';

const { now: NOW } = PUBLIC_COPY.contact;

export interface ContactBigButtonsProps {
  /** The shop facts, or undefined while they load. */
  site: PublicSite | undefined;
}

export function ContactBigButtons({ site }: ContactBigButtonsProps) {
  const phone = site === undefined ? undefined : mainPhone(site);
  return (
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
              note={
                <Suspense fallback={null}>
                  <LazyCallHoursNote site={site} />
                </Suspense>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
