// RED placeholder (02-39 Task 2): handlers that never prefetch.
import type { QueryClient, QueryExecuteOptions, QueryKey } from '@tanstack/react-query';

export const INTENT_DELAY_MS = 100;

export interface IntentEvent {
  currentTarget: EventTarget;
}

export interface IntentPointerEvent extends IntentEvent {
  pointerType: string;
}

export interface IntentHandlers {
  onPointerEnter: (event: IntentPointerEvent) => void;
  onPointerLeave: (event: IntentEvent) => void;
  onFocus: (event: IntentEvent) => void;
  onBlur: (event: IntentEvent) => void;
}

export function prefetchOnIntent<TQueryFnData, TQueryKey extends QueryKey>(
  _queryClient: QueryClient,
  _options: QueryExecuteOptions<TQueryFnData, Error, TQueryFnData, TQueryFnData, TQueryKey>,
): IntentHandlers {
  const ignore = (): void => undefined;
  return { onPointerEnter: ignore, onPointerLeave: ignore, onFocus: ignore, onBlur: ignore };
}
