// Dev-only scenario wrapper (plan 02-30; never shipped, D-20): the App. E.12 Users list as a screen composes it, with
// the real ResponsiveTable and list cells. The scenario passes the users as plain data (spec §12.1 seed); this side
// builds the columns (render functions are not scenario data). The reference side transcribes App. E.12's table with
// the same users (web/visual/reference/fragments/ListTable.tsx). Every row action is a no-op here.
import { formatCalendarDate } from '@/lib/format';
import { RowAction, RowActions, ResponsiveTable, UserCell, type ResponsiveTableColumn } from '@/ui/lists';
import { Badge } from '@/ui/status';

export interface ListTableUser {
  first: string;
  last: string;
  email: string;
  role: string;
  active: boolean;
  /** The created date, YYYY-MM-DD. */
  created: string;
  /** The signed-in user: "You", and no deactivate or delete. */
  me?: boolean;
}

export interface ListTableProps {
  users: readonly ListTableUser[];
  caption?: string;
}

function nameOf(user: ListTableUser): string {
  return `${user.first} ${user.last}`;
}

function noop(): void {
  // Scenario actions do nothing.
}

/** The App. E.12 columns: User (the card title), Email, Role, Status, Created (muted) and the row actions. */
export const USER_COLUMNS: readonly ResponsiveTableColumn<ListTableUser>[] = [
  {
    key: 'user',
    header: 'User',
    lead: true,
    cell: (user) => <UserCell name={nameOf(user)} sub={user.me === true ? 'You' : user.role} />,
  },
  { key: 'email', header: 'Email', cell: (user) => user.email },
  {
    key: 'role',
    header: 'Role',
    cell: (user) => <Badge tone={user.role === 'Manager' ? 'accent' : 'neutral'}>{user.role}</Badge>,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (user) => (
      <Badge tone={user.active ? 'success' : 'neutral'} dot>
        {user.active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  { key: 'created', header: 'Created', muted: true, cell: (user) => formatCalendarDate(user.created) },
  {
    key: 'actions',
    header: 'Actions',
    actions: true,
    cell: (user) => {
      const toggle = user.active ? `Deactivate ${user.first}` : `Activate ${user.first}`;
      return (
        <RowActions>
          <RowAction icon="pencil" label={`Edit ${nameOf(user)}`} onClick={noop} />
          {user.me !== true && (
            <RowAction icon={user.active ? 'lock' : 'shield-check'} label={toggle} title={toggle} onClick={noop} />
          )}
          {user.me !== true && <RowAction icon="trash-2" label={`Delete ${nameOf(user)}`} danger onClick={noop} />}
        </RowActions>
      );
    },
  },
];

export function ListTable({ users, caption = 'Users' }: ListTableProps) {
  return (
    <ResponsiveTable<ListTableUser>
      caption={caption}
      columns={USER_COLUMNS}
      rows={users}
      rowKey={(user) => user.email}
      isInactive={(user) => !user.active}
      things="users"
    />
  );
}
