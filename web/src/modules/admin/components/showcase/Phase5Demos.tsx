// The Phase 5 demos of the Component Showcase (UI-SPEC C1; D-32, D-33; plan 05-42): the new staff, profile and audit
// pieces on made-up people and values, in the "Staff and audit" section. Every demo keeps its state in the component:
// nothing here reads or writes a record, so the demos are safe in the public chunk (T-05-105). The static cases sit in
// page-root frames; a live demo that opens a fixed layer sits in a frame that is no page root, as in ShowcaseDemos.
import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActorName,
  Button,
  ConflictBanner,
  DateInput,
  overlineClasses,
  RadioGroup,
  RecordMeta,
  ResponsiveTable,
  RowAction,
  RowActions,
  UserCell,
  type RadioOption,
  type ResponsiveTableColumn,
} from '@/components';
import { AUDIT_COPY, auditActionLabel } from '@/modules/admin/auditCopy';
import { AuditDetail } from '@/modules/admin/components/AuditDetail';
import {
  caseClasses,
  demoFrameClasses,
  frameClasses,
  staffStackClasses,
} from '@/modules/admin/components/showcase/showcase.recipe';
import { SHOWCASE_COPY } from '@/modules/admin/components/showcase/showcaseCopy';
import { RoleBadge, StatusBadges } from '@/modules/admin/components/UserBadges';
import { usersFormGridClasses, usersWrapClasses } from '@/modules/admin/components/users.recipe';
import { USERS_COPY } from '@/modules/admin/usersCopy';
import type { UserAccess } from '@/modules/admin/usersSchemas';
import { formatBusinessDate, formatBusinessDateTime } from '@/utils/format';

const COPY = SHOWCASE_COPY.staff;

interface DemoCaseProps {
  /** The case id: its overline label and its `data-case`. */
  id: string;
  /** A live demo that opens a fixed layer: its frame is no page root, so the layer covers the page. */
  live?: boolean;
  children: ReactNode;
}

/** One case under its overline label, in the same two frames the page gives every other case. */
function DemoCase({ id, live = false, children }: DemoCaseProps) {
  const labelId = useId();
  return (
    <div className={caseClasses}>
      <p id={labelId} className={overlineClasses}>
        {id}
      </p>
      {live ? (
        <div data-case={id} className={demoFrameClasses}>
          {children}
        </div>
      ) : (
        <div
          data-case={id}
          role="region"
          // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a sideways-scrolling region must take keyboard focus (WCAG 2.1.1)
          tabIndex={0}
          aria-labelledby={labelId}
          className={frameClasses}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const ACCESS_OPTIONS: readonly RadioOption<UserAccess>[] = [
  {
    value: 'invitation',
    label: USERS_COPY.add.access.invitation.label,
    description: USERS_COPY.add.access.invitation.description,
  },
  {
    value: 'temporary-password',
    label: USERS_COPY.add.access.temporary.label,
    description: USERS_COPY.add.access.temporary.description,
  },
];

function RadioGroupDemo() {
  const name = useId();
  const [access, setAccess] = useState<UserAccess>('invitation');
  return (
    <RadioGroup<UserAccess>
      legend={USERS_COPY.add.access.legend}
      name={name}
      value={access}
      options={ACCESS_OPTIONS}
      onChange={setAccess}
    />
  );
}

function DateInputDemo() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <div className={usersFormGridClasses}>
      <DateInput label={COPY.from} value={from} {...(to === '' ? {} : { max: to })} onChange={setFrom} />
      <DateInput label={COPY.to} value={to} {...(from === '' ? {} : { min: from })} onChange={setTo} />
    </div>
  );
}

/** How long the Load Latest demo reads "Loading" before the banner leaves. */
const LOAD_MS = 300;

/**
 * The stale-save banner takes focus the moment it mounts, so it appears only on request; Load Latest then shows its
 * pending word, hides the banner, and gives focus back to the button that showed it.
 */
function ConflictBannerDemo() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loading) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setLoading(false);
      setShown(false);
      trigger.current?.focus();
    }, LOAD_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loading]);
  return (
    <>
      <div>
        <Button
          ref={trigger}
          variant="secondary"
          size="sm"
          onClick={() => {
            setShown(true);
          }}
        >
          {COPY.showConflict}
        </Button>
      </div>
      {shown && (
        <ConflictBanner
          pending={loading}
          onLoadLatest={() => {
            setLoading(true);
          }}
        />
      )}
    </>
  );
}

/** A record made by the system and last changed by a colleague whose account was deleted since (D-11). */
function RecordMetaDemo() {
  return (
    <RecordMeta
      recordedBy={null}
      recordedAt="2026-10-06T01:00:00Z"
      lastChangedBy={{ name: 'Paolo Garcia', formerStaff: true }}
      lastChangedAt="2026-10-12T07:42:00Z"
    />
  );
}

