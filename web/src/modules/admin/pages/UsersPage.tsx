// U1 Users, /admin/users (UI-SPEC "U1 Users"; App. E.12; USER-01, USER-08, D-09, D-19, C-35, WEB-10; plan 05-20). The
// Manager-only roster: the `.s-ph` header with the "Manager only" badge, the toolbar (search, Role, Status), the result bar
// with one chip per non-default filter, a ResponsiveTable of the staff with role, status and invitation badges, Pagination
// and the caption.
//   - The search, filters and page live in the URL through useUsersListParams and nowhere else; the query keys on the parsed
//     values after useSettledListParams, so typing makes one request for the settled text (WEB-08, WEB-10).
//   - The route's loader (requireManager) keeps an Admin out; the API answers 403 for a role lost mid-session, and the page
//     then shows the "You don't have access to this" banner instead of the table.
//   - Add User opens the U2 panel (05-22); the panel is always mounted so it can animate out. After a create the roster
//     reads again.
//   - The signed-in Manager's own row has one action, a pencil link to My Profile (D-19). Deleted users never appear (D-09).
//   - Every other row has a pencil "Edit {First Last}" that opens the U3 panel (05-25); the panel is always mounted, and
//     after a save the roster reads again and focus returns to that row's Edit button.
//   - Every other row also has the status toggle (05-28): "Deactivate {first}" (user-x) opens DeactivateUserDialog, and
//     "Activate {first}" (user-check) acts at once. Either way the roster reads again and the flipped toggle takes focus. The
//     dialog sits in the page root, never in a table cell, and stays mounted with `open` so it can play its exit.
//   - Delete (05-28) opens the shared ConfirmDialog. Once the row is gone, focus goes to the Edit button of the row that took
//     its place, else the row before, else the h1. A refusal (the last active Manager) or a 404 stays in the dialog.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { isHttpError } from '@/core/api/errors';
import { Select } from '@/components/forms';
import { ConfirmDialog } from '@/components/overlays';
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
import { Badge } from '@/components/status';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import { AddUserPanel, type CreatedUser } from '@/modules/admin/components/AddUserPanel';
import { DeactivateUserDialog } from '@/modules/admin/components/DeactivateUserDialog';
import { EditUserPanel } from '@/modules/admin/components/EditUserPanel';
import { RoleBadge, StatusBadges } from '@/modules/admin/components/UserBadges';
import { usersCaptionClasses, usersTitleRowClasses, usersWrapClasses } from '@/modules/admin/components/users.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { useSession } from '@/modules/admin/hooks/useSession';
import { useUsersListParams } from '@/modules/admin/hooks/useUsersListParams';
import { useUserAction } from '@/modules/admin/hooks/useUserAction';
import { useUsersQuery, usersKey } from '@/modules/admin/hooks/useUsersQuery';
import {
  USER_ROLE_FILTERS,
  USER_STATUS_FILTERS,
  usersService,
  type UserDetailResponse,
  type UserListItem,
  type UserRoleFilter,
  type UserStatusFilter,
} from '@/modules/admin/services/usersService';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import { describeUserGuard } from '@/modules/admin/usersGuards';
import { describeHttpError, errorLine } from '@/utils/describeHttpError';
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

function fullName(user: UserListItem): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function isSelf(meId: string | null, user: UserListItem): boolean {
  return meId !== null && user.id.toLowerCase() === meId.toLowerCase();
}

/** Active and Locked people are deactivated; only an Inactive one is activated. */
function toggleLabel(user: UserListItem): string {
  return user.status === 'inactive'
    ? COPY.rowActions.activate(user.firstName)
    : COPY.rowActions.deactivate(user.firstName);
}

/** What the roster needs to wire a row's buttons: what each does, and the button refs that focus returns to. */
interface RowWiring {
  edit: (user: UserListItem) => void;
  /** Deactivate opens the confirm; Activate acts at once. */
  toggle: (user: UserListItem) => void;
  remove: (user: UserListItem) => void;
  registerEdit: (id: string, button: HTMLButtonElement | null) => void;
  registerToggle: (id: string, button: HTMLButtonElement | null) => void;
}

function columnsFor(meId: string | null, wiring: RowWiring): readonly ResponsiveTableColumn<UserListItem>[] {
  const isMe = (user: UserListItem): boolean => isSelf(meId, user);
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
    {
      key: 'status',
      header: COPY.columns.status,
      cell: (user) => <StatusBadges status={user.status} inviteState={user.inviteState} />,
    },
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
        ) : (
          <RowActions>
            <RowAction
              icon="pencil"
              label={COPY.edit.rowEdit(fullName(user))}
              onClick={() => {
                wiring.edit(user);
              }}
              ref={(button) => {
                wiring.registerEdit(user.id, button);
              }}
            />
            {/* SPEC-DEVIATION: OQ-1 the toggle's icon is user-x / user-check, not App. E.12's lock / shield-check, because
                Lock is now its own action. */}
            <RowAction
              icon={user.status === 'inactive' ? 'user-check' : 'user-x'}
              label={toggleLabel(user)}
              title={toggleLabel(user)}
              onClick={() => {
                wiring.toggle(user);
              }}
              ref={(button) => {
                wiring.registerToggle(user.id, button);
              }}
            />
            <RowAction
              icon="trash-2"
              label={COPY.remove.rowDelete(fullName(user))}
              danger
              onClick={() => {
                wiring.remove(user);
              }}
            />
          </RowActions>
        ),
    },
  ];
}

