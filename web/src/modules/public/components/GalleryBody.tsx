// GalleryBody (UI-SPEC G1 items 2 and 3, GAL-01, D-32, WEB-10): everything on the Gallery page under the page head, in one lazy
// chunk (lazyGallery.ts) so the Gallery route's first download stays inside the 150 KB budget (PERF-01). It reads the gallery,
// keeps the chosen category in ?category= through the loaded pill keys, and draws the filter bar and the masonry of that
// category: the first 24 tiles, Show More Photos for 24 more (no request, the focus goes to the first new tile) and, under
// them, Get a Quote. Loading shows the pill and tile skeletons; a failed read the error with Try Again and no pills; nothing
// shown the empty state. The lightbox opens from the tiles in plan 11-31.
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { UiLink } from '@/components/actions/UiLink';
import { PUBLIC_COPY } from '../copy';
import { useGalleryCategory } from '../hooks/useGalleryCategory';
import { useGalleryQuery } from '../hooks/useGalleryQuery';
import { isLineKey } from '../lineKey';
import type { PublicGalleryItem } from '../services/contentService';
import { GalleryFilterBar } from './GalleryFilterBar';
import { GalleryMasonry } from './GalleryMasonry';
import { GalleryEmpty, GallerySkeletons } from './GalleryStates';
import { PublicLoadingRegion, ProductsError, type LoadingMessages } from './ProductStates';
import { galleryActionRowClasses, galleryBodyClasses, galleryStateClasses, showMoreClasses } from './gallery.recipe';
import { aBtnSecondaryClasses } from './public.recipe';

const { gallery: COPY, states: STATES } = PUBLIC_COPY;

/** How many tiles show first, and how many Show More Photos adds. */
const PAGE_SIZE = 24;

const GALLERY_MESSAGES: LoadingMessages = { loading: STATES.loading.gallery, loaded: STATES.loaded.gallery };

interface GalleryResultsProps {
  items: readonly PublicGalleryItem[];
}

/** The tiles of one category with their paging. The page keys it by category, so a new category starts at 24 again. */
function GalleryResults({ items }: GalleryResultsProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  return (
    <div className={galleryBodyClasses}>
      <GalleryMasonry items={items} shown={shown} focusIndex={focusIndex} />
      {items.length > shown && (
        <div className={galleryActionRowClasses}>
          <button
            type="button"
            className={clsx(aBtnSecondaryClasses, showMoreClasses)}
            onClick={() => {
              setFocusIndex(shown);
              setShown(shown + PAGE_SIZE);
            }}
          >
            {COPY.showMore}
          </button>
        </div>
      )}
      <div className={galleryActionRowClasses}>
        <UiLink to="/contact" className={aBtnSecondaryClasses}>
          {COPY.wantOne}
        </UiLink>
      </div>
    </div>
  );
}

export function GalleryBody() {
  const query = useGalleryQuery();
  const gallery = query.status === 'success' ? query.data : undefined;
  const keys = useMemo(() => gallery?.pills.map((pill) => pill.key).filter(isLineKey), [gallery]);
  const [category, setCategory] = useGalleryCategory(keys);
  const items = useMemo(() => {
    if (gallery === undefined) {
      return [];
    }
    return category === null ? gallery.items : gallery.items.filter((item) => item.lineKey === category);
  }, [gallery, category]);
  if (query.status === 'error') {
    return (
      <div className={galleryStateClasses}>
        <ProductsError title={STATES.errors.gallery} onRetry={query.retry} />
      </div>
    );
  }
  return (
    <PublicLoadingRegion loading={query.status === 'loading'} messages={GALLERY_MESSAGES}>
      {gallery === undefined ? (
        <GallerySkeletons />
      ) : gallery.items.length === 0 ? (
        <GalleryEmpty />
      ) : (
        <>
          <GalleryFilterBar
            pills={gallery.pills}
            total={Number(gallery.total)}
            selected={category}
            onSelect={setCategory}
          />
          <GalleryResults key={category ?? 'all'} items={items} />
        </>
      )}
    </PublicLoadingRegion>
  );
}

export default GalleryBody;
