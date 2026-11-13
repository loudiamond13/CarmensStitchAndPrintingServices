// The Gallery parts that load after the page (PERF-01): the filter bar, the masonry and the states under the page head, and the
// lightbox that opens from a tile. They are declared in one file so the build writes one preload table for them, not one per use.
import { lazy } from 'react';

export const LazyGalleryBody = lazy(() => import('./GalleryBody'));
export const LazyGalleryLightbox = lazy(() => import('./GalleryLightbox'));
