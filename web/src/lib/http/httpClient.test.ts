// Core request/response behaviour of the HTTP client (WEB-03, PRD 9.3). Every test injects a fake fetch.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeFetch, type FakeCall } from '../../test/fakeFetch';
import { HttpError, isHttpError } from './HttpError';
import { createHttpClient } from './httpClient';

interface SiteSettings {
  readonly businessName: string;
  readonly timeZone: string;
}

const settings: SiteSettings = { businessName: "Carmen's Stitch & Printing Services", timeZone: 'Asia/Manila' };

function onlyCall(calls: readonly FakeCall[]): FakeCall {
  expect(calls).toHaveLength(1);
  const [call] = calls;
  if (call === undefined) {
    throw new Error('no call recorded');
  }
  return call;
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
  vi.unstubAllGlobals();
});

describe('createHttpClient: GET round trip', () => {
  it('GETs baseURL + path with same-origin credentials and Accept JSON, and resolves to the parsed body', async () => {
    const fake = createFakeFetch([{ status: 200, body: settings }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const result = await client.get<SiteSettings>('/site-settings');

    const call = onlyCall(fake.calls);
    expect(call.url).toBe('/api/v1/site-settings');
    expect(call.method).toBe('GET');
    expect(call.init.credentials).toBe('same-origin');
    expect(call.headers.get('Accept')).toBe('application/json');
    expect(call.body).toBeNull();
    expect(result).toEqual(settings);
  });

  it('joins baseURL and path with exactly one slash', async () => {
    const fake = createFakeFetch([{ body: {} }, { body: {} }, { body: {} }]);
    const client = createHttpClient({ baseURL: '/api/v1/', fetch: fake.fetch });
    const bare = createHttpClient({ fetch: fake.fetch });

    await client.get('/orders');
    await client.get('orders');
    await bare.get('/health');

    expect(fake.calls.map((c) => c.url)).toEqual(['/api/v1/orders', '/api/v1/orders', '/health']);
  });

  it('serializes params: arrays as repeated keys, null and undefined skipped', async () => {
    const fake = createFakeFetch([{ body: [] }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    await client.get('/orders', {
      params: { q: 'jersey', status: ['ready', 'pending'], page: 2, empty: undefined, none: null, flag: true },
    });

    expect(onlyCall(fake.calls).url).toBe('/api/v1/orders?q=jersey&status=ready&status=pending&page=2&flag=true');
  });

  it('skips null entries inside an array param and encodes reserved characters', async () => {
    const fake = createFakeFetch([{ body: [] }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    await client.get('/orders', { params: { tag: ['a&b', null, 'c d'], sort: '-date' } });

    expect(onlyCall(fake.calls).url).toBe('/api/v1/orders?tag=a%26b&tag=c+d&sort=-date');
  });

  it('adds no "?" when every param is empty, and appends with "&" when the path already has a query', async () => {
    const fake = createFakeFetch([{ body: [] }, { body: [] }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    await client.get('/orders', { params: { q: undefined, page: null } });
    await client.get('/orders?view=board', { params: { page: 3 } });

    expect(fake.calls.map((c) => c.url)).toEqual(['/api/v1/orders', '/api/v1/orders?view=board&page=3']);
  });

  it('sends client default headers, and request headers override them', async () => {
    const fake = createFakeFetch([{ body: {} }]);
    const client = createHttpClient({
      fetch: fake.fetch,
      headers: { 'X-Client': 'csps-web', 'X-Mode': 'default' },
    });

    await client.get('/x', { headers: { 'x-mode': 'override' } });

    const { headers } = onlyCall(fake.calls);
    expect(headers.get('X-Client')).toBe('csps-web');
    expect(headers.get('X-Mode')).toBe('override');
  });

  it('maps get, post, put, patch, delete and request to their HTTP methods', async () => {
    const fake = createFakeFetch(Array.from({ length: 6 }, () => ({ status: 204 })));
    const client = createHttpClient({ fetch: fake.fetch });

    await client.get('/a');
    await client.post('/a');
    await client.put('/a');
    await client.patch('/a');
    await client.delete('/a');
    await client.request({ method: 'OPTIONS', url: '/a' });

    expect(fake.calls.map((c) => c.method)).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
  });

  it('defaults request() to GET', async () => {
    const fake = createFakeFetch([{ status: 204 }]);
    const client = createHttpClient({ fetch: fake.fetch });

    await client.request({ url: '/a' });

    expect(onlyCall(fake.calls).method).toBe('GET');
  });

  it('resolves 204, 205 and an empty 200 to undefined, and a non-JSON 200 to its text', async () => {
    const fake = createFakeFetch([
      { status: 204 },
      { status: 205 },
      { status: 200, body: '' },
      { status: 200, body: 'pong', headers: { 'Content-Type': 'text/plain' } },
    ]);
    const client = createHttpClient({ fetch: fake.fetch });

    await expect(client.delete('/a')).resolves.toBeUndefined();
    await expect(client.put('/a', { name: 'Jersey' })).resolves.toBeUndefined();
    await expect(client.get('/b')).resolves.toBeUndefined();
    await expect(client.get('/c')).resolves.toBe('pong');
  });

  it('parses an application/problem+json success body and a JSON content type with parameters', async () => {
    const fake = createFakeFetch([
      { body: '{"a":1}', headers: { 'Content-Type': 'application/json; charset=utf-8' } },
      { body: '{"b":2}', headers: { 'Content-Type': 'application/problem+json' } },
    ]);
    const client = createHttpClient({ fetch: fake.fetch });

    await expect(client.get('/a')).resolves.toEqual({ a: 1 });
    await expect(client.get('/b')).resolves.toEqual({ b: 2 });
  });

  it('uses globalThis.fetch when no fetch is injected', async () => {
    const fake = createFakeFetch([{ body: settings }]);
    vi.stubGlobal('fetch', fake.fetch);
    const client = createHttpClient({ baseURL: '/api/v1' });

    await expect(client.get('/site-settings')).resolves.toEqual(settings);
    expect(onlyCall(fake.calls).url).toBe('/api/v1/site-settings');
  });
});

describe('createHttpClient: ProblemDetails errors', () => {
  it('turns a 404 problem+json into an HttpError with kind http, status 404, title and traceId', async () => {
    const fake = createFakeFetch([
      {
        status: 404,
        headers: { 'Content-Type': 'application/problem+json' },
        body: JSON.stringify({ title: 'Not found', status: 404, traceId: 'abc' }),
      },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const error = await rejection(client.get('/orders/9'));

    expect(error).toBeInstanceOf(HttpError);
    expect(error.kind).toBe('http');
    expect(error.status).toBe(404);
    expect(error.problem?.title).toBe('Not found');
    expect(error.traceId).toBe('abc');
    expect(error.fieldErrors).toEqual({});
    expect(error.message).toBe('Not found');
  });

  it('exposes validation errors from a 400 problem as fieldErrors', async () => {
    const fake = createFakeFetch([
      {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
        body: JSON.stringify({ title: 'Check the fields', status: 400, errors: { Amount: ['Enter an amount.'] } }),
      },
    ]);
    const client = createHttpClient({ fetch: fake.fetch });

    const error = await rejection(client.post('/payments', { amount: '' }));

    expect(error.status).toBe(400);
    expect(error.fieldErrors).toEqual({ Amount: ['Enter an amount.'] });
  });

  it('never rejects with a raw Response', async () => {
    const fake = createFakeFetch([{ status: 500, body: { title: 'Something went wrong', status: 500 } }]);
    const client = createHttpClient({ fetch: fake.fetch });

    const outcome = await client.get('/x').catch((error: unknown) => error);

    expect(outcome).not.toBeInstanceOf(Response);
    expect(isHttpError(outcome)).toBe(true);
  });

  it('keeps the message plain English and never puts the response text in it', async () => {
    const fake = createFakeFetch([
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
        body: '<h1>System.NullReferenceException at Csps.Server.Orders.Create()</h1>',
      },
    ]);
    const client = createHttpClient({ fetch: fake.fetch });

    const error = await rejection(client.get('/x'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(error.problem).toBeUndefined();
    expect(error.message).toBe("The server couldn't complete the request.");
    expect(error.message).not.toContain('Exception');
  });
});

describe('createHttpClient: request interceptors', () => {
  it('applies a request interceptor before fetch, and its eject function removes it', async () => {
    const fake = createFakeFetch([{ body: {} }, { body: {} }]);
    const client = createHttpClient({ fetch: fake.fetch });
    const eject = client.interceptors.request.use((request) => {
      request.headers.set('X-Test', 'yes');
      return request;
    });

    await client.get('/a');
    eject();
    await client.get('/b');

    expect(fake.calls.map((c) => c.headers.get('X-Test'))).toEqual(['yes', null]);
  });

  it('runs interceptors in registration order and awaits async ones', async () => {
    const fake = createFakeFetch([{ body: {} }]);
    const client = createHttpClient({ fetch: fake.fetch });
    client.interceptors.request.use(async (request) => {
      await Promise.resolve();
      request.headers.append('X-Order', 'first');
      return request;
    });
    client.interceptors.request.use((request) => ({ ...request, url: `${request.url}/second` }));
    client.interceptors.request.use((request) => {
      request.headers.append('X-Order', 'third');
      return request;
    });

    await client.get('/a');

    const call = onlyCall(fake.calls);
    expect(call.url).toBe('/a/second');
    expect(call.headers.get('X-Order')).toBe('first, third');
  });

  it('ejecting twice is harmless', async () => {
    const fake = createFakeFetch([{ body: {} }]);
    const client = createHttpClient({ fetch: fake.fetch });
    const eject = client.interceptors.request.use((request) => {
      request.headers.set('X-Test', 'yes');
      return request;
    });

    eject();
    eject();
    await client.get('/a');

    expect(onlyCall(fake.calls).headers.has('X-Test')).toBe(false);
  });
});
