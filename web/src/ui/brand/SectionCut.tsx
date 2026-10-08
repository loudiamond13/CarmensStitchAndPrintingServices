// The diagonal cut section (CSPS-UI-SPEC.md §5, App. D.3 SectionCut, App. B `.csp-cut*`): a band clipped by the cut
// angle at the top, the bottom or both, on --surface or --accent, optionally with the dot mesh, and padded wider from
// 1024px. App. D.3's markup and props are kept; the look is utilities from brand.recipe.ts (D-33), the clip paths as
// arbitrary properties and the App. B `@media (min-width: 1024px)` rule as `lg:`.
import clsx from 'clsx';
import type { ReactNode } from 'react';
import {
  meshClasses,
  sectionCutClasses,
  sectionCutClipClasses,
  sectionCutInnerClasses,
  sectionCutToneClasses,
  type SectionCutTone,
} from './brand.recipe';

export interface SectionCutProps {
  top?: boolean;
  bottom?: boolean;
  tone?: SectionCutTone;
  mesh?: boolean;
  children?: ReactNode;
  /** Layout glue only. */
  className?: string;
}

/** The clip for the cuts asked for: both edges, one edge, or none (App. B `.csp-cut-top` / `.csp-cut-bottom`). */
function clipFor(top: boolean, bottom: boolean): string | undefined {
  if (top && bottom) {
    return sectionCutClipClasses.both;
  }
  if (top) {
    return sectionCutClipClasses.top;
  }
  return bottom ? sectionCutClipClasses.bottom : undefined;
}

export function SectionCut({
  top = true,
  bottom = true,
  tone = 'surface',
  mesh = false,
  children,
  className,
}: SectionCutProps) {
  return (
    <section
      className={clsx(
        sectionCutClasses,
        clipFor(top, bottom),
        sectionCutToneClasses[tone],
        mesh && meshClasses,
        className,
      )}
    >
      <div className={sectionCutInnerClasses}>{children}</div>
    </section>
  );
}
