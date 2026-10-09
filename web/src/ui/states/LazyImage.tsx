// SPEC-GAP: LazyImage (RED stub, plan 02-28 Task 2).
export interface LazyImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  ratio?: string | undefined;
  priority?: boolean | undefined;
  className?: string | undefined;
}

export function LazyImage({ alt }: LazyImageProps) {
  return <div data-alt={alt} />;
}
