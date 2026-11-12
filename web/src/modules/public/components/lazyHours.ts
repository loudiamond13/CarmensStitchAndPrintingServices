// The hours parts that load after the page (PERF-01): the Contact hours card, the footer clock row and the Call button's
// hours line. They are declared together so the build writes one preload table for all three, not one per page chunk.
import { lazy } from 'react';

export const LazyHoursCard = lazy(() => import('./HoursCard'));
export const LazyFooterHours = lazy(() => import('./FooterHours'));
export const LazyCallHoursNote = lazy(() => import('./CallHoursNote'));
