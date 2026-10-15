// SPEC-GAP: S7 Signed-in devices, the page body (UI-SPEC "S7 Signed-in devices"; D-43, D-44; plan 04-29, split out of
// SessionsPage by plan 04-32 so the parity previews can draw every state with fixed rows). The `.s-ph` page header with
// the "Sign Out Other Devices" button, the ResponsiveTable of the caller's own sessions (this device first, with the
// "This device" badge and no sign-out button) and, when only this device is signed in, the note. The route owns the query,
// the dialogs and the focus after a removal.
import type { Ref } from 'react';
import { Button } from '@/components/actions';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { Note } from '@/components/states';
import { Badge } from '@/components/status';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { lastActiveText, deviceLabel, rowSignOutName, signedInText } from '@/modules/admin/components/deviceSummary';
import type { SessionListItem } from '@/modules/admin/services/sessionsService';

const COPY = AUTH_COPY.sessions;

/** A time in a `<time>` element carrying the UTC value; null (the empty-value icon) when it cannot be read. */
function timeCell(text: string | null, utcIso: string) {
  return text === null ? null : <time dateTime={utcIso}>{text}</time>;
}

export interface SessionsViewProps {
  /** The rows in display order, or undefined before the first answer. */
  rows: SessionListItem[] | undefined;
  /** The moment "Last active" is read against. */
  now: number;
  pending: boolean;
  refetching: boolean;
  failed: boolean;
  error: unknown;
  onRetry: () => void;
  /** Opens the "Sign out of other devices?" dialog. */
  onOpenOthers: () => void;
  /** Opens the confirm dialog for one other device. */
  onSignOut: (device: SessionListItem) => void;
  headingRef?: Ref<HTMLHeadingElement>;
  /** Hands the route each row's sign-out button, so it can move focus after a removal. */
  registerButton?: (id: string, button: HTMLButtonElement | null) => void;
  /** The title's level: h1 on the page, h2 where the Component Showcase draws it among other cases. */
  titleAs?: 'h1' | 'h2';
}

export function SessionsView({
  rows,
  now,
  pending,
  refetching,
  failed,
  error,
  onRetry,
  onOpenOthers,
  onSignOut,
  headingRef,
  registerButton,
  titleAs: Title = 'h1',
}: SessionsViewProps) {
  const onlyThisDevice = rows !== undefined && rows.length > 0 && rows.every((item) => item.current);
  const columns: readonly ResponsiveTableColumn<SessionListItem>[] = [
    {
      key: 'device',
      header: COPY.columns.device,
      lead: true,
      cell: (item) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="wrap-anywhere">{deviceLabel(item)}</span>
          {item.current && <Badge tone="info">{COPY.thisDevice}</Badge>}
        </span>
      ),
    },
    {
      key: 'signedIn',
      header: COPY.columns.signedIn,
      cell: (item) => timeCell(signedInText(item), item.signedInAt),
    },
    {
      key: 'lastActive',
      header: COPY.columns.lastActive,
      cell: (item) => timeCell(lastActiveText(item, now), item.lastActiveAt),
    },
    {
      key: 'session',
      header: COPY.columns.session,
      cell: (item) => (item.persistent ? <Badge tone="neutral">{COPY.keepBadge}</Badge> : COPY.untilClose),
    },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (item) =>
        item.current ? null : (
          <RowActions>
            <RowAction
              icon="log-out"
              label={rowSignOutName(item)}
              title={COPY.rowHint}
              ref={(button) => {
                registerButton?.(item.id, button);
              }}
              onClick={() => {
                onSignOut(item);
              }}
            />
          </RowActions>
        ),
    },
  ];

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <Title ref={headingRef} tabIndex={-1} className={pageTitleClasses}>
            {COPY.title}
          </Title>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
        <div className="pg-phone:w-full">
          <Button variant="secondary" icon="log-out" className="pg-phone:w-full" onClick={onOpenOthers}>
            {COPY.headerAction}
          </Button>
        </div>
      </div>
      <ResponsiveTable<SessionListItem>
        caption={COPY.caption}
        columns={columns}
        rows={rows}
        rowKey={(item) => item.id}
        things={COPY.things}
        pending={pending}
        refetching={refetching}
        failed={failed}
        error={error}
        onRetry={onRetry}
      />
      {onlyThisDevice && <Note icon="shield-check">{COPY.onlyThisDevice}</Note>}
    </>
  );
}
