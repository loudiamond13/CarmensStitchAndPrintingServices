// Reference side of the list table (plan 02-30; test only, never shipped): a JSX transcription of the App. E.12 Users
// table (`div.s-rt-wrap > table.s-rt`), cells verbatim with the frozen App. D.3 Avatar, Badge and Icon, the spec's
// `.s-rt*`, `.csp-cell-user`, `.s-acts`, `.s-iconbtn` and `.s-muted` classes, and the App. D.1 formatDate. The
// implementation side renders the real ResponsiveTable (web/src/dev/previews/ListTable.tsx). Recorded differences from
// App. E.12, none of which changes the look:
//   - D-02 (owner): an inactive row is `tr.is-inactive` (the rulings layer puts it on --surface-2) instead of App.
//     E.12's inline `opacity: .72`.
//   - A11Y-01 (UI-SPEC ResponsiveTable): the table has a visually hidden `<caption>` (`.csp-sr`) naming the list, and
//     the frame is a named, focusable region (it scrolls sideways on tablets, axe scrollable-region-focusable). The
//     caption is out of flow; the region attributes are attributes only.
//   - The structure the converted component adds around the frame, with no look of its own: the LoadingRegion's plain
//     block around the frame and its empty, visually hidden `role="status"` node after it (02-28).
// The frozen components come from the extracted spec module, loaded the way kit.ts loads it (import.meta.glob, so the
// frozen code is never type-checked).
import type { ComponentType, ReactNode } from 'react';

type ModuleExports = Readonly<Record<string, unknown>>;

const spec = Object.values(import.meta.glob<ModuleExports>('../../.reference-src/ui/index.tsx', { eager: true }))[0];

function frozen<T>(name: string): T {
  const value = spec?.[name];
  if (typeof value !== 'function') {
    throw new Error(`The frozen spec has no ${name}. Run node visual/reference/extract-spec.mjs.`);
  }
  return value as T;
}

const Avatar = frozen<ComponentType<{ name?: string; size?: number }>>('Avatar');
const Badge = frozen<ComponentType<{ tone?: string; dot?: boolean; children?: ReactNode }>>('Badge');
const Icon = frozen<ComponentType<{ name: string; size?: number }>>('Icon');
const formatDate = frozen<(value: string) => string>('formatDate');

export interface ListTableUser {
  first: string;
  last: string;
  email: string;
  role: string;
  active: boolean;
  created: string;
  me?: boolean;
}

export interface ListTableProps {
  users: readonly ListTableUser[];
  caption?: string;
}

export function ListTable({ users, caption = 'Users' }: ListTableProps) {
  return (
    <>
      <div>
        {/* eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- the converted frame is a focusable region (A11Y-01) */}
        <div className="s-rt-wrap" role="region" tabIndex={0} aria-label={caption}>
          <table className="s-rt">
            <caption className="csp-sr">{caption}</caption>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th className="r">
                  <span className="csp-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const name = `${user.first} ${user.last}`;
                const me = user.me === true;
                const toggleLabel = user.active ? `Deactivate ${user.first}` : `Activate ${user.first}`;
                return (
                  <tr key={user.email} className={user.active ? undefined : 'is-inactive'}>
                    <td className="is-lead" data-label="User">
                      <span className="csp-cell-user">
                        <Avatar name={name} size={36} />
                        <span>
                          <strong>{name}</strong>
                          <span>{me ? 'You' : user.role}</span>
                        </span>
                      </span>
                    </td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Role">
                      <Badge tone={user.role === 'Manager' ? 'accent' : 'neutral'}>{user.role}</Badge>
                    </td>
                    <td data-label="Status">
                      <Badge tone={user.active ? 'success' : 'neutral'} dot>
                        {user.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td data-label="Created" className="s-muted">
                      {formatDate(user.created)}
                    </td>
                    <td className="r is-acts">
                      <span className="s-acts">
                        <button type="button" className="s-iconbtn" aria-label={`Edit ${name}`}>
                          <Icon name="pencil" size={18} />
                        </button>
                        {!me && (
                          <button type="button" className="s-iconbtn" aria-label={toggleLabel} title={toggleLabel}>
                            <Icon name={user.active ? 'lock' : 'shield-check'} size={18} />
                          </button>
                        )}
                        {!me && (
                          <button type="button" className="s-iconbtn is-danger" aria-label={`Delete ${name}`}>
                            <Icon name="trash-2" size={18} />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="csp-sr" role="status" aria-live="polite" />
    </>
  );
}
