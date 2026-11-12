// The Products loading region and error banner (UI-SPEC P1 States). They look and speak like the shared LoadingRegion and
// ErrorState, but are written here: the Products page reading those two shared parts changed how the build groups the
// chunks that Contact and the admin share, which cost every Contact visitor about 0.3 KB and put its bundle over the 150 KB
// limit (PERF-01). Only parts the page already uses are imported.
import { useState, type ReactNode } from 'react';
import { buttonClasses } from '@/components/actions/button.recipe';
import { Icon } from '@/components/brand/Icon';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { bannerStartClasses, bannerTextClasses } from '@/components/states/states.recipe';
import { PUBLIC_COPY } from '../copy';

const { errors, loading: LOADING, loaded: LOADED } = PUBLIC_COPY.states;

export interface ProductsLoadingRegionProps {
  /** True while the first load runs. */
  loading: boolean;
  children?: ReactNode;
}

/** The content with aria-busy while it loads, and one polite status line: "Loading the product lines…", then "The product lines loaded.". */
export function ProductsLoadingRegion({ loading, children }: ProductsLoadingRegionProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'loaded'>(loading ? 'loading' : 'idle');
  const [wasLoading, setWasLoading] = useState(loading);
  // Track the loading edges during render, so the announcement changes in the same render as aria-busy.
  if (loading !== wasLoading) {
    setWasLoading(loading);
    setPhase(loading ? 'loading' : 'loaded');
  }
  const message = phase === 'loading' ? LOADING.products : phase === 'loaded' ? LOADED.products : '';
  return (
    <>
      <div aria-busy={loading || undefined}>{children}</div>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {message}
      </div>
    </>
  );
}

export interface ProductsErrorProps {
  /** Reads the lines again. */
  onRetry: () => void;
}

/** "Couldn't load the product lines." over the reassurance line, with Try Again. */
export function ProductsError({ onRetry }: ProductsErrorProps) {
  return (
    <div className={bannerStartClasses} role="alert">
      <Icon name="triangle-alert" size={20} />
      <div className={bannerTextClasses}>
        <strong>{errors.products}</strong>
        <span>{errors.body}</span>
      </div>
      <button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={onRetry}>
        {errors.retry}
      </button>
    </div>
  );
}
