// Reference side of OrderTotals (owner ruling D-41 R2-06, 2026-10-13; test only, never shipped): the frozen App. D.3
// OrderTotals, rendered unchanged with the same props and no wrapper element, so every DOM path stays the pinned
// design's. The owner ruled that the order math follows the PRD §5.1 names: "Subtotal" is the amount before discount
// and "Total" the amount after it. App. D.3 labels the before-discount row "Total" and its internal note reads
// "Profit = Total − Discount − Expenses. Internal only.", and CSS cannot change a text node, so after mount this side
// writes the PRD wording into every frozen `.csp-totals-row > dt` that reads exactly "Total" and every
// `.csp-totals-note` that reads exactly the App. D.3 note. "Total Discount" and "Total Paid" are not exact matches and
// stay as they are. The words are typed here from the ruling, not imported from the app, so a wording slip on either
// side shows up as a pixel difference. This name shadows the frozen OrderTotals, which merge-kit.ts allows only
// through its SPEC_OVERRIDES entry (OrderTotals → D-41). The frozen OrderCard draws the frozen OrderTotals internally,
// out of this override's reach, so fragments/OrderCard.tsx does the same for the card. The converted OrderTotals
// renders the wording by itself (web/src/ui/money/OrderTotals.tsx).
// The frozen component comes from the extracted spec module, loaded the way kit.ts loads it (import.meta.glob, so the
// frozen code is never type-checked).
import { useEffect, type ComponentType } from 'react';

type ModuleExports = Readonly<Record<string, unknown>>;

const spec = Object.values(import.meta.glob<ModuleExports>('../../.reference-src/ui/index.tsx', { eager: true }))[0];

/** The frozen App. D.3 props the scenarios pass (the frozen OrderTotals takes them as they are). */
export interface OrderTotalsProps {
  order?: unknown;
  totals?: unknown;
  variant?: 'card' | 'panel';
}

function frozenOrderTotals(): ComponentType<OrderTotalsProps> {
  const component = spec?.OrderTotals;
  if (typeof component !== 'function') {
    throw new Error('The frozen spec has no OrderTotals. Run node visual/reference/extract-spec.mjs.');
  }
  return component as ComponentType<OrderTotalsProps>;
}

const FrozenOrderTotals = frozenOrderTotals();

/** App. D.3's first row label, the amount before discount. */
const SPEC_ROW = 'Total';
/** D-41 R2-06: the PRD §5.1 name of the amount before discount. */
const PRD_ROW = 'Subtotal';
/** App. D.3's internal note (U+2212 minus signs). */
const SPEC_NOTE = 'Profit = Total − Discount − Expenses. Internal only.';
/** D-41 R2-06: the same note in the PRD §5.1 names (U+2212 minus signs). */
const PRD_NOTE = 'Profit = Subtotal − Discount − Expenses. Internal only.';

/**
 * Writes the D-41 R2-06 wording into the frozen totals rows and note inside `root`. Only exact matches change, so it
 * is idempotent and leaves "Total Discount" and "Total Paid" alone.
 */
export function writePrdTotalsWording(root: ParentNode): void {
  for (const term of root.querySelectorAll('.csp-totals-row > dt')) {
    if (term.textContent === SPEC_ROW) {
      term.textContent = PRD_ROW;
    }
  }
  for (const note of root.querySelectorAll('.csp-totals-note')) {
    if (note.textContent === SPEC_NOTE) {
      note.textContent = PRD_NOTE;
    }
  }
}

export function OrderTotals(props: OrderTotalsProps) {
  useEffect(() => {
    writePrdTotalsWording(document);
  });
  return <FrozenOrderTotals {...props} />;
}
