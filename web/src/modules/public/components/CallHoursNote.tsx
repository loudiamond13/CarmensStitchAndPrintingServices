// The second line of the big Call button (UI-SPEC C1 ContactNowCard, D-21): the open days and hours, such as
// "Mon-Sat, 9:00 AM - 6:00 PM". It is left out when no day is open.
import { callButtonSummary } from '@/utils/hours';
import { weekHours } from '../hoursFacts';
import type { PublicSite } from '../services/siteService';

export interface CallHoursNoteProps {
  site: PublicSite;
}

export function CallHoursNote({ site }: CallHoursNoteProps) {
  return callButtonSummary(weekHours(site));
}

export default CallHoursNote;
