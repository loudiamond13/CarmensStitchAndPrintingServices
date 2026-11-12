// The Home parts that load after the page (PERF-01): everything below the product cards. They are declared in one file so the
// build writes one preload table for them, not one per use.
import { lazy } from 'react';

export const LazyHomeSections = lazy(() => import('./HomeSections'));
