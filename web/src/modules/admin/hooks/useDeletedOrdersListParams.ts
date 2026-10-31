// The Deleted Orders list's URL state (WEB-10, D-52; plan 08-20): page and size only.
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser } from '@/lib/url-state/parsers';

export const useDeletedOrdersListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
});
