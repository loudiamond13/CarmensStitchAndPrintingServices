// RED placeholder (plan 13 Task 3): replaced by the implementation in the GREEN commit.
export interface LazyImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  ratio?: string;
  priority?: boolean;
  className?: string;
}

export function LazyImage({ src, alt }: LazyImageProps) {
  return (
    <div>
      <img src={src} alt={alt} />
    </div>
  );
}
