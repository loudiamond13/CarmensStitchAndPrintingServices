// WEB-09: one Idempotency-Key per user submission, reused only when that same submission is retried.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeferred } from '@/test/fakeFetch';
import { newIdempotencyKey, useSubmission, type SubmitContext } from './useSubmission';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface Payment {
  readonly orderId: string;
  readonly amount: string;
}

const payment: Payment = { orderId: 'ORD-2026-0148', amount: '1500.00' };

/** A submit spy that records each call and answers from the given outcomes in order (true = success). */
function recordingSubmit(outcomes: readonly boolean[]) {
  const queue = [...outcomes];
  const calls: { args: Payment; context: SubmitContext }[] = [];
  const submit = vi.fn((args: Payment, context: SubmitContext) => {
    calls.push({ args, context });
    const ok = queue.shift() ?? true;
    return ok ? Promise.resolve(`saved ${args.amount}`) : Promise.reject(new Error('server unavailable'));
  });
  return { submit, calls, keys: () => calls.map((call) => call.context.idempotencyKey) };
}

describe('useSubmission', () => {
  it('calls submit once with a fresh v4 key and a signal, and is pending until it settles', async () => {
    const deferred = createDeferred<string>();
    const submit = vi.fn((_args: Payment, _context: SubmitContext) => deferred.promise);
    const { result } = renderHook(() => useSubmission(submit));
    expect(result.current.pending).toBe(false);

    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = result.current.run(payment);
    });

    expect(result.current.pending).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    const [args, context] = submit.mock.calls[0] ?? [];
    expect(args).toEqual(payment);
    expect(context?.idempotencyKey).toMatch(uuidV4);
    expect(context?.signal).toBeInstanceOf(AbortSignal);

    await act(async () => {
      deferred.resolve('saved');
      await outcome;
    });
    expect(result.current.pending).toBe(false);
    await expect(outcome).resolves.toEqual({ ok: true, value: 'saved' });
  });

  it('returns the same in-flight promise to a second trigger and sends one request (double-click, Enter repeat)', async () => {
    const deferred = createDeferred<string>();
    const submit = vi.fn((_args: Payment, _context: SubmitContext) => deferred.promise);
    const { result } = renderHook(() => useSubmission(submit));

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    let third: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.run(payment);
      second = result.current.run(payment);
    });
    act(() => {
      third = result.current.run({ ...payment, amount: '9.00' });
    });

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(submit).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve('saved once');
      await first;
    });
    await expect(third).resolves.toEqual({ ok: true, value: 'saved once' });
  });

  it('gives two successful submissions with identical data two different keys', async () => {
    const spy = recordingSubmit([true, true]);
    const { result } = renderHook(() => useSubmission(spy.submit));

    await act(async () => {
      await result.current.run(payment);
    });
    await act(async () => {
      await result.current.run({ ...payment });
    });

    const [first, second] = spy.keys();
    expect(first).toMatch(uuidV4);
    expect(second).toMatch(uuidV4);
    expect(second).not.toBe(first);
  });

  it('reuses the key when a failed submission is retried with unchanged data, and exposes the error', async () => {
    const spy = recordingSubmit([false, false, true]);
    const { result } = renderHook(() => useSubmission(spy.submit));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run(payment);
    });
    expect(outcome).toEqual({ ok: false, error: new Error('server unavailable') });
    expect(result.current.error).toEqual(new Error('server unavailable'));
    expect(result.current.pending).toBe(false);

    await act(async () => {
      await result.current.run({ orderId: 'ORD-2026-0148', amount: '1500.00' });
    });
    await act(async () => {
      outcome = await result.current.run(payment);
    });

    expect(outcome).toEqual({ ok: true, value: 'saved 1500.00' });
    expect(result.current.error).toBeUndefined();
    const keys = spy.keys();
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
  });

  it('starts a new submission with a new key when the data changed after a failure', async () => {
    const spy = recordingSubmit([false, true]);
    const { result } = renderHook(() => useSubmission(spy.submit));

    await act(async () => {
      await result.current.run(payment);
    });
    await act(async () => {
      await result.current.run({ ...payment, amount: '1600.00' });
    });

    const [failed, changed] = spy.keys();
    expect(changed).not.toBe(failed);
  });

  it('discards the key after success, so the next run gets a new one', async () => {
    const spy = recordingSubmit([false, true, true]);
    const { result } = renderHook(() => useSubmission(spy.submit));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        await result.current.run(payment);
      });
    }

    const [failed, retried, next] = spy.keys();
    expect(retried).toBe(failed);
    expect(next).not.toBe(retried);
  });

  it('discards the key and the error on reset(), so the next run is a new submission', async () => {
    const spy = recordingSubmit([false, true]);
    const { result } = renderHook(() => useSubmission(spy.submit));

    await act(async () => {
      await result.current.run(payment);
    });
    expect(result.current.error).toBeDefined();
    act(() => {
      result.current.reset();
    });
    expect(result.current.error).toBeUndefined();
    await act(async () => {
      await result.current.run(payment);
    });

    const [failed, afterReset] = spy.keys();
    expect(afterReset).not.toBe(failed);
  });

  it('never reuses a key for data that cannot be compared as JSON', async () => {
    const calls: string[] = [];
    const submit = (_args: { amount: bigint }, context: SubmitContext) => {
      calls.push(context.idempotencyKey);
      return Promise.reject(new Error('down'));
    };
    const { result } = renderHook(() => useSubmission(submit));

    await act(async () => {
      await result.current.run({ amount: 1n });
    });
    await act(async () => {
      await result.current.run({ amount: 1n });
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toBe(calls[0]);
  });

  it('aborts the in-flight request through the submit signal when the component unmounts', async () => {
    let seen: AbortSignal | undefined;
    const submit = (_args: Payment, context: SubmitContext) => {
      seen = context.signal;
      return new Promise<string>((_resolve, reject) => {
        context.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    };
    const { result, unmount } = renderHook(() => useSubmission(submit));

    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = result.current.run(payment);
    });
    expect(seen?.aborted).toBe(false);
    unmount();

    expect(seen?.aborted).toBe(true);
    await expect(outcome).resolves.toMatchObject({ ok: false });
  });
});

describe('newIdempotencyKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an RFC 4122 version 4 UUID, different every call', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key).toMatch(uuidV4);
    }
  });

  it('builds a v4 UUID from crypto.getRandomValues when randomUUID is unavailable (plain-HTTP LAN, Pitfall 15)', () => {
    const real = globalThis.crypto;
    const getRandomValues = vi.fn(<T extends ArrayBufferView>(array: T): T => real.getRandomValues(array));
    vi.stubGlobal('crypto', { getRandomValues });
    const random = vi.spyOn(Math, 'random');

    const first = newIdempotencyKey();
    const second = newIdempotencyKey();

    expect(first).toMatch(uuidV4);
    expect(second).toMatch(uuidV4);
    expect(second).not.toBe(first);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
    expect(random).not.toHaveBeenCalled();
  });

  it.each([
    [0xff, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
    [0x00, '00000000-0000-4000-8000-000000000000'],
  ])('sets the version and variant bits when every random byte is %i', (fill, expected) => {
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(fill);
        return array;
      },
    });

    expect(newIdempotencyKey()).toBe(expected);
  });

  it('never calls Math.random on the randomUUID path either', () => {
    const random = vi.spyOn(Math, 'random');
    newIdempotencyKey();
    expect(random).not.toHaveBeenCalled();
  });
});
