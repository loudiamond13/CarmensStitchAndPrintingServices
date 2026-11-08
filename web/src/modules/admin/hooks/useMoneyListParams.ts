// RED stub: the URL state of the money screens, without the Admin rule yet (WEB-10, D-31; plan 10-17).
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser, pageParser, pageSizeParser } from '@/lib/url-state/parsers';
import { parseAsStringLiteral } from 'nuqs';

export const MONEY_TABS = ['mine', 'staff', 'transfers'] as const;

export const useMoneyListParams = createListParams({
  tab: literalParser(MONEY_TABS, 'mine'),
  page: pageParser,
  size: pageSizeParser,
  deleted: parseAsStringLiteral(['true'] as const),
});
