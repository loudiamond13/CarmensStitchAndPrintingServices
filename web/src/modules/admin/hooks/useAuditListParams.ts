// The Audit Log's URL state (UI-SPEC "URL params"; WEB-10, T-05-91; AUDIT-02, D-26; plan 05-33): page, size and the date range,
// all through the one shared list-state factory. The range is stored by name and resolved against the business today on every
// visit, so the default never appears in the URL and is never worked out from the machine clock. from and to are business dates
// that the page reads only with range=custom. An invalid value falls back to its default and is removed with one replace;
// filters replace the history entry and reset the page, and a page change pushes.
import { parseAsStringLiteral } from 'nuqs';
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser, parseAsBusinessDate } from '@/lib/url-state/parsers';
import { AUDIT_RANGES, DEFAULT_AUDIT_RANGE } from '@/modules/admin/auditRange';

export const useAuditListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  range: parseAsStringLiteral(AUDIT_RANGES).withDefault(DEFAULT_AUDIT_RANGE),
  from: parseAsBusinessDate,
  to: parseAsBusinessDate,
});
