// GalleryBody (UI-SPEC G1 items 2 and 3, GAL-01, WEB-10): everything on the Gallery page under the page head, in one lazy chunk
// (lazyGallery.ts) so the Gallery route's first download stays inside the 150 KB budget (PERF-01). It reads the gallery, keeps the
// chosen category in ?category= through the loaded pill keys, and draws the filter bar and the masonry of that category. The
// lightbox opens from the tiles in plan 11-31.
import { useMemo } from 'react';
import { useGalleryCategory } from '../hooks/useGalleryCategory';
import { useGalleryQuery } from '../hooks/useGalleryQuery';
import { isLineKey } from '../lineKey';
import { GalleryFilterBar } from './GalleryFilterBar';
import { GalleryMasonry } from './GalleryMasonry';
import { galleryBodyClasses } from './gallery.recipe';

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
  if (gallery === undefined) {
    return null;
  }
  return (
    <>
      <GalleryFilterBar
        pills={gallery.pills}
        total={Number(gallery.total)}
        selected={category}
        onSelect={setCategory}
      />
      <div className={galleryBodyClasses}>
        <GalleryMasonry items={items} shown={items.length} />
      </div>
    </>
  );
}

export default GalleryBody;
