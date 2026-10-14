// The params a list query keys on (WEB-08, WEB-10; plan 02-30). A list passes its parsed URL values (from its
// createListParams hook) through this hook and gives the result to useListQuery, instead of debouncing only `q`.
//
// Why: setSearch writes the search and resets the page in one update, and nuqs applies both to the hook's values at
// once (only the URL write waits 300 ms). Debouncing `q` alone then changed the key twice: at the first keystroke
// (page 1, the old search: an extra, unfiltered request) and again when the text settled. Here, while the typed search
// has not settled (useDebouncedValue), the query keeps the whole set of values it last ran with, so typing "jersey"
// starts exactly one request, for the settled text and the reset page. Every other change (Next, a filter, the page
// size) reaches the query at once.
//
// The held snapshot is read-only: it only feeds the query key, is never shown or edited, and is never written back.
// The URL stays the one source of the list state.
import { useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/** Parsed list values; `q` is the free-text search, if the list has one. */
export type ListValues = Readonly<Record<string, unknown>> & { readonly q?: string | null };

function sameValues(a: ListValues, b: ListValues): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
}

export function useSettledListParams<P extends ListValues>(values: P, delayMs: number): P {
  const search = values.q ?? null;
  const settledSearch = useDebouncedValue(search, delayMs);
  const [held, setHeld] = useState(values);
  const settled = search === settledSearch;
  // Adjust during render (not in an effect): once the search has settled, the current values are the ones to hold.
  if (settled && !sameValues(held, values)) {
    setHeld(values);
  }
  return settled ? values : held;
}
