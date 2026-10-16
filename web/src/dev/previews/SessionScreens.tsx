// Dev-only scenario wrappers (plan 04-32; never shipped, D-20): the session surfaces of Phase 4 in the states the owner
// reviews, with the real components and fixed data, with no requests. They are SPEC-GAP surfaces (parity: false):
//   - DevicesScreen: S7 Signed-in devices in its loading, error, only-this-device and populated states. The populated list
//     holds a 60-character device label and two rows with the same label (UI-SPEC "UI Considerations" long-text).
//   - OpenedSessionMenu: the user menu opened, with its four items (My Profile, Signed-in Devices, Sign Out Other Devices,
//     Logout).
//   - OpenedSignOutDialog: SignOutOthersDialog and SignOutDeviceDialog open, and after the request failed.
//   - SessionToast: the session-cap warning toast and the S7 and password toasts, each with the app's own copy.
//   - NoteUses: the Note primitive in its three status uses.
import { useEffect, useRef } from 'react';
import { Toast, ToastProvider } from '@/components/feedback';
import { Topbar } from '@/components/navigation';
import { Note } from '@/components/states';
import { adminBodyClasses } from '@/modules/admin/components/admin.recipe';
import { AUTH_COPY } from '@/modules/admin/authCopy';
import { SessionsView } from '@/modules/admin/components/SessionsView';
import { SignOutDeviceDialog } from '@/modules/admin/components/SignOutDeviceDialog';
import { SignOutDialog } from '@/modules/admin/components/SignOutDialog';
import { SignOutOthersDialog } from '@/modules/admin/components/SignOutOthersDialog';
import type { SessionListItem } from '@/modules/admin/services/sessionsService';
import type { Role } from '@/utils/csps';
import { serverError } from './serverError';

function noop(): undefined {
  return undefined;
}

/** The moment "Last active" is read against: Oct 13, 2026, 12:00 PM in Manila. */
const NOW = Date.parse('2026-10-13T04:00:00Z');

/** A 60-character device label, the longest the server sends (D-32). */
export const LONG_DEVICE_LABEL = 'Samsung Internet on Galaxy Tab S9 Ultra at the front counter';

function minutesBefore(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function device(
  id: string,
  label: string,
  signedInAt: string,
  lastActiveAt: string,
  persistent: boolean,
): SessionListItem {
  return { id, device: label, signedInAt, lastActiveAt, persistent, current: false };
}

/** The only-this-device list: just the caller's own session. */
const THIS_DEVICE: SessionListItem = {
  id: '00000000-0000-4000-8000-000000000001',
  device: 'Chrome on Windows',
  signedInAt: '2026-10-13T00:12:00Z',
  lastActiveAt: new Date(NOW).toISOString(),
  persistent: true,
  current: true,
};

/** The device the per-row dialog is about. */
export const SAMPLE_DEVICE = device(
  '00000000-0000-4000-8000-000000000002',
  'Safari on iPhone',
  '2026-10-12T07:42:00Z',
  minutesBefore(5),
  true,
);

/** Populated: this device first, then newest activity first; a 60-character label and two identical labels. */
const POPULATED: SessionListItem[] = [
  THIS_DEVICE,
  SAMPLE_DEVICE,
  device('00000000-0000-4000-8000-000000000003', LONG_DEVICE_LABEL, '2026-10-11T01:30:00Z', minutesBefore(95), false),
  device('00000000-0000-4000-8000-000000000004', 'Edge on Windows', '2026-10-12T05:05:00Z', minutesBefore(600), true),
  device('00000000-0000-4000-8000-000000000005', 'Edge on Windows', '2026-10-09T09:20:00Z', minutesBefore(3000), false),
];

export interface DevicesScreenProps {
  state: 'loading' | 'error' | 'only-this-device' | 'populated';
}

export function DevicesScreen({ state }: DevicesScreenProps) {
  const rows = state === 'only-this-device' ? [THIS_DEVICE] : state === 'populated' ? POPULATED : undefined;
  return (
    <div className={adminBodyClasses}>
      <SessionsView
        rows={rows}
        now={NOW}
        pending={state === 'loading'}
        refetching={false}
        failed={state === 'error'}
        error={state === 'error' ? serverError('00-4bf92f3577b34da6a3ce929d0e0e4736-01') : undefined}
        onRetry={noop}
        onOpenOthers={noop}
        onSignOut={noop}
        titleAs="h2"
      />
    </div>
  );
}

const MANAGER: Role = 'manager';

export function OpenedSessionMenu() {
  const frame = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not close the menu again.
    if (pressed.current) {
      return;
    }
    pressed.current = true;
    frame.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.click();
  }, []);
  return (
    <div ref={frame} data-ui="s-admin-main" className="min-h-[260px]">
      <Topbar user={{ name: 'Carmen Reyes' }} role={MANAGER} devicesPath="/admin/sessions" onSignOutOthers={noop} />
    </div>
  );
}

