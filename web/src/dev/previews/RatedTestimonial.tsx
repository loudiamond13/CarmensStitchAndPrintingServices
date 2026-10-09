// Dev-only scenario wrapper (plan 02-25; never shipped, D-20): one plain block around a TestimonialCard. The converted
// TestimonialCard gives its star rating role="img" by itself (owner ruling D-31 O-2: the rating `<div aria-label>` is
// one named image), so this side does nothing. The reference side gives the frozen App. D.3 rating the same attribute
// after mount, so axe passes on both pages (web/visual/reference/fragments/RatedTestimonial.tsx); attributes are not
// compared. It adds no look of its own.
import type { ReactNode } from 'react';

export interface RatedTestimonialProps {
  /** The TestimonialCard node. */
  children?: ReactNode;
}

export function RatedTestimonial({ children }: RatedTestimonialProps) {
  return <div>{children}</div>;
}
