// The role, status and invitation badges of a staff member (U1 rows, U3 status line; plan 05-20, 05-25): one place, so the
// roster and the Edit panel show the same tones.
import { Badge, type BadgeTone } from '@/components/status';
import { usersStatusClasses } from '@/modules/admin/components/users.recipe';
import { USERS_COPY } from '@/modules/admin/usersCopy';

const COPY = USERS_COPY;

const STATUS_BADGES: ReadonlyMap<string, { tone: BadgeTone; label: string }> = new Map([
  ['active', { tone: 'success', label: COPY.statusFilter.active }],
  ['inactive', { tone: 'neutral', label: COPY.statusFilter.inactive }],
  ['locked', { tone: 'warning', label: COPY.statusFilter.locked }],
]);

const INVITE_BADGES: ReadonlyMap<string, { tone: BadgeTone; label: string }> = new Map([
  ['pending', { tone: 'info', label: COPY.invite.pending }],
  ['expired', { tone: 'warning', label: COPY.invite.expired }],
]);

export function RoleBadge({ role }: { role: string }) {
  return role === 'Manager' ? <Badge tone="accent">{role}</Badge> : <Badge tone="neutral">{role}</Badge>;
}

/** The status badge and, when no password is set yet, the invitation badge; nothing for a status it does not know. */
export function StatusBadges({ status, inviteState }: { status: string; inviteState: string }) {
  const known = STATUS_BADGES.get(status);
  const invite = INVITE_BADGES.get(inviteState);
  if (known === undefined) {
    return null;
  }
  return (
    <span className={usersStatusClasses}>
      <Badge tone={known.tone} dot>
        {known.label}
      </Badge>
      {invite !== undefined && <Badge tone={invite.tone}>{invite.label}</Badge>}
    </span>
  );
}