type AuditSample = ComponentProps<typeof AuditDetail>['item'];

const CARMEN_ACTOR = { id: '11111111-1111-4111-8111-111111111111', name: 'Carmen Reyes', formerStaff: false };
const PAOLO_ACTOR = { id: '22222222-2222-4222-8222-222222222222', name: 'Paolo Garcia', formerStaff: false };
const JOMAR_ACTOR = { id: '33333333-3333-4333-8333-333333333333', name: 'Jomar Santos', formerStaff: false };

/** Two entries: one with every detail, one with the empty-value icon and "Unknown browser". The IP is a documentation range. */
const AUDIT_ROWS: readonly AuditSample[] = [
  {
    id: 1,
    action: 'user.role-changed',
    detail: 'role=admin>manager',
    device: 'Chrome',
    doneBy: { kind: 'user', person: CARMEN_ACTOR },
    doneTo: PAOLO_ACTOR,
    ipPrefix: '203.0.113.0',
    occurredAt: '2026-10-12T07:42:00Z',
    reference: '00-4bf92f3577b34da6a3ce929d0e0e4736-01',
  },
  {
    id: 2,
    action: 'user.deactivated',
    detail: null,
    device: null,
    doneBy: { kind: 'system', person: null },
    doneTo: JOMAR_ACTOR,
    ipPrefix: null,
    occurredAt: '2026-10-11T02:15:00Z',
    reference: '00-9a1f0c2d3b4e5f60718293a4b5c6d7e8-01',
  },
];

function auditKey(item: AuditSample): string {
  return String(item.id);
}

function auditDetailId(item: AuditSample): string {
  return `staff-audit-detail-${auditKey(item)}`;
}

function whenText(item: AuditSample): string {
  return formatBusinessDateTime(item.occurredAt) ?? item.occurredAt;
}

function auditColumns(
  expanded: ReadonlySet<string>,
  toggle: (key: string) => void,
): readonly ResponsiveTableColumn<AuditSample>[] {
  return [
    {
      key: 'when',
      header: AUDIT_COPY.columns.when,
      lead: true,
      cell: (item) => <time dateTime={item.occurredAt}>{whenText(item)}</time>,
    },
    { key: 'doneBy', header: AUDIT_COPY.columns.doneBy, cell: (item) => <ActorName actor={item.doneBy.person} /> },
    { key: 'action', header: AUDIT_COPY.columns.action, cell: (item) => auditActionLabel(item.action) },
    { key: 'doneTo', header: AUDIT_COPY.columns.doneTo, cell: (item) => <ActorName actor={item.doneTo} /> },
    {
      key: 'actions',
      header: AUDIT_COPY.columns.actions,
      actions: true,
      cell: (item) => {
        const open = expanded.has(auditKey(item));
        const action = auditActionLabel(item.action);
        return (
          <RowActions>
            <RowAction
              icon="chevron-down"
              label={
                open ? AUDIT_COPY.toggle.hide(action, whenText(item)) : AUDIT_COPY.toggle.show(action, whenText(item))
              }
              expanded={open}
              controls={auditDetailId(item)}
              onClick={() => {
                toggle(auditKey(item));
              }}
            />
          </RowActions>
        );
      },
    },
  ];
}

function AuditRowDemo() {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  };
  return (
    <ResponsiveTable<AuditSample>
      caption={COPY.auditCaption}
      columns={auditColumns(expanded, toggle)}
      rows={AUDIT_ROWS}
      rowKey={auditKey}
      things="audit entries"
      detail={(item) => <AuditDetail item={item} id={auditDetailId(item)} />}
      expandedKeys={expanded}
    />
  );
}

interface DemoUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'Admin' | 'Manager';
  status: 'active' | 'inactive' | 'locked';
  inviteState: 'none' | 'pending' | 'expired';
  createdAt: string;
}

/** Exactly 100 characters, so the wrapping of the longest allowed name shows (the name limit is 100). */
const LONG_NAME =
  'Maria Concepcion Villanueva Delacruz Santiago Bartolome Magsaysay Fernandez de los Reyes y Alcantara';

