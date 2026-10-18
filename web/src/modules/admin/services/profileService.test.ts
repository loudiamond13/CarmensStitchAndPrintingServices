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

describe('profileService.checkEmailChange', () => {
  it('calls POST /api/v1/profile/email-change/check with the token in the JSON body and resolves the new email', async () => {
    const fake = createFakeFetch([{ body: { newEmail: 'new@example.ph' } }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.checkEmailChange('tok-123')).resolves.toEqual({ newEmail: 'new@example.ph' });

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/profile/email-change/check');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ token: 'tok-123' });
    expect(fake.calls[0]?.url).not.toContain('tok-123');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const fake = createFakeFetch([{ hang: true }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));
    const controller = new AbortController();

    const pending = service.checkEmailChange('tok-123', controller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(1);
    });
    controller.abort();

    expect(await pending).toMatchObject({ kind: 'aborted' });
  });

  it('rejects with the machine code of a 409 email-change.taken', async () => {
    const fake = createFakeFetch([
      { status: 409, headers: PROBLEM, body: { title: 'Conflict', status: 409, code: 'email-change.taken' } },
    ]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.checkEmailChange('tok-123')).rejects.toMatchObject({
      status: 409,
      code: 'email-change.taken',
    });
  });
});

describe('profileService.confirmEmailChange', () => {
  it('calls POST /api/v1/profile/email-change/confirm with the token in the body and the Idempotency-Key it was given', async () => {
    const fake = createFakeFetch([{ body: { newEmail: 'new@example.ph' } }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.confirmEmailChange('tok-123', 'key-abc')).resolves.toEqual({ newEmail: 'new@example.ph' });

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/profile/email-change/confirm');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ token: 'tok-123' });
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-abc');
  });

  it('rejects with the status of a 404 for a link that does not work', async () => {
    const fake = createFakeFetch([
      { status: 404, headers: PROBLEM, body: { title: 'This link has expired', status: 404 } },
    ]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.confirmEmailChange('tok-123', 'key-abc')).rejects.toMatchObject({ status: 404 });
  });
});

describe('profileService.requestEmailChange', () => {
  const body = { newEmail: 'new@example.ph', currentPassword: 'Mabuhay#Tahi2026' };

  it('calls POST /api/v1/profile/email-change with the new email, the password and the Idempotency-Key it was given, and resolves the profile', async () => {
    const pending = { ...profile, pendingEmail: 'new@example.ph' };
    const fake = createFakeFetch([{ body: pending }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.requestEmailChange(body, 'key-abc')).resolves.toEqual(pending);

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/profile/email-change');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-abc');
  });

  it('keeps the password out of the address', async () => {
    const fake = createFakeFetch([{ body: profile }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await service.requestEmailChange(body, 'key-abc');

    expect(fake.calls[0]?.url).not.toContain('Mabuhay');
  });

  it('rejects with the field errors of a 400, keyed as the server wrote them', async () => {
    const fake = createFakeFetch([
      {
        status: 400,
        headers: PROBLEM,
        body: {
          title: 'Bad Request',
          status: 400,
          errors: { currentPassword: ['Your current password is incorrect.'] },
        },
      },
    ]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.requestEmailChange(body, 'key-abc')).rejects.toMatchObject({
      status: 400,
      fieldErrors: { currentPassword: ['Your current password is incorrect.'] },
    });
  });

  it('rejects with the machine code of a 429 profile.password-locked', async () => {
    const fake = createFakeFetch([
      {
        status: 429,
        headers: PROBLEM,
        body: { title: 'Too Many Requests', status: 429, code: 'profile.password-locked' },
      },
    ]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.requestEmailChange(body, 'key-abc')).rejects.toMatchObject({
      status: 429,
      code: 'profile.password-locked',
    });
  });
});

describe('profileService.resendEmailChange', () => {
  it('calls POST /api/v1/profile/email-change/resend with the Idempotency-Key it was given and no body, and resolves with nothing', async () => {
    const fake = createFakeFetch([{ status: 204 }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.resendEmailChange('key-abc')).resolves.toBeUndefined();

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/profile/email-change/resend');
    expect(fake.calls[0]?.body).toBeUndefined();
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-abc');
  });

  it('rejects with the code of a 404 email-change.none', async () => {
    const fake = createFakeFetch([
      { status: 404, headers: PROBLEM, body: { title: 'Not Found', status: 404, code: 'email-change.none' } },
    ]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.resendEmailChange('key-abc')).rejects.toMatchObject({
      status: 404,
      code: 'email-change.none',
    });
  });
});

describe('profileService.cancelEmailChange', () => {
  it('calls DELETE /api/v1/profile/email-change with no body and no Idempotency-Key (it repeats safely)', async () => {
    const fake = createFakeFetch([{ status: 204 }]);
    const service = createProfileService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.cancelEmailChange()).resolves.toBeUndefined();

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe('/api/v1/profile/email-change');
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });
});

describe('profileService (the exported instance)', () => {
  it('exposes get, updateName and the email-change calls over the shared client', () => {
    expect(typeof profileService.get).toBe('function');
    expect(typeof profileService.updateName).toBe('function');
    expect(typeof profileService.checkEmailChange).toBe('function');
    expect(typeof profileService.confirmEmailChange).toBe('function');
    expect(typeof profileService.requestEmailChange).toBe('function');
    expect(typeof profileService.resendEmailChange).toBe('function');
    expect(typeof profileService.cancelEmailChange).toBe('function');
  });
});
