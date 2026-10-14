// The stitched divider (CSPS-UI-SPEC.md §5, App. D.3 StitchDivider, App. B `.csp-stitch-divider`): two dashed rules
// drawn by the ::before and ::after pseudo-elements, with an optional label between them. App. D.3's markup and props
// are kept; the look is utilities from brand.recipe.ts (D-33).
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { stitchDividerClasses, stitchLabelClasses } from './brand.recipe';

export interface StitchDividerProps {
  label?: ReactNode;
  /** Layout glue only. */
  className?: string;
}

export function StitchDivider({ label, className }: StitchDividerProps) {
  return (
    <div className={clsx(stitchDividerClasses, className)} role="separator">
      {label ? <span className={stitchLabelClasses}>{label}</span> : null}
    </div>
  );
}
