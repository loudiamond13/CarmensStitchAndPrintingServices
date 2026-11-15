// TestimonialRow (UI-SPEC H1 item 6, App. E.1; D-05, CONT-03): "From the court and the road", the first three shown
// testimonials as TestimonialCards with their star rating. Three columns, two on tablets, and on phones one row of cards that
// scrolls and snaps inside itself.
// SPEC-DEVIATION: A11Y-SCROLL. At phone width the scrolling row is a region named "Testimonials" that takes a tab stop, so a
// keyboard can scroll it (an area that scrolls must be reachable). Wider, nothing scrolls, so it is plain markup.
import { useSyncExternalStore } from 'react';
import { TestimonialCard } from '@/components/marketing/TestimonialCard';
import { PUBLIC_COPY } from '../copy';
import type { PublicTestimonial } from '../services/contentService';
import {
  h2Classes,
  h2EmClasses,
  headClasses,
  homeWrapClasses,
  testimonialSectionClasses,
  testisClasses,
} from './home.recipe';
import { eyebrowClasses } from './public.recipe';

const { testimonials: COPY } = PUBLIC_COPY.home;

/** How many testimonials Home draws. */
const SHOWN = 3;
const PHONE = '(max-width: 767px)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(PHONE);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function isPhone(): boolean {
  return window.matchMedia(PHONE).matches;
}

export interface TestimonialRowProps {
  testimonials: readonly PublicTestimonial[];
}

export function TestimonialRow({ testimonials }: TestimonialRowProps) {
  const phone = useSyncExternalStore(subscribe, isPhone, () => false);
  return (
    <section className={testimonialSectionClasses}>
      <div className={homeWrapClasses}>
        <div className={headClasses}>
          <span className={eyebrowClasses}>{COPY.eyebrow}</span>
          <h2 className={h2Classes}>
            {`${COPY.headline.plain} `}
            <em className={h2EmClasses}>{COPY.headline.accent}</em>
            {` ${COPY.headline.rest}`}
          </h2>
        </div>
        <div
          className={testisClasses}
          role={phone ? 'region' : undefined}
          aria-label={phone ? COPY.region : undefined}
          // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a sideways-scrolling region must take keyboard focus (WCAG 2.1.1)
          tabIndex={phone ? 0 : undefined}
        >
          {testimonials.slice(0, SHOWN).map((testimonial, index) => (
            <TestimonialCard
              key={`${String(index)}|${testimonial.name}|${testimonial.quote}`}
              quote={testimonial.quote}
              name={testimonial.name}
              team={testimonial.teamOrRole ?? ''}
              rating={Number(testimonial.stars)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
