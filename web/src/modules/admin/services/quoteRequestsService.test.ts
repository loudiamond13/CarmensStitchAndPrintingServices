import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { quoteRequestDetail, quoteRequestId, quoteRequestItem, quoteRequestList } from '@/test/quoteRequestFixtures';
import { createQuoteRequestsService } from './quoteRequestsService';

// The staff inbox calls (INQ-05, D-14, D-18): typed, over the one HTTP client.

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createQuoteRequestsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('quoteRequestsService.list', () => {
  it('calls GET /api/v1/quote-requests with status, q, page and size and resolves the typed page', async () => {
    const list = quoteRequestList([quoteRequestItem()]);
    const { fake, service } = serviceWith([{ body: list }]);

    await expect(service.list({ status: 'spam', q: 'juan', page: 2, size: 50 })).resolves.toEqual(list);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/quote-requests');
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'spam', q: 'juan', page: '2', size: '50' });
  });

  it('leaves q out when there is no search', async () => {
    const { fake, service } = serviceWith([{ body: quoteRequestList([]) }]);

    await service.list({ status: 'open', q: null, page: 1, size: 20 });

    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'open', page: '1', size: '20' });
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.list({ status: 'open', q: null, page: 1, size: 20 }, controller.signal).then(
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

describe('quoteRequestsService.get', () => {
  it('calls GET /api/v1/quote-requests/{id} and resolves the request in full', async () => {
    const detail = quoteRequestDetail(quoteRequestId(7));
    const { fake, service } = serviceWith([{ body: detail }]);

    await expect(service.get(quoteRequestId(7))).resolves.toEqual(detail);

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(`/api/v1/quote-requests/${quoteRequestId(7)}`);
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.get(quoteRequestId(1), controller.signal).then(
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

describe('quoteRequestsService.changeStatus', () => {
  it('posts the status and the version with the Idempotency-Key and resolves the slim answer', async () => {
    const answer = {
      id: quoteRequestId(7),
      status: 'quoted',
      statusChangedAtUtc: '2026-11-21T08:05:00Z',
      version: 'AAAAAAAAB9I=',
    };
    const { fake, service } = serviceWith([{ body: answer }]);

    await expect(service.changeStatus(quoteRequestId(7), 'quoted', 'AAAAAAAAB9E=', 'key-1')).resolves.toEqual(answer);

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(`/api/v1/quote-requests/${quoteRequestId(7)}/status`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ status: 'quoted', version: 'AAAAAAAAB9E=' });
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
  });
});

describe('quoteRequestsService.addNote', () => {
  it('posts the text with the Idempotency-Key and resolves the slim answer', async () => {
    const answer = {
      id: quoteRequestId(7),
      noteId: quoteRequestId(70),
      createdAtUtc: '2026-11-21T08:05:00Z',
      version: 'AAAAAAAAB9I=',
    };
    const { fake, service } = serviceWith([{ body: answer }]);

    await expect(service.addNote(quoteRequestId(7), 'Called back, wants 12.', 'key-2')).resolves.toEqual(answer);

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(`/api/v1/quote-requests/${quoteRequestId(7)}/notes`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ text: 'Called back, wants 12.' });
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-2');
  });
});

describe('quoteRequestsService.remove', () => {
  it('calls DELETE /api/v1/quote-requests/{id} with the version as a query parameter, no body and no Idempotency-Key', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await service.remove(quoteRequestId(7), 'AAAAAAAAB9E=');

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('DELETE');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe(`/api/v1/quote-requests/${quoteRequestId(7)}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ version: 'AAAAAAAAB9E=' });
    expect(fake.calls[0]?.body ?? null).toBeNull();
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBeNull();
  });
});

describe('quoteRequestsService.getOrderPrefill', () => {
  it('calls GET /api/v1/quote-requests/{id}/order-prefill and resolves the values the New Order form starts with', async () => {
    const prefill = {
      quoteRequestId: quoteRequestId(7),
      customerName: 'Juan Dela Cruz',
      teamName: null,
      contactNumber: '0917 555 0101',
      email: null,
      notes: 'Twelve jerseys.',
      receivedOn: '2026-11-21',
      productTypeId: null,
    };
    const { fake, service } = serviceWith([{ body: prefill }]);

    await expect(service.getOrderPrefill(quoteRequestId(7))).resolves.toEqual(prefill);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(`/api/v1/quote-requests/${quoteRequestId(7)}/order-prefill`);
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.getOrderPrefill(quoteRequestId(1), controller.signal).then(
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

describe('quoteRequestsService.newCount', () => {
  it('calls GET /api/v1/quote-requests/new-count and resolves the count', async () => {
    const { fake, service } = serviceWith([{ body: { count: 3 } }]);

    await expect(service.newCount()).resolves.toEqual({ count: 3 });

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/quote-requests/new-count');
  });
});
