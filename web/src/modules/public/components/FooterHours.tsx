// The footer's clock row (UI-SPEC "Footer", Visit column; CONT-04, D-21): one line per run of open days, such as
// "Mon-Sat · 9:00 AM - 6:00 PM". Closed days are left out, and with no open day the row is not rendered.
import { Icon } from '@/components/brand/Icon';
import { tw } from '@/ui/tw';
import { summarizeOpenDays } from '@/utils/hours';
import { weekHours } from '../hoursFacts';
import type { PublicSite } from '../services/siteService';

const rowClasses = tw('flex items-start gap-2');

export interface FooterHoursProps {
  site: PublicSite;
}

export function FooterHours({ site }: FooterHoursProps) {
  const lines = summarizeOpenDays(weekHours(site));
  if (lines.length === 0) {
    return null;
  }
  return (
    <li className={rowClasses}>
      <Icon name="clock" size={16} className="mt-px text-ink-muted" />
      <span className="flex flex-col gap-1">
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </li>
  );
}

export default FooterHours;
