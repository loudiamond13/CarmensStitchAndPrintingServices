// RED stub (plan 02-22 Task 1).
import type { RefObject } from 'react';

export interface FocusTrapOptions {
  readonly active?: boolean;
  readonly initialFocus?: RefObject<HTMLElement | null> | undefined;
  readonly returnFocus?: boolean;
}

export function useFocusTrap(_container: RefObject<HTMLElement | null>, _options: FocusTrapOptions = {}): void {}
