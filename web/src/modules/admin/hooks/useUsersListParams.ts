// The Users roster's URL state (WEB-10; plan 05-20). Stub for the RED commit: role and status take any text, with no allow-list.
import { parseAsString } from 'nuqs';
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser, searchParser } from '@/lib/url-state/parsers';

export const useUsersListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  role: parseAsString,
  status: parseAsString,
});
