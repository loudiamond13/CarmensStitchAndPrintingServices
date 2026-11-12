// The Home categories' loading shape and failure (UI-SPEC H1 States, CLS < 0.05). While the home data loads, the section keeps
// its head and as many 4:5 card skeletons as there are cards, each with a body the height of a real card's, so nothing moves
// when the cards land. Every skeleton is hidden from assistive technology; the loading region around the page announces the
// load. When the read fails, the section shows the product lines error with Try Again (decorative sections never show an
// error, but the categories are the page's main content). Deep imports only (PERF-01): the shared Skeletons file pulls in an
// admin barrel.
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PUBLIC_COPY } from '../copy';
import {
  catSkeletonBodyClasses,
  catSkeletonClasses,
  catSkeletonMediaClasses,
  catsClasses,
  cutClasses,
  h2Classes,
  h2EmClasses,
  headInRowClasses,
  headRowClasses,
  homeWrapClasses,
} from './home.recipe';
import { ProductsError } from './ProductStates';
import { eyebrowClasses, linkClasses } from './public.recipe';

const { categories: COPY } = PUBLIC_COPY.home;

/** How many cards a first load without a boot block reserves: the six starting lines. */
export const DEFAULT_CARD_SKELETONS = 6;

export interface CategorySkeletonsProps {
  /** The number of card frames. */
  count?: number;
}

/** The section's head with the lead as a skeleton line (the count in words is not known yet), over the card frames. */
export function CategorySkeletons({ count = DEFAULT_CARD_SKELETONS }: CategorySkeletonsProps) {
  return (
    <section className={cutClasses}>
      <div className={homeWrapClasses}>
        <div className={headRowClasses}>
          <div className={headInRowClasses}>
            <span className={eyebrowClasses}>{COPY.eyebrow}</span>
            <h2 className={h2Classes}>
              {`${COPY.headline.plain} `}
              <em className={h2EmClasses}>{COPY.headline.accent}</em>
            </h2>
            <Skeleton width="min(560px, 100%)" height={28} />
          </div>
          <UiLink to="/products" className={linkClasses}>
            {COPY.allProducts}
            <Icon name="arrow-right" size={18} />
          </UiLink>
        </div>
        <div className={catsClasses}>
          {Array.from({ length: count }, (_, position) => (
            <div key={position} className={catSkeletonClasses} data-home-skeleton="card" aria-hidden="true">
              <div className={catSkeletonMediaClasses}>
                <Skeleton width="100%" height="100%" radius={0} />
              </div>
              <div className={catSkeletonBodyClasses}>
                <Skeleton width="70%" height={28} />
                <Skeleton width="100%" height={14} />
                <Skeleton width="60%" height={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface CategoriesErrorProps {
  /** Reads the home data again. */
  onRetry: () => void;
}

/** The categories section when the read failed: "Couldn't load the product lines." with Try Again. */
export function CategoriesError({ onRetry }: CategoriesErrorProps) {
  return (
    <section className={cutClasses}>
      <div className={homeWrapClasses}>
        <ProductsError onRetry={onRetry} />
      </div>
    </section>
  );
}
