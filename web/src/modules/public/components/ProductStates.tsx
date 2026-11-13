// The public loading region and error banner (UI-SPEC P1 and H1 States). They look and speak like the shared LoadingRegion and
// ErrorState, but are written here: the Products page reading those two shared parts changed how the build groups the
// chunks that Contact and the admin share, which cost every Contact visitor about 0.3 KB and put its bundle over the 150 KB
// limit (PERF-01). Only parts the page already uses are imported. The Home page uses the same two parts: its categories fail
// with the same words, and its region announces "Loading the page…".
import { useState, type ReactNode } from 'react';
import { buttonClasses } from '@/components/actions/button.recipe';
import { Icon } from '@/components/brand/Icon';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { bannerStartClasses, bannerTextClasses } from '@/components/states/states.recipe';
import { PUBLIC_COPY } from '../copy';

const { errors, loading: LOADING, loaded: LOADED } = PUBLIC_COPY.states;

/** The two polite announcements of a loading region. */
export interface LoadingMessages {
  readonly loading: string;
  readonly loaded: string;
}

const PRODUCT_MESSAGES: LoadingMessages = { loading: LOADING.products, loaded: LOADED.products };

export interface PublicLoadingRegionProps {
  /** True while the first load runs. */
  loading: boolean;
  /** What the region says when it starts and when it is done. */
  messages: LoadingMessages;
  /** The load that just ended failed: the error banner announces that, so the region says nothing. */
  failed?: boolean;
  children?: ReactNode;
}

type Phase = 'idle' | 'loading' | 'loaded' | 'failed';

/** The content with aria-busy while it loads, and one polite status line: "Loading the product lines…", then "The product lines loaded.". */
export function PublicLoadingRegion({ loading, messages, failed = false, children }: PublicLoadingRegionProps) {
  const [phase, setPhase] = useState<Phase>(loading ? 'loading' : 'idle');
  const [wasLoading, setWasLoading] = useState(loading);
  // Track the loading edges during render, so the announcement changes in the same render as aria-busy.
  if (loading !== wasLoading) {
    setWasLoading(loading);
    setPhase(loading ? 'loading' : failed ? 'failed' : 'loaded');
  }
  const message = phase === 'loading' ? messages.loading : phase === 'loaded' ? messages.loaded : '';
  return (
    <>
      <div aria-busy={loading || undefined}>{children}</div>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {message}
      </div>
    </>
  );
}

export interface ProductsLoadingRegionProps {
  /** True while the first load runs. */
  loading: boolean;
  children?: ReactNode;
}

/** The Products page's region: "Loading the product lines…", then "The product lines loaded.". */
export function ProductsLoadingRegion({ loading, children }: ProductsLoadingRegionProps) {
  return (
    <PublicLoadingRegion loading={loading} messages={PRODUCT_MESSAGES}>
      {children}
    </PublicLoadingRegion>
  );
}

export interface ProductsErrorProps {
  /** Reads the data again. */
  onRetry: () => void;
  /** What could not be loaded, as the banner says it; the product lines by default. */
  title?: string;
}

/** "Couldn't load the product lines." (or the given title) over the reassurance line, with Try Again. */
export function ProductsError({ onRetry, title = errors.products }: ProductsErrorProps) {
  return (
    <div className={bannerStartClasses} role="alert">
      <Icon name="triangle-alert" size={20} />
      <div className={bannerTextClasses}>
        <strong>{title}</strong>
        <span>{errors.body}</span>
      </div>
      <button type="button" className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={onRetry}>
        {errors.retry}
      </button>
    </div>
  );
}
