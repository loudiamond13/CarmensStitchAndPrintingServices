// The Deleted Expenses list's URL state (WEB-10, D-03, D-07; plan 06-16): page, size, the search and one category through the one
// shared list-state factory, as the expenses list does but with no dates. Defaults stay out of the URL; an invalid value falls back
// and is removed with one replace. A filter, search or size change replaces the entry and resets the page; a page change pushes.
import { createListParams } from '@/lib/url-state/createListParams';
import { guidParser, pageParser, pageSizeParser, searchParser } from '@/lib/url-state/parsers';

export const useDeletedExpensesListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  category: guidParser,
});
