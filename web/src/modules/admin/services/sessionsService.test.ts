import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { createSessionsService, sessionsService, type SessionListItem } from './sessionsService';

// The signed-in devices calls (D-43): typed, over the one HTTP client.

const devices: SessionListItem[] = [
  {
    id: '3f1d6b0e-0a52-4b0e-9a55-6a3f7d8c1b11',
    device: 'Chrome on Windows',
    signedInAt: '2026-10-12T07:42:00Z',
    lastActiveAt: '2026-10-12T09:59:30Z',
    persistent: true,
    current: true,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sessionsService.list', () => {
  it('calls GET /api/v1/sessions once and resolves the typed list', async () => {
    const fake = createFakeFetch([{ body: devices }]);
    const service = createSessionsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.list()).resolves.toEqual(devices);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/sessions');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const fake = createFakeFetch([{ hang: true }]);
    const service = createSessionsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));
    const controller = new AbortController();

    const pending = service.list(controller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(1);
    });
    controller.abort();

    expect(await pending).toMatchObject({ kind: 'aborted' });
  });
});

describe('sessionsService.revoke', () => {
  it('calls DELETE /api/v1/sessions/{id} and resolves the answer', async () => {
    const fake = createFakeFetch([{ body: { alreadySignedOut: false } }]);
    const service = createSessionsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.revoke('3f1d6b0e-0a52-4b0e-9a55-6a3f7d8c1b11')).resolves.toEqual({ alreadySignedOut: false });

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe('/api/v1/sessions/3f1d6b0e-0a52-4b0e-9a55-6a3f7d8c1b11');
  });

  it('encodes the id as one path segment', async () => {
    const fake = createFakeFetch([{ body: { alreadySignedOut: true } }]);
    const service = createSessionsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await service.revoke('a/b?c#d');

    expect(fake.calls[0]?.url).toBe('/api/v1/sessions/a%2Fb%3Fc%23d');
  });

  it('the shared service calls the same-origin /api/v1 base through the global fetch', async () => {
    const fake = createFakeFetch([{ body: devices }, { body: { alreadySignedOut: false } }]);
    vi.stubGlobal('fetch', fake.fetch);

    await sessionsService.list();
    await sessionsService.revoke('abc');

    expect(fake.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'GET /api/v1/sessions',
      'DELETE /api/v1/sessions/abc',
    ]);
  });
});
