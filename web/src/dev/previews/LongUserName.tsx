// Dev-only scenario wrapper (plan 02-32; never shipped, D-20): one long user name in the two places the shell shows a
// user (UI-SPEC "UI Considerations" long-text: Sidebar user chip, Topbar user menu): the Sidebar, as the phone drawer
// shows it, and the Topbar in a `data-ui="s-admin-main"` column, as the shell shows it. The table lead cell has its
// own long-name case (rt-long-name, plan 02-30). Nothing here is compared (no reference); the overflow spec measures it.
import type { Role } from '@/lib/csps';
import { Sidebar, Topbar } from '@/ui/navigation';

const MANAGER: Role = 'manager';

export interface LongUserNameProps {
  /** The user's name (the scenario passes a 40-character one). */
  name: string;
}

export function LongUserName({ name }: LongUserNameProps) {
  const user = { name };
  return (
    <div>
      <Sidebar active="dashboard" role={MANAGER} user={user} />
      <div data-ui="s-admin-main">
        <Topbar user={user} role={MANAGER} />
      </div>
    </div>
  );
}
