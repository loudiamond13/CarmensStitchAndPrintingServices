// Dev-only scenario wrapper (plan 02-32; never shipped, D-20): the admin frame with the phone navigation drawer open,
// as a person opens it from the Topbar's "Open navigation" button (pressed once after mount; the button shows on phone
// pages only, but a script click works at any width). The real AdminFrame owns the drawer, so this is exactly the
// shell's drawer. The drawer is a SPEC-GAP primitive with no reference, so there is no reference fragment.
import { useEffect, useRef } from 'react';
import { AdminFrame } from '@/layouts/AdminLayout';
import { AdminPreviewPage } from '@/modules/admin/pages/AdminPreviewPage';
import { DEV_USER } from '@/modules/admin/sections';

function noop(): undefined {
  return undefined;
}

export function OpenedNavDrawer() {
  const frame = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not close the drawer again.
    if (pressed.current) {
      return;
    }
    pressed.current = true;
    frame.current?.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]')?.click();
  }, []);
  return (
    <div ref={frame}>
      <AdminFrame section="dashboard" user={DEV_USER} theme="light" onLogout={noop}>
        <AdminPreviewPage section="dashboard" />
      </AdminFrame>
    </div>
  );
}
