// HomeSections (UI-SPEC H1 items 3 to 7): everything on Home below the product cards, in the spec's order: Why CSPS, How ordering
// works, Recent work, the testimonials and the final call to action. It loads as one chunk after the page (lazyHome.ts), so the
// Home route's first download stays inside the 150 KB budget (PERF-01); the hero tag, which floats over the hero drawing, is
// exported from here so it comes down in the same chunk. While the home data loads, Recent work shows four frames and the
// testimonials three card frames; with none shown, or after a failed read, the section is left out.
import type { PublicRecentWork, PublicTestimonial } from '../services/contentService';
import { FinalCta } from './FinalCta';
import { HowOrdering } from './HowOrdering';
import { RecentWorkSkeletons, RecentWorkStrip } from './RecentWorkStrip';
import { TestimonialRow } from './TestimonialRow';
import { TestimonialSkeletons } from './TestimonialSkeletons';
import { WhyCsps } from './WhyCsps';

export { HeroTag } from './HeroTag';

export interface HomeSectionsProps {
  /** The newest shown orders; undefined while the home data loads, and none leaves the section out. */
  recentWork: readonly PublicRecentWork[] | undefined;
  /** The shown testimonials; undefined while the home data loads, and none leaves the section out. */
  testimonials: readonly PublicTestimonial[] | undefined;
  /** The Business Info turnaround line, or null for the no-promise text. */
  turnaroundLine: string | null;
  /** The Messenger link, or null when the shop has none. */
  messengerUrl: string | null;
}

export function HomeSections({ recentWork, testimonials, turnaroundLine, messengerUrl }: HomeSectionsProps) {
  return (
    <>
      <WhyCsps turnaroundLine={turnaroundLine} />
      <HowOrdering />
      {recentWork === undefined ? <RecentWorkSkeletons /> : <RecentWorkStrip items={recentWork} />}
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
