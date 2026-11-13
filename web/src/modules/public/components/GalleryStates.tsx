// The Gallery's loading and empty shapes (UI-SPEC G1 States, CLS < 0.05). Loading: seven pill skeletons 44px tall in the bar's own
// frame and eight tile skeletons at 4 / 5, 1 / 1, 3 / 4 and 4 / 3 in turn, in the masonry's own columns, so the page keeps its
// size when the tiles land; each is hidden from assistive technology and the loading region around them announces the load.
// Empty: no pills, "No photos yet" and one Get a Quote button. Deep imports only (PERF-01).
import clsx from 'clsx';
import { buttonClasses } from '@/components/actions/button.recipe';
import { UiLink } from '@/components/actions/UiLink';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PUBLIC_COPY } from '../copy';
import {
  galleryBodyClasses,
  galleryStateClasses,
  masonryClasses,
  pillSkeletonClasses,
  tileSkeletonClasses,
  tileSkeletonRatios,
} from './gallery.recipe';
import { anchorsClasses, anchorsInClasses } from './products.recipe';

const { empty: EMPTY } = PUBLIC_COPY.gallery;

const PILL_WIDTHS = [88, 148, 140, 116, 168, 116, 124] as const;
const TILE_COUNT = 8;

/** Seven pill skeletons in the bar's frame, then eight tile skeletons in the masonry's columns. */
export function GallerySkeletons() {
  return (
    <>
      <div className={anchorsClasses} aria-hidden="true">
        <div className={anchorsInClasses}>
          {PILL_WIDTHS.map((width, position) => (
            <span key={position} className={pillSkeletonClasses} data-gallery-skeleton="pill">
              <Skeleton width={width} height={44} radius={8} />
            </span>
          ))}
        </div>
      </div>
      <div className={galleryBodyClasses} aria-hidden="true">
        <div className={masonryClasses}>
          {Array.from({ length: TILE_COUNT }, (_, position) => (
            <div
              key={position}
              className={clsx(tileSkeletonClasses, tileSkeletonRatios[position % tileSkeletonRatios.length])}
              data-gallery-skeleton="tile"
            >
              <Skeleton width="100%" height="100%" radius={0} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// The ButtonLink look without importing ButtonLink: a second reader of it split it into a chunk of its own (PERF-01).
const primaryButton = buttonClasses({ variant: 'primary', size: 'md' });

/** "No photos yet" with Get a Quote to /contact; there are no pills. */
export function GalleryEmpty() {
  return (
    <div className={galleryStateClasses}>
      <EmptyState
        icon="image"
        title={EMPTY.title}
        message={EMPTY.message}
        action={
          <UiLink to="/contact" className={primaryButton}>
            {PUBLIC_COPY.actions.getQuote}
          </UiLink>
        }
      />
    </div>
  );
}
