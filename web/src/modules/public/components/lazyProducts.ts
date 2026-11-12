// The Products parts that load after the page (PERF-01): the articles and the help card. They are declared in one file so the
// build writes one preload table for them, not one per use.
import { lazy } from 'react';

export const LazyProductList = lazy(() => import('./ProductList'));
export const LazyProductsHelp = lazy(() => import('./ProductsHelp'));
