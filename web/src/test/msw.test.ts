import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { collectConsole } from './consoleGuard';
import { server } from './msw';

// MSW reports an unhandled request with console.error before the fetch rejects. The test takes that record so the
// console guard does not fail it, and checks the report names MSW.
function takeMswReport(): string {
  return collectConsole()
    .flatMap((call) => call.args.map(String))
    .join('\n');
}

describe('MSW test harness', () => {
  it('answers a request that has a registered handler', async () => {
    server.use(http.get('http://localhost/api/v1/ping', () => HttpResponse.json({ pong: true })));

    const response = await fetch('http://localhost/api/v1/ping');

    expect(await response.json()).toEqual({ pong: true });
  });

  it('fails a request that has no handler', async () => {
    await expect(fetch('http://localhost/api/v1/unhandled')).rejects.toThrow();

    expect(takeMswReport()).toContain('[MSW]');
  });

  it('forgets handlers between tests', async () => {
    await expect(fetch('http://localhost/api/v1/ping')).rejects.toThrow();

    expect(takeMswReport()).toContain('[MSW]');
  });
});
