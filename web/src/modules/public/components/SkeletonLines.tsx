// Skeleton text lines for the public parts, 14px high at 100% then 90%, 8px apart. A light copy of SkeletonText: that one
// sits in a file that imports the admin money barrel, which a public chunk must not carry (PERF-01).
import { Skeleton } from '@/components/feedback/Skeleton';
import { skeletonTextClasses } from '@/components/states/states.recipe';

const WIDTHS = ['100%', '90%', '60%'] as const;

export interface SkeletonLinesProps {
  lines?: 1 | 2 | 3;
}

export function SkeletonLines({ lines = 2 }: SkeletonLinesProps) {
  return (
    <div className={skeletonTextClasses} aria-hidden="true">
      {WIDTHS.slice(0, lines).map((width) => (
        <Skeleton key={width} width={width} height={14} />
      ))}
    </div>
  );
}
