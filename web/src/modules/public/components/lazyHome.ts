// The Home parts that load after the page (PERF-01): everything below the product cards, and the hero tag that floats over the
// hero drawing. They are declared in one file so the build writes one preload table for them, not one per use; the tag comes
// from the same module as the sections, so both are one chunk.
import { lazy } from 'react';

export const LazyHomeSections = lazy(() => import('./HomeSections'));
export const LazyHeroTag = lazy(async () => ({ default: (await import('./HomeSections')).HeroTag }));
