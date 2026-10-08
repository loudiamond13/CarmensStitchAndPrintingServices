// SPEC-GAP: the 200 ms refetch delay (02-UI-SPEC UI Considerations "loading on page, filter, search or sort change";
// WEB-08). True only once `flag` has stayed true for `delayMs`, and false again at once when `flag` turns false, so a
// fast fetch never flickers the rows.
import { useEffect, useState } from 'react';

export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  // Reset during render (not in an effect), so the very render that sees `flag` false already returns false and the
  // next true has to wait the full delay again.
  if (!flag && elapsed) {
    setElapsed(false);
  }
  useEffect(() => {
    if (!flag) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setElapsed(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [flag, delayMs]);
  return flag && elapsed;
}
