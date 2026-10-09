// SPEC-GAP: SkipLink (UI-SPEC "SPEC-GAP Primitive Specs" → SkipLink; A11Y-02, WCAG 2.4.1).
// The first focusable element of each layout. Its look is the primary md button (buttonClasses); it adds only
// visibility and position: visually hidden until it has keyboard focus, then fixed at the top left above everything.
// Activating it moves focus to the target (the layout's <main id="main" tabIndex={-1}>; base.css drops that element's
// focus outline) and prevents the default, so no #main lands in the URL or the history.
import clsx from 'clsx';
import type { MouseEvent } from 'react';
import { buttonClasses } from '@/ui/actions';
import { ENTRY_COPY } from './copy';
import { skipLinkClasses } from './entry.recipe';

export interface SkipLinkProps {
  /** The id of the element that takes focus; the layouts' `main` is "main". */
  targetId?: string;
}

export function SkipLink({ targetId = 'main' }: SkipLinkProps) {
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(targetId)?.focus();
  };
  return (
    <a
      href={`#${targetId}`}
      className={clsx(buttonClasses({ variant: 'primary', size: 'md' }), skipLinkClasses)}
      onClick={skip}
    >
      {ENTRY_COPY.skipLink.label}
    </a>
  );
}
