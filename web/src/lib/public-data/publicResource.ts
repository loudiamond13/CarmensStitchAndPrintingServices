// A small public data store (D-42): useSyncExternalStore over a load function, with no TanStack Query.
import type { BootKey } from './bootData';

export type PublicResourceState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T }
  | { readonly status: 'error'; readonly error: unknown; readonly retry: () => void };

export interface PublicResource<T> {
  useResource(): PublicResourceState<T>;
  invalidate(): void;
  prime(value: T): void;
}

export interface PublicResourceOptions<T> {
  readonly key: BootKey;
  readonly load: (signal: AbortSignal) => Promise<T>;
  readonly staleMs: number;
}

export function createPublicResource<T>(options: PublicResourceOptions<T>): PublicResource<T> {
  void options;
  return {
    useResource: () => ({ status: 'loading' }),
    invalidate: () => undefined,
    prime: () => undefined,
  };
}

/** Clears every public resource (the admin calls it after a content write). */
export function invalidatePublicContent(): void {}

/** Drops every resource's data and in-flight load, for tests and previews. */
export function resetPublicResources(): void {}
