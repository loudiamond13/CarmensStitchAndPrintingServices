// Dev-only scenario wrapper (plan 02-27; never shipped, D-20): the SkipLink as a keyboard user first meets it. The
// link is visually hidden until it has keyboard focus, and the parity harness never drives a state on an
// implementation-only (`parity: false`) case, so this wrapper focuses the link once after mount, as the first Tab on a
// page would. It also renders the `main#main` target the link moves focus to (tabIndex -1, as the layouts render it).
// SPEC-GAP primitives have no reference, so there is no reference fragment: that side shows its missing-component note.
import { useEffect, useRef } from 'react';
import { SkipLink } from '@/components/entry';

export function FocusedSkipLink() {
  const frame = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not move focus again.
    if (focused.current) {
      return;
    }
    focused.current = true;
    frame.current?.querySelector('a')?.focus();
  }, []);
  return (
    <div ref={frame}>
      <SkipLink />
      <main id="main" tabIndex={-1}>
        <p>Page content</p>
      </main>
    </div>
  );
}
