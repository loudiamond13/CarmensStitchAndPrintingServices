// The Component Showcase copy (D-22, D-30..D-33). The page head, the badge, the banner and the document title are the
// UI-SPEC's (C1 and the Copywriting showcase row). The demo trigger labels are SPEC-GAP wording (the UI-SPEC names the
// triggers but not their words); the dialogs and toasts they open reuse the scenario copy (spec §9.3, App. E.10).
export const SHOWCASE_COPY = {
  documentTitle: 'Component Showcase · CSPS Admin',
  heading: 'Component Showcase',
  /** D-32: the warning badge beside the h1. */
  badge: 'Demo data',
  /** D-32: the Note first in main after the page head. */
  banner:
    'Demo data. Every order, name and amount on this page is made up to show the design. Nothing here is a real record.',
  subline: 'Every shared building block, in the current theme. Use the moon/sun button to switch themes.',
  /** SPEC-GAP: shows a case that would otherwise move focus when the page loads (the open user menu). */
  showExample: 'Show this example',
  openAddPayment: 'Open Add Payment',
  openAddUser: 'Open Add User',
  openDeleteOrder: 'Open Delete Order',
  /** SPEC-GAP trigger for the child-row delete (CSPS-UI-SPEC "Deleting a child row"), the ConfirmDialog with no field. */
  openDeletePayment: 'Open Delete Payment',
  openDrawer: 'Open navigation drawer',
  /** SPEC-GAP dev wording: the triggers of the four sign-out dialog demos (plan 04-32). */
  openSignOutOthers: 'Open Sign Out Others',
  openSignOutOthersFailed: 'Open Sign Out Others (fails)',
  openSignOutDevice: 'Open Sign Out Device',
  openSignOutDeviceFailed: 'Open Sign Out Device (fails)',
  /** SPEC-GAP dev wording: the session toast triggers, each with the app's own copy (plan 04-32). */
  sessionToastTriggers: [
    ['Show session ending toast', 'session-ending'],
    ['Show device signed out toast', 'device-signed-out'],
    ['Show already signed out toast', 'already-signed-out'],
    ['Show signed out others toast', 'signed-out-others'],
    ['Show password saved toast', 'password-saved'],
  ],
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
  markAlt: "CSPS: Carmen's Stitch & Printing Services",
  /** Spec §9.3 success toast after a delete. */
  deletedToast: {
    title: 'Order ORD-2026-0148 deleted',
    message: 'Its items, payments, discounts, expenses and images were removed.',
  },
} as const;
