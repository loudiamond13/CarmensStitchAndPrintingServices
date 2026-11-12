// SPEC-GAP: hours and closures
// S2 Hours & Closures tab, /admin/site-content?tab=hours (CONT-01, CONT-04, D-21, D-22; plan 11-16): the weekly hours card, and below it the
// holidays and closures card. Each card loads its own data with its own loading and error states, so one failing card never blanks the other.
import { OpeningHoursCard } from '@/modules/admin/components/OpeningHoursCard';
import { siteContentStackClasses } from '@/modules/admin/components/siteContent.recipe';

export interface HoursTabProps {
  /** Called with true while the hours differ from the saved week, and with false when the tab closes. */
  onDirtyChange?: ((dirty: boolean) => void) | undefined;
}

export function HoursTab({ onDirtyChange }: HoursTabProps) {
  return (
    <div className={siteContentStackClasses}>
      <OpeningHoursCard onDirtyChange={onDirtyChange} />
    </div>
  );
}
