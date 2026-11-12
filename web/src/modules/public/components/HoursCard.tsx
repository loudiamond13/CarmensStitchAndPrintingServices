// HoursCard (UI-SPEC C1, App. E.4 `.s-infocard` with `.s-hours`; PUB-05, CONT-04, D-21, D-22): the "Business hours" title and
// the open status, the weekly rows grouped by `groupWeek`, and the closures of the next 30 days under "Closed on".
// SPEC-DEVIATION: A11Y-H the title is an h2 with App. E.4's h3 look, so the page's headings go h1 then h2.
// While the shop facts load the card shows its title, a pill-sized skeleton and three skeleton lines.
import { Fragment } from 'react';
import { Skeleton } from '@/components/feedback/Skeleton';
import { formatCalendarDate } from '@/utils/format';
import { groupWeek } from '@/utils/hours';
import { HOURS_COPY as HOURS } from '../hoursCopy';
import type { PublicSite } from '../services/siteService';
import { weekHours } from '../hoursFacts';
import { infoCardClasses, infoTitleClasses, labelClasses } from './contact.recipe';
import {
  closuresBlockClasses,
  closuresListClasses,
  hoursDayClasses,
  hoursHeadClasses,
  hoursListClasses,
  hoursTimeClasses,
} from './hours.recipe';
import { OpenStatus } from './OpenStatus';
import { SkeletonLines } from './SkeletonLines';

/** "Dec 25, 2026 · Christmas" or "Dec 30, 2026 to Jan 1, 2027 · Year-end inventory"; the note is left out when empty. */
function closureText(closure: PublicSite['upcomingClosures'][number]): string | null {
  const first = formatCalendarDate(closure.firstDay);
  const last = formatCalendarDate(closure.lastDay);
  if (first === null || last === null) {
    return null;
  }
  const days = closure.firstDay === closure.lastDay ? first : `${first} to ${last}`;
  const note = closure.note?.trim() ?? '';
  return note === '' ? days : `${days} · ${note}`;
}

export interface HoursCardProps {
  /** The shop facts, or undefined while they load. */
  site: PublicSite | undefined;
}

export function HoursCard({ site }: HoursCardProps) {
  const rows = site === undefined ? [] : groupWeek(weekHours(site));
  const closures = site === undefined ? [] : site.upcomingClosures.flatMap((closure) => closureText(closure) ?? []);
  return (
    <div data-hours-card className={infoCardClasses}>
      <div className={hoursHeadClasses}>
        <h2 className={infoTitleClasses}>{HOURS.title}</h2>
        {site === undefined ? <Skeleton width={84} height={16} radius={8} /> : <OpenStatus />}
      </div>
      {site === undefined ? (
        <SkeletonLines lines={3} />
      ) : (
        <dl className={hoursListClasses}>
          {rows.map((row) => (
            <Fragment key={row.days}>
              <dt className={hoursDayClasses}>{row.days}</dt>
              <dd className={hoursTimeClasses}>{row.hours ?? HOURS.closedRow}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {closures.length > 0 && (
        <div className={closuresBlockClasses}>
          <h3 className={labelClasses}>{HOURS.closedOn}</h3>
          <ul className={closuresListClasses}>
            {closures.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default HoursCard;
