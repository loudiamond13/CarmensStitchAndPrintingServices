// The Audit Log's URL state (UI-SPEC "URL params"; WEB-10, T-05-91, T-05-92; AUDIT-02, D-26, D-40; plan 05-33): page, size, the
// date range and the three filters, all through the one shared list-state factory. The range is stored by name and resolved
// against the business today on every visit, so the default never appears in the URL and is never worked out from the machine
// clock; from and to are business dates that the page reads only with range=custom. actor and target are user ids (actor may
// be `system`), never an email or a name; action is one of the known codes. An invalid value falls back to its default and is
// removed with one replace; filters replace the history entry and reset the page, and a page change pushes.
import { createParser, parseAsStringLiteral } from 'nuqs';
import { createListParams } from '@/lib/url-state/createListParams';
import { pageParser, pageSizeParser, parseAsBusinessDate } from '@/lib/url-state/parsers';
import { AUDIT_ACTION_CODES } from '@/modules/admin/auditCopy';
import { AUDIT_RANGES, DEFAULT_AUDIT_RANGE } from '@/modules/admin/auditRange';

/** The actor filter's word for entries nobody signed in did. */
export const SYSTEM_ACTOR = 'system';

/** A user id in the dashed form the server accepts. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUserId(value: string): string | null {
  return USER_ID.test(value) ? value.toLowerCase() : null;
}

/** A person by user id (CWE-20). Anything else, an email or a name included, is no filter. */
const userIdParser = createParser<string>({ parse: parseUserId, serialize: (id) => id });

/** Done by: a user id, or `system`. */
const actorParser = createParser<string>({
  parse: (value) => (value === SYSTEM_ACTOR ? value : parseUserId(value)),
  serialize: (actor) => actor,
});

export const useAuditListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  range: parseAsStringLiteral(AUDIT_RANGES).withDefault(DEFAULT_AUDIT_RANGE),
  from: parseAsBusinessDate,
  to: parseAsBusinessDate,
  actor: actorParser,
  action: parseAsStringLiteral(AUDIT_ACTION_CODES),
  target: userIdParser,
});
