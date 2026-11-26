// The quote form loads as its own piece right after the Contact page shows (D-35, PERF-01): react-hook-form, zod and the resolver
// never sit in the page's first download, and the build measures this piece on its own row.
import type { ComponentType } from 'react';

export type QuoteFormLoader = () => Promise<{ default: ComponentType }>;

export const loadQuoteForm: QuoteFormLoader = () => import('./QuoteForm');
