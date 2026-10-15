// Auth layout group (plan 04-32; UI-SPEC "Look-Equality Proof (App. E.5)"): S1 Sign in joins the approved-look proof as
// three cases that mirror the App. E.5 `state` prop, in Blush only (the auth pages are always Blush). The dev-only
// LoginScreen wrapper pair renders the page: the real AuthFrame holding the real SignInForm on the implementation side,
// a JSX transcription of App. E.5 with the frozen components on the reference side. Both fix the frame at the mockup's
// 960px, because the production page is `min-h-dvh` and a viewport has no fixed height.
import type { Scenario } from '../types';

const GROUP = 'layouts-auth';

type LoginState = 'default' | 'error' | 'loading';

function loginCase(state: LoginState): Scenario {
  return {
    id: `login-${state}`,
    group: GROUP,
    node: { kind: 'node', component: 'LoginScreen', props: { state } },
    themes: ['light'],
    responsive: true,
    states: ['rest'],
    parity: true,
  };
}

export const scenarios: readonly Scenario[] = [loginCase('default'), loginCase('error'), loginCase('loading')];
