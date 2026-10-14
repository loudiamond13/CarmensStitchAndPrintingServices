import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_DISMISS_MS, createToastQueue, isPersistent, MAX_TOASTS, type ToastQueue } from './toastQueue';

// The pure toast queue (plan 02-21; D-04, D-31 O-5, O-7; UI-SPEC Interaction Contract "Toasts"), on fake timers (L-24).
// The clock and the scheduler are injected, so these tests drive time through vi.advanceTimersByTime.

function fakeTimerQueue(): ToastQueue {
  return createToastQueue({
    now: () => Date.now(),
    schedule: (callback, delayMs) => {
      const handle = setTimeout(callback, delayMs);
      return () => {
        clearTimeout(handle);
      };
    },
  });
}

function titles(queue: ToastQueue): string[] {
  return queue.getSnapshot().toasts.map((toast) => toast.title);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toast queue constants (D-04, O-7)', () => {
  it('keeps at most 3 toasts and auto-dismisses after 4.5 s', () => {
    expect(MAX_TOASTS).toBe(3);
    expect(AUTO_DISMISS_MS).toBe(4500);
  });

  it('treats danger and warning as persistent, success and info as timed', () => {
    expect(isPersistent('danger')).toBe(true);
    expect(isPersistent('warning')).toBe(true);
    expect(isPersistent('success')).toBe(false);
    expect(isPersistent('info')).toBe(false);
  });
});

