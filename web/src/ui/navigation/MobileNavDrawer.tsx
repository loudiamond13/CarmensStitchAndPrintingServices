// SPEC-GAP: mobile nav drawer
// RED stub (plan 02-32): the props API only; the drawer itself comes with the implementation.
import type { ReactNode } from 'react';

export interface MobileNavDrawerProps {
  /** The drawer is shown while true. */
  open: boolean;
  /** Called on Esc, a scrim click or a navigation. */
  onClose: () => void;
  /** The panel's id: the menu button's `aria-controls`. */
  id: string;
  /** The Sidebar. */
  children?: ReactNode;
}

export function MobileNavDrawer(_props: MobileNavDrawerProps) {
  return null;
}
