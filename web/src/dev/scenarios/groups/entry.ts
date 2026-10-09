// Entry group (SPEC-GAP entry primitives, plan 02-27; UI-SPEC "SPEC-GAP Primitive Specs"). Every scenario here has
// group 'entry' and `parity: false`: the spec draws none of these primitives, so no reference exists. The parity suite
// still loads each case in the rest rows of Chromium, Firefox and WebKit, where the implementation page runs axe and
// the CSP and console guard (`npm --prefix web run parity -- --grep @entry`); the owner reviews them in the D-23
// screenshots. The states are listed for the showcase; the harness never drives them on a `parity: false` case.
//   - MoneyInput (ORD-09): empty with the balance hint, filled, required and empty after a submit (the Copywriting
//     error), and right-aligned as in an item row (App. E.9). The value is controlled, so `onChange` gets a no-op.
// Copy is typed out here (relative imports only: the reference build has no @ alias); the tests pin it to copy.ts.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

const ENTRY_STATES: readonly ScenarioState[] = ['rest', 'focus-visible'];

interface EntryCase {
  readonly id: string;
  readonly component: string;
  readonly props: ScenarioProps;
  readonly target: string;
  readonly handlers?: readonly string[];
}

/** An implementation-only entry case in both themes at every width. */
function entryCase({ id, component, props, target, handlers }: EntryCase): Scenario {
  const node: ScenarioNode = { kind: 'node', component, props };
  return {
    id,
    group: 'entry',
    node,
    themes: ['light', 'dark'],
    responsive: true,
    states: ENTRY_STATES,
    parity: false,
    target,
    ...(handlers === undefined ? {} : { handlers }),
  };
}

export const scenarios: readonly Scenario[] = [
  entryCase({
    id: 'money-input-empty',
    component: 'MoneyInput',
    props: { label: 'Amount', value: '', hint: 'Balance due: ₱4,327.50' },
    target: 'input',
    handlers: ['onChange'],
  }),
  entryCase({
    id: 'money-input-filled',
    component: 'MoneyInput',
    props: { label: 'Amount', value: '12450.50' },
    target: 'input',
    handlers: ['onChange'],
  }),
  entryCase({
    id: 'money-input-error',
    component: 'MoneyInput',
    props: { label: 'Amount', value: '', required: true, error: 'Enter an amount.' },
    target: 'input',
    handlers: ['onChange'],
  }),
  entryCase({
    id: 'money-input-right',
    component: 'MoneyInput',
    props: { label: 'Unit price', value: '450.00', align: 'right' },
    target: 'input',
    handlers: ['onChange'],
  }),
];
