// H1 Home (UI-SPEC H1, App. E.1; PUB-01, PUB-02, CONT-03, D-14, D-34, D-36): the hero (text, two buttons, three chips, the
// drawing and the "Recent order" tag), the product line cards, Why CSPS, How ordering works, Recent work, the testimonials and
// the final call to action. The lines, the recent orders and the testimonials come from the home boot block on a first visit
// and from the API after that (D-42). With no shown line the categories are left out, with no shown order the strip and the
// tag are, and with no shown testimonial the testimonials are; the rest stays. The strip and the tag load after the page
// (lazyHome.ts, PERF-01). "Get a Quote" goes to /contact (D-19).
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
import { CategoriesError, CategorySkeletons } from '../components/CategoryStates';
import { CategoryGrid } from '../components/CategoryGrid';
import { HeroArt } from '../components/HeroArt';
import { LazyHeroTag, LazyHomeSections } from '../components/lazyHome';
import { PublicLoadingRegion, type LoadingMessages } from '../components/ProductStates';
import { PUBLIC_COPY } from '../copy';
import { useHomeQuery } from '../hooks/useHomeQuery';
import { usePageTitle } from '../hooks/usePageTitle';
import type { PublicOutletContext } from '../outletContext';
import type { PublicRecentWork, PublicTestimonial } from '../services/contentService';

const CHIP_ICONS: readonly IconName[] = ['printer', 'shirt', 'users'];
const NO_TESTIMONIALS: readonly PublicTestimonial[] = [];
const NO_RECENT_WORK: readonly PublicRecentWork[] = [];
const PAGE_MESSAGES: LoadingMessages = {
  loading: PUBLIC_COPY.states.loading.page,
  loaded: PUBLIC_COPY.states.loaded.page,
};

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
  // Loading: undefined (three frames). A failed read leaves the testimonials out, as a decorative section shows no error.
  const testimonials =
    query.status === 'success' ? query.data.testimonials : query.status === 'error' ? NO_TESTIMONIALS : undefined;
  // Recent work holds four frames while the data loads and is left out after a failed read; the hero tag shows only with data.
  const recentWork =
    query.status === 'success' ? query.data.recentWork : query.status === 'error' ? NO_RECENT_WORK : undefined;
  const heroTag = query.status === 'success' ? query.data.heroTag : null;
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
          <div className="relative">
            <HeroArt />
            {heroTag !== null && (
              <Suspense fallback={null}>
                <LazyHeroTag tag={heroTag} />
              </Suspense>
            )}
          </div>
        </div>
      </section>
      <PublicLoadingRegion
        loading={query.status === 'loading'}
        failed={query.status === 'error'}
        messages={PAGE_MESSAGES}
      >
        {query.status === 'error' ? (
          <CategoriesError onRetry={query.retry} />
        ) : lines === undefined ? (
          <CategorySkeletons />
        ) : (
          lines.length > 0 && <CategoryGrid lines={lines} />
        )}
        <Suspense fallback={null}>
          <LazyHomeSections
            recentWork={recentWork}
            testimonials={testimonials}
            turnaroundLine={turnaroundLine}
            messengerUrl={messengerUrl}
          />
        </Suspense>
      </PublicLoadingRegion>
    </>
  );
}
