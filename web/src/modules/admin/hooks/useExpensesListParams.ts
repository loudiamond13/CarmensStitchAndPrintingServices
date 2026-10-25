// The Company Expenses list's URL state (WEB-10, T-06-17, T-06-23; plans 06-04, 06-07): page, size and the search through the
// one shared list-state factory. Defaults stay out of the URL; an invalid value falls back and is removed with one replace. A
// size or search change replaces the entry and resets the page; a page change pushes. The category and the date pair arrive
// in the second task of plan 06-07.
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser, searchParser } from '@/lib/url-state/parsers';

export const useExpensesListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
});