describe('createToastQueue', () => {
  it('starts empty and running', () => {
    const queue = fakeTimerQueue();

    expect(queue.getSnapshot()).toEqual({ toasts: [], paused: false });
  });

  it('shows toasts newest first, with increasing ids and the success tone by default', () => {
    const queue = fakeTimerQueue();

    const first = queue.show({ title: 'Payment added', message: 'Balance now ₱4,327.50' });
    const second = queue.show({ tone: 'danger', title: "Couldn't save order" });

    expect(second).toBeGreaterThan(first);
    expect(queue.getSnapshot().toasts).toEqual([
      { id: second, tone: 'danger', title: "Couldn't save order" },
      { id: first, tone: 'success', title: 'Payment added', message: 'Balance now ₱4,327.50' },
    ]);
  });

  it.each(['success', 'info'] as const)('dismisses a %s toast after exactly 4500 ms', (tone) => {
    const queue = fakeTimerQueue();
    queue.show({ tone, title: 'Timed' });

    vi.advanceTimersByTime(4499);
    expect(titles(queue)).toEqual(['Timed']);

    vi.advanceTimersByTime(1);
    expect(titles(queue)).toEqual([]);
  });

  it.each(['danger', 'warning'] as const)('never auto-dismisses a %s toast (D-04, O-7)', (tone) => {
    const queue = fakeTimerQueue();
    queue.show({ tone, title: 'Persistent' });

    vi.advanceTimersByTime(10 * 60_000);

    expect(titles(queue)).toEqual(['Persistent']);
  });

  it('pause() stops the clock and resume() continues with the remaining time (O-7)', () => {
    const queue = fakeTimerQueue();
    queue.show({ title: 'Payment added' });

    vi.advanceTimersByTime(1000);
    queue.pause();
    expect(queue.getSnapshot().paused).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(titles(queue)).toEqual(['Payment added']);

    queue.resume();
    expect(queue.getSnapshot().paused).toBe(false);
    vi.advanceTimersByTime(3499);
    expect(titles(queue)).toEqual(['Payment added']);
    vi.advanceTimersByTime(1);
    expect(titles(queue)).toEqual([]);
  });

  it('keeps each timed toast on its own remaining time across several pauses', () => {
    const queue = fakeTimerQueue();
    queue.show({ title: 'Older' });
    vi.advanceTimersByTime(2000);
    queue.show({ title: 'Newer' });

    vi.advanceTimersByTime(1000);
    queue.pause();
    vi.advanceTimersByTime(5000);
    queue.resume();
    vi.advanceTimersByTime(500);
    queue.pause();
    queue.resume();

    vi.advanceTimersByTime(999);
    expect(titles(queue)).toEqual(['Newer', 'Older']);
    vi.advanceTimersByTime(1);
    expect(titles(queue)).toEqual(['Newer']);
    vi.advanceTimersByTime(1999);
    expect(titles(queue)).toEqual(['Newer']);
    vi.advanceTimersByTime(1);
    expect(titles(queue)).toEqual([]);
  });

  it('gives a toast shown while paused its full 4500 ms once the clock runs again', () => {
    const queue = fakeTimerQueue();
    queue.pause();
    queue.show({ tone: 'info', title: 'Not available yet' });

    vi.advanceTimersByTime(60_000);
    expect(titles(queue)).toEqual(['Not available yet']);

    queue.resume();
    vi.advanceTimersByTime(4499);
    expect(titles(queue)).toEqual(['Not available yet']);
    vi.advanceTimersByTime(1);
    expect(titles(queue)).toEqual([]);
  });

  it('ignores a pause while paused and a resume while running', () => {
    const queue = fakeTimerQueue();
    const listener = vi.fn();
    queue.subscribe(listener);

    queue.resume();
    expect(listener).not.toHaveBeenCalled();

    queue.pause();
    queue.pause();
    expect(listener).toHaveBeenCalledTimes(1);

    queue.resume();
    queue.resume();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot().paused).toBe(false);
  });

  it('trims the oldest non-persistent toast when a 4th arrives (WEB-06 concurrency edge)', () => {
    const queue = fakeTimerQueue();
    queue.show({ tone: 'danger', title: 'Danger A' });
    queue.show({ tone: 'success', title: 'Success B' });
    queue.show({ tone: 'info', title: 'Info C' });

    queue.show({ tone: 'warning', title: 'Warning D' });

    expect(queue.getSnapshot().toasts).toHaveLength(MAX_TOASTS);
    expect(titles(queue)).toEqual(['Warning D', 'Info C', 'Danger A']);
  });

  it('trims the oldest toast when all three are timed', () => {
    const queue = fakeTimerQueue();
    queue.show({ title: 'One' });
    queue.show({ title: 'Two' });
    queue.show({ title: 'Three' });

    queue.show({ title: 'Four' });

    expect(titles(queue)).toEqual(['Four', 'Three', 'Two']);
  });

  it('trims the oldest persistent toast only when all three are persistent (A11Y-04 ordering edge)', () => {
    const queue = fakeTimerQueue();
    queue.show({ tone: 'danger', title: 'Danger A' });
    queue.show({ tone: 'warning', title: 'Warning B' });
    queue.show({ tone: 'danger', title: 'Danger C' });

    queue.show({ tone: 'success', title: 'Success D' });

    expect(titles(queue)).toEqual(['Success D', 'Danger C', 'Warning B']);
  });

  it('cancels the timer of a trimmed toast, so it never touches the list again', () => {
    const queue = fakeTimerQueue();
    queue.show({ title: 'Trimmed' });
    queue.show({ tone: 'danger', title: 'Danger' });
    queue.show({ tone: 'warning', title: 'Warning' });
    queue.show({ tone: 'danger', title: 'Danger 2' });
    const listener = vi.fn();
    queue.subscribe(listener);

    vi.advanceTimersByTime(AUTO_DISMISS_MS * 2);

    expect(listener).not.toHaveBeenCalled();
    expect(titles(queue)).toEqual(['Danger 2', 'Warning', 'Danger']);
  });

  it('dismisses by id, cancelling its timer, and ignores an unknown id', () => {
    const queue = fakeTimerQueue();
    const timed = queue.show({ title: 'Timed' });
    const persistent = queue.show({ tone: 'danger', title: 'Persistent' });
    const listener = vi.fn();
    queue.subscribe(listener);

    queue.dismiss(timed);
    expect(titles(queue)).toEqual(['Persistent']);
    expect(listener).toHaveBeenCalledTimes(1);

    queue.dismiss(timed);
    queue.dismiss(999);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(AUTO_DISMISS_MS);
    expect(listener).toHaveBeenCalledTimes(1);

    queue.dismiss(persistent);
    expect(titles(queue)).toEqual([]);
  });

  it('dismisses a toast shown while paused (it has no running timer)', () => {
    const queue = fakeTimerQueue();
    queue.pause();
    const id = queue.show({ title: 'Waiting' });

    queue.dismiss(id);
    queue.resume();
    vi.advanceTimersByTime(AUTO_DISMISS_MS);

    expect(titles(queue)).toEqual([]);
  });

  it('notifies subscribers on every change and stops after unsubscribe', () => {
    const queue = fakeTimerQueue();
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);

    queue.show({ title: 'One' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    queue.show({ title: 'Two' });
    vi.advanceTimersByTime(AUTO_DISMISS_MS);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns the same snapshot object until something changes (useSyncExternalStore)', () => {
    const queue = fakeTimerQueue();
    const empty = queue.getSnapshot();

    expect(queue.getSnapshot()).toBe(empty);

    queue.show({ title: 'One' });
    const one = queue.getSnapshot();
    expect(one).not.toBe(empty);
    expect(queue.getSnapshot()).toBe(one);
  });
});
