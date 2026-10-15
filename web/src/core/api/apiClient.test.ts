// The shared client's session hooks (AUTH-05, plan 04-25): the Bearer header, the anti-CSRF header, the single-flight
// refresh on a 401 and the sign-out on an unrecoverable one.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeferred, createFakeFetch, type Plan } from '@/test/fakeFetch';

const unauthorized: Plan = {
  status: 401,
  headers: { 'Content-Type': 'application/problem+json' },
  body: { title: 'Sign in again', status: 401 },
};
const ok: Plan = { body: { ok: true } };

/** A fresh copy of the module, so each test starts before any configureSession call. */
async function freshClient() {
  vi.resetModules();
  return import('./apiClient');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClient session hooks (AUTH-05)', () => {
  it('sends the Bearer header from the configured token and X-CSPS-CSRF on every request', async () => {
    const { apiClient, configureSession } = await freshClient();
    const fake = createFakeFetch([ok]);
    vi.stubGlobal('fetch', fake.fetch);
    configureSession({ accessToken: () => 'T', refresh: () => Promise.resolve(), onUnauthorized: vi.fn() });

    await apiClient.get('/ping');

    expect(fake.calls[0]?.headers.get('Authorization')).toBe('Bearer T');
    expect(fake.calls[0]?.headers.get('X-CSPS-CSRF')).toBe('1');
  });

  it('sends no Authorization header without a token, but still sends X-CSPS-CSRF', async () => {
    const { apiClient, configureSession } = await freshClient();
    const fake = createFakeFetch([ok]);
    vi.stubGlobal('fetch', fake.fetch);
    configureSession({ accessToken: () => null, refresh: () => Promise.resolve(), onUnauthorized: vi.fn() });

    await apiClient.get('/ping');

    expect(fake.calls[0]?.headers.has('Authorization')).toBe(false);
    expect(fake.calls[0]?.headers.get('X-CSPS-CSRF')).toBe('1');
  });

  it('sends X-CSPS-CSRF before any session is configured', async () => {
    const { apiClient } = await freshClient();
    const fake = createFakeFetch([ok]);
    vi.stubGlobal('fetch', fake.fetch);

    await apiClient.get('/ping');

    expect(fake.calls[0]?.headers.has('Authorization')).toBe(false);
    expect(fake.calls[0]?.headers.get('X-CSPS-CSRF')).toBe('1');
  });

  it('three concurrent 401s run the configured refresh once and replay with the new token', async () => {
    const { apiClient, configureSession } = await freshClient();
    let token = 'old';
    const gate = createDeferred<undefined>();
    const refresh = vi.fn(async () => {
      await gate.promise;
      token = 'new';
    });
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized, unauthorized, unauthorized, ok, ok, ok]);
    vi.stubGlobal('fetch', fake.fetch);
    configureSession({ accessToken: () => token, refresh, onUnauthorized });

    const results = Promise.all([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    gate.resolve(undefined);
    await results;

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fake.calls.slice(0, 3).map((call) => call.headers.get('Authorization'))).toEqual(
      Array(3).fill('Bearer old'),
    );
    expect(fake.calls.slice(3).map((call) => call.headers.get('Authorization'))).toEqual(Array(3).fill('Bearer new'));
  });

  it('a failed refresh calls onUnauthorized once and rejects with the 401', async () => {
    const { apiClient, configureSession } = await freshClient();
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized]);
    vi.stubGlobal('fetch', fake.fetch);
    configureSession({
      accessToken: () => 'T',
      refresh: () => Promise.reject(new Error('over')),
      onUnauthorized,
    });

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('configuring again replaces the hooks', async () => {
    const { apiClient, configureSession } = await freshClient();
    const fake = createFakeFetch([ok, ok]);
    vi.stubGlobal('fetch', fake.fetch);
    configureSession({ accessToken: () => 'first', refresh: () => Promise.resolve(), onUnauthorized: vi.fn() });
    configureSession({ accessToken: () => 'second', refresh: () => Promise.resolve(), onUnauthorized: vi.fn() });

    await apiClient.get('/ping');

    expect(fake.calls[0]?.headers.get('Authorization')).toBe('Bearer second');
  });

  it('before configuration a 401 rejects untouched', async () => {
    const { apiClient } = await freshClient();
    const fake = createFakeFetch([unauthorized]);
    vi.stubGlobal('fetch', fake.fetch);

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ status: 401 });

    expect(fake.calls).toHaveLength(1);
  });
});
