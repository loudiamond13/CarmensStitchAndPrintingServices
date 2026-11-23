// The Quote Requests inbox URL state (UI-SPEC R1 "URL params"; WEB-10, D-18): status, q, page and size through the shared
// list-state factory. `open` is the default status, so it never shows in the URL; a value off the allow-list is removed with
// one replace. A status or search change replaces the entry and resets the page; a page change pushes. Sorting is fixed to
// newest first, so there is no sort key. Personal data appears only inside q.
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser, pageParser, pageSizeParser, searchParser } from '@/lib/url-state/parsers';
import { QUOTE_STATUS_FILTERS } from '@/modules/admin/services/quoteRequestsService';

export const useQuoteRequestsListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  status: literalParser(QUOTE_STATUS_FILTERS, 'open'),
});
