// HomeSections (UI-SPEC H1 items 3, 4, 6 and 7): everything on Home below the product cards, in the spec's order: Why CSPS,
// How ordering works, the testimonials and the final call to action. It loads as one chunk after the page (lazyHome.ts), so
// the Home route's first download stays inside the 150 KB budget (PERF-01). While the home data loads the testimonials show as
// three card frames; with none shown, or after a failed read, the section is left out.
import type { PublicTestimonial } from '../services/contentService';
import { FinalCta } from './FinalCta';
import { HowOrdering } from './HowOrdering';
import { TestimonialRow } from './TestimonialRow';
import { TestimonialSkeletons } from './TestimonialSkeletons';
import { WhyCsps } from './WhyCsps';

export interface HomeSectionsProps {
  /** The shown testimonials; undefined while the home data loads, and none leaves the section out. */
  testimonials: readonly PublicTestimonial[] | undefined;
  /** The Business Info turnaround line, or null for the no-promise text. */
  turnaroundLine: string | null;
  /** The Messenger link, or null when the shop has none. */
  messengerUrl: string | null;
}

export function HomeSections({ testimonials, turnaroundLine, messengerUrl }: HomeSectionsProps) {
  return (
    <>
      <WhyCsps turnaroundLine={turnaroundLine} />
      <HowOrdering />
      {testimonials === undefined ? (
        <TestimonialSkeletons />
      ) : (
        testimonials.length > 0 && <TestimonialRow testimonials={testimonials} />
      )}
      <FinalCta messengerUrl={messengerUrl} />
    </>
  );
}

export default HomeSections;
