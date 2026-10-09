// SPEC-GAP: Skeleton family (RED stub, plan 02-28 Task 2).
export interface SkeletonImageProps {
  ratio?: string | undefined;
  className?: string | undefined;
}

export function SkeletonText() {
  return <div />;
}

export function SkeletonCard() {
  return <div />;
}

export function SkeletonImage({ className }: SkeletonImageProps) {
  return <div className={className} />;
}
