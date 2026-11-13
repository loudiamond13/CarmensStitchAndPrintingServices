// The Gallery tab's URL state (WEB-10, GAL-03, T-11-81; plan 11-32): the line, the page and the rows per page through the one shared list-state
// factory. Defaults stay out of the URL; an invalid value falls back and is removed with one replace; a line or size change replaces the entry
// and resets the page; a page change pushes.
//   - The line must be a GUID (guidParser) and, once the product lines have loaded, one of them: a stale or shared link to a deleted line
//     reads as every line at once and one replace removes it. While the lines are still loading the value is kept.
//   - The params belong to the Gallery tab only: useSiteContentTab removes them when another tab is chosen.
import { useEffect, useRef } from 'react';
import { createListParams } from '@/lib/url-state/createListParams';
import { guidParser, pageParser, pageSizeParser } from '@/lib/url-state/parsers';

const useGalleryUrlParams = createListParams({ line: guidParser, page: pageParser, size: pageSizeParser });

/** `lineIds` are the ids of the loaded product lines (lower case), or undefined while they load. */
export function useGalleryTabParams(lineIds: readonly string[] | undefined) {
  const [values, set] = useGalleryUrlParams();
  const unknownLine = lineIds !== undefined && values.line !== null && !lineIds.includes(values.line);
  // One replace per visit to such a URL, even if the tab renders again before the address has changed.
  const dropped = useRef(false);
  const { setFilter } = set;

  useEffect(() => {
    if (!unknownLine) {
      dropped.current = false;
      return;
    }
    if (!dropped.current) {
      dropped.current = true;
      setFilter('line', null);
    }
  }, [unknownLine, setFilter]);

  // Until the replace lands, an unknown line counts as every line, so no request is sent for it.
  return [unknownLine ? { ...values, line: null } : values, set] as const;
}
