// Body scroll lock for open overlays (WEB-02, spec §2.10 #1, UI-SPEC "Tailwind Contract"): while active, `<body>` gets
// the literal `overflow-hidden` class through classList. It never writes `style.overflow` (the strict CSP and D-33 keep
// inline styles out). A count keeps the class until the last of several open overlays lets go.
import { useEffect } from 'react';
import { bodyScrollLockClass } from './overlays.recipe';

let holders = 0;

/** Locks body scroll while `active` (default true). */
export function useBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    holders += 1;
    document.body.classList.add(bodyScrollLockClass);
    return () => {
      holders -= 1;
      if (holders === 0) {
        document.body.classList.remove(bodyScrollLockClass);
      }
    };
  }, [active]);
}
