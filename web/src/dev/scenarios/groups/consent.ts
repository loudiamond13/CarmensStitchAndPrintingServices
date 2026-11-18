// Consent and legal group (UI-SPEC "Component Showcase additions"; ANL-01, ANL-03, ANL-04, LEGAL-05; plan 12-29). Every
// scenario here has group 'consent', is Blush only (the public look, D-14) and is SPEC-GAP (parity false). The UI-SPEC
// asks for these on a dev public page; they sit in the component showcase instead, so the /dev/public field column the
// focus E2E uses stays as it is.
//   - `consent-bar`: the cookie bar (CB1) in the page flow (StaticConsentBar);
//   - the Cookie Settings window (CS1) with no choice yet, a saved choice, under GPC, after a clear (the Done Note) and
//     after a failed clear (the confirmation CS2 with its failure line), each opened on a seeded consent store with no
//     network (OpenedCookieSettings). The window is fixed-position, so each is a `viewport` case;
//   - `legal-notice`: the DRAFT notice of a legal page (L1).
import type { Scenario, ScenarioFrame, ScenarioNode, ScenarioProps } from '../types';

function node(component: string, props: ScenarioProps = {}): ScenarioNode {
  return { kind: 'node', component, props };
}

function consentCase(id: string, caseNode: ScenarioNode, frame?: ScenarioFrame): Scenario {
  return {
    id,
    group: 'consent',
    node: caseNode,
    themes: ['light'],
    responsive: true,
    states: ['rest'],
    parity: false,
    ...(frame === undefined ? {} : { frame }),
  };
}

function settingsCase(id: string, state: string): Scenario {
  return consentCase(id, node('OpenedCookieSettings', { state }), 'viewport');
}

export const scenarios: readonly Scenario[] = [
  consentCase('consent-bar', node('StaticConsentBar')),
  settingsCase('cookie-settings-no-choice', 'no-choice'),
  settingsCase('cookie-settings-saved', 'saved'),
  settingsCase('cookie-settings-gpc', 'gpc'),
  settingsCase('cookie-settings-cleared', 'cleared'),
  settingsCase('cookie-settings-clear-failed', 'clear-failed'),
  consentCase('legal-notice', node('LegalNotice')),
];
