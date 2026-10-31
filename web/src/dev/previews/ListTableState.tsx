// Dev-only scenario wrapper (plan 02-30; never shipped, D-20): the Users list in one of its SPEC-GAP states, with the
// real ResponsiveTable (parity false: no reference exists; axe and the guard check it, and the owner reviews the
// screenshots, D-23). `loading` is the first load (SkeletonTable), `error` a failed load with the previous rows,
// `empty` first use, `no-matches` a filtered search with no result, and `refetching` the spec seed while the next page
// loads (dimmed after 200 ms).
import { Button } from '@/components/actions';
import { ResponsiveTable } from '@/components/lists';
import { USER_COLUMNS, type ListTableUser } from './ListTable';

export type ListTableStateName = 'loading' | 'error' | 'empty' | 'no-matches' | 'refetching';

export interface ListTableStateProps {
  state: ListTableStateName;
}

const USERS: readonly ListTableUser[] = [
  {
    first: 'Carmen',
    last: 'Reyes',
    email: 'carmen.reyes.csp@example.com',
    role: 'Manager',
    active: true,
    created: '2026-01-12',
    me: true,
  },
  {
    first: 'Paolo',
    last: 'Garcia',
    email: 'paolo.garcia@example.com',
    role: 'Admin',
    active: true,
    created: '2026-02-03',
  },
];

function noop(): void {
  // Scenario actions do nothing.
}

export function ListTableState({ state }: ListTableStateProps) {
  const withRows = state === 'error' || state === 'refetching';
  return (
    <ResponsiveTable<ListTableUser>
      caption="Users"
      columns={USER_COLUMNS}
      rows={state === 'loading' ? undefined : withRows ? USERS : []}
      rowKey={(user) => user.email}
      isInactive={(user) => !user.active}
      things="users"
      pending={state === 'loading'}
      refetching={state === 'refetching'}
      failed={state === 'error'}
      onRetry={noop}
      filtered={state === 'no-matches'}
      search={state === 'no-matches' ? 'Jomar' : null}
      filterSummary={state === 'no-matches' ? 'status Active' : undefined}
      onClearFilters={noop}
      emptyIcon="users"
      emptyMessage="Add your first user so staff can sign in."
      emptyAction={
        <Button variant="primary" icon="plus" onClick={noop}>
          Add User
        </Button>
      }
    />
  );
}
