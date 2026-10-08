// Forms group (App. D.3 "Forms": Field, PasswordField and Select; CSPS-UI-SPEC.md §6.3). Every scenario here has group
// 'forms'. Plan 02-20:
//   - Field with a label only, a hint, an error, the required mark, as a textarea (`multiline`), with the ₱ prefix and
//     disabled; the values come from the spec §12 seed and the payment and order forms (App. E). All at every width;
//   - PasswordField (the WEB-06 PasswordInput) empty with its meter hint, at each strength (Weak, Fair, Good, Strong),
//     revealed (the dev-only RevealPassword wrapper pair presses the toggle once after mount; App. D.3 has no prop for
//     it) and with an error;
//   - Select with string options (also at every width), with object options, a placeholder and an error, and disabled.
// Each case is compared in both themes, at rest, on hover and with keyboard focus (the focus-within ring). The states
// act on the text box or the reveal toggle (`target`); a disabled box is never focused, so it is compared at rest and on
// hover only, and the strength cases (one look each, no interaction) at rest.
// Values are `defaultValue` (uncontrolled), so neither side needs an onChange handler.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

const FIELD_STATES: readonly ScenarioState[] = ['rest', 'hover', 'focus-visible'];

interface FormCase {
  readonly id: string;
  readonly component: string;
  readonly props: ScenarioProps;
  readonly target: string;
  readonly states?: readonly ScenarioState[];
  readonly responsive?: boolean;
  /** Wraps the control in a dev-only wrapper pair (by kit name). */
  readonly wrapper?: string;
}

/** A forms case compared in both themes; the harness drives `states` on `target`. */
function formCase({
  id,
  component,
  props,
  target,
  states = FIELD_STATES,
  responsive = true,
  wrapper,
}: FormCase): Scenario {
  const control: ScenarioNode = { kind: 'node', component, props };
  return {
    id,
    group: 'forms',
    node: wrapper === undefined ? control : { kind: 'node', component: wrapper, props: { children: control } },
    themes: ['light', 'dark'],
    responsive,
    states,
    parity: true,
    target,
  };
}

const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Bank transfer'];
const PRODUCT_TYPES = [
  { value: 'jersey-set', label: 'Jersey set' },
  { value: 'jersey-top', label: 'Jersey top' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'tailoring', label: 'Tailoring' },
];

/** A PasswordField with its strength meter, at rest only: one look per score. */
function strengthCase(id: string, defaultValue: string): Scenario {
  return formCase({
    id,
    component: 'PasswordField',
    props: { showStrength: true, defaultValue },
    target: 'input',
    states: ['rest'],
    responsive: false,
  });
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
  formCase({
    id: 'password-empty',
    component: 'PasswordField',
    props: { showStrength: true, autoComplete: 'new-password' },
    target: 'input',
    responsive: false,
  }),
  strengthCase('password-strength-weak', 'abc'),
  strengthCase('password-strength-fair', 'abcdefgh1'),
  strengthCase('password-strength-good', 'Abcdefgh1'),
  strengthCase('password-strength-strong', 'Abcdefgh1!xyz'),
  formCase({
    id: 'password-visible',
    component: 'PasswordField',
    props: { defaultValue: 'Abcdefgh1', autoComplete: 'current-password' },
    wrapper: 'RevealPassword',
    target: 'button',
    responsive: false,
  }),
  formCase({
    id: 'password-error',
    component: 'PasswordField',
    props: { label: 'Current password', defaultValue: 'abc', error: 'Enter your current password.' },
    target: 'input',
    responsive: false,
  }),
  formCase({
    id: 'select-default',
    component: 'Select',
    props: { label: 'Payment method', options: PAYMENT_METHODS },
    target: 'select',
  }),
  formCase({
    id: 'select-error',
    component: 'Select',
    props: {
      label: 'Product type',
      placeholder: 'Choose a product type',
      options: PRODUCT_TYPES,
      error: 'Choose a product type.',
    },
    target: 'select',
    responsive: false,
  }),
  formCase({
    id: 'select-disabled',
    component: 'Select',
    props: { label: 'Payment method', options: PAYMENT_METHODS, disabled: true, hint: 'Paid in full.' },
    target: 'select',
    states: ['rest', 'hover'],
    responsive: false,
  }),
];
