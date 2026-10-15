// SPEC-GAP: S7 Signed-in devices (D-43), /admin/sessions (UI-SPEC "S7 Signed-in devices"; plan 04-29). An ordinary admin
// page: the `.s-ph` header, then a ResponsiveTable of the caller's own active sessions, this device first with the
// "This device" badge and no sign-out button. Another device's row opens SignOutDeviceDialog; the dialog lives here, in the
// page root, because a ResponsiveTable cell is a paint-containment frame that would trap its scrim.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { isHttpError } from '@/core/api/errors';
import { useToast } from '@/components/feedback';
import { sessionsListKey } from '@/lib/query/keys';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { deviceLabel } from '@/modules/admin/components/deviceSummary';
import { SessionsView } from '@/modules/admin/components/SessionsView';
import { SignOutDeviceDialog } from '@/modules/admin/components/SignOutDeviceDialog';
import { SignOutOthersDialog } from '@/modules/admin/components/SignOutOthersDialog';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useSessionsQuery } from '@/modules/admin/hooks/useSessionsQuery';
import { sessionsService, type SessionListItem } from '@/modules/admin/services/sessionsService';

const COPY = AUTH_COPY.sessions;
const HEADING = Symbol('heading');

export function SessionsRoute() {
  const query = useSessionsQuery();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<SessionListItem | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
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

  const showGone = () => {
    toast.show({
      tone: 'info',
      title: AUTH_COPY.toasts.alreadySignedOut.title,
      message: AUTH_COPY.toasts.alreadySignedOut.body,
    });
  };

  const showSignedOut = (device: SessionListItem) => {
    toast.show({
      title: AUTH_COPY.toasts.deviceSignedOut.title,
      message: AUTH_COPY.toasts.deviceSignedOut.body(deviceLabel(device)),
    });
  };

  /**
   * Signs one device out. A device that had already ended, or that the server no longer knows (404), is a success with
   * its own info toast (UI-SPEC S7): the row goes either way. Any other failure keeps the dialog open.
   */
  const revoke = async (device: SessionListItem) => {
    const answer = await sessionsService.revoke(device.id).then(
      (response) => ({ gone: response.alreadySignedOut }),
      (error: unknown) => (isHttpError(error) && error.status === 404 ? { gone: true } : { error }),
    );
    if ('error' in answer) {
      return { ok: false as const, error: answer.error };
    }
    chooseFocusAfter(device);
    removeRow(device.id);
    setTarget(null);
    if (answer.gone) {
      showGone();
    } else {
      showSignedOut(device);
    }
    return { ok: true as const };
  };

  const afterSignedOutOthers = () => {
    queryClient.setQueryData<SessionListItem[]>(sessionsListKey, (list) => list?.filter((item) => item.current));
    void queryClient.invalidateQueries({ queryKey: sessionsListKey });
  };

  return (
    <>
      <SessionsView
        rows={rows}
        now={now}
        pending={query.isPending}
        refetching={query.isFetching && rows !== undefined}
        failed={query.isError}
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
        onOpenOthers={() => {
          setOthersOpen(true);
        }}
        onSignOut={setTarget}
        headingRef={headingRef}
        registerButton={(id, button) => {
          if (button === null) {
            buttonRefs.current.delete(id);
          } else {
            buttonRefs.current.set(id, button);
          }
        }}
      />
      {othersOpen && (
        <SignOutOthersDialog
          onClose={() => {
            setOthersOpen(false);
          }}
          onSignedOut={afterSignedOutOthers}
        />
      )}
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
