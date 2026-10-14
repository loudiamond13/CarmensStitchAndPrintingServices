// Dev-only scenario wrapper (plan 02-24, owner ruling D-40; never shipped, D-20): one plain block around an OrderCard
// for an order with no team. The converted OrderCard writes "Walk-in customer" on its customer line by itself, so this
// side does nothing. App. D.3 leaves that line empty, so the reference side writes the same text into the frozen
// `.csp-order-cust` line after mount (web/visual/reference/fragments/WalkInOrderCard.tsx), and the text is then
// compared through the pixels like any other. It adds no look of its own.
import type { ReactNode } from 'react';

export interface WalkInOrderCardProps {
  /** The OrderCard node. */
  children?: ReactNode;
}

export function WalkInOrderCard({ children }: WalkInOrderCardProps) {
  return <div>{children}</div>;
}
