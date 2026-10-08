// The search value a query key uses (WEB-08, WEB-10): it changes only after `delayMs` of quiet, so typing "jersey"
// starts one query, not six. The URL is debounced separately by nuqs (limitUrlUpdates: debounce(300)).
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return debounced;
}
