// The Orders list's URL state (WEB-10, T-08-08; plan 08-06): page and size through the one shared list-state factory. Defaults
// stay out of the URL; an invalid value (a size outside 10, 20, 50 and 100, a page below 1) falls back and is removed with
// one replace. A size change replaces the entry and resets the page; a page change pushes. The filters join in plan 08-09 and
// the view in plan 08-11.
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser } from '@/lib/url-state/parsers';

export const useOrdersListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
});
