// Bodies, parse failures, the XMLHttpRequest upload transport and response interceptors (WEB-03, PRD 9.3).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeFetch, createFakeXhrFactory, type FakeXhr, type PlannedXhr } from '../../test/fakeFetch';
import { HttpError, isHttpError } from './HttpError';
import { createHttpClient, type HttpResponse, type UploadProgress } from './httpClient';

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

function onlyXhr(instances: readonly FakeXhr[]): FakeXhr {
  expect(instances).toHaveLength(1);
  const [xhr] = instances;
  if (xhr === undefined) {
    throw new Error('no XMLHttpRequest created');
  }
  return xhr;
}

const created: PlannedXhr = {
  status: 201,
  headers: 'content-type: application/json; charset=utf-8\r\nx-trace: t-1\r\n',
  body: '{"id":"img-1"}',
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('request bodies', () => {
  it('sends an object body as JSON with Content-Type application/json', async () => {
    const fake = createFakeFetch([{ status: 201, body: { id: 7 } }]);
    const client = createHttpClient({ fetch: fake.fetch });

    await expect(client.post('/orders', { name: 'Jersey', qty: 12 })).resolves.toEqual({ id: 7 });

    const [call] = fake.calls;
    expect(call?.headers.get('Content-Type')).toBe('application/json');
    expect(call?.body).toBe('{"name":"Jersey","qty":12}');
  });

  it('keeps a Content-Type the caller set', async () => {
    const fake = createFakeFetch([{ status: 204 }]);
    const client = createHttpClient({ fetch: fake.fetch });

    await client.patch(
      '/orders/1',
      { status: 'ready' },
      { headers: { 'Content-Type': 'application/merge-patch+json' } },
    );

    expect(fake.calls[0]?.headers.get('Content-Type')).toBe('application/merge-patch+json');
  });

  it('passes FormData through unchanged and sets no Content-Type', async () => {
    const fake = createFakeFetch([{ status: 204 }]);
    const client = createHttpClient({ fetch: fake.fetch });
    const form = new FormData();
    form.append('caption', 'Front');

    await client.post('/orders/1/images', form);

    expect(fake.calls[0]?.body).toBe(form);
    expect(fake.calls[0]?.headers.has('Content-Type')).toBe(false);
  });
});

describe('parse failures and non-JSON errors', () => {
  it('a 200 with an invalid JSON body rejects with kind parse and keeps the status', async () => {
    const fake = createFakeFetch([{ status: 200, headers: { 'Content-Type': 'application/json' }, body: '{oops' }]);
    const client = createHttpClient({ fetch: fake.fetch });

    const error = await rejection(client.get('/orders'));

    expect(error.kind).toBe('parse');
    expect(error.status).toBe(200);
    expect(error.problem).toBeUndefined();
    expect(error.message).toBe("The server sent a reply we couldn't read.");
  });

  it('a text/plain error body gives kind http, no problem and the default message', async () => {
    const fake = createFakeFetch([
      { status: 502, headers: { 'Content-Type': 'text/plain' }, body: 'Bad Gateway: upstream at 10.0.0.4 failed' },
    ]);
    const client = createHttpClient({ fetch: fake.fetch });

    const error = await rejection(client.get('/orders'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(502);
    expect(error.problem).toBeUndefined();
    expect(error.message).toBe("The server couldn't complete the request.");
    expect(error.message).not.toContain('10.0.0.4');
  });

  it('an error that claims problem+json but is not valid JSON still gives kind http with no problem', async () => {
    const fake = createFakeFetch([
      { status: 500, headers: { 'Content-Type': 'application/problem+json' }, body: '<html>oops</html>' },
    ]);
    const client = createHttpClient({ fetch: fake.fetch });

    const error = await rejection(client.get('/orders'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(error.problem).toBeUndefined();
  });
});

describe('XMLHttpRequest upload transport', () => {
  it('is used only when onUploadProgress is given: progress, then the 201 JSON body', async () => {
    const fake = createFakeFetch([]);
    const xhr = createFakeXhrFactory([
      {
        ...created,
        progress: [
          { loaded: 512, total: 2048 },
          { loaded: 2048, total: 2048 },
        ],
      },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, xhrFactory: xhr.factory });
    client.interceptors.request.use((request) => {
      request.headers.set('X-Csrf', 'c-1');
      return request;
    });
    const progress: UploadProgress[] = [];
    const form = new FormData();
    form.append('file', new Blob(['jpeg']), 'front.jpg');

    const result = await client.post<{ id: string }>('/orders/1/images', form, {
      idempotencyKey: 'k-up',
      params: { position: 1 },
      onUploadProgress: (p) => progress.push(p),
    });

    expect(result).toEqual({ id: 'img-1' });
    expect(fake.calls).toHaveLength(0);
    expect(progress).toEqual([
      { loaded: 512, total: 2048 },
      { loaded: 2048, total: 2048 },
    ]);
    const sent = onlyXhr(xhr.instances);
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe('/api/v1/orders/1/images?position=1');
    expect(sent.body).toBe(form);
    expect(sent.requestHeaders).toMatchObject({
      accept: 'application/json',
      'idempotency-key': 'k-up',
      'x-csrf': 'c-1',
    });
    expect(sent.requestHeaders).not.toHaveProperty('content-type');
  });

  it('reports an unknown total as undefined and sends a JSON body as a string', async () => {
    const xhr = createFakeXhrFactory([{ status: 204, progress: [{ loaded: 10 }] }]);
    const client = createHttpClient({ xhrFactory: xhr.factory });
    const progress: UploadProgress[] = [];

    await expect(
      client.put('/orders/1/notes', { text: 'Rush' }, { onUploadProgress: (p) => progress.push(p) }),
    ).resolves.toBeUndefined();

    expect(progress).toEqual([{ loaded: 10, total: undefined }]);
    const sent = onlyXhr(xhr.instances);
    expect(sent.body).toBe('{"text":"Rush"}');
    expect(sent.requestHeaders['content-type']).toBe('application/json');
  });

  it('sends null as the body when there is none', async () => {
    const xhr = createFakeXhrFactory([{ status: 204 }]);
    const client = createHttpClient({ xhrFactory: xhr.factory });

    await client.delete('/orders/1/images/2', { onUploadProgress: () => undefined });

    expect(onlyXhr(xhr.instances).body).toBeNull();
  });

  it('turns a ProblemDetails error into the same HttpError shape as fetch', async () => {
    const xhr = createFakeXhrFactory([
      {
        status: 413,
        headers: 'content-type: application/problem+json\r\n',
        body: JSON.stringify({
          title: 'File too large',
          status: 413,
          traceId: 'up-9',
          errors: { File: ['Max 10 MB.'] },
        }),
      },
    ]);
    const client = createHttpClient({ xhrFactory: xhr.factory });

    const error = await rejection(client.post('/images', new FormData(), { onUploadProgress: () => undefined }));

    expect(error).toBeInstanceOf(HttpError);
    expect([error.kind, error.status, error.message, error.traceId]).toEqual(['http', 413, 'File too large', 'up-9']);
    expect(error.fieldErrors).toEqual({ File: ['Max 10 MB.'] });
  });

  it('reads response headers, skipping malformed lines', async () => {
    const xhr = createFakeXhrFactory([
      {
        status: 200,
        headers: 'bad header: x\r\nno-colon-line\r\nContent-Type: application/json\r\n\r\n',
        body: '"stored"',
      },
    ]);
    const client = createHttpClient({ xhrFactory: xhr.factory });

    await expect(client.post('/images', new FormData(), { onUploadProgress: () => undefined })).resolves.toBe('stored');
  });

  it('rejects an upload answered with a non-JSON 2xx body with kind parse (LIB-WR-05)', async () => {
    const xhr = createFakeXhrFactory([{ status: 200, headers: 'Content-Type: text/html\r\n', body: '<html></html>' }]);
    const client = createHttpClient({ xhrFactory: xhr.factory });

    const error = await rejection(client.post('/images', new FormData(), { onUploadProgress: () => undefined }));

    expect([error.kind, error.status]).toEqual(['parse', 200]);
  });

  it('rejects an upload whose answer came through a redirect with kind parse, and accepts the same URL', async () => {
    const xhr = createFakeXhrFactory([
      { ...created, responseURL: 'https://wifi.example.ph/portal' },
      { ...created, responseURL: new URL('/images', globalThis.location.href).href },
    ]);
    const client = createHttpClient({ xhrFactory: xhr.factory });
    const upload = () => client.post('/images', new FormData(), { onUploadProgress: () => undefined });

    expect((await rejection(upload())).kind).toBe('parse');
    await expect(upload()).resolves.toEqual({ id: 'img-1' });
  });

  it('onerror gives kind network', async () => {
    const xhr = createFakeXhrFactory([{ outcome: 'error' }]);
    const client = createHttpClient({ xhrFactory: xhr.factory, retry: { max: 0 } });

    const error = await rejection(client.post('/images', new FormData(), { onUploadProgress: () => undefined }));

    expect(error.kind).toBe('network');
    expect(error.status).toBe(0);
  });

  it("cancelling the caller's signal aborts the upload with kind aborted", async () => {
    const xhr = createFakeXhrFactory([{ outcome: 'hang', progress: [{ loaded: 1, total: 4 }] }]);
    const client = createHttpClient({ xhrFactory: xhr.factory });
    const controller = new AbortController();

    const pending = rejection(
      client.post('/images', new FormData(), { signal: controller.signal, onUploadProgress: () => undefined }),
    );
    await vi.waitFor(() => {
      expect(xhr.instances[0]?.sent).toBe(true);
    });
    await Promise.resolve();
    controller.abort();
    const error = await pending;

    expect(error.kind).toBe('aborted');
    expect(onlyXhr(xhr.instances).aborted).toBe(true);
  });

  it('a signal that is already aborted never opens a request', async () => {
    const xhr = createFakeXhrFactory([{ status: 204 }]);
    const client = createHttpClient({ xhrFactory: xhr.factory });

    const error = await rejection(
      client.post('/images', new FormData(), { signal: AbortSignal.abort(), onUploadProgress: () => undefined }),
    );

    expect(error.kind).toBe('aborted');
    expect(xhr.instances).toHaveLength(0);
  });

  it('the timeout aborts the upload with kind timeout', async () => {
    vi.useFakeTimers();
    const xhr = createFakeXhrFactory([{ outcome: 'hang' }]);
    const client = createHttpClient({ xhrFactory: xhr.factory, timeoutMs: 5_000 });

    const pending = rejection(client.post('/images', new FormData(), { onUploadProgress: () => undefined }));
    await vi.advanceTimersByTimeAsync(5_000);
    const error = await pending;

    expect(error.kind).toBe('timeout');
    expect(onlyXhr(xhr.instances).aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never retries a keyed FormData upload: a new multipart boundary would change the body (LIB-CR-02)', async () => {
    const xhr = createFakeXhrFactory([{ outcome: 'error' }, created]);
    const client = createHttpClient({ xhrFactory: xhr.factory, sleep: () => Promise.resolve() });

    const error = await rejection(
      client.post('/images', new FormData(), { idempotencyKey: 'k-7', onUploadProgress: () => undefined }),
    );

    expect(error.kind).toBe('network');
    expect(xhr.instances.map((x) => x.requestHeaders['idempotency-key'])).toEqual(['k-7']);
  });

  it('retries a keyed JSON POST sent with upload progress, with the same key', async () => {
    const xhr = createFakeXhrFactory([{ outcome: 'error' }, created]);
    const client = createHttpClient({ xhrFactory: xhr.factory, sleep: () => Promise.resolve() });

    await client.post('/notes', { text: 'Rush' }, { idempotencyKey: 'k-8', onUploadProgress: () => undefined });

    expect(xhr.instances.map((x) => x.requestHeaders['idempotency-key'])).toEqual(['k-8', 'k-8']);
  });

  it('without onUploadProgress the XHR factory is never called', async () => {
    const fake = createFakeFetch([{ status: 204 }]);
    const factory = vi.fn(createFakeXhrFactory([]).factory);
    const client = createHttpClient({ fetch: fake.fetch, xhrFactory: factory });

    await client.post('/images', new FormData());

    expect(factory).not.toHaveBeenCalled();
    expect(fake.calls).toHaveLength(1);
  });

  it('uses the global XMLHttpRequest when no factory is injected', async () => {
    const xhr = createFakeXhrFactory([created]);
    vi.stubGlobal('XMLHttpRequest', xhr.XhrClass);
    const client = createHttpClient();

    await expect(client.post('/images', new FormData(), { onUploadProgress: () => undefined })).resolves.toEqual({
      id: 'img-1',
    });
    expect(xhr.instances).toHaveLength(1);
  });
});

describe('response interceptors', () => {
  it('can transform the data, in registration order', async () => {
    const fake = createFakeFetch([{ body: { n: 1 } }]);
    const client = createHttpClient({ fetch: fake.fetch });
    client.interceptors.response.use((response) => ({ ...response, data: { wrapped: response.data } }));
    client.interceptors.response.use(async (response: HttpResponse) => {
      await Promise.resolve();
      return { ...response, data: { status: response.status, inner: response.data } };
    });

    await expect(client.get('/a')).resolves.toEqual({ status: 200, inner: { wrapped: { n: 1 } } });
  });

  it('an onRejected interceptor sees the HttpError, and the error it returns is the rejection', async () => {
    const fake = createFakeFetch([{ status: 404, body: { title: 'Not found', status: 404, traceId: 'abc' } }]);
    const client = createHttpClient({ fetch: fake.fetch });
    const seen: HttpError[] = [];
    const replacement = new HttpError({ kind: 'http', status: 404 });
    client.interceptors.response.use(undefined, (error) => {
      seen.push(error);
      return replacement;
    });
    client.interceptors.response.use(undefined, async (error) => {
      await Promise.resolve();
      seen.push(error);
      return error;
    });

    const error = await rejection(client.get('/orders/9'));

    expect(seen[0]?.traceId).toBe('abc');
    expect(seen[1]).toBe(replacement);
    expect(error).toBe(replacement);
  });

  it('skips the missing half of each interceptor', async () => {
    const fake = createFakeFetch([{ body: { n: 1 } }, { status: 500 }]);
    const client = createHttpClient({ fetch: fake.fetch });
    const onRejected = vi.fn((error: HttpError) => error);
    const onFulfilled = vi.fn((response: HttpResponse) => response);
    client.interceptors.response.use(undefined, onRejected);
    client.interceptors.response.use(onFulfilled);

    await client.get('/a');
    await rejection(client.get('/b'));

    expect(onFulfilled).toHaveBeenCalledTimes(1);
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it('a programming error (a secret param) skips onRejected and rejects as a TypeError', async () => {
    const fake = createFakeFetch([]);
    const client = createHttpClient({ fetch: fake.fetch });
    const onRejected = vi.fn((error: HttpError) => error);
    client.interceptors.response.use(undefined, onRejected);

    await expect(client.get('/a', { params: { password: 'x' } })).rejects.toBeInstanceOf(TypeError);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('an ejected response interceptor no longer runs', async () => {
    const fake = createFakeFetch([{ body: { n: 1 } }]);
    const client = createHttpClient({ fetch: fake.fetch });
    const eject = client.interceptors.response.use(() => {
      throw new Error('should not run');
    });

    eject();

    await expect(client.get('/a')).resolves.toEqual({ n: 1 });
  });
});
