// Timeout and abort, capped retries, the single-flight 401 refresh and Idempotency-Key reuse (WEB-03, WEB-09).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeferred, createFakeFetch, type Plan } from '../../test/fakeFetch';
import { isHttpError, type HttpError } from './HttpError';
import { createHttpClient, type HttpMethod, type Sleep } from './httpClient';

const ok: Plan = { status: 200, body: { ok: true } };
const networkError: Plan = { networkError: true };
const unavailable: Plan = { status: 503, body: { title: 'Service unavailable', status: 503 } };
const unauthorized: Plan = { status: 401, body: { title: 'Sign in again', status: 401 } };
const hang: Plan = { hang: true };

/** Retries without waiting: the injected sleep resolves at once and records each delay. */
function instantRetry(): { readonly delays: number[]; readonly sleep: Sleep } {
  const delays: number[] = [];
  return {
    delays,
    sleep: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
  };
}

async function rejection(promise: Promise<unknown>): Promise<HttpError> {
  const outcome = await promise.then(
    () => 'resolved',
    (error: unknown) => error,
  );
  if (!isHttpError(outcome)) {
    expect.fail(`expected the request to reject with an HttpError, got ${String(outcome)}`);
  }
  return outcome;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('timeout and abort', () => {
  it("cancelling the caller's signal rejects with kind aborted and status 0, and is not retried", async () => {
    const fake = createFakeFetch([hang, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });
    const controller = new AbortController();

    const pending = rejection(client.get('/orders', { signal: controller.signal }));
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(1);
    });
    controller.abort();
    const error = await pending;

    expect(error.kind).toBe('aborted');
    expect(error.status).toBe(0);
    expect(fake.calls).toHaveLength(1);
  });

  it('a signal that is already aborted rejects with kind aborted', async () => {
    const fake = createFakeFetch([ok]);
    const client = createHttpClient({ fetch: fake.fetch });

    const error = await rejection(client.get('/orders', { signal: AbortSignal.abort() }));

    expect(error.kind).toBe('aborted');
  });

  it('the client timeout rejects with kind timeout and is not retried', async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch([hang, ok]);
    const client = createHttpClient({ fetch: fake.fetch, timeoutMs: 1000, sleep: instantRetry().sleep });

    const pending = rejection(client.get('/orders'));
    await vi.advanceTimersByTimeAsync(999);
    expect(fake.calls[0]?.init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await pending;

    expect(error.kind).toBe('timeout');
    expect(error.status).toBe(0);
    expect(fake.calls).toHaveLength(1);
  });

  it('a request timeoutMs overrides the client timeout', async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch([hang]);
    const client = createHttpClient({ fetch: fake.fetch, timeoutMs: 60_000 });

    const pending = rejection(client.get('/orders', { timeoutMs: 50 }));
    await vi.advanceTimersByTimeAsync(50);

    expect((await pending).kind).toBe('timeout');
  });

  it('the default timeout is 30 seconds', async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch([hang]);
    const client = createHttpClient({ fetch: fake.fetch });

    const pending = rejection(client.get('/orders'));
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fake.calls[0]?.init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect((await pending).kind).toBe('timeout');
  });

  it('clears its timer once the request settles', async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch([ok, { status: 404 }]);
    const client = createHttpClient({ fetch: fake.fetch });

    await client.get('/a');
    await rejection(client.get('/b'));

    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes fetch a signal that follows the caller signal', async () => {
    const fake = createFakeFetch([hang]);
    const client = createHttpClient({ fetch: fake.fetch });
    const controller = new AbortController();

    const pending = rejection(client.get('/orders', { signal: controller.signal }));
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(1);
    });
    const sent = fake.calls[0]?.init.signal;
    expect(sent?.aborted).toBe(false);
    controller.abort();
    await pending;

    expect(sent?.aborted).toBe(true);
  });
});

