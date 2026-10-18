// U1 Users, /admin/users (UI-SPEC "U1 Users"; App. E.12; USER-01, USER-08, D-09, D-19, C-35; plan 05-20). The Manager-only
// roster: the `.s-ph` header with the "Manager only" badge, then a ResponsiveTable of every staff member with the role,
// status and invitation badges, and the caption.
//   - The route's loader (requireManager) keeps an Admin out; the API answers 403 for a role lost mid-session, and the page
//     then shows the "You don't have access to this" banner instead of the table.
//   - The signed-in Manager's own row has one action, a pencil link to My Profile (D-19). Deleted users never appear (D-09).
//     The other rows' actions arrive with the Edit panel (05-25) and the row dialogs (05-28).
import { useEffect, type ReactNode } from 'react';
import { isHttpError } from '@/core/api/errors';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ResponsiveTable, RowAction, RowActions, UserCell, type ResponsiveTableColumn } from '@/components/lists';
import { ErrorState } from '@/components/states';
import { Badge, type BadgeTone } from '@/components/status';
import {
  usersCaptionClasses,
  usersStatusClasses,
  usersTitleRowClasses,
  usersWrapClasses,
} from '@/modules/admin/components/users.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useSession } from '@/modules/admin/hooks/useSession';
import { useUsersQuery } from '@/modules/admin/hooks/useUsersQuery';
import type { UserListItem, UsersListQuery } from '@/modules/admin/services/usersService';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import { describeHttpError } from '@/utils/describeHttpError';
import { formatBusinessDate } from '@/utils/format';

const COPY = USERS_COPY;

/** The first page with no search or filter. */
const FIRST_PAGE: UsersListQuery = { q: null, role: null, status: null, page: 1, pageSize: 20 };

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
  const query = useUsersQuery(FIRST_PAGE);

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const forbidden = isHttpError(query.error) && query.error.status === 403;
  const denied = forbidden ? describeHttpError(query.error) : null;

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={usersTitleRowClasses}>
            <h1 id="users-results" tabIndex={-1} className={pageTitleClasses}>
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
          />
          <p className={usersCaptionClasses}>{COPY.caption}</p>
        </>
      ) : (
        <ErrorState title={denied.title} message={denied.body} error={query.error} />
      )}
    </>
  );
}
