import type { RefObject } from 'react';

export interface SwipeOptions {
  onLeft: () => void;
  onRight: () => void;
  minDistance?: number;
}

// Stub for the RED step: it never listens.
export function useSwipe(ref: RefObject<HTMLElement | null>, options: SwipeOptions): void {
  if (options.minDistance === -1) {
    ref.current?.blur();
  }
}
