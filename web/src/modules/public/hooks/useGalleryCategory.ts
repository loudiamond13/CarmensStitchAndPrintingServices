// The Gallery's ?category= parameter (GAL-01, WEB-10, T-11-74, CWE-601). The address is untrusted: the value is read as plain
// text and only a key in the loaded pill list ever leaves this hook. While the list loads the address is left alone and the
// hook returns no category; once it has loaded, a value outside it is dropped with one replace. A pill change replaces the
// entry, and All (null) removes the parameter, because it is the default.
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo } from 'react';

export type GalleryCategory = readonly [category: string | null, setCategory: (next: string | null) => void];

/** `keys` are the loaded pill keys, or undefined while the gallery loads. */
export function useGalleryCategory(keys: readonly string[] | undefined): GalleryCategory {
  const [raw, setRaw] = useQueryState('category', parseAsString);
  const allowed = useMemo(() => (keys === undefined ? null : parseAsStringLiteral(keys)), [keys]);
  const category = allowed !== null && raw !== null ? allowed.parse(raw) : null;

  useEffect(() => {
    if (allowed !== null && raw !== null && category === null) {
      void setRaw(null, { history: 'replace' });
    }
  }, [allowed, raw, category, setRaw]);

  const setCategory = useCallback(
    (next: string | null) => {
      const listed = next === null || (allowed?.parse(next) ?? null) !== null;
      if (!listed) {
        return;
      }
      void setRaw(next, { history: 'replace' });
    },
    [allowed, setRaw],
  );

  return [category, setCategory];
}
