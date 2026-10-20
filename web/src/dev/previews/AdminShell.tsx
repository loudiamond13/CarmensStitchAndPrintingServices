// Dev-only scenario wrapper (plan 02-31; never shipped, D-20): the admin frame as AdminLayout renders it, with the real
// components: AdminFrame (the side column with the Sidebar, the Topbar, `main` in the `.s-body` look and the TabBar)
// around the section's AdminPreviewPage, for the dev user Carmen Reyes (Manager). It leaves out what has no counterpart
// in App. E.6: the visually hidden skip link and the toast layer. The case frame is already the page root; with
// `frameWidth` the frame holds a second page root that wide (a fractional width a viewport cannot have), so the
// container queries read that width. The reference side transcribes App. E.6's shell
// (web/visual/reference/fragments/AdminShell.tsx).
import clsx from 'clsx';
import { AdminFrame } from '@/layouts/AdminLayout';
import { PreviewBody } from '@/dev/PreviewBody';
import { pageRootClasses } from '@/components/layout/layout.recipe';
import type { AdminSection } from '@/components/navigation';
import { DEV_USER } from '@/modules/admin/sections';

export interface AdminShellProps {
  section?: AdminSection;
  /** The theme of the case; the Topbar toggle offers the other one. */
  theme?: 'light' | 'dark';
  /** A page-root width in px for the boundary cases (767.5, 1023.5). */
  frameWidth?: number;
}

function noop(): undefined {
  return undefined;
}

export function AdminShell({ section = 'dashboard', theme = 'light', frameWidth }: AdminShellProps) {
  const frame = (
    <AdminFrame section={section} user={DEV_USER} theme={theme} onToggleTheme={noop} onLogout={noop}>
      <PreviewBody section={section} />
    </AdminFrame>
  );
  if (frameWidth === undefined) {
    return frame;
  }
  return (
    <div
      className={clsx(pageRootClasses, 'w-(--frame-w) max-w-full')}
      style={{ '--frame-w': `${String(frameWidth)}px` }}
    >
      {frame}
    </div>
  );
}
