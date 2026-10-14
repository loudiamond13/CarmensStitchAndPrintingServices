// Admin layout boundary group (plan 02-31; WEB-05 precision edge). The dev-only AdminShell wrapper pair (see
// layouts-admin.ts) renders the shell in a 767.5px or a 1023.5px page root inside the case frame (`frameWidth`; a
// viewport width must be whole). Between App. C's phone, tablet and desktop queries neither the phone nor the tablet rule
// applies there, so the approved CSS shows the full sidebar and no tab bar, and the implementation must do the same
// (its `pg-*` variants carry App. C's own query text). The 1440 rows run the cases at their own width; at 390 the root
// is capped to the frame and shows the phone layout. Not responsive, so no 320 or 820 row loads them (the 320px fit
// of the Topbar, D-41 R2-01, is proven by the e2e sweep and the layouts-admin group).
// The D-27 Logout `<button>` pairs with the approved `<a href="#">` through the registry: case > page root > .s-admin >
// side column > aside > foot > Logout is path 0/0/0/0/0/2/1.
import type { Scenario } from '../types';

const GROUP = 'layouts-admin-boundaries';

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
  shellCase({ id: 'admin-shell-767-5', section: 'dashboard', theme: 'light', frameWidth: 767.5 }),
  shellCase({ id: 'admin-shell-767-5-dark', section: 'dashboard', theme: 'dark', frameWidth: 767.5 }),
  shellCase({ id: 'admin-shell-1023-5', section: 'dashboard', theme: 'light', frameWidth: 1023.5 }),
  shellCase({ id: 'admin-shell-1023-5-dark', section: 'dashboard', theme: 'dark', frameWidth: 1023.5 }),
];
