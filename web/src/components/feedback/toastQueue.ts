// The toast queue (plan 02-21; UI-SPEC Interaction Contract "Toasts"): pure, with the clock and the scheduler injected,
// so its rules are tested on fake timers and ToastProvider only wires it to React.
//   - D-04: danger toasts persist until closed. D-31 O-7: warning toasts persist too, and the success and info timers
//     (4.5 s, App. D.3) pause while the pointer is over the stack or focus is inside it (WCAG 2.2.1); pause() and
//     resume() are that switch, and a resumed timer continues with the time it had left.
//   - At most 3 toasts, newest first (App. D.3). A 4th removes the oldest non-persistent toast; only when the three
//     already shown are all persistent is the oldest of them removed, so a danger or warning message is never pushed out
//     by a success message (T-02-51).
//   - D-31 O-5 (the layer always mounted as the live region) is ToastProvider's part.
import type { ReactNode } from 'react';
import type { ToastTone } from './Toast';

/** The most toasts on screen at once (App. D.3). */
export const MAX_TOASTS = 3;

/** How long a success or info toast stays, in running (unpaused) time (App. D.3: 4.5 s). */
export const AUTO_DISMISS_MS = 4500;

/** Danger (D-04) and warning (D-31 O-7) toasts stay until the user closes them. */
export function isPersistent(tone: ToastTone): boolean {
  return tone === 'danger' || tone === 'warning';
}

/** A toast on screen. The text is rendered as React text only (T-02-52). */
export interface ToastItem {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly message?: ReactNode;
  readonly action?: ReactNode;
}

/** What a screen passes to `show`; the tone defaults to success, as App. D.3 does. */
export interface ToastInput {
  readonly tone?: ToastTone | undefined;
  readonly title: string;
  readonly message?: ReactNode;
  readonly action?: ReactNode;
}

/** The queue's state; the same object until something changes (useSyncExternalStore). */
export interface ToastQueueSnapshot {
  /** Newest first. */
  readonly toasts: readonly ToastItem[];
  /** True while the timers are paused (pointer over the stack or focus inside it). */
  readonly paused: boolean;
}

export interface ToastQueueOptions {
  /** The current time in ms. */
  readonly now: () => number;
  /** Runs `callback` after `delayMs` and returns a function that cancels it. */
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
}

export interface ToastQueue {
  /** Adds a toast on top and returns its id. */
  readonly show: (input: ToastInput) => number;
  /** Removes a toast; an unknown id does nothing. */
  readonly dismiss: (id: number) => void;
  /** Stops every success and info clock. */
  readonly pause: () => void;
  /** Restarts them with the time each had left. */
  readonly resume: () => void;
  readonly getSnapshot: () => ToastQueueSnapshot;
  /** Calls `listener` after every change; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** The clock of one timed toast. `cancel` is set only while its timer runs. */
interface Clock {
  remaining: number;
  startedAt: number;
  cancel: (() => void) | undefined;
}

export function createToastQueue({ now, schedule }: ToastQueueOptions): ToastQueue {
  const clocks = new Map<number, Clock>();
  const listeners = new Set<() => void>();
  let snapshot: ToastQueueSnapshot = { toasts: [], paused: false };
  let nextId = 1;

  function publish(next: ToastQueueSnapshot): void {
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function start(id: number, clock: Clock): void {
    clock.startedAt = now();
    clock.cancel = schedule(() => {
      dismiss(id);
    }, clock.remaining);
  }

  function stop(clock: Clock): void {
    if (clock.cancel !== undefined) {
      clock.cancel();
      clock.cancel = undefined;
      clock.remaining = Math.max(0, clock.remaining - (now() - clock.startedAt));
    }
  }

  /** Drops the clock of every toast no longer shown (dismissed, expired or trimmed). */
  function sweep(toasts: readonly ToastItem[]): void {
    for (const [id, clock] of clocks) {
      if (!toasts.some((toast) => toast.id === id)) {
        stop(clock);
        clocks.delete(id);
      }
    }
  }

  /** The position a 4th toast pushes out: the oldest non-persistent toast already shown, else the oldest of all. */
  function trimIndex(shown: readonly ToastItem[]): number {
    const timed = shown.findLastIndex((toast) => !isPersistent(toast.tone));
    return timed === -1 ? shown.length - 1 : timed;
  }

  function show(input: ToastInput): number {
    const id = nextId;
    nextId += 1;
    const toast: ToastItem = { ...input, id, tone: input.tone ?? 'success' };
    const shown = snapshot.toasts;
    const pushedOut = shown.length >= MAX_TOASTS ? trimIndex(shown) : -1;
    const toasts = [toast, ...shown.filter((_, position) => position !== pushedOut)];
    sweep(toasts);
    if (!isPersistent(toast.tone)) {
      const clock: Clock = { remaining: AUTO_DISMISS_MS, startedAt: 0, cancel: undefined };
      clocks.set(id, clock);
      if (!snapshot.paused) {
        start(id, clock);
      }
    }
    publish({ ...snapshot, toasts });
    return id;
  }

  function dismiss(id: number): void {
    if (!snapshot.toasts.some((toast) => toast.id === id)) {
      return;
    }
    const toasts = snapshot.toasts.filter((toast) => toast.id !== id);
    sweep(toasts);
    publish({ ...snapshot, toasts });
  }

  function pause(): void {
    if (snapshot.paused) {
      return;
    }
    for (const clock of clocks.values()) {
      stop(clock);
    }
    publish({ ...snapshot, paused: true });
  }

  function resume(): void {
    if (!snapshot.paused) {
      return;
    }
    for (const [id, clock] of clocks) {
      start(id, clock);
    }
    publish({ ...snapshot, paused: false });
  }

  return {
    show,
    dismiss,
    pause,
    resume,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
