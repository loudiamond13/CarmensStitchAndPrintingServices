// Reference side of the dev-only walk-in order card wrapper (plan 02-24, owner ruling D-40; test only, never shipped):
// one plain block around the frozen App. D.3 OrderCard. The owner ruled that an order with no team shows
// "Walk-in customer" on the card's customer line, the wording of the spec §8.3 table rows. App. D.3 renders that line
// empty (`o.team ? o.customer : ''`) and CSS cannot add a text node, so after mount this side writes the text into the
// frozen `.csp-order-cust` line when the OrderCard child's order has no team. The text is typed here from the spec,
// not imported from the app, so a wording slip on either side shows up as a pixel difference. The converted OrderCard
// renders the line by itself (web/src/dev/previews/WalkInOrderCard.tsx). No look of its own.
import { isValidElement, useEffect, useRef, type ReactNode } from 'react';

/** Spec §8.3: the muted sub "reads the customer name, or "Walk-in customer" when there's no team". */
const WALK_IN = 'Walk-in customer';

export interface WalkInOrderCardProps {
  children?: ReactNode;
}

export function WalkInOrderCard({ children }: WalkInOrderCardProps) {
  const frame = useRef<HTMLDivElement>(null);
  const walkIn = isValidElement<{ order?: { team?: unknown } }>(children) && !children.props.order?.team;
  useEffect(() => {
    if (!walkIn) {
      return;
    }
    for (const line of frame.current?.querySelectorAll('.csp-order-cust') ?? []) {
      if (line.textContent === '') {
        line.textContent = WALK_IN;
      }
    }
  }, [walkIn]);
  return <div ref={frame}>{children}</div>;
}