export interface OpenedSignOutDialogProps {
  dialog: 'others' | 'others-failed' | 'device' | 'device-failed';
}

/** Presses the confirm button once, as a person would, so the dialog shows its failure state. */
function useConfirmOnMount(enabled: boolean): void {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) {
      return;
    }
    done.current = true;
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[role="dialog"] footer button:last-child')?.click();
    }, 0);
  }, [enabled]);
}

export function OpenedSignOutDialog({ dialog }: OpenedSignOutDialogProps) {
  const failed = dialog === 'others-failed' || dialog === 'device-failed';
  useConfirmOnMount(failed);
  const fail = () => Promise.reject(serverError('00-4bf92f3577b34da6a3ce929d0e0e4736-01'));
  const others = AUTH_COPY.signOutOthersDialog;
  return (
    <ToastProvider>
      {dialog === 'others' && <SignOutOthersDialog onClose={noop} />}
      {dialog === 'others-failed' && (
        <SignOutDialog
          title={others.title}
          message={others.body}
          keepLabel={others.keep}
          confirmLabel={others.confirm}
          pendingLabel={others.pending}
          onConfirm={fail}
          onCancel={noop}
        />
      )}
      {dialog === 'device' && <SignOutDeviceDialog device={SAMPLE_DEVICE} onConfirm={noop} onCancel={noop} />}
      {dialog === 'device-failed' && <SignOutDeviceDialog device={SAMPLE_DEVICE} onConfirm={fail} onCancel={noop} />}
    </ToastProvider>
  );
}

export interface SessionToastProps {
  toast: 'session-ending' | 'device-signed-out' | 'already-signed-out' | 'signed-out-others' | 'password-saved';
}

export function SessionToast({ toast }: SessionToastProps) {
  const copy = AUTH_COPY.toasts;
  switch (toast) {
    case 'session-ending':
      return (
        <Toast
          tone="warning"
          title={copy.sessionEnding.title}
          message={copy.sessionEnding.body('3:42 PM')}
          onClose={noop}
        />
      );
    case 'device-signed-out':
      return (
        <Toast
          tone="success"
          title={copy.deviceSignedOut.title}
          message={copy.deviceSignedOut.body(LONG_DEVICE_LABEL)}
          onClose={noop}
        />
      );
    case 'already-signed-out':
      return (
        <Toast tone="info" title={copy.alreadySignedOut.title} message={copy.alreadySignedOut.body} onClose={noop} />
      );
    case 'signed-out-others':
      return (
        <Toast tone="success" title={copy.signedOutOthers.title} message={copy.signedOutOthers.body} onClose={noop} />
      );
    case 'password-saved':
      return <Toast tone="success" title={copy.passwordSaved.title} message={copy.passwordSaved.body} onClose={noop} />;
  }
}

export function NoteUses() {
  const notices = AUTH_COPY.notices;
  return (
    <div className="flex max-w-[420px] flex-col gap-3">
      <Note live icon={notices['session-ended'].icon}>
        {notices['session-ended'].text}
      </Note>
      <Note live icon={notices['signed-out'].icon}>
        {notices['signed-out'].text}
      </Note>
      <Note icon="shield-check">{AUTH_COPY.signIn.staffNote}</Note>
    </div>
  );
}
