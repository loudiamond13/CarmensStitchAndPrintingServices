// The Products loading shapes (UI-SPEC P1 States, CLS < 0.05): six pill-shaped skeletons 44px tall in the pill bar's own
// frame, and article skeletons with the 5:4 media box and six text lines. Every skeleton is hidden from assistive
// technology; the LoadingRegion around them announces the load. The shapes come from the real parts' classes, so the page
// keeps its size when the lines arrive. Deep imports only (PERF-01): the shared Skeletons file pulls in an admin barrel.
import { Skeleton } from '@/components/feedback/Skeleton';
import {
  anchorsClasses,
  anchorsInClasses,
  articleClasses,
  prodWrapClasses,
  skeletonCopyClasses,
  skeletonMediaClasses,
} from './products.recipe';

const PILL_WIDTHS = [148, 140, 168, 116, 116, 140] as const;
const LINE_WIDTHS = ['30%', '90%', '100%', '100%', '75%', '55%'] as const;

/** Six pill skeletons in the pill bar's frame. */
export function PillSkeletons() {
  return (
    <div className={anchorsClasses} aria-hidden="true">
      <div className={anchorsInClasses}>
        {PILL_WIDTHS.map((width, index) => (
          <Skeleton
            key={`${String(index)}-${String(width)}`}
            width={width}
            height={44}
            radius={8}
            className="flex-none"
          />
        ))}
      </div>
    </div>
  );
}

/** Article skeletons: a media box and six text lines each. */
export function ArticleSkeletons({ count = 2 }: { count?: number }) {
  return (
    <div className={prodWrapClasses} aria-hidden="true">
      {Array.from({ length: count }, (_, position) => (
        <div key={position} className={articleClasses} data-product-skeleton="article">
          <div className={skeletonMediaClasses}>
            <Skeleton width="100%" height="100%" radius={0} />
          </div>
          <div className={skeletonCopyClasses}>
            {LINE_WIDTHS.map((width, line) => (
              <Skeleton key={width + String(line)} width={width} height={line === 1 ? 40 : 14} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
