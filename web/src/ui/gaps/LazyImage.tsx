// SPEC-GAP: LazyImage (02-UI-SPEC SPEC-GAP "LazyImage"; WEB-06, A11Y-01, PERF-02, T-02-38). A box with a reserved
// aspect ratio (4 / 3 by default, like MediaPlaceholder) and a cover-fit image, so the layout never shifts (CLS).
// Until the load event a full-box radius-0 Skeleton covers the image; after an error MediaPlaceholder fills the box
// with no label chip, and the box takes role="img" named by the alt text (no role for a decorative image, which is
// hidden instead). React escapes the src attribute and the CSP img-src allow-list blocks other hosts.
import { clsx } from 'clsx';
import { useState } from 'react';
import { MediaPlaceholder, Skeleton } from '@/ui';

export interface LazyImageProps {
  src: string;
  /** Empty for a decorative image. */
  alt: string;
  /** The intrinsic size, so the browser can reserve the space before the file arrives. */
  width: number;
  height: number;
  /** The box's CSS aspect-ratio, like '1 / 1'. */
  ratio?: string;
  /** The LCP image: loading="eager" and fetchpriority="high". */
  priority?: boolean;
  className?: string;
}

type LoadState = 'loading' | 'loaded' | 'failed';

export function LazyImage({ src, alt, width, height, ratio = '4 / 3', priority = false, className }: LazyImageProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [shownSrc, setShownSrc] = useState(src);
  // A new source starts over with the skeleton (reset during render, not in an effect).
  if (src !== shownSrc) {
    setShownSrc(src);
    setState('loading');
  }
  const failed = state === 'failed';
  const named = failed && alt !== '';
  return (
    <div
      className={clsx('csp-lazy', className)}
      style={{ aspectRatio: ratio }}
      role={named ? 'img' : undefined}
      aria-label={named ? alt : undefined}
      aria-hidden={failed && alt === '' ? true : undefined}
    >
      {failed ? (
        <MediaPlaceholder ratio={ratio} />
      ) : (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : undefined}
          onLoad={() => {
            setState('loaded');
          }}
          onError={() => {
            setState('failed');
          }}
        />
      )}
      {state === 'loading' && <Skeleton width="100%" height="100%" radius={0} />}
    </div>
  );
}
