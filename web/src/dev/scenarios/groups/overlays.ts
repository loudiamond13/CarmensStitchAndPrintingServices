// Overlays group (App. D.3 "Overlays": Modal and ConfirmDialog; App. C `.s-overlay`; CSPS-UI-SPEC.md §6.5). Every
// scenario here has group 'overlays'. Plan 02-22. The dialogs are fixed-position, so every case is a `viewport` frame
// (one case per page load, compared as the whole viewport) at every width: below 640px viewport width the centred
// modal is a bottom sheet and the slide-over fills the width (App. B), and on phone pages the region rules of App. C
// apply. Each case is compared in both themes and in the reduced-motion pass, where the overlay fade and the modal
// entry stop on both sides (D-31 O-6).
//
// Every dialog sits in an OpenedDialog wrapper (web/src/dev/previews, web/visual/reference/fragments): the converted
// Modal focuses its first field when it opens (WEB-02, A11Y-02), so the reference side focuses the frozen dialog's first
// field the same way, and both sides compare the dialog as it looks once open.
//   - `modal-add-payment`: the centred Modal on its own scrim (App. B `.csp-overlay`): "Add Payment" with the order in
//     the description, the Amount field and the Cancel and Add Payment buttons (App. E.10 payment modal copy).
//   - `modal-slideover`: the slide-over variant ("Add User", App. E.12 copy) with the First name field.
//   - `confirm-delete-order` / `confirm-delete-order-typed`: the App. E.8/E.10 order delete, an inline ConfirmDialog in
//     the Overlay region (App. C `.s-overlay`) as the mockups render it, with the ORD-2026-0148 cascade (5 items,
//     2 payments, 1 discount, 3 expenses, 4 images) and the type-to-confirm field, empty (Delete Order disabled) and
//     with the order number typed (enabled).
//   - `confirm-delete-order-error`: the failure state (WEB-06, UI-SPEC "UI Considerations" → error | ConfirmDialog),
//     which the frozen App. D.3 ConfirmDialog does not have: implementation only (`parity: false`), checked by axe and
//     the CSP guard. The FailedConfirmDialog preview types the order number and presses Delete Order against an action
//     that fails with a 500 and a traceId.
import type { Scenario, ScenarioNode, ScenarioProps } from '../types';

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

/** A dialog case: a viewport frame in both themes, at every width, with the reduced-motion pass. */
function overlayCase(id: string, dialog: ScenarioNode, handlers: readonly string[]): Scenario {
  return {
    id,
    group: 'overlays',
    node: dialog,
    themes: ['light', 'dark'],
    responsive: true,
    states: ['rest'],
    parity: true,
    passes: ['motion'],
    handlers,
    frame: 'viewport',
  };
}

const cancel = node('Button', { variant: 'secondary', children: 'Cancel' });

/** The App. E.8/E.10 order delete (spec §9.3 copy). */
const deleteOrder: ScenarioProps = {
  inline: true,
  title: 'Delete order ORD-2026-0148?',
  message:
    'Brgy. San Roque Ballers · Juan Dela Cruz. The order will be permanently deleted along with everything inside it.',
  counts: { items: 5, payments: 2, discounts: 1, expenses: 3, images: 4 },
  confirmText: 'ORD-2026-0148',
  confirmLabel: 'Delete Order',
};

/** The delete dialog in the Overlay region, opened (and typed into, with `typed`). */
function openedDelete(typed?: string): ScenarioNode {
  return node('OpenedDialog', {
    children: node('Overlay', { children: node('ConfirmDialog', deleteOrder) }),
    ...(typed === undefined ? {} : { typed }),
  });
}

export const scenarios: readonly Scenario[] = [
  overlayCase(
    'modal-add-payment',
    node('OpenedDialog', {
      children: node('Modal', {
        title: 'Add Payment',
        description: 'ORD-2026-0148 · Brgy. San Roque Ballers',
        children: node('Field', {
          label: 'Amount',
          prefix: '₱',
          inputMode: 'decimal',
          autoComplete: 'off',
          hint: 'Balance due: ₱4,327.50',
        }),
        footer: [cancel, node('Button', { variant: 'primary', icon: 'check', children: 'Add Payment' })],
      }),
    }),
    ['onClose'],
  ),
  overlayCase(
    'modal-slideover',
    node('OpenedDialog', {
      children: node('Modal', {
        variant: 'slideover',
        title: 'Add User',
        description: 'They can sign in right away with a temporary password.',
        children: node('Field', { label: 'First name', autoComplete: 'off' }),
        footer: [cancel, node('Button', { variant: 'primary', icon: 'check', children: 'Create User' })],
      }),
    }),
    ['onClose'],
  ),
  overlayCase('confirm-delete-order', openedDelete(), ['onConfirm', 'onCancel']),
  overlayCase('confirm-delete-order-typed', openedDelete('ORD-2026-0148'), ['onConfirm', 'onCancel']),
  {
    ...overlayCase(
      'confirm-delete-order-error',
      node('Overlay', {
        children: node('FailedConfirmDialog', { ...deleteOrder, traceId: '00-4bf92f3577b34da6a3ce929d0e0e4736-01' }),
      }),
      ['onCancel'],
    ),
    parity: false,
  },
];
