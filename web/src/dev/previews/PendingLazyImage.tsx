// Dev-only scenario wrapper (plan 02-28; never shipped, D-20): a LazyImage whose file has not arrived yet, so it shows
// its full-box radius-0 Skeleton in the reserved aspect box. A real slow download cannot be held open in the parity
// run (a request still pending or aborted at the end is a guard finding), so the wrapper loads a 1×1 inline GIF and
// stops its `load` event in the capture phase on the frame, before it reaches the image. The image therefore stays in
// its loading state for as long as the case is on screen. Nothing in LazyImage changes for this.
// SPEC-GAP primitives have no reference, so there is no reference fragment: that side shows its missing-component note.
import { LazyImage } from '@/components/states';

/** A 1×1 transparent GIF, inline, so no request leaves the page (CSP img-src allows data:). */
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export interface PendingLazyImageProps {
  alt: string;
  ratio?: string;
}

function holdLoad(event: Event): void {
  event.stopPropagation();
}

/** Stops every `load` event below the frame in the capture phase, so it never reaches the image. */
function holdLoads(frame: HTMLDivElement | null): (() => void) | undefined {
  if (frame === null) {
    return undefined;
  }
  frame.addEventListener('load', holdLoad, true);
  return () => {
    frame.removeEventListener('load', holdLoad, true);
  };
}

export function PendingLazyImage({ alt, ratio }: PendingLazyImageProps) {
  return (
    <div ref={holdLoads}>
      <LazyImage src={PIXEL} alt={alt} width={800} height={600} ratio={ratio} />
    </div>
  );
}
