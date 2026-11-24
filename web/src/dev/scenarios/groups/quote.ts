// Quote group (UI-SPEC "Component Showcase additions"; INQ-01; plan 13-23). The QuoteForm of the Contact page in its eight states,
// through the dev-only QuoteFormDemo (made-up values, a demo service, nothing sent). Blush only (the public look) and SPEC-GAP
// (parity false), so the parity page runs axe and the CSP listener on each one.
import type { Scenario } from '../types';

const STATES = [
  'empty',
  'field-errors',
  'photos-refused',
  'sending',
  'sent',
  'sent-photos-missing',
  'rate-limited',
  'send-failed',
] as const;

export const scenarios: readonly Scenario[] = STATES.map((state): Scenario => ({
  id: `quote-form-${state}`,
  group: 'quote',
  node: { kind: 'node', component: 'QuoteFormDemo', props: { state } },
  themes: ['light'],
  responsive: true,
  states: ['rest'],
  parity: false,
}));
