// The Component Showcase copy (D-22; dev only, never shipped, D-20). The page head and the document title are the
// UI-SPEC's ("Phase 2 pages" → ComponentShowcase). The demo trigger labels are SPEC-GAP dev wording (the UI-SPEC names
// the triggers but not their words); the dialogs and toasts they open reuse the scenario copy (spec §9.3, App. E.10).
export const SHOWCASE_COPY = {
  documentTitle: 'Component Showcase · CSPS (dev)',
  heading: 'Component Showcase',
  subline: 'Every shared building block, in the current theme. Use the moon/sun button to switch themes.',
  /** SPEC-GAP: shows a case that would otherwise move focus when the page loads (the open user menu). */
  showExample: 'Show this example',
  openAddPayment: 'Open Add Payment',
  openAddUser: 'Open Add User',
  openDeleteOrder: 'Open Delete Order',
  /** SPEC-GAP trigger for the child-row delete (CSPS-UI-SPEC "Deleting a child row"), the ConfirmDialog with no field. */
  openDeletePayment: 'Open Delete Payment',
  openDrawer: 'Open navigation drawer',
  /** Toast trigger label → the toast scenario whose tone, title and message it shows. */
  toastTriggers: [
    ['Show success toast', 'toast-success'],
    ['Show info toast', 'toast-info'],
    ['Show warning toast', 'toast-warning'],
    ['Show danger toast', 'toast-danger'],
    ['Show long toast', 'toast-long-copy'],
  ],
  /** The ORD-2026-0148 dates (spec §12.2 "Ordered" and "Due"). */
  dates: { ordered: 'Ordered', due: 'Due' },
  /** The loaded LazyImage shows the brand mark (web/public/mark.svg). */
  markAlt: "CSPS — Carmen's Stitch & Printing Services",
  /** Spec §9.3 success toast after a delete. */
  deletedToast: {
    title: 'Order ORD-2026-0148 deleted',
    message: 'Its items, payments, discounts, expenses and images were removed.',
  },
} as const;
