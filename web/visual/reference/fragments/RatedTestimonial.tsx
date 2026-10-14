// Reference side of the dev-only rated-testimonial wrapper (plan 02-25; test only, never shipped): one plain block
// around the frozen App. D.3 TestimonialCard. App. D.3 names the star rating with aria-label on a plain <div>, which
// axe reports (aria-prohibited-attr); the owner approved giving it role="img" (D-31 O-2), which the converted
// TestimonialCard renders by itself (web/src/dev/previews/RatedTestimonial.tsx). This side adds the same attribute after
// mount. Attributes are not compared. No look of its own.
import { useEffect, useRef, type ReactNode } from 'react';

export interface RatedTestimonialProps {
  children?: ReactNode;
}

export function RatedTestimonial({ children }: RatedTestimonialProps) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    for (const rating of frame.current?.querySelectorAll('.csp-testi-stars') ?? []) {
      rating.setAttribute('role', 'img');
    }
  }, []);
  return <div ref={frame}>{children}</div>;
}
