// Admin layout group (plan 02-31; UI-SPEC "Parity scenarios": the admin shell, App. E.6 frame: the expanded sidebar,
// the tablet icon rail and the phone tab bar). The dev-only AdminShell wrapper pair renders the frame: the real
// AdminFrame (Sidebar, Topbar, `main`, TabBar) with an AdminPreviewPage body on the implementation side, a JSX
// transcription of App. E.6's shell with the frozen Sidebar and Topbar and the same body on the reference side.
//   - Each case lists one theme, so the Topbar's theme toggle shows the icon of that theme (moon in Blush, sun in
//     Espresso), as the real shell does.
//   - Dashboard current (the Users row keeps its "Manager" tag) and Users current (the tag is hidden on the current
//     row, D-31 D-BL-02; no tab is current), at every width: 1440 the expanded sidebar, 820 the rail, 390 and 320 the
//     tab bar.
//   - The WEB-05 precision-edge cases (767.5px and 1023.5px page roots) are their own group,
//     layouts-admin-boundaries.ts, so this group's 320 and 820 rows load only the shells compared there.
// The D-27 Logout `<button>` pairs with the approved `<a href="#">` through the registry: case > .s-admin > side
// column > aside > foot > Logout is path 0/0/0/0/2/1.
import type { Scenario } from '../types';

const GROUP = 'layouts-admin';

type ShellTheme = 'light' | 'dark';

interface ShellCase {
  readonly id: string;
  readonly section: 'dashboard' | 'users';
  readonly theme: ShellTheme;
  readonly frameWidth?: number;
}

function shellCase({ id, section, theme, frameWidth }: ShellCase): Scenario {
  return {
    id,
    group: GROUP,
    node: {
      kind: 'node',
      component: 'AdminShell',
      props: { section, theme, ...(frameWidth === undefined ? {} : { frameWidth }) },
    },
    themes: [theme],
    responsive: frameWidth === undefined,
    states: ['rest'],
    parity: true,
  };
}

export const scenarios: readonly Scenario[] = [
  shellCase({ id: 'admin-shell-dashboard', section: 'dashboard', theme: 'light' }),
  shellCase({ id: 'admin-shell-dashboard-dark', section: 'dashboard', theme: 'dark' }),
  shellCase({ id: 'admin-shell-users', section: 'users', theme: 'light' }),
  shellCase({ id: 'admin-shell-users-dark', section: 'users', theme: 'dark' }),
];