/** Made-up staff, one per roster state (UI-SPEC C1), and one with a 100-character name. */
const DEMO_USERS: readonly DemoUser[] = [
  {
    id: 'u-carmen',
    firstName: 'Carmen',
    lastName: 'Reyes',
    email: 'carmen.reyes.csp@example.com',
    role: 'Manager',
    status: 'active',
    inviteState: 'none',
    createdAt: '2026-01-05T02:00:00Z',
  },
  {
    id: 'u-paolo',
    firstName: 'Paolo',
    lastName: 'Garcia',
    email: 'paolo.garcia@example.com',
    role: 'Admin',
    status: 'active',
    inviteState: 'none',
    createdAt: '2026-02-14T02:00:00Z',
  },
  {
    id: 'u-jomar',
    firstName: 'Jomar',
    lastName: 'Santos',
    email: 'jomar.santos@example.com',
    role: 'Admin',
    status: 'inactive',
    inviteState: 'none',
    createdAt: '2026-03-02T02:00:00Z',
  },
  {
    id: 'u-rhea',
    firstName: 'Rhea',
    lastName: 'Villanueva',
    email: 'rhea.villanueva@example.com',
    role: 'Admin',
    status: 'locked',
    inviteState: 'none',
    createdAt: '2026-04-20T02:00:00Z',
  },
  {
    id: 'u-liza',
    firstName: 'Liza',
    lastName: 'Mercado',
    email: 'liza.mercado@example.com',
    role: 'Admin',
    status: 'active',
    inviteState: 'pending',
    createdAt: '2026-10-09T02:00:00Z',
  },
  {
    id: 'u-noel',
    firstName: 'Noel',
    lastName: 'Bautista',
    email: 'noel.bautista@example.com',
    role: 'Admin',
    status: 'active',
    inviteState: 'expired',
    createdAt: '2026-09-01T02:00:00Z',
  },
  {
    id: 'u-long',
    firstName: 'Maria',
    lastName: LONG_NAME.slice('Maria '.length),
    email: 'maria.long.name@example.com',
    role: 'Admin',
    status: 'active',
    inviteState: 'none',
    createdAt: '2026-06-18T02:00:00Z',
  },
];

/** The signed-in Manager of the demo roster. */
const OWN_ID = 'u-carmen';

function fullName(user: DemoUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

const ROSTER_COPY = USERS_COPY;

const rosterColumns: readonly ResponsiveTableColumn<DemoUser>[] = [
  {
    key: 'user',
    header: ROSTER_COPY.columns.user,
    lead: true,
    cell: (user) => <UserCell name={fullName(user)} sub={user.id === OWN_ID ? ROSTER_COPY.you : user.role} />,
  },
  {
    key: 'email',
    header: ROSTER_COPY.columns.email,
    cell: (user) => <span className={usersWrapClasses}>{user.email}</span>,
  },
  { key: 'role', header: ROSTER_COPY.columns.role, cell: (user) => <RoleBadge role={user.role} /> },
  {
    key: 'status',
    header: ROSTER_COPY.columns.status,
    cell: (user) => <StatusBadges status={user.status} inviteState={user.inviteState} />,
  },
  {
    key: 'created',
    header: ROSTER_COPY.columns.created,
    muted: true,
    cell: (user) => formatBusinessDate(user.createdAt),
  },
  {
    key: 'actions',
    header: ROSTER_COPY.columns.actions,
    actions: true,
    cell: (user) =>
      // The signed-in Manager's own row has only the link to My Profile (D-19).
      user.id === OWN_ID ? (
        <RowActions>
          <RowAction to="/admin/profile" icon="pencil" label={ROSTER_COPY.ownRowEdit} />
        </RowActions>
      ) : (
        <RowActions>
          <RowAction icon="pencil" label={ROSTER_COPY.edit.rowEdit(fullName(user))} />
          <RowAction
            icon={user.status === 'inactive' ? 'user-check' : 'user-x'}
            label={
              user.status === 'inactive'
                ? ROSTER_COPY.rowActions.activate(user.firstName)
                : ROSTER_COPY.rowActions.deactivate(user.firstName)
            }
          />
          <RowAction icon="trash-2" label={ROSTER_COPY.remove.rowDelete(fullName(user))} danger />
        </RowActions>
      ),
  },
];

function RosterDemo() {
  return (
    <ResponsiveTable<DemoUser>
      caption={COPY.rosterCaption}
      columns={rosterColumns}
      rows={DEMO_USERS}
      rowKey={(user) => user.id}
      isInactive={(user) => user.status === 'inactive'}
      things={ROSTER_COPY.things}
    />
  );
}

/** Every Phase 5 demo, one case under another. */
export function Phase5Demos() {
  return (
    <div className={staffStackClasses}>
      <DemoCase id="staff-radio-group">
        <RadioGroupDemo />
      </DemoCase>
      <DemoCase id="staff-date-input">
        <DateInputDemo />
      </DemoCase>
      <DemoCase id="staff-conflict-banner">
        <ConflictBannerDemo />
      </DemoCase>
      <DemoCase id="staff-record-meta">
        <RecordMetaDemo />
      </DemoCase>
      <DemoCase id="staff-audit-row">
        <AuditRowDemo />
      </DemoCase>
      <DemoCase id="staff-roster-rows">
        <RosterDemo />
      </DemoCase>
    </div>
  );
}
