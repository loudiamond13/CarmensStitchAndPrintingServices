// SPEC-GAP: SkipLink (02-UI-SPEC SPEC-GAP "SkipLink"; A11Y-02, WCAG 2.4.1).
// The first focusable element of each layout. It reuses the primary md button classes for its look; spec-gaps.css only
// hides it until :focus-visible and then fixes it at the top left. Activating it moves focus to the target (the
// layout's <main id="main" tabIndex={-1}>) and prevents the default, so no #main lands in the URL or the history.
import type { MouseEvent } from 'react';
import { SKIP_LINK_COPY } from './copy';

export function SkipLink({ targetId = 'main' }: { targetId?: string }) {
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(targetId)?.focus();
  };
  return (
    <a href={`#${targetId}`} className="csp-btn csp-btn-primary csp-btn-md csp-skip-link" onClick={skip}>
      {SKIP_LINK_COPY.label}
    </a>
  );
}
