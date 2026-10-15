// SPEC-GAP: S7 Signed-in devices (D-43), /admin/sessions (UI-SPEC "S7 Signed-in devices"; plan 04-29). An ordinary admin
// page: the `.s-ph` header, then a ResponsiveTable of the caller's own active sessions, this device first with the
// "This device" badge and no sign-out button. Another device's row opens SignOutDeviceDialog; the dialog lives here, in the
// page root, because a ResponsiveTable cell is a paint-containment frame that would trap its scrim.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { Note } from '@/components/states';
import { Badge } from '@/components/status';
import { sessionsListKey } from '@/lib/query/keys';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { deviceLabel, lastActiveText, rowSignOutName, signedInText } from '@/modules/admin/components/deviceSummary';
import { SignOutDeviceDialog } from '@/modules/admin/components/SignOutDeviceDialog';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useSessionsQuery } from '@/modules/admin/hooks/useSessionsQuery';
import { sessionsService, type SessionListItem } from '@/modules/admin/services/sessionsService';

const COPY = AUTH_COPY.sessions;
const HEADING = Symbol('heading');

/** A time in a `<time>` element carrying the UTC value; null (the empty-value icon) when it cannot be read. */
function timeCell(text: string | null, utcIso: string) {
  return text === null ? null : <time dateTime={utcIso}>{text}</time>;
}

export function SessionsRoute() {
  const query = useSessionsQuery();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<SessionListItem | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  // Where focus goes once a removed row is gone: a row's button id, or the heading.
  const focusAfterRemoval = useRef<string | typeof HEADING | null>(null);

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  // After a removal the dialog is already closed and the row is gone: focus the next row's button, else the previous
  // row's, else the heading (UI-SPEC S7 "Per-row sign-out").
  useEffect(() => {
    const wanted = focusAfterRemoval.current;
    if (wanted === null) {
      return;
    }
    focusAfterRemoval.current = null;
    (wanted === HEADING ? headingRef.current : buttonRefs.current.get(wanted))?.focus();
  });

  const rows = query.data;
  const onlyThisDevice = rows !== undefined && rows.length > 0 && rows.every((item) => item.current);
  // "Last active" is read against the moment the list was fetched, so the same data always reads the same.
  const now = query.dataUpdatedAt;

  const removeRow = (id: string) => {
    queryClient.setQueryData<SessionListItem[]>(sessionsListKey, (list) => list?.filter((item) => item.id !== id));
    void queryClient.invalidateQueries({ queryKey: sessionsListKey });
  };

  const chooseFocusAfter = (device: SessionListItem) => {
    const list = rows ?? [];
    const index = list.findIndex((item) => item.id === device.id);
    const next = list[index + 1];
    const previous = list[index - 1];
    if (next !== undefined) {
      focusAfterRemoval.current = next.id;
    } else if (previous !== undefined && !previous.current) {
      focusAfterRemoval.current = previous.id;
    } else {
      focusAfterRemoval.current = HEADING;
    }
  };

  const revoke = async (device: SessionListItem) => {
    try {
      await sessionsService.revoke(device.id);
    } catch (error: unknown) {
      return { ok: false as const, error };
    }
    chooseFocusAfter(device);
    removeRow(device.id);
    setTarget(null);
    toast.show({
      title: AUTH_COPY.toasts.deviceSignedOut.title,
      message: AUTH_COPY.toasts.deviceSignedOut.body(deviceLabel(device)),
    });
    return { ok: true as const };
  };

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
                if (button === null) {
                  buttonRefs.current.delete(item.id);
                } else {
                  buttonRefs.current.set(item.id, button);
                }
              }}
              onClick={() => {
                setTarget(item);
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
          <h1 ref={headingRef} tabIndex={-1} className={pageTitleClasses}>
            {COPY.title}
          </h1>
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
        <div className="pg-phone:w-full">
          <Button variant="secondary" icon="log-out" className="pg-phone:w-full">
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
        pending={query.isPending}
        refetching={query.isFetching && rows !== undefined}
        failed={query.isError}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
      {onlyThisDevice && <Note icon="shield-check">{COPY.onlyThisDevice}</Note>}
      {target !== null && (
        <SignOutDeviceDialog
          device={target}
          onConfirm={() => revoke(target)}
          onCancel={() => {
            setTarget(null);
          }}
        />
      )}
    </>
  );
}
