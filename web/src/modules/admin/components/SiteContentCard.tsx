// One Site Content card (UI-SPEC S2; plan 11-16): the head with the h2, its 13px hint and an optional action, the body, and an optional
// footer on a hairline. The looks are the My Profile card recipes.
import { useId, type ReactNode } from 'react';
import {
  profileCardBodyClasses,
  profileCardClasses,
  profileCardFootClasses,
  profileCardHeadClasses,
  profileCardHintClasses,
  profileCardTitleClasses,
} from '@/modules/admin/components/profile.recipe';

export interface SiteContentCardProps {
  title: string;
  hint: string;
  /** A button in the head, beside the title. */
  action?: ReactNode;
  /** The buttons at the end of the card. */
  footer?: ReactNode;
  children: ReactNode;
}

export function SiteContentCard({ title, hint, action, footer, children }: SiteContentCardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={profileCardClasses}>
      <div className={profileCardHeadClasses}>
        <div>
          <h2 id={headingId} className={profileCardTitleClasses}>
            {title}
          </h2>
          <p className={profileCardHintClasses}>{hint}</p>
        </div>
        {action}
      </div>
      <div className={profileCardBodyClasses}>{children}</div>
      {footer !== undefined && <div className={profileCardFootClasses}>{footer}</div>}
    </section>
  );
}
