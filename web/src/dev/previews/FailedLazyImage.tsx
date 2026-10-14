// Dev-only scenario wrapper (plan 02-28; never shipped, D-20): a LazyImage whose file failed to load, so it shows the
// chip-less MediaPlaceholder in the reserved aspect box, named by the alt text. A real broken download would be a
// failed request (a guard finding), and a corrupt inline image makes some engines log a console message, so the
// wrapper loads a 1×1 inline GIF, stops its `load` event in the capture phase on the frame, and fires the image's
// `error` event once after mount, as the browser would. Nothing in LazyImage changes for this.
// SPEC-GAP primitives have no reference, so there is no reference fragment: that side shows its missing-component note.
import { useEffect, useRef } from 'react';
import { LazyImage } from '@/ui/states';

/** A 1×1 transparent GIF, inline, so no request leaves the page (CSP img-src allows data:). */
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export interface FailedLazyImageProps {
  alt: string;
  ratio?: string;
}

function holdLoad(event: Event): void {
  event.stopPropagation();
}

export function FailedLazyImage({ alt, ratio }: FailedLazyImageProps) {
  const frame = useRef<HTMLDivElement>(null);
  const failed = useRef(false);
  useEffect(() => {
    const node = frame.current;
    if (node === null) {
      return undefined;
    }
    node.addEventListener('load', holdLoad, true);
    // Once only: a development re-run of the effect must not fail the image again.
    if (!failed.current) {
      failed.current = true;
      node.querySelector('img')?.dispatchEvent(new Event('error'));
    }
    return () => {
      node.removeEventListener('load', holdLoad, true);
    };
  }, []);
  return (
    <div ref={frame}>
      <LazyImage src={PIXEL} alt={alt} width={800} height={600} ratio={ratio} />
    </div>
  );
}
