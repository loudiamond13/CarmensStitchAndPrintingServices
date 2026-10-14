// SPEC-GAP: LazyImage (UI-SPEC "SPEC-GAP Primitive Specs" → LazyImage; UI considerations empty, loading and error |
// LazyImage; WEB-06, A11Y-01, PERF-02, T-02-63). A box with a reserved aspect ratio (`--ratio`, 4 / 3 by default like
// MediaPlaceholder) and a cover-fit image, so the layout never shifts (CLS < 0.05). Until the load event a full-box
// radius-0 Skeleton covers the image; after an error MediaPlaceholder fills the box with no label chip, and the box
// becomes an image named by the alt text (a decorative image, with an empty alt, is hidden instead). React escapes the
// src attribute, and the CSP img-src allow-list (unchanged here) blocks any other host.
import clsx from 'clsx';
import { useState } from 'react';
import { MediaPlaceholder } from '@/ui/brand';
import { Skeleton } from '@/ui/feedback';
import { lazyBoxClasses, lazyFallbackClasses, lazyImageClasses, lazySkeletonClasses } from './states.recipe';

export interface LazyImageProps {
  src: string;
  /** Empty for a decorative image. */
  alt: string;
  /** The intrinsic size, so the browser can reserve the space before the file arrives. */
  width: number;
  height: number;
  /** The box's CSS aspect ratio, like '1 / 1' (default '4 / 3'). */
  ratio?: string | undefined;
  /** The LCP image: loads eagerly with a high fetch priority. */
  priority?: boolean | undefined;
  /** Layout glue only, on the box. */
  className?: string | undefined;
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
      className={clsx(lazyBoxClasses, 'aspect-(--ratio)', className)}
      style={{ '--ratio': ratio }}
      role={named ? 'img' : undefined}
      aria-label={named ? alt : undefined}
      aria-hidden={failed && alt === '' ? true : undefined}
    >
      {failed ? (
        <MediaPlaceholder label={false} ratio={ratio} className={lazyFallbackClasses} />
      ) : (
        <img
          className={lazyImageClasses}
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
      {state === 'loading' && <Skeleton width="100%" height="100%" radius={0} className={lazySkeletonClasses} />}
    </div>
  );
}
