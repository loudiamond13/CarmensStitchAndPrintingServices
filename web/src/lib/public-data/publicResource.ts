// A small public data store (D-42): useSyncExternalStore over a load function, with no TanStack Query, so a public page
// never loads that library. Each resource keeps one cached answer for the whole page:
//   - the first read is primed from the server's boot block, so a first visit sends no request for it;
//   - otherwise the first subscriber loads it, and every other subscriber shares the result;
//   - after `staleMs` the next subscriber reloads, showing the old data meanwhile;
//   - invalidate() makes the data stale at once, and reloads it now when something is showing it;
//   - a failed first load is an error with a retry, and a failed refresh keeps the old data.
// The browser revalidates each read with the answer's ETag, so a reload that changed nothing costs a 304.
import { useSyncExternalStore } from 'react';
import { readBootData, type BootKey } from './bootData';

export type PublicResourceState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T }
  | { readonly status: 'error'; readonly error: unknown; readonly retry: () => void };

export interface PublicResource<T> {
  /** The resource's state; loads it when it is missing or stale. */
  useResource(): PublicResourceState<T>;
  /** Marks the data stale and reloads it now when a component shows it. */
  invalidate(): void;
  /** Sets the data without a load. */
  prime(value: T): void;
}

export interface PublicResourceOptions<T> {
  /** The part of the boot block that primes this resource; a resource the server never writes there has none. */
  readonly key?: BootKey;
  readonly load: (signal: AbortSignal) => Promise<T>;
  /** How long loaded data counts as fresh. */
  readonly staleMs: number;
}

const LOADING: PublicResourceState<never> = { status: 'loading' };

/** What each resource registers, so one call can clear them all. */
interface Registered {
  invalidate(): void;
  reset(): void;
}
const registry = new Set<Registered>();

export function createPublicResource<T>({ key, load, staleMs }: PublicResourceOptions<T>): PublicResource<T> {
  let state: PublicResourceState<T> = LOADING;
  let fetchedAt = 0;
  let primedFromBoot = false;
  let inFlight: AbortController | undefined;
  const listeners = new Set<() => void>();

  function set(next: PublicResourceState<T>): void {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function setData(data: T): void {
    fetchedAt = Date.now();
    set({ status: 'success', data });
  }

  function start(): void {
    if (inFlight !== undefined) {
      return;
    }
    const controller = new AbortController();
    inFlight = controller;
    if (state.status !== 'success' && state.status !== 'loading') {
      set(LOADING);
    }
    load(controller.signal).then(
      (data) => {
        if (inFlight === controller) {
          inFlight = undefined;
          setData(data);
        }
      },
      (error: unknown) => {
        if (inFlight !== controller) {
          return;
        }
        inFlight = undefined;
        if (state.status !== 'success') {
          set({ status: 'error', error, retry: start });
        }
      },
    );
  }

  function needsLoad(): boolean {
    return state.status !== 'success' || Date.now() - fetchedAt >= staleMs;
  }

  function snapshot(): PublicResourceState<T> {
    if (!primedFromBoot) {
      primedFromBoot = true;
      const boot = key === undefined ? undefined : (readBootData(key) as T | undefined);
      if (boot !== undefined) {
        fetchedAt = Date.now();
        state = { status: 'success', data: boot };
      }
    }
    return state;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (needsLoad()) {
      start();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && inFlight !== undefined) {
        inFlight.abort();
        inFlight = undefined;
      }
    };
  }

  function invalidate(): void {
    fetchedAt = 0;
    if (listeners.size > 0 && state.status === 'success') {
      start();
    }
  }

  registry.add({
    invalidate,
    reset: () => {
      inFlight?.abort();
      inFlight = undefined;
      state = LOADING;
      fetchedAt = 0;
      primedFromBoot = false;
      listeners.clear();
    },
  });

  return {
    useResource: () => useSyncExternalStore(subscribe, snapshot, snapshot),
    invalidate,
    prime: (value) => {
      primedFromBoot = true;
      setData(value);
    },
  };
}

/** Clears every public resource (the admin calls it after a content write). */
export function invalidatePublicContent(): void {
  for (const resource of registry) {
    resource.invalidate();
  }
}

/** Drops every resource's data and in-flight load, for tests and previews. */
export function resetPublicResources(): void {
  for (const resource of registry) {
    resource.reset();
  }
}
