import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import {
  createUsersService,
  usersService,
  type UserDetailResponse,
  type UserListItem,
  type UserListResponse,
} from './usersService';

// The staff roster calls (USER-01, USER-08): typed, over the one HTTP client.

const carmen: UserListItem = {
  id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  firstName: 'Carmen',
  lastName: 'Reyes',
  email: 'carmen@example.ph',
  role: 'Manager',
  status: 'active',
  inviteState: 'none',
  createdAt: '2026-10-17T01:00:00Z',
};

const list: UserListResponse = { items: [carmen], page: 1, pageSize: 20, total: 1 };

const detail: UserDetailResponse = {
  ...carmen,
  hasPassword: true,
  managerLocked: false,
  pendingEmail: null,
  updatedAt: null,
  version: '0b0e1c2a-3d4f-4a5b-8c6d-7e8f90a1b2c3',
  recordedBy: null,
  lastChangedBy: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createUsersService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('usersService.list', () => {
  it('calls GET /api/v1/users with q, role, status, page and pageSize and resolves the typed page', async () => {
    const { fake, service } = serviceWith([{ body: list }]);

    await expect(
      service.list({ q: 'carmen', role: 'manager', status: 'locked', page: 2, pageSize: 50 }),
    ).resolves.toEqual(list);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/users');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'carmen',
      role: 'manager',
      status: 'locked',
      page: '2',
      pageSize: '50',
    });
  });

  it('leaves out a search and filters that are not set', async () => {
    const { fake, service } = serviceWith([{ body: list }]);

    await service.list({ q: null, role: null, status: null, page: 1, pageSize: 20 });

    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', pageSize: '20' });
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.list({ q: null, role: null, status: null, page: 1, pageSize: 20 }, controller.signal).then(
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

describe('usersService.get', () => {
  it('calls GET /api/v1/users/{id} and resolves the typed detail', async () => {
    const { fake, service } = serviceWith([{ body: detail }]);

    await expect(service.get(detail.id)).resolves.toEqual(detail);

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(`/api/v1/users/${detail.id}`);
  });

  it('encodes the id so it can never add a path segment or a query', async () => {
    const { fake, service } = serviceWith([{ body: detail }]);

    await service.get('a/b?c=d');

    expect(fake.calls[0]?.url).toBe('/api/v1/users/a%2Fb%3Fc%3Dd');
  });
});

describe('usersService.create', () => {
  const body = {
    firstName: 'Ana',
    lastName: 'Reyes',
    email: 'ana@example.ph',
    role: 'Admin',
    access: 'invitation',
  } as const;

  it('calls POST /api/v1/users with the body and the Idempotency-Key and resolves the new id', async () => {
    const { fake, service } = serviceWith([{ status: 201, body: { id: detail.id } }]);

    await expect(service.create(body, 'key-1')).resolves.toEqual({ id: detail.id });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/users');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });

  it('sends the temporary password on its own route', async () => {
    const { fake, service } = serviceWith([{ status: 201, body: { id: detail.id } }]);

    await service.create({ ...body, access: 'temporary-password', temporaryPassword: 'Tela-Sukat-7381' }, 'key-2');

    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({
      ...body,
      access: 'temporary-password',
      temporaryPassword: 'Tela-Sukat-7381',
    });
  });

  it('rejects with the field errors of a 400', async () => {
    const { service } = serviceWith([
      {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'x', status: 400, errors: { email: ['Another account already uses this email.'] } },
      },
    ]);

    await expect(service.create(body, 'key-3')).rejects.toMatchObject({
      status: 400,
      fieldErrors: { email: ['Another account already uses this email.'] },
    });
  });
});

describe('usersService.update', () => {
  const body = {
    firstName: 'Paolo',
    lastName: 'Garcia',
    email: 'paolo@example.ph',
    role: 'Manager',
    version: detail.version,
  };

  it('calls PUT /api/v1/users/{id} with the body, sends no Idempotency-Key and resolves the saved person', async () => {
    const saved = { ...detail, firstName: 'Paolo', role: 'Manager', version: '9d8c7b6a-1111-4222-8333-444455556666' };
    const { fake, service } = serviceWith([{ body: saved }]);

    await expect(service.update(detail.id, body)).resolves.toEqual(saved);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/users/${detail.id}`);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBeNull();
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });

  it('carries the email-change choice (D-45) when the body has one', async () => {
    const { fake, service } = serviceWith([{ body: detail }]);

    await service.update(detail.id, { ...body, emailChange: 'now' });

    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ ...body, emailChange: 'now' });
  });

  it('encodes the id so it can never add a path segment or a query', async () => {
    const { fake, service } = serviceWith([{ body: detail }]);

    await service.update('a/b?c=d', body);

    expect(fake.calls[0]?.url).toBe('/api/v1/users/a%2Fb%3Fc%3Dd');
  });

  it.each([
    [409, 'edit.stale'],
    [422, 'users.last-active-manager'],
    [404, 'users.not-found'],
  ])('rejects with the status and machine code of a %i', async (status, code) => {
    const { service } = serviceWith([
      { status, headers: { 'Content-Type': 'application/problem+json' }, body: { title: 'x', status, code } },
    ]);

    await expect(service.update(detail.id, body)).rejects.toMatchObject({ kind: 'http', status, code });
  });
});

describe('usersService.deactivate and activate', () => {
  it.each(['deactivate', 'activate'] as const)(
    'calls POST /api/v1/users/{id}/%s with the Idempotency-Key and no body, and resolves on a 204',
    async (action) => {
      const { fake, service } = serviceWith([{ status: 204 }]);

      await expect(service[action](detail.id, 'key-1')).resolves.toBeUndefined();

      expect(fake.calls).toHaveLength(1);
      expect(fake.calls[0]?.method).toBe('POST');
      expect(fake.calls[0]?.url).toBe(`/api/v1/users/${detail.id}/${action}`);
      expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
      expect(fake.calls[0]?.body).toBeNull();
    },
  );

  it.each(['deactivate', 'activate'] as const)(
    'encodes the id for %s so it can never add a path segment',
    async (action) => {
      const { fake, service } = serviceWith([{ status: 204 }]);

      await service[action]('a/b?c=d', 'key-1');

      expect(fake.calls[0]?.url).toBe(`/api/v1/users/a%2Fb%3Fc%3Dd/${action}`);
    },
  );

  it('rejects with the status and machine code of a 422', async () => {
    const { service } = serviceWith([
      {
        status: 422,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'x', status: 422, code: 'users.last-active-manager' },
      },
    ]);

    await expect(service.deactivate(detail.id, 'key-1')).rejects.toMatchObject({
      kind: 'http',
      status: 422,
      code: 'users.last-active-manager',
    });
  });
});

describe('usersService.remove', () => {
  it('calls DELETE /api/v1/users/{id} with no Idempotency-Key and resolves on a 204', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await expect(service.remove(detail.id)).resolves.toBeUndefined();

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/users/${detail.id}`);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBeNull();
  });

  it('encodes the id so it can never add a path segment or a query', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await service.remove('a/b?c=d');

    expect(fake.calls[0]?.url).toBe('/api/v1/users/a%2Fb%3Fc%3Dd');
  });

  it.each([
    [404, 'users.not-found'],
    [422, 'users.own-account'],
  ])('rejects with the status and machine code of a %i', async (status, code) => {
    const { service } = serviceWith([
      { status, headers: { 'Content-Type': 'application/problem+json' }, body: { title: 'x', status, code } },
    ]);

    await expect(service.remove(detail.id)).rejects.toMatchObject({ kind: 'http', status, code });
  });
});

describe('usersService', () => {
  it('exports an instance over the shared client', () => {
    expect(typeof usersService.list).toBe('function');
    expect(typeof usersService.get).toBe('function');
    expect(typeof usersService.create).toBe('function');
    expect(typeof usersService.update).toBe('function');
    expect(typeof usersService.deactivate).toBe('function');
    expect(typeof usersService.activate).toBe('function');
    expect(typeof usersService.remove).toBe('function');
  });
});
