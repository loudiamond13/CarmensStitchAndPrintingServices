// Reference side of OrderCard (owner ruling D-41 R2-06, 2026-10-13; test only, never shipped): the frozen App. D.3
// OrderCard, rendered unchanged with the same props and no wrapper element, so every DOM path stays the pinned
// design's. The frozen OrderCard draws the frozen OrderTotals internally (a module-local reference), which the
// OrderTotals override in fragments/OrderTotals.tsx cannot reach, so after mount this side writes the same PRD §5.1
// wording into the card's totals block: the before-discount row reads "Subtotal" instead of "Total". The words come
// from fragments/OrderTotals.tsx (typed there from the ruling, not imported from the app). This name shadows the frozen
// OrderCard, which merge-kit.ts allows only through its SPEC_OVERRIDES entry (OrderCard → D-41). The existing
// WalkInOrderCard wrapper pair keeps wrapping this override. The converted OrderCard renders the wording by itself
// through the converted OrderTotals (web/src/components/data/OrderCard.tsx).
// The frozen component comes from the extracted spec module, loaded the way kit.ts loads it (import.meta.glob, so the
// frozen code is never type-checked).
import { useEffect, type ComponentType } from 'react';
import { writePrdTotalsWording } from './OrderTotals';

type ModuleExports = Readonly<Record<string, unknown>>;

const spec = Object.values(import.meta.glob<ModuleExports>('../../.reference-src/ui/index.tsx', { eager: true }))[0];

/** The frozen App. D.3 props the scenarios pass (the frozen OrderCard takes them as they are). */
export interface OrderCardProps {
  order?: unknown;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function frozenOrderCard(): ComponentType<OrderCardProps> {
  const component = spec?.OrderCard;
  if (typeof component !== 'function') {
    throw new Error('The frozen spec has no OrderCard. Run node visual/reference/extract-spec.mjs.');
  }
  return component as ComponentType<OrderCardProps>;
}

const FrozenOrderCard = frozenOrderCard();

export function OrderCard(props: OrderCardProps) {
  useEffect(() => {
    writePrdTotalsWording(document);
  });
  return <FrozenOrderCard {...props} />;
}