describe('capped retries', () => {
  it('retries a GET after a network error and resolves on the second call', async () => {
    const fake = createFakeFetch([networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    await expect(client.get('/orders')).resolves.toEqual({ ok: true });
    expect(fake.calls).toHaveLength(2);
  });

  it('gives up after 1 call + 2 retries with kind network', async () => {
    const fake = createFakeFetch([networkError, networkError, networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    const error = await rejection(client.get('/orders'));

    expect(error.kind).toBe('network');
    expect(error.status).toBe(0);
    expect(fake.calls).toHaveLength(3);
  });

  it('clamps a larger retry max to 2', async () => {
    const fake = createFakeFetch([networkError, networkError, networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep, retry: { max: 5 } });

    await rejection(client.get('/orders'));

    expect(fake.calls).toHaveLength(3);
  });

  it('retry max 0 turns retries off', async () => {
    const fake = createFakeFetch([networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep, retry: { max: 0 } });

    await rejection(client.get('/orders'));

    expect(fake.calls).toHaveLength(1);
  });

  it('waits with capped exponential backoff from the injected sleep', async () => {
    const retry = instantRetry();
    const fake = createFakeFetch([networkError, unavailable, networkError]);
    const client = createHttpClient({
      fetch: fake.fetch,
      sleep: retry.sleep,
      retry: { baseDelayMs: 100, maxDelayMs: 150 },
    });

    await rejection(client.get('/orders'));

    expect(retry.delays).toEqual([100, 150]);
  });

  it('uses 250 ms then 500 ms by default, with the built-in sleep', async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch([networkError, networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch });

    const pending = client.get('/orders');
    await vi.advanceTimersByTimeAsync(249);
    expect(fake.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(499);
    expect(fake.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toEqual({ ok: true });
    expect(fake.calls).toHaveLength(3);
  });

  it('the built-in sleep waits out the backoff with a live caller signal', async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch([networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch });
    const controller = new AbortController();

    const pending = client.get('/orders', { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(250);

    await expect(pending).resolves.toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancelling during the backoff rejects with kind aborted and sends nothing more', async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch([networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch });
    const controller = new AbortController();

    const pending = rejection(client.get('/orders', { signal: controller.signal }));
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    const error = await pending;

    expect(error.kind).toBe('aborted');
    expect(fake.calls).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an injected sleep that rejects ends the request with kind aborted', async () => {
    const fake = createFakeFetch([networkError, ok]);
    const client = createHttpClient({
      fetch: fake.fetch,
      sleep: () => Promise.reject(new DOMException('Aborted', 'AbortError')),
    });

    const error = await rejection(client.get('/orders'));

    expect(error.kind).toBe('aborted');
    expect(fake.calls).toHaveLength(1);
  });

  it.each<HttpMethod>(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])('retries %s after a 503', async (method) => {
    const fake = createFakeFetch([unavailable, { status: 204 }]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    await client.request({ method, url: '/orders/1' });

    expect(fake.calls).toHaveLength(2);
  });

  it('never retries a PATCH', async () => {
    const fake = createFakeFetch([networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    await rejection(client.patch('/orders/1', { status: 'ready' }, { idempotencyKey: 'k-1' }));

    expect(fake.calls).toHaveLength(1);
  });

  it('never retries a 500', async () => {
    const fake = createFakeFetch([{ status: 500, body: { title: 'Something went wrong', status: 500 } }, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    const error = await rejection(client.get('/orders'));

    expect(error.status).toBe(500);
    expect(fake.calls).toHaveLength(1);
  });
});

describe('Idempotency-Key (WEB-09)', () => {
  it('retries a POST with an idempotencyKey after a 503 and sends the same key both times', async () => {
    const fake = createFakeFetch([unavailable, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    await expect(client.post('/orders', { name: 'Jersey' }, { idempotencyKey: 'k-1' })).resolves.toEqual({
      ok: true,
    });

    expect(fake.calls.map((c) => c.headers.get('Idempotency-Key'))).toEqual(['k-1', 'k-1']);
  });

  it('retries a keyed POST after a network error with the same key', async () => {
    const fake = createFakeFetch([networkError, networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    await client.post('/orders', { name: 'Jersey' }, { idempotencyKey: 'k-2' });

    expect(fake.calls.map((c) => c.headers.get('Idempotency-Key'))).toEqual(['k-2', 'k-2', 'k-2']);
  });

  it('never retries a keyed FormData POST after a 503: its multipart body cannot be resent byte for byte (LIB-CR-02)', async () => {
    const fake = createFakeFetch([unavailable, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    const error = await rejection(client.post('/orders/1/images', new FormData(), { idempotencyKey: 'k-img' }));

    expect(error.status).toBe(503);
    expect(fake.calls).toHaveLength(1);
  });

  it('still retries an unkeyed FormData PUT after a network error', async () => {
    const fake = createFakeFetch([networkError, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    await client.put('/site/logo', new FormData());

    expect(fake.calls).toHaveLength(2);
  });

  it('never retries a POST without a key, and sends no key header', async () => {
    const fake = createFakeFetch([unavailable, ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });

    const error = await rejection(client.post('/orders', { name: 'Jersey' }));

    expect(error.status).toBe(503);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a GET never carries an Idempotency-Key header, even when one is passed', async () => {
    const fake = createFakeFetch([ok, ok]);
    const client = createHttpClient({ fetch: fake.fetch });

    await client.get('/orders');
    await client.get('/orders', { idempotencyKey: 'k-3' });

    expect(fake.calls.map((c) => c.headers.has('Idempotency-Key'))).toEqual([false, false]);
  });

  it.each<HttpMethod>(['HEAD', 'OPTIONS'])('a %s never carries an Idempotency-Key header', async (method) => {
    const fake = createFakeFetch([{ status: 204 }]);
    const client = createHttpClient({ fetch: fake.fetch });

    await client.request({ method, url: '/orders', idempotencyKey: 'k-5' });

    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it.each<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])('a %s sends the caller key unchanged', async (method) => {
    const fake = createFakeFetch([{ status: 204 }]);
    const client = createHttpClient({ fetch: fake.fetch });

    await client.request({ method, url: '/orders/1', idempotencyKey: 'k-6' });

    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('k-6');
  });

  it('a 401 refresh replays a keyed POST with the same key it sent first', async () => {
    const refresh = vi.fn(() => Promise.resolve());
    const fake = createFakeFetch([unauthorized, unavailable, ok]);
    const client = createHttpClient({ fetch: fake.fetch, refresh, sleep: instantRetry().sleep });

    await client.post('/payments', { amount: '1250.50' }, { idempotencyKey: 'k-pay' });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fake.calls.map((c) => [c.method, c.headers.get('Idempotency-Key')])).toEqual([
      ['POST', 'k-pay'],
      ['POST', 'k-pay'],
      ['POST', 'k-pay'],
    ]);
  });

  it('sending the same POST twice makes two requests (no client-side dedupe)', async () => {
    const fake = createFakeFetch([ok, ok]);
    const client = createHttpClient({ fetch: fake.fetch });

    await Promise.all([
      client.post('/orders', { name: 'Jersey' }, { idempotencyKey: 'k-4' }),
      client.post('/orders', { name: 'Jersey' }, { idempotencyKey: 'k-4' }),
    ]);

    expect(fake.calls).toHaveLength(2);
  });
});

describe('secrets never go in a URL (PRD 8.2, 9.3)', () => {
  it.each(['token', 'access_token', 'refresh_token', 'password', 'secret', 'otp', 'code', 'Password', 'CODE'])(
    'rejects a %s param with a TypeError before fetch is called',
    async (name) => {
      const fake = createFakeFetch([ok]);
      const client = createHttpClient({ fetch: fake.fetch });

      await expect(client.get('/orders', { params: { [name]: 'x' } })).rejects.toThrow(
        new TypeError(`The "${name}" parameter is not allowed: secrets never go in a URL. Send them in a header.`),
      );
      expect(fake.calls).toHaveLength(0);
    },
  );

  it('also rejects a secret param added by an interceptor, and does not retry', async () => {
    const fake = createFakeFetch([ok]);
    const client = createHttpClient({ fetch: fake.fetch, sleep: instantRetry().sleep });
    client.interceptors.request.use((request) => ({ ...request, params: { ...request.params, otp: '123456' } }));

    await expect(client.get('/orders')).rejects.toBeInstanceOf(TypeError);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('single-flight 401 refresh', () => {
  it('three concurrent 401s cause one refresh, then each request retries once with the new token and the same key', async () => {
    let token = 'old';
    const gate = createDeferred<undefined>();
    const refresh = vi.fn(async () => {
      await gate.promise;
      token = 'new';
    });
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([
      unauthorized,
      unauthorized,
      unauthorized,
      { body: { n: 1 } },
      { body: { n: 2 } },
      { body: { n: 3 } },
    ]);
    const client = createHttpClient({ fetch: fake.fetch, refresh, onUnauthorized });
    client.interceptors.request.use((request) => {
      request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    });

    const all = Promise.all([
      client.get('/a'),
      client.get('/b'),
      client.post('/c', { name: 'Jersey' }, { idempotencyKey: 'k-9' }),
    ]);
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(3);
    });
    await Promise.resolve();
    gate.resolve(undefined);
    const results = await all;

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(results).toHaveLength(3);
    expect(fake.calls).toHaveLength(6);
    expect(fake.calls.map((c) => c.headers.get('Authorization'))).toEqual([
      'Bearer old',
      'Bearer old',
      'Bearer old',
      'Bearer new',
      'Bearer new',
      'Bearer new',
    ]);
    const posts = fake.calls.filter((c) => c.method === 'POST');
    expect(posts.map((c) => [c.url, c.headers.get('Idempotency-Key'), c.body])).toEqual([
      ['/c', 'k-9', '{"name":"Jersey"}'],
      ['/c', 'k-9', '{"name":"Jersey"}'],
    ]);
  });

  it('when the refresh fails, every waiting request rejects with status 401 and onUnauthorized runs once', async () => {
    const gate = createDeferred<undefined>();
    const refresh = vi.fn(() => gate.promise);
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized, unauthorized, unauthorized]);
    const client = createHttpClient({ fetch: fake.fetch, refresh, onUnauthorized });

    const outcomes = Promise.all([
      rejection(client.get('/a')),
      rejection(client.get('/b')),
      rejection(client.get('/c')),
    ]);
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(3);
    });
    gate.reject(new Error('refresh token expired'));
    const errors = await outcomes;

    expect(errors.map((e) => [e.kind, e.status])).toEqual([
      ['http', 401],
      ['http', 401],
      ['http', 401],
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fake.calls).toHaveLength(3);
  });

  it('a refresh that throws synchronously counts as a failed refresh', async () => {
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized]);
    const client = createHttpClient({
      fetch: fake.fetch,
      refresh: () => {
        throw new Error('no refresh token');
      },
      onUnauthorized,
    });

    const error = await rejection(client.get('/a'));

    expect(error.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('a second 401 after a successful refresh calls onUnauthorized and does not refresh again', async () => {
    const refresh = vi.fn(() => Promise.resolve());
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized, unauthorized]);
    const client = createHttpClient({ fetch: fake.fetch, refresh, onUnauthorized });

    const error = await rejection(client.get('/a'));

    expect(error.status).toBe(401);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fake.calls).toHaveLength(2);
  });

  it('concurrent second 401s in one refresh cycle call onUnauthorized once', async () => {
    const gate = createDeferred<undefined>();
    const refresh = vi.fn(() => gate.promise);
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized, unauthorized, unauthorized, unauthorized]);
    const client = createHttpClient({ fetch: fake.fetch, refresh, onUnauthorized });

    const outcomes = Promise.all([rejection(client.get('/a')), rejection(client.get('/b'))]);
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(2);
    });
    gate.resolve(undefined);
    await outcomes;

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fake.calls).toHaveLength(4);
  });

  it('a non-401 failure on the refresh retry rejects with that error and does not sign out', async () => {
    const refresh = vi.fn(() => Promise.resolve());
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized, { status: 500, body: { title: 'Something went wrong', status: 500 } }]);
    const client = createHttpClient({ fetch: fake.fetch, refresh, onUnauthorized });

    const error = await rejection(client.get('/a'));

    expect(error.status).toBe(500);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('a 401 after the refresh cycle has finished starts a new refresh', async () => {
    const refresh = vi.fn(() => Promise.resolve());
    const fake = createFakeFetch([unauthorized, ok, unauthorized, ok]);
    const client = createHttpClient({ fetch: fake.fetch, refresh });

    await client.get('/a');
    await client.get('/b');

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(fake.calls).toHaveLength(4);
  });

  it('without a refresh function a 401 calls onUnauthorized and rejects', async () => {
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized, ok]);
    const client = createHttpClient({ fetch: fake.fetch, onUnauthorized });

    const error = await rejection(client.get('/a'));

    expect(error.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fake.calls).toHaveLength(1);
  });

  it('a 401 with neither refresh nor onUnauthorized simply rejects', async () => {
    const fake = createFakeFetch([unauthorized]);
    const client = createHttpClient({ fetch: fake.fetch });

    expect((await rejection(client.get('/a'))).status).toBe(401);
  });

  it('a failed refresh with no onUnauthorized still rejects with the 401', async () => {
    const fake = createFakeFetch([unauthorized]);
    const client = createHttpClient({ fetch: fake.fetch, refresh: () => Promise.reject(new Error('expired')) });

    expect((await rejection(client.get('/a'))).status).toBe(401);
  });

  it('a 403 never triggers a refresh', async () => {
    const refresh = vi.fn(() => Promise.resolve());
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([{ status: 403, body: { title: 'Forbidden', status: 403 } }]);
    const client = createHttpClient({ fetch: fake.fetch, refresh, onUnauthorized });

    expect((await rejection(client.get('/a'))).status).toBe(403);
    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
