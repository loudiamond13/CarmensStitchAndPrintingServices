// The Company Expenses list's URL state (WEB-10, T-06-17; plan 06-04): page and size through the one shared list-state
// factory. Defaults stay out of the URL; an invalid value falls back and is removed with one replace. A size change
// replaces the entry and resets the page; a page change pushes. Plan 06-07 adds q, category, from and to.
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser } from '@/lib/url-state/parsers';

export const useExpensesListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
});
