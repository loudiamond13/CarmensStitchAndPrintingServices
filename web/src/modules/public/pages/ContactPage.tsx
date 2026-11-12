// C1 Contact (UI-SPEC C1, App. E.4, D-17, D-18, D-20): the page head with the 48px bottom padding and the contact-first lead,
// then `.s-contact`: the Message us card on the left (where the Phase 13 inquiry form returns) and the aside with the phone
// list and the map. The hours card (plan 11-14) leads the aside. The sticky bar is PublicLayout's.
// States: while the shop facts load the cards show their skeletons inside one loading region; if the read fails the whole
// area becomes one error with Try Again.
import { lazy, Suspense } from 'react';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingRegion } from '@/components/states/LoadingRegion';
import { ContactNowCard } from '../components/ContactNowCard';
import { MapCard } from '../components/MapCard';
import { PageHead } from '../components/PageHead';
import { PhoneListCard } from '../components/PhoneListCard';
import { SkeletonLines } from '../components/SkeletonLines';
import {
  contactGridClasses,
  contactSectionClasses,
  contactWrapClasses,
  infoCardClasses,
  sideClasses,
} from '../components/contact.recipe';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';
import { useSiteQuery } from '../hooks/useSiteQuery';

// The hours card loads on its own after the page, so the page's first download stays inside the public budget (PERF-01).
const HoursCard = lazy(async () => ({ default: (await import('../components/HoursCard')).HoursCard }));

export function ContactPage() {
  usePageTitle(PUBLIC_COPY.titles.contact);
  const { eyebrow, headline, lead } = PUBLIC_COPY.contact;
  const { errors } = PUBLIC_COPY.states;
  const query = useSiteQuery();
  const site = query.status === 'success' ? query.data : undefined;
  return (
    <>
      <PageHead flat crumb={PUBLIC_COPY.crumbs.contact} eyebrow={eyebrow} headline={headline} lead={lead} />
      <section className={contactSectionClasses}>
        {query.status === 'error' ? (
          <div className={contactWrapClasses}>
            <ErrorState align="start" title={errors.contact} message={errors.body} onRetry={query.retry} />
          </div>
        ) : (
          <LoadingRegion
            loading={query.status === 'loading'}
            things="our contact details"
            className={contactGridClasses}
          >
            <ContactNowCard site={site} />
            <aside className={sideClasses}>
              <Suspense
                fallback={
                  <div className={infoCardClasses}>
                    <SkeletonLines lines={3} />
                  </div>
                }
              >
                <HoursCard site={site} />
              </Suspense>
              {site !== undefined && <PhoneListCard phones={site.phones} />}
              <MapCard site={site} />
            </aside>
          </LoadingRegion>
        )}
      </section>
    </>
  );
}
