// H1 Home (UI-SPEC H1, App. E.1; PUB-01, PUB-02, CONT-03, D-34, D-36): the hero (text, two buttons, three chips and the
// drawing), the product line cards, Why CSPS, How ordering works, the testimonials and the final call to action. The lines
// and the testimonials come from the home boot block on a first visit and from the API after that (D-42). With no shown line
// the categories are left out, and with no shown testimonial the testimonials are; the rest stays. The Recent work strip and
// the hero tag join in plan 11-29. "Get a Quote" goes to /contact (D-19).
import { Suspense } from 'react';
import { useOutletContext } from 'react-router';
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import type { IconName } from '@/components/brand/icons';
import {
  aBtnPrimaryClasses,
  aBtnSecondaryClasses,
  btnRowClasses,
  chipClasses,
  chipIconClasses,
  chipsClasses,
  eyebrowClasses,
  h1EmClasses,
  heroClasses,
  heroCopyClasses,
  heroGridClasses,
  heroH1Classes,
  leadClasses,
} from '../components/public.recipe';
import { CategoryGrid } from '../components/CategoryGrid';
import { HeroArt } from '../components/HeroArt';
import { LazyHomeSections } from '../components/lazyHome';
import { PUBLIC_COPY } from '../copy';
import { useHomeQuery } from '../hooks/useHomeQuery';
import { usePageTitle } from '../hooks/usePageTitle';
import type { PublicOutletContext } from '../outletContext';
import type { PublicTestimonial } from '../services/contentService';

const CHIP_ICONS: readonly IconName[] = ['printer', 'shirt', 'users'];
const NO_TESTIMONIALS: readonly PublicTestimonial[] = [];

export function HomePage() {
  usePageTitle(PUBLIC_COPY.titles.home);
  const { eyebrow, headline, lead, chips } = PUBLIC_COPY.home.hero;
  const { getQuote, viewWork } = PUBLIC_COPY.actions;
  const query = useHomeQuery();
  // Outside the public layout (the page shown on its own) there is no context: no Messenger button, the no-promise text.
  const context = useOutletContext<PublicOutletContext | undefined>();
  const messengerUrl = context?.messengerUrl ?? null;
  const turnaroundLine = context?.turnaroundLine ?? null;
  const lines = query.status === 'success' ? query.data.lines : undefined;
  const testimonials = query.status === 'success' ? query.data.testimonials : undefined;
  return (
    <>
      <section className={heroClasses}>
        <div className={heroGridClasses}>
          <div className={heroCopyClasses}>
            <span className={eyebrowClasses}>{eyebrow}</span>
            <h1 className={heroH1Classes}>
              {`${headline.plain} `}
              <em className={h1EmClasses}>{headline.accent}</em>
            </h1>
            <p className={leadClasses}>{lead}</p>
            <div className={btnRowClasses}>
              <UiLink to="/contact" className={aBtnPrimaryClasses}>
                {getQuote}
                <Icon name="arrow-right" size={20} />
              </UiLink>
              <UiLink to="/gallery" className={aBtnSecondaryClasses}>
                {viewWork}
              </UiLink>
            </div>
            <div className={chipsClasses}>
              {chips.map((chip, index) => (
                <span key={chip} className={chipClasses}>
                  <Icon name={CHIP_ICONS[index] ?? 'printer'} size={16} className={chipIconClasses} />
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <HeroArt />
        </div>
      </section>
      {lines !== undefined && lines.length > 0 && <CategoryGrid lines={lines} />}
      <Suspense fallback={null}>
        <LazyHomeSections
          testimonials={testimonials ?? NO_TESTIMONIALS}
          turnaroundLine={turnaroundLine}
          messengerUrl={messengerUrl}
        />
      </Suspense>
    </>
  );
}
