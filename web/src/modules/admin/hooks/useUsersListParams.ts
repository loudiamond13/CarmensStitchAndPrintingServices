// The Users roster's URL state (UI-SPEC "URL params"; WEB-10, T-05-57, T-05-58; plan 05-20): page, size, q, role and status,
// all through the one shared list-state factory. role and status are allow-listed with no default, so "all" is simply absent from
// the URL; an invalid value falls back to that and is removed with one replace. Filters and the search replace the history
// entry and reset the page; a page change pushes. The keys never hold an email or a name (the factory refuses them).
import { parseAsStringLiteral } from 'nuqs';
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser, searchParser } from '@/lib/url-state/parsers';
import { USER_ROLE_FILTERS, USER_STATUS_FILTERS } from '@/modules/admin/services/usersService';

export const useUsersListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  role: parseAsStringLiteral(USER_ROLE_FILTERS),
  status: parseAsStringLiteral(USER_STATUS_FILTERS),
});
