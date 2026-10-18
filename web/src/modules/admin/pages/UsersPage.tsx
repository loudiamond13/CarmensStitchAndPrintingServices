// U1 Users, /admin/users (UI-SPEC "U1 Users"; App. E.12; USER-01, USER-08, D-09, D-19, C-35, WEB-10; plan 05-20). The
// Manager-only roster: the `.s-ph` header with the "Manager only" badge, the toolbar (search, Role, Status), the result bar
// with one chip per non-default filter, a ResponsiveTable of the staff with role, status and invitation badges, Pagination
// and the caption.
//   - The search, filters and page live in the URL through useUsersListParams and nowhere else; the query keys on the parsed
//     values after useSettledListParams, so typing makes one request for the settled text (WEB-08, WEB-10).
//   - The route's loader (requireManager) keeps an Admin out; the API answers 403 for a role lost mid-session, and the page
//     then shows the "You don't have access to this" banner instead of the table.
//   - The signed-in Manager's own row has one action, a pencil link to My Profile (D-19). Deleted users never appear (D-09).
//     The other rows' actions arrive with the Edit panel (05-25) and the row dialogs (05-28).
import { useEffect, type ReactNode } from 'react';
import { isHttpError } from '@/core/api/errors';
import { Select } from '@/components/forms';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import {
  FilterBar,
  FilterChip,
  Pagination,
  ResponsiveTable,
  ResultBar,
  RowAction,
  RowActions,
  SearchBox,
  UserCell,
  type ResponsiveTableColumn,
} from '@/components/lists';
import { ErrorState } from '@/components/states';
import { Badge, type BadgeTone } from '@/components/status';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import {
  usersCaptionClasses,
  usersStatusClasses,
  usersTitleRowClasses,
  usersWrapClasses,
} from '@/modules/admin/components/users.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useSession } from '@/modules/admin/hooks/useSession';
import { useUsersListParams } from '@/modules/admin/hooks/useUsersListParams';
import { useUsersQuery } from '@/modules/admin/hooks/useUsersQuery';
import {
  USER_ROLE_FILTERS,
  USER_STATUS_FILTERS,
  type UserListItem,
  type UserRoleFilter,
  type UserStatusFilter,
} from '@/modules/admin/services/usersService';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import { describeHttpError } from '@/utils/describeHttpError';
import { formatBusinessDate } from '@/utils/format';

const COPY = USERS_COPY;
/** The results heading Pagination moves focus to (it needs tabIndex -1). */
const HEADING_ID = 'users-results';

const ROLE_OPTIONS = USER_ROLE_FILTERS.map((value) => ({ value, label: COPY.roleFilter[value] }));
const STATUS_OPTIONS = USER_STATUS_FILTERS.map((value) => ({ value, label: COPY.statusFilter[value] }));

function asRole(value: string): UserRoleFilter | null {
  return USER_ROLE_FILTERS.find((role) => role === value) ?? null;
}

function asStatus(value: string): UserStatusFilter | null {
  return USER_STATUS_FILTERS.find((status) => status === value) ?? null;
}

const STATUS_BADGES: ReadonlyMap<string, { tone: BadgeTone; label: string }> = new Map([
  ['active', { tone: 'success', label: COPY.statusFilter.active }],
  ['inactive', { tone: 'neutral', label: COPY.statusFilter.inactive }],
  ['locked', { tone: 'warning', label: COPY.statusFilter.locked }],
]);

const INVITE_BADGES: ReadonlyMap<string, { tone: BadgeTone; label: string }> = new Map([
  ['pending', { tone: 'info', label: COPY.invite.pending }],
  ['expired', { tone: 'warning', label: COPY.invite.expired }],
]);

function fullName(user: UserListItem): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function RoleBadge({ role }: { role: string }) {
  return role === 'Manager' ? <Badge tone="accent">{role}</Badge> : <Badge tone="neutral">{role}</Badge>;
}

/** The status badge and, when no password is set yet, the invitation badge; null for a status the page does not know. */
function statusCell(user: UserListItem): ReactNode {
  const status = STATUS_BADGES.get(user.status);
  const invite = INVITE_BADGES.get(user.inviteState);
  if (status === undefined) {
    return null;
  }
  return (
    <span className={usersStatusClasses}>
      <Badge tone={status.tone} dot>
        {status.label}
      </Badge>
      {invite !== undefined && <Badge tone={invite.tone}>{invite.label}</Badge>}
    </span>
  );
}