export function UsersRoute() {
  const { user: me } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  // The person whose Edit panel is open or was last open (kept while it animates out), and each row's Edit button.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const rowFocus = useRowFocus();
  const toggleFocus = useRowFocus();
  // The person the Deactivate dialog is open for, or was last open for (kept while it animates out).
  const [deactivating, setDeactivating] = useState<{ user: UserListItem; open: boolean } | null>(null);
  // The same for the Delete confirm, and where focus goes once the deleted row has left the roster.
  const [deleting, setDeleting] = useState<{ user: UserListItem; open: boolean } | null>(null);
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
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

  // The roster reads again so the new person shows at once; an invitation also gets its toast (the panel closes itself).
  const created = (user: CreatedUser): void => {
    void queryClient.invalidateQueries({ queryKey: usersKey });
    if (user.access === 'invitation') {
      toast.show({
        tone: 'success',
        title: COPY.add.toast.title,
        message: COPY.add.toast.invitation(`${user.firstName} ${user.lastName}`, user.role),
      });
    }
  };

  // The roster reads again; once it has, focus goes back to that row's Edit button, or to the heading when the row left the list.
  const saved = (person: UserDetailResponse): void => {
    toast.show({
      tone: 'success',
      title: COPY.edit.toast.title,
      message: COPY.edit.toast.message(`${person.firstName} ${person.lastName}`, person.role),
    });
    void queryClient.invalidateQueries({ queryKey: usersKey }).then(() => {
      if (!rowFocus.focusRow(person.id)) {
        headingRef.current?.focus();
      }
    });
  };

  // The roster reads again; once it has, the flipped toggle takes focus (a dialog's own focus return may have run first).
  const refreshThenFocusToggle = (user: UserListItem): Promise<unknown> =>
    queryClient.invalidateQueries({ queryKey: usersKey }).then(() => toggleFocus.focusRow(user.id));

  const closeDeactivate = (): void => {
    setDeactivating((current) => (current === null ? null : { ...current, open: false }));
  };

  const deactivation = useUserAction(
    (key, user) => usersService.deactivate(user.id, key),
    (user) => {
      closeDeactivate();
      toast.show({ title: COPY.deactivate.toast.title, message: COPY.deactivate.toast.message(fullName(user)) });
      return refreshThenFocusToggle(user);
    },
  );

  const activation = useUserAction(
    (key, user) => usersService.activate(user.id, key),
    (user) => {
      toast.show({ title: COPY.activate.toast.title, message: COPY.activate.toast.message(fullName(user)) });
      return refreshThenFocusToggle(user);
    },
  );

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  // Focus lands on the Edit button of the next row, else the previous one (your own row has no Edit button), else the h1.
  const chooseFocusAfter = (user: UserListItem): string | null => {
    const others = (query.data?.items ?? []).filter((item) => !isSelf(me?.id ?? null, item));
    const index = others.findIndex((item) => item.id === user.id);
    return others[index + 1]?.id ?? others[index - 1]?.id ?? null;
  };

  const removal = useUserAction(
    (_key, user) => usersService.remove(user.id),
    (user) => {
      afterRemoval.current = { removedId: user.id, focusId: chooseFocusAfter(user) };
      closeDelete();
      toast.show({ title: COPY.remove.toast.title, message: COPY.remove.toast.message(fullName(user)) });
      return queryClient.invalidateQueries({ queryKey: usersKey });
    },
  );

  // Once the roster no longer holds the deleted row, move focus (the dialog's own return to the gone button has run).
  useEffect(() => {
    const wanted = afterRemoval.current;
    if (wanted === null || query.data === undefined || query.data.items.some((item) => item.id === wanted.removedId)) {
      return;
    }
    afterRemoval.current = null;
    if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
      headingRef.current?.focus();
    }
  });

  // Activate restores access, so it acts at once; a failure is a danger toast that stays until closed.
  const activate = async (user: UserListItem): Promise<void> => {
    const outcome = await activation.submit(user);
    if (!outcome.ok) {
      const copy = describeUserGuard(outcome.error) ?? describeHttpError(outcome.error);
      if (copy !== null) {
        toast.show({ tone: 'danger', title: COPY.activate.failed(fullName(user)), message: errorLine(copy) });
      }
    }
  };

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
            <h1 id={HEADING_ID} ref={headingRef} tabIndex={-1} className={pageTitleClasses}>
              {COPY.title}
            </h1>
            <Badge tone="accent" icon="shield-check">
              {COPY.badge}
            </Badge>
          </div>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => {
            setAdding(true);
          }}
        >
          {COPY.add.open}
        </Button>
      </div>
      <AddUserPanel
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        onCreated={created}
      />
      <EditUserPanel
        userId={editingId}
        open={editing}
        onClose={() => {
          setEditing(false);
        }}
        onSaved={saved}
      />
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
            columns={columnsFor(me?.id ?? null, {
              edit: (user) => {
                setEditingId(user.id);
                setEditing(true);
              },
              toggle: (user) => {
                if (user.status === 'inactive') {
                  void activate(user);
                } else {
                  setDeactivating({ user, open: true });
                }
              },
              remove: (user) => {
                setDeleting({ user, open: true });
              },
              registerEdit: rowFocus.register,
              registerToggle: toggleFocus.register,
            })}
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
      {deactivating !== null && (
        <DeactivateUserDialog
          open={deactivating.open}
          user={deactivating.user}
          onConfirm={() => deactivation.submit(deactivating.user)}
          onCancel={closeDeactivate}
        />
      )}
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={COPY.remove.title(fullName(deleting.user))}
          message={COPY.remove.message}
          confirmLabel={COPY.remove.confirm}
          pendingLabel={COPY.remove.pending}
          describeFailure={describeUserGuard}
          onConfirm={() => removal.submit(deleting.user)}
          onCancel={closeDelete}
        />
      )}
    </>
  );
}
