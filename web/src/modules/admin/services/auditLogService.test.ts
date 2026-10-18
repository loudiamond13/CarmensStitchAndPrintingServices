import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { createAuditLogService, type AuditLogResponse, type AuditPerson } from './auditLogService';

// The audit log calls (AUDIT-02, D-26): typed, over the one HTTP client. Manager only; an Admin gets 403.

const list: AuditLogResponse = {
  items: [
    {
      id: 41,
      occurredAt: '2026-10-17T07:42:00Z',
      doneBy: { kind: 'user', person: { id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f', name: 'Carmen Reyes', formerStaff: false } },
      action: 'user.deactivated',
      doneTo: { id: '00000000-0000-4000-8000-000000000002', name: 'Paolo Garcia', formerStaff: false },
      detail: null,
      ipPrefix: '203.0.113.0/24',
      device: 'Chrome on Android',
      reference: 'c0ffee00',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

const people: AuditPerson[] = [{ id: '00000000-0000-4000-8000-000000000002', name: 'Paolo Garcia', formerStaff: false }];

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createAuditLogService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

const NO_FILTERS = { from: null, to: null, actor: null, action: null, target: null, page: 1, pageSize: 20 };

describe('auditLogService.list', () => {
  it('calls GET /api/v1/audit-log with every filter, the page and the size and resolves the typed page', async () => {
    const { fake, service } = serviceWith([{ body: list }]);

    await expect(
      service.list({
        from: '2026-10-12',
        to: '2026-10-18',
        actor: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
        action: 'user.deactivated',
        target: '00000000-0000-4000-8000-000000000002',
        page: 2,
        pageSize: 50,
      }),
    ).resolves.toEqual(list);

    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/audit-log');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '2026-10-12',
      to: '2026-10-18',
      actor: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
      action: 'user.deactivated',
      target: '00000000-0000-4000-8000-000000000002',
      page: '2',
      pageSize: '50',
    });
  });

  it('leaves out every filter that is not set', async () => {
    const { fake, service } = serviceWith([{ body: list }]);

    await service.list(NO_FILTERS);

    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', pageSize: '20' });
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.list(NO_FILTERS, controller.signal).then(
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

describe('auditLogService.people', () => {
  it('calls GET /api/v1/audit-log/people and resolves the bare array', async () => {
    const { fake, service } = serviceWith([{ body: people }]);

    await expect(service.people()).resolves.toEqual(people);

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/audit-log/people');
  });
});
