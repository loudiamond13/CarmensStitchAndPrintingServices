// The testimonial row's loading shape (UI-SPEC H1 States, CLS < 0.05): the section's own head over three card frames with four
// skeleton lines each, in the row's own grid, so the page keeps its size when the testimonials land. Every skeleton is hidden
// from assistive technology; the loading region around the page announces the load. Deep imports only (PERF-01).
import { Skeleton } from '@/components/feedback/Skeleton';
import { PUBLIC_COPY } from '../copy';
import {
  h2Classes,
  h2EmClasses,
  headClasses,
  homeWrapClasses,
  skeletonLinesClasses,
  testimonialSectionClasses,
  testimonialSkeletonClasses,
  testisClasses,
} from './home.recipe';
import { eyebrowClasses } from './public.recipe';

const { testimonials: COPY } = PUBLIC_COPY.home;

const LINE_WIDTHS = ['100%', '95%', '90%', '60%'] as const;

export function TestimonialSkeletons() {
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
        <div className={testisClasses}>
          {[0, 1, 2].map((position) => (
            <div
              key={position}
              className={testimonialSkeletonClasses}
              data-home-skeleton="testimonial"
              aria-hidden="true"
            >
              <div className={skeletonLinesClasses}>
                {LINE_WIDTHS.map((width) => (
                  <Skeleton key={width} width={width} height={14} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
