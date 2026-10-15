// Auth and session SPEC-GAP group (plan 04-32; UI-SPEC "Look-Equality Proof (App. E.5)" and "UI Considerations"). Every
// scenario here has group 'auth-gaps' and `parity: false`: the approved design draws none of these surfaces, so no
// reference exists. The parity suite still runs axe, the CSP listener and the console guard on them
// (`--grep @auth-gaps`), the Component Showcase lists them in its "Sign-in and devices" section, and the owner reviews
// them in the review pack (`npm run review`).
//   - S1 to S6 cards (Blush only; the auth pages are always Blush): the notice and the 5xx banner on S1; S2 with the code
//     error, the resend cooldown and the resend cap; S3 for a temporary and a breached password; S4 form and sent; S5
//     checking, form and invalid; S6 checking, form, invalid and the fail-closed banner. The long-text cases hold a
//     64-character e-mail in the S2, S4, S5 and S6 sublines, and a 5xx banner with its reference.
//   - S7 Signed-in devices in loading, error, only-this-device and populated states (a 60-character device label and two
//     rows with one label), in Blush and Espresso, since it lives in the admin shell.
//   - the two sign-out dialogs open and after a failed request, the user menu with its four items, and the session-cap
//     and S7 toasts (each toast carries its own copy; the device toast a 60-character label), in both themes.
//   - NoteUses: the Note primitive in its three status uses.
import type { Scenario, ScenarioProps, Theme } from '../types';

const GROUP = 'auth-gaps';

/** A 64-character e-mail address: the longest the S2, S4, S5 and S6 sublines have to wrap (UI-SPEC long-text). */
export const LONG_EMAIL = 'maria.concepcion.villanueva.dela.cruz.j@barangay-sanroque.gov.ph';

const BLUSH: readonly Theme[] = ['light'];
const BOTH: readonly Theme[] = ['light', 'dark'];

function gap(
  id: string,
  component: string,
  props: ScenarioProps,
  themes: readonly Theme[],
  extra: Partial<Pick<Scenario, 'frame' | 'responsive'>> = {},
): Scenario {
  return {
    id,
    group: GROUP,
    node: { kind: 'node', component, props },
    themes,
    responsive: extra.responsive ?? true,
    states: ['rest'],
    parity: false,
    ...(extra.frame === undefined ? {} : { frame: extra.frame }),
  };
}

function card(id: string, name: string, props: ScenarioProps = {}): Scenario {
  return gap(id, 'AuthCard', { card: name, ...props }, BLUSH);
}

export const scenarios: readonly Scenario[] = [
  gap('note-uses', 'NoteUses', {}, BLUSH),
  // S1
  card('signin-notice', 'signin-notice'),
  card('signin-banner-trace', 'signin-banner'),
  // S2
  card('verify-default', 'verify'),
  card('verify-code-error', 'verify-error'),
  card('verify-resend-waiting', 'verify-waiting'),
  card('verify-resend-cap', 'verify-cap'),
  card('verify-long-email', 'verify', { email: LONG_EMAIL }),
  // S3
  card('new-password-temporary', 'new-password-temporary'),
  card('new-password-breach', 'new-password-breach'),
  // S4
  card('forgot-form', 'forgot-form'),
  card('forgot-sent', 'forgot-sent'),
  card('forgot-long-email', 'forgot-sent', { email: LONG_EMAIL }),
  // S5
  card('reset-checking', 'reset-checking'),
  card('reset-form', 'reset-form'),
  card('reset-invalid', 'reset-invalid'),
  card('reset-long-email', 'reset-form', { email: LONG_EMAIL }),
  // S6
  card('invite-checking', 'invite-checking'),
  card('invite-form', 'invite-form'),
  card('invite-invalid', 'invite-invalid'),
  card('invite-fail-closed', 'invite-fail-closed'),
  card('invite-long-email', 'invite-form', { email: LONG_EMAIL }),
  // S7
  gap('devices-loading', 'DevicesScreen', { state: 'loading' }, BOTH),
  gap('devices-error', 'DevicesScreen', { state: 'error' }, BOTH),
  gap('devices-only-this-device', 'DevicesScreen', { state: 'only-this-device' }, BOTH),
  gap('devices-populated', 'DevicesScreen', { state: 'populated' }, BOTH),
  // Dialogs (fixed-position, one case per page load)
  gap('signout-others-open', 'OpenedSignOutDialog', { dialog: 'others' }, BOTH, {
    frame: 'viewport',
    responsive: false,
  }),
  gap('signout-others-failed', 'OpenedSignOutDialog', { dialog: 'others-failed' }, BOTH, {
    frame: 'viewport',
    responsive: false,
  }),
  gap('signout-device-open', 'OpenedSignOutDialog', { dialog: 'device' }, BOTH, {
    frame: 'viewport',
    responsive: false,
  }),
  gap('signout-device-failed', 'OpenedSignOutDialog', { dialog: 'device-failed' }, BOTH, {
    frame: 'viewport',
    responsive: false,
  }),
  // The user menu with its four items
  gap('session-menu-open', 'OpenedSessionMenu', {}, BOTH, { responsive: false }),
  // Toasts
  gap('toast-session-ending', 'SessionToast', { toast: 'session-ending' }, BOTH),
  gap('toast-device-signed-out', 'SessionToast', { toast: 'device-signed-out' }, BOTH),
  gap('toast-already-signed-out', 'SessionToast', { toast: 'already-signed-out' }, BOTH),
  gap('toast-signed-out-others', 'SessionToast', { toast: 'signed-out-others' }, BOTH),
  gap('toast-password-saved', 'SessionToast', { toast: 'password-saved' }, BOTH),
];
