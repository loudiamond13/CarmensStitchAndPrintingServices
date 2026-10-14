// Shared order copy (owner ruling D-40, 2026-10-08). An order with no team reads "Walk-in customer" under the customer's
// name: the spec §8.3 table rows ("Customer / team": the customer, or "Walk-in customer" when there's no team) and,
// since D-40, the OrderCard's customer line. Every screen that shows this line imports this one constant (the
// ResponsiveTable customer cell of plan 02-30 included), so the card and the table always say exactly the same thing.

/** The line shown under the customer's name when an order has no team (spec §8.3, D-40). */
export const WALK_IN_CUSTOMER = 'Walk-in customer';