function columnsFor(meId: string | null): readonly ResponsiveTableColumn<UserListItem>[] {
  const isMe = (user: UserListItem): boolean => meId !== null && user.id.toLowerCase() === meId.toLowerCase();
  return [
    {
      key: 'user',
      header: COPY.columns.user,
      lead: true,
      cell: (user) => <UserCell name={fullName(user)} sub={isMe(user) ? COPY.you : user.role} />,
    },
    {
      key: 'email',
      header: COPY.columns.email,
      cell: (user) => <span className={usersWrapClasses}>{user.email}</span>,
    },
    { key: 'role', header: COPY.columns.role, cell: (user) => <RoleBadge role={user.role} /> },
    { key: 'status', header: COPY.columns.status, cell: statusCell },
    { key: 'created', header: COPY.columns.created, muted: true, cell: (user) => formatBusinessDate(user.createdAt) },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (user) =>
        // SPEC-DEVIATION: D-19 the signed-in Manager's row has only a link to My Profile: no toggle, no delete (App. E.12 gave
        // every row all three).
        isMe(user) ? (
          <RowActions>
            <RowAction to="/admin/profile" icon="pencil" label={COPY.ownRowEdit} />
          </RowActions>
        ) : null,
    },
  ];
}

export function UsersRoute() {
  const { user: me } = useSession();
  const [values, set] = useUsersListParams();
  const settled = useSettledListParams(values, 300);
  const query = useUsersQuery({
    q: settled.q,
    role: settled.role,
    status: settled.status,
    page: settled.page,
    pageSize: settled.size,
  });

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  // The generated type allows a number or text for an int32; the server sends a number.
  const total = Number(query.data?.total ?? 0);
  const pageCount = Math.ceil(total / values.size);

  // A page past the last one (a stale link, or rows deleted meanwhile) becomes the last page, once fresh data says so.
  const { clampPage } = set;
  const fresh = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => {
    if (fresh) {
      clampPage(pageCount);
    }
  }, [fresh, pageCount, clampPage]);

  const forbidden = isHttpError(query.error) && query.error.status === 403;
  const denied = forbidden ? describeHttpError(query.error) : null;
  const filtered = values.role !== null || values.status !== null;
  const roleLabel = values.role === null ? null : COPY.roleFilter[values.role];
  const statusLabel = values.status === null ? null : COPY.statusFilter[values.status];

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={usersTitleRowClasses}>
            <h1 id={HEADING_ID} tabIndex={-1} className={pageTitleClasses}>
              {COPY.title}
            </h1>
            <Badge tone="accent" icon="shield-check">
              {COPY.badge}
            </Badge>
          </div>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      {denied === null ? (
        <>
          <FilterBar>
            <SearchBox value={values.q} placeholder={COPY.search.placeholder} onSearch={set.setSearch} />
            <Select
              label={COPY.roleFilter.label}
              placeholder={COPY.roleFilter.all}
              options={ROLE_OPTIONS}
              value={values.role ?? ''}
              onChange={(event) => {
                set.setFilter('role', asRole(event.target.value));
              }}
            />
            <Select
              label={COPY.statusFilter.label}
              placeholder={COPY.statusFilter.all}
              options={STATUS_OPTIONS}
              value={values.status ?? ''}
              onChange={(event) => {
                set.setFilter('status', asStatus(event.target.value));
              }}
            />
          </FilterBar>
          <ResultBar count={total} thing={COPY.thing} things={COPY.things} sortLabel={COPY.sortLabel}>
            {values.q !== null && (
              <FilterChip
                label={COPY.search.label}
                value={values.q}
                onClear={() => {
                  set.setSearch('', { immediate: true });
                }}
              />
            )}
            {roleLabel !== null && (
              <FilterChip
                label={COPY.roleFilter.label}
                value={roleLabel}
                onClear={() => {
                  set.setFilter('role', null);
                }}
              />
            )}
            {statusLabel !== null && (
              <FilterChip
                label={COPY.statusFilter.label}
                value={statusLabel}
                onClear={() => {
                  set.setFilter('status', null);
                }}
              />
            )}
          </ResultBar>
          <ResponsiveTable<UserListItem>
            caption={COPY.title}
            columns={columnsFor(me?.id ?? null)}
            rows={query.data?.items}
            rowKey={(user) => user.id}
            // SPEC-DEVIATION: C-35 an inactive row sits on surface-2 by colour, with full-opacity text (App. E.12 faded it).
            isInactive={(user) => user.status === 'inactive'}
            things={COPY.things}
            pending={query.isPending}
            refetching={query.isPlaceholderData && query.isFetching}
            failed={query.isError}
            error={query.error}
            onRetry={() => {
              void query.refetch();
            }}
            filtered={filtered}
            search={values.q}
            filterSummary={COPY.filterSummary(roleLabel, statusLabel)}
            onClearFilters={() => {
              set.setSearch('', { immediate: true });
              set.setFilters({ role: null, status: null });
            }}
          />
          <p className={usersCaptionClasses}>{COPY.caption}</p>
          <Pagination
            page={values.page}
            pageCount={pageCount}
            onPageChange={set.setPage}
            focusTargetId={HEADING_ID}
            pageSize={values.size}
            onPageSizeChange={set.setPageSize}
          />
        </>
      ) : (
        <ErrorState title={denied.title} message={denied.body} error={query.error} />
      )}
    </>
  );
}
