import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { createProfileService, profileService, type ProfileResponse } from './profileService';

// My Profile calls (PROF-01, SEC-07): typed, over the one HTTP client.

const profile: ProfileResponse = {
  id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  firstName: 'Carmen',
  lastName: 'Reyes',
  email: 'carmen@example.ph',
  role: 'Manager',
  pendingEmail: null,
  memberSince: '2026-10-17T01:00:00Z',
  version: '0b0e1c2a-3d4f-4a5b-8c6d-7e8f90a1b2c3',
};

const PROBLEM = { 'Content-Type': 'application/problem+json' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('profileService.get', () => {
  it('calls GET /api/v1/profile once and resolves the typed profile', async () => {
    const fake = createFakeFetch([{ body: profile }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.get()).resolves.toEqual(profile);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/profile');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const fake = createFakeFetch([{ hang: true }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));
    const controller = new AbortController();

    const pending = service.get(controller.signal).then(
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

describe('profileService.updateName', () => {
  it('calls PUT /api/v1/profile with the names and the version, and resolves the saved profile', async () => {
    const saved = { ...profile, firstName: 'Ana', version: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' };
    const fake = createFakeFetch([{ body: saved }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    const body = { firstName: 'Ana', lastName: 'Reyes', version: profile.version };
    await expect(service.updateName(body)).resolves.toEqual(saved);

    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe('/api/v1/profile');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });

  it('sends no Idempotency-Key: a PUT repeats safely', async () => {
    const fake = createFakeFetch([{ body: profile }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await service.updateName({ firstName: 'Carmen', lastName: 'Reyes', version: profile.version });

    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('rejects with an HttpError carrying the status and the machine code on a 409 edit.stale', async () => {
    const fake = createFakeFetch([
      {
        status: 409,
        headers: PROBLEM,
        body: { title: 'Conflict', status: 409, code: 'edit.stale', detail: 'This was changed by someone else.' },
      },
    ]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(
      service.updateName({ firstName: 'Ana', lastName: 'Reyes', version: profile.version }),
    ).rejects.toMatchObject({ kind: 'http', status: 409, code: 'edit.stale' });
  });

  it('rejects with the field errors of a 400', async () => {
    const fake = createFakeFetch([
      {
        status: 400,
        headers: PROBLEM,
        body: { title: 'Bad', status: 400, errors: { FirstName: ['Enter a first name.'] } },
      },
    ]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(
      service.updateName({ firstName: '', lastName: 'Reyes', version: profile.version }),
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: { FirstName: ['Enter a first name.'] },
    });
  });
});

describe('profileService (the exported instance)', () => {
  it('exposes get and updateName over the shared client', () => {
    expect(typeof profileService.get).toBe('function');
    expect(typeof profileService.updateName).toBe('function');
  });
});
