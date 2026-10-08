// Intent prefetch (WEB-08): when a mouse pointer rests on a link or row, or focus stays on it, for 100 ms, start the
// target screen's query so its data is cached by the time the user opens it. Leaving or blurring first cancels it,
// so sweeping the pointer across a list sends nothing (T-02-81). Returns plain event handlers and adds no markup.
import type { QueryClient, QueryExecuteOptions, QueryKey } from '@tanstack/react-query';

export const INTENT_DELAY_MS = 100;

/** The part of a React focus/blur/pointerleave event the handlers read. */
export interface IntentEvent {
  currentTarget: EventTarget;
}

/** The part of a React pointerenter event the handlers read. */
export interface IntentPointerEvent extends IntentEvent {
  pointerType: string;
}

export interface IntentHandlers {
  onPointerEnter: (event: IntentPointerEvent) => void;
  onPointerLeave: (event: IntentEvent) => void;
  onFocus: (event: IntentEvent) => void;
  onBlur: (event: IntentEvent) => void;
}

// One pending timer per element, shared by every handler set, so handlers rebuilt on a later render still cancel the
// timer an earlier render started, and a hover followed by focus never queues a second prefetch.
const pending = new WeakMap<EventTarget, ReturnType<typeof setTimeout>>();

function cancel(target: EventTarget): void {
  clearTimeout(pending.get(target));
  pending.delete(target);
}

export function prefetchOnIntent<TQueryFnData, TQueryKey extends QueryKey>(
  queryClient: QueryClient,
  options: QueryExecuteOptions<TQueryFnData, Error, TQueryFnData, TQueryFnData, TQueryKey>,
): IntentHandlers {
  const start = (target: EventTarget): void => {
    if (pending.has(target)) return;
    pending.set(
      target,
      setTimeout(() => {
        pending.delete(target);
        // queryClient.query replaces the deprecated prefetchQuery (L-15): it fetches only when the cached data is
        // stale. A failed prefetch is swallowed; the error stays in the cache for the real screen to show.
        queryClient.query(options).catch(() => undefined);
      }, INTENT_DELAY_MS),
    );
  };

  return {
    onPointerEnter: (event) => {
      // A touch pointer enters on the tap itself, so it is no sign of intent (the tap navigates anyway).
      if (event.pointerType === 'touch') return;
      start(event.currentTarget);
    },
    onPointerLeave: (event) => {
      cancel(event.currentTarget);
    },
    onFocus: (event) => {
      start(event.currentTarget);
    },
    onBlur: (event) => {
      cancel(event.currentTarget);
    },
  };
}
