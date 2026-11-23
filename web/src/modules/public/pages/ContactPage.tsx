// C1 and Q1 Contact (UI-SPEC C1 and Q1, App. E.4, D-17, D-18, D-20, D-35): the page head with the 48px bottom padding and the quote lead, then
// `.s-contact`: the Get a Quote form card on the left (first on phones) and the aside on the right with the Messenger and Call big
// buttons, the hours card, the phone list and the map. The sticky bar is PublicLayout's.
// The form loads as its own piece right after the page shows, into a card of the same size, so nothing shifts (D-35). It needs no
// shop facts, so it renders at once. If its piece cannot load, a small message takes its place and the aside stays.
// States of the aside: while the shop facts load it shows its skeletons inside one loading region; if the read fails only the
// aside becomes an error with Try Again.
// SPEC-DEVIATION: SETTINGS-FAIL App. E.4 and the P11 rule blanked the whole area when the shop facts failed to load; only the aside
// shows the error now, because a lead is never lost to a settings read (D-03 spirit).
import { Suspense, useEffect } from 'react';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingRegion } from '@/components/states/LoadingRegion';
import { ContactBigButtons } from '../components/ContactBigButtons';
import { LazyHoursCard } from '../components/lazyHours';
import { MapCard } from '../components/MapCard';
import { PageHead } from '../components/PageHead';
import { PhoneListCard } from '../components/PhoneListCard';
import { QuoteFormSlot } from '../components/QuoteFormSlot';
import { SkeletonLines } from '../components/SkeletonLines';
import { contactGridClasses, contactSectionClasses, infoCardClasses, sideClasses } from '../components/contact.recipe';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';
import { useSiteQuery } from '../hooks/useSiteQuery';
import { QUOTE_FOCUS_EVENT } from '../quoteFormEvent';
import { focusQuoteForm, QUOTE_FORM_ID } from '../quoteFormTarget';

export function ContactPage() {
  usePageTitle(PUBLIC_COPY.titles.contact);
  // The header "Get a Quote", pressed while the visitor is already here, brings them to the form.
  useEffect(() => {
    window.addEventListener(QUOTE_FOCUS_EVENT, focusQuoteForm);
    return () => {
      window.removeEventListener(QUOTE_FOCUS_EVENT, focusQuoteForm);
    };
  }, []);
  const { eyebrow, headline, lead } = PUBLIC_COPY.contact;
  const { errors } = PUBLIC_COPY.states;
  const query = useSiteQuery();
  const site = query.status === 'success' ? query.data : undefined;
  return (
    <>
      <PageHead flat crumb={PUBLIC_COPY.crumbs.contact} eyebrow={eyebrow} headline={headline} lead={lead} />
      <section className={contactSectionClasses}>
        <div className={contactGridClasses}>
          <div id={QUOTE_FORM_ID} className="min-w-0">
            <QuoteFormSlot />
          </div>
          <aside className={sideClasses}>
            {query.status === 'error' ? (
              <ErrorState align="start" title={errors.contact} message={errors.body} onRetry={query.retry} />
            ) : (
              <LoadingRegion loading={query.status === 'loading'} things="our contact details" className={sideClasses}>
                <ContactBigButtons site={site} />
                <Suspense
                  fallback={
                    <div className={infoCardClasses}>
                      <SkeletonLines lines={3} />
                    </div>
                  }
                >
                  <LazyHoursCard site={site} />
                </Suspense>
                {site !== undefined && <PhoneListCard phones={site.phones} />}
                <MapCard site={site} />
              </LoadingRegion>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
