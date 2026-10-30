// The Orders list's URL state (WEB-10, T-08-08, T-08-16; plans 08-06, 08-09): page, size and the search through the one shared
// list-state factory. Defaults stay out of the URL; an invalid value (a size outside 10, 20, 50 and 100, a page below 1) falls
// back and is removed with one replace. A search, filter or size change replaces the entry and resets the page; a page change
// pushes. The other filters join in the next task of plan 08-09 and the view in plan 08-11.
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser, searchParser } from '@/lib/url-state/parsers';

export const useOrdersListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
});
