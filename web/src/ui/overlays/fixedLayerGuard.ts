// RED stub (quick-261013-lgi Task 3): the WR-05 guard is not implemented yet.
import { createContext, use } from 'react';

export const PaintContainmentContext = createContext<boolean>(false);

/** Stub: reads the context and names the component, but does not throw yet. */
export function useFixedLayerGuard(component: string): string {
  return use(PaintContainmentContext) ? component : '';
}
