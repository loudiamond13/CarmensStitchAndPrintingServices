// Forms group (App. D.3 "Forms": Field; CSPS-UI-SPEC.md §6.3). Every scenario here has group 'forms'. Plan 02-20:
//   - Field with a label only, a hint, an error, the required mark, as a textarea (`multiline`), with the ₱ prefix and
//     disabled; the values come from the spec §12 seed and the payment and order forms (App. E);
// Each case is compared in both themes at every width (`responsive`), at rest, on hover and with keyboard focus
// (the focus-within ring). The states act on the text box (`target`), whose control box takes the hover and focus look;
// a disabled box is never focused, so it is compared at rest and on hover only.
// Values are `defaultValue` (uncontrolled), so neither side needs an onChange handler.
import type { Scenario, ScenarioProps, ScenarioState } from '../types';

const FIELD_STATES: readonly ScenarioState[] = ['rest', 'hover', 'focus-visible'];

interface FormCase {
  readonly id: string;
  readonly component: string;
  readonly props: ScenarioProps;
  readonly target: string;
  readonly states?: readonly ScenarioState[];
}

/** A forms case compared in both themes at every width; the harness drives `states` on `target`. */
function formCase({ id, component, props, target, states = FIELD_STATES }: FormCase): Scenario {
  return {
    id,
    group: 'forms',
    node: { kind: 'node', component, props },
    themes: ['light', 'dark'],
    responsive: true,
    states,
    parity: true,
    target,
  };
}

export const scenarios: readonly Scenario[] = [
  formCase({
    id: 'field-default',
    component: 'Field',
    props: { label: 'Customer name', placeholder: 'e.g. Carmen Reyes' },
    target: 'input',
  }),
  formCase({
    id: 'field-hint',
    component: 'Field',
    props: {
      label: 'Reference number',
      hint: 'GCash, Maya or bank reference.',
      placeholder: 'GCash / Maya / bank ref.',
    },
    target: 'input',
  }),
  formCase({
    id: 'field-error',
    component: 'Field',
    props: {
      label: 'Mobile number',
      defaultValue: '0917',
      error: 'Enter a mobile number like 0917 123 4567.',
      inputMode: 'tel',
    },
    target: 'input',
  }),
  formCase({
    id: 'field-required',
    component: 'Field',
    props: { label: 'Customer name', required: true, defaultValue: 'Carmen Reyes' },
    target: 'input',
  }),
  formCase({
    id: 'field-multiline',
    component: 'Field',
    props: { label: 'Notes', multiline: true, placeholder: 'Optional' },
    target: 'textarea',
  }),
  formCase({
    id: 'field-prefix-peso',
    component: 'Field',
    props: {
      label: 'Unit price',
      prefix: '₱',
      inputMode: 'decimal',
      defaultValue: '450.00',
      hint: 'Line total: ₱12,450.00',
    },
    target: 'input',
  }),
  formCase({
    id: 'field-disabled',
    component: 'Field',
    props: { label: 'Order number', disabled: true, defaultValue: 'ORD-2026-0148' },
    target: 'input',
    states: ['rest', 'hover'],
  }),
];
