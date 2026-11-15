// G1 Gallery (UI-SPEC G1, App. E.3; GAL-01, D-03, D-30 to D-32, WEB-10): the page head, then the filter bar and the masonry of
// one tile per order or upload. The route sits under the lazy UrlStateLayout (WEB-10). Everything under the head, the gallery
// read and the ?category= parameter included, loads as one chunk after the page (lazyGallery.ts), so the route's first
// download stays inside the 150 KB budget (PERF-01). The lightbox opens from the tiles in plan 11-31.
import { Suspense } from 'react';
import { LazyGalleryBody } from '../components/lazyGallery';
import { PageHead } from '../components/PageHead';
import { PUBLIC_COPY } from '../copy';
import { usePageTitle } from '../hooks/usePageTitle';

export function GalleryPage() {
  usePageTitle(PUBLIC_COPY.titles.gallery);
  const { eyebrow, headline, lead } = PUBLIC_COPY.gallery;
  return (
    <>
      <PageHead flat crumb={PUBLIC_COPY.crumbs.gallery} eyebrow={eyebrow} headline={headline} lead={lead} />
      <Suspense fallback={null}>
        <LazyGalleryBody />
      </Suspense>
    </>
  );
}
