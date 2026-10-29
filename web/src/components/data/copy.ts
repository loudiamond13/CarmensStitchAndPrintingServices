// Shared order copy (owner ruling D-40, 2026-10-08). An order with no team reads "Walk-in customer" under the customer's
// name: the spec §8.3 table rows ("Customer / team": the customer, or "Walk-in customer" when there's no team) and,
// since D-40, the OrderCard's customer line. Every screen that shows this line imports this one constant (the
// ResponsiveTable customer cell of plan 02-30 included), so the card and the table always say exactly the same thing.

/** The line shown under the customer's name when an order has no team (spec §8.3, D-40). */
export const WALK_IN_CUSTOMER = 'Walk-in customer';

/** The order card's words (plan 08-02; owner rulings D-27, D-46, D-57). */
export const ORDER_CARD_COPY = {
  /** The cover placeholder until Phase 9 brings the real images (D-27). */
  noImages: 'No images yet',
  view: 'View Order',
  editDetails: 'Edit Details',
} as const;

/** SEC-08 RecordMeta and ActorName (owner ruling D-47, OQ-8): who recorded and last changed a record. */
export const RECORD_META_COPY = {
  recordedBy: 'Recorded by',
  lastChangedBy: 'Last changed by',
  /** The actor of a record made before actors were recorded, or by the system itself. */
  system: 'System',
  /** Follows the name of an actor whose account was deleted. */
  formerStaff: ' (former staff)',
  /** Between the actor and the time. */
  separator: ' · ',
} as const;
