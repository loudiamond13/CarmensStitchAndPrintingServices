// SPEC-GAP: Skeleton family (UI-SPEC "SPEC-GAP Primitive Specs" → Skeleton family + LoadingRegion; App. E.8 loading
// skeleton; WEB-06). Wrappers over the App. D.3 Skeleton for first loads only. Every skeleton is aria-hidden; the
// LoadingRegion around it announces the load. Sizes go only through the Skeleton's --sk-w/--sk-h/--sk-r and the image
// ratio only through --ratio (D-33). The shimmer stops under reduced motion with the Skeleton look itself (O-6).
// SkeletonTable comes with ResponsiveTable (plan 02-30), inside the list-table wrapper look.
import clsx from 'clsx';
import { Skeleton } from '@/components/feedback';
import { cardClasses } from '@/components/money';
import { skeletonCardBodyClasses, skeletonCardClasses, skeletonTextClasses } from './states.recipe';

const TEXT_LINE_WIDTHS = ['100%', '90%', '60%'] as const;

export interface SkeletonTextProps {
  /** How many lines: three by default, or one for a single line such as a page subline. */
  lines?: 1 | 2 | 3 | undefined;
}

/** Text lines, 14px high at 100%, 90% and 60%, 8px apart (three by default). */
export function SkeletonText({ lines = 3 }: SkeletonTextProps) {
  return (
    <div className={skeletonTextClasses} aria-hidden="true">
      {TEXT_LINE_WIDTHS.slice(0, lines).map((width) => (
        <Skeleton key={width} width={width} height={14} />
      ))}
    </div>
  );
}

/** The App. E.8 order-card skeleton: the 180px media block, then the number, team, customer and totals lines. */
export function SkeletonCard() {
  return (
    <div className={clsx(cardClasses, skeletonCardClasses)} aria-hidden="true">
      <Skeleton height={180} radius={0} />
      <div className={skeletonCardBodyClasses}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="75%" height={22} />
        <Skeleton width="55%" height={14} />
        <Skeleton height={56} />
      </div>
    </div>
  );
}

export interface SkeletonImageProps {
  /** The image's aspect ratio, reserved so the real image lands without a shift; 4 / 3 like MediaPlaceholder. */
  ratio?: string | undefined;
  /** Layout glue only. */
  className?: string | undefined;
}

/** A full-box, radius-0 Skeleton in a box with the image's aspect ratio. */
export function SkeletonImage({ ratio = '4 / 3', className }: SkeletonImageProps) {
  return (
    <div className={clsx('aspect-(--ratio)', className)} style={{ '--ratio': ratio }} aria-hidden="true">
      <Skeleton width="100%" height="100%" radius={0} />
    </div>
  );
}
