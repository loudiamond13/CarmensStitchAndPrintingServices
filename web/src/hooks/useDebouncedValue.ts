// The search value a list query key uses (WEB-08, WEB-10): it changes only after `delayMs` without a new value, so
// typing "jersey" starts one request, not six (T-02-81). Lists pass 300 ms. The URL is debounced separately (nuqs
// limitUrlUpdates: debounce(300), plan 02-11).
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return settled;
}
