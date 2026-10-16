// @vitest-environment node
// Pins the production smoke test (OPS-04, OPS-05, D-06, D-13). Every case drives smoke.mjs through a fake `send` and a
// fake clock, so no request leaves the machine. Each failure mode has its own case, because a smoke that follows
// redirects or counts an IIS HTML page as ProblemDetails would pass vacuously (T-03-32).
import { describe, expect, it } from 'vitest';
import { CHECKS, evaluate, main, runSmoke } from './smoke.mjs';

interface FakeRequest {
  readonly method: string;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly servername?: string;
  readonly insecureTls?: boolean;
}

interface FakeResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

type Reply = FakeResponse | Error;

const ORIGIN = 'https://smoke.test';
const SECRET_BODY_MARKER = 'BODY-MARKER-must-never-be-printed';

function reply(status: number, headers: Record<string, string>, body = ''): FakeResponse {
  return { status, headers, body };
}

function problem(status: number, extra: Record<string, unknown> = { traceId: '00-abc-def-00' }): FakeResponse {
  return reply(
    status,
    { 'content-type': 'application/problem+json; charset=utf-8' },
    JSON.stringify({ status, title: 'Problem', ...extra }),
  );
}

function health(
  overrides: { status?: string; checks?: readonly { name: string; status: string }[] } = {},
): FakeResponse {
  const checks = overrides.checks ?? [
    { name: 'self', status: 'Healthy' },
    { name: 'database', status: 'Healthy' },
    { name: 'time-zone', status: 'Healthy' },
  ];
  return reply(
    200,
    { 'content-type': 'application/json', 'cache-control': 'no-store' },
    JSON.stringify({ status: overrides.status ?? 'Healthy', checks }),
  );
}

/** A fake site: `routes` maps "METHOD url" to a reply, or to a function that returns one per call. */
function fakeSite(routes: Record<string, Reply | (() => Reply)>) {
  const requests: FakeRequest[] = [];
  const send = (request: FakeRequest): Promise<FakeResponse> => {
    requests.push(request);
    const route = routes[`${request.method} ${request.url}`];
    if (route === undefined) {
      return Promise.reject(new Error(`unplanned request ${request.method} ${request.url}`));
    }
    const answer = typeof route === 'function' ? route() : route;
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { send, requests };
}

function healthySite(overrides: Record<string, Reply | (() => Reply)> = {}) {
  return fakeSite({
    [`GET ${ORIGIN}/health`]: health(),
    [`GET ${ORIGIN}/api/v1/__smoke-missing`]: problem(404),
    [`GET ${ORIGIN}/api/v1/site-settings`]: problem(401),
    ...overrides,
  });
}

/** A clock that only moves when the script sleeps. */
function fakeClock() {
  let time = 1_000_000;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: (ms: number): Promise<void> => {
      sleeps.push(ms);
      time += ms;
      return Promise.resolve();
    },
    sleeps,
    elapsed: () => time - 1_000_000,
  };
}

async function runOne(
  name: string,
  site: { send: (request: FakeRequest) => Promise<FakeResponse> },
  clock = fakeClock(),
) {
  const results = await runSmoke({ origin: ORIGIN, send: site.send, now: clock.now, sleep: clock.sleep, only: [name] });
  expect(results).toHaveLength(1);
  const [result] = results;
  if (result === undefined) {
    throw new Error('no result');
  }
  return result;
}

describe('CHECKS', () => {
  it('is a frozen, ordered list of named checks', () => {
    expect(Object.isFrozen(CHECKS)).toBe(true);
    expect(CHECKS.map((check) => check.name).slice(0, 3)).toEqual(['health', 'unknown-api', 'default-deny']);
    expect(new Set(CHECKS.map((check) => check.name)).size).toBe(CHECKS.length);
  });
});

describe('health', () => {
  it('passes on 200 JSON, no-store, status Healthy and self, database and time-zone all Healthy', async () => {
    const result = await runOne('health', healthySite());
    expect(result).toMatchObject({ name: 'health', ok: true });
  });

  it('asks for the https origin only and never follows redirects (no redirect option is passed)', async () => {
    const site = healthySite();
    await runOne('health', site);
    expect(site.requests).toHaveLength(1);
    expect(site.requests[0]).toMatchObject({ method: 'GET', url: `${ORIGIN}/health` });
  });

  it('retries a 503 with 2, 4, 8, 15 second backoff and passes once the site is up (cold start)', async () => {
    let calls = 0;
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: () => {
        calls += 1;
        return calls < 4 ? reply(503, { 'content-type': 'text/html' }, '<html>starting</html>') : health();
      },
    });
    const clock = fakeClock();
    const result = await runOne('health', site, clock);
    expect(result.ok).toBe(true);
    expect(calls).toBe(4);
    expect(clock.sleeps).toEqual([2000, 4000, 8000]);
  });

  it('retries a connection error', async () => {
    let calls = 0;
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: () => {
        calls += 1;
        return calls === 1 ? Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' }) : health();
      },
    });
    const result = await runOne('health', site);
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('gives up before 90 seconds have passed, naming the last status, and never sleeps past the deadline', async () => {
    let calls = 0;
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: () => {
        calls += 1;
        return reply(503, { 'content-type': 'text/html' }, SECRET_BODY_MARKER);
      },
    });
    const clock = fakeClock();
    const result = await runOne('health', site, clock);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('503');
    expect(result.detail).not.toContain(SECRET_BODY_MARKER);
    expect(clock.sleeps).toEqual([2000, 4000, 8000, 15000, 15000, 15000, 15000, 15000]);
    expect(calls).toBe(9);
    expect(clock.elapsed()).toBeLessThanOrEqual(90_000);
    expect(clock.elapsed()).toBeGreaterThan(60_000);
  });

  it('fails when a required check is missing', async () => {
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: health({
        checks: [
          { name: 'self', status: 'Healthy' },
          { name: 'time-zone', status: 'Healthy' },
        ],
      }),
    });
    const result = await runOne('health', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('database');
  });

  it('fails when a check is Unhealthy', async () => {
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: health({
        checks: [
          { name: 'self', status: 'Healthy' },
          { name: 'database', status: 'Unhealthy' },
          { name: 'time-zone', status: 'Healthy' },
        ],
      }),
    });
    const result = await runOne('health', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('database');
  });

  it('fails when the overall status is not Healthy', async () => {
    const result = await runOne('health', healthySite({ [`GET ${ORIGIN}/health`]: health({ status: 'Degraded' }) }));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('status');
  });

  it('fails on a 200 that is not JSON (an HTML page in front of the app)', async () => {
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: reply(
        200,
        { 'content-type': 'text/html', 'cache-control': 'no-store' },
        '<html></html>',
      ),
    });
    const result = await runOne('health', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('text/html');
  });

  it('fails on JSON content type with a body that does not parse', async () => {
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: reply(
        200,
        { 'content-type': 'application/json', 'cache-control': 'no-store' },
        'not json',
      ),
    });
    const result = await runOne('health', site);
    expect(result.ok).toBe(false);
  });

  it('fails when Cache-Control no-store is missing', async () => {
    const good = health();
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: reply(200, { 'content-type': 'application/json' }, good.body),
    });
    const result = await runOne('health', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('no-store');
  });

  it('reads header names in any letter case', async () => {
    const good = health();
    const site = healthySite({
      [`GET ${ORIGIN}/health`]: reply(
        200,
        { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        good.body,
      ),
    });
    expect((await runOne('health', site)).ok).toBe(true);
  });
});

describe('unknown-api', () => {
  it('passes on 404 application/problem+json with a traceId', async () => {
    expect(await runOne('unknown-api', healthySite())).toMatchObject({ name: 'unknown-api', ok: true });
  });

  it('fails on an IIS HTML 404', async () => {
    const site = healthySite({
      [`GET ${ORIGIN}/api/v1/__smoke-missing`]: reply(404, { 'content-type': 'text/html' }, SECRET_BODY_MARKER),
    });
    const result = await runOne('unknown-api', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('text/html');
    expect(result.detail).not.toContain(SECRET_BODY_MARKER);
  });

  it('fails when the SPA shell answers 200 with index.html', async () => {
    const site = healthySite({
      [`GET ${ORIGIN}/api/v1/__smoke-missing`]: reply(200, { 'content-type': 'text/html' }, '<html></html>'),
    });
    const result = await runOne('unknown-api', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('200');
  });

  it('fails when the ProblemDetails has no traceId', async () => {
    const site = healthySite({ [`GET ${ORIGIN}/api/v1/__smoke-missing`]: problem(404, {}) });
    const result = await runOne('unknown-api', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('traceId');
  });

  it('fails on a connection error', async () => {
    const site = healthySite({ [`GET ${ORIGIN}/api/v1/__smoke-missing`]: new Error('socket hang up') });
    const result = await runOne('unknown-api', site);
    expect(result.ok).toBe(false);
  });
});

describe('default-deny', () => {
  it('passes on anonymous 401 application/problem+json', async () => {
    expect(await runOne('default-deny', healthySite())).toMatchObject({ name: 'default-deny', ok: true });
  });

  it('fails when the endpoint answers 200 to an anonymous caller', async () => {
    const site = healthySite({
      [`GET ${ORIGIN}/api/v1/site-settings`]: reply(200, { 'content-type': 'application/json' }, SECRET_BODY_MARKER),
    });
    const result = await runOne('default-deny', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('200');
    expect(result.detail).not.toContain(SECRET_BODY_MARKER);
  });

  it('fails on an IIS HTML 401', async () => {
    const site = healthySite({
      [`GET ${ORIGIN}/api/v1/site-settings`]: reply(401, { 'content-type': 'text/html' }, '<html>401</html>'),
    });
    const result = await runOne('default-deny', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('text/html');
  });

  it('sends no credentials', async () => {
    const site = healthySite();
    await runOne('default-deny', site);
    const headers = Object.keys(site.requests[0]?.headers ?? {}).map((name) => name.toLowerCase());
    expect(headers).not.toContain('authorization');
    expect(headers).not.toContain('cookie');
  });
});

describe('evaluate', () => {
  it('passes only when every result is ok and prints one plain line per check', () => {
    const verdict = evaluate([
      { name: 'health', ok: true, detail: '200 Healthy' },
      { name: 'default-deny', ok: false, detail: 'status 200' },
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.lines).toEqual(['PASS health: 200 Healthy', 'FAIL default-deny: status 200']);
    expect(evaluate([{ name: 'health', ok: true, detail: 'fine' }]).ok).toBe(true);
  });

  it('does not pass an empty result list (a smoke that ran nothing proves nothing)', () => {
    expect(evaluate([]).ok).toBe(false);
  });
});

describe('runSmoke', () => {
  it('runs the checks in CHECKS order and keeps going after a failure', async () => {
    const site = healthySite({ [`GET ${ORIGIN}/api/v1/__smoke-missing`]: reply(404, { 'content-type': 'text/html' }) });
    const clock = fakeClock();
    const results = await runSmoke({
      origin: ORIGIN,
      send: site.send,
      now: clock.now,
      sleep: clock.sleep,
      only: ['health', 'unknown-api', 'default-deny'],
    });
    expect(results.map((result) => [result.name, result.ok])).toEqual([
      ['health', true],
      ['unknown-api', false],
      ['default-deny', true],
    ]);
  });

  it('turns an unexpected throw inside a check into a failed result', async () => {
    const site = healthySite({ [`GET ${ORIGIN}/api/v1/site-settings`]: new TypeError('boom') });
    const result = await runOne('default-deny', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('boom');
  });
});

describe('main', () => {
  function cli(argv: readonly string[], env: Record<string, string> = {}, site = healthySite()) {
    const out: string[] = [];
    const err: string[] = [];
    const appended: { file: string; text: string }[] = [];
    const clock = fakeClock();
    return {
      site,
      out,
      err,
      appended,
      run: () =>
        main(argv, env, {
          send: site.send,
          now: clock.now,
          sleep: clock.sleep,
          stdout: (text: string) => out.push(text),
          stderr: (text: string) => err.push(text),
          appendFile: (file: string, text: string) => appended.push({ file, text }),
        }),
    };
  }

  const THREE = ['--origin', ORIGIN, '--only', 'health,unknown-api,default-deny'];

  it('exits 0 and prints one pass line per check when every check passes', async () => {
    const harness = cli(THREE);
    expect(await harness.run()).toBe(0);
    const lines = harness.out
      .join('')
      .split('\n')
      .filter((line) => line.startsWith('PASS ') || line.startsWith('FAIL '));
    expect(lines).toHaveLength(3);
    expect(lines.every((line) => line.startsWith('PASS '))).toBe(true);
    expect(harness.err).toEqual([]);
  });

  it('exits 1 when any check fails', async () => {
    const harness = cli(
      THREE,
      {},
      healthySite({ [`GET ${ORIGIN}/api/v1/site-settings`]: reply(200, { 'content-type': 'application/json' }) }),
    );
    expect(await harness.run()).toBe(1);
    expect(harness.out.join('')).toContain('FAIL default-deny');
  });

  it('never prints a response body', async () => {
    const harness = cli(
      THREE,
      {},
      healthySite({
        [`GET ${ORIGIN}/api/v1/site-settings`]: reply(200, { 'content-type': 'application/json' }, SECRET_BODY_MARKER),
      }),
    );
    await harness.run();
    expect(harness.out.join('') + harness.err.join('')).not.toContain(SECRET_BODY_MARKER);
  });

  it('exits 2 without any request when --origin is missing, not https, or not a URL', async () => {
    for (const argv of [[], ['--origin'], ['--origin', 'http://smoke.test'], ['--origin', 'smoke.test']]) {
      const harness = cli(argv);
      expect(await harness.run()).toBe(2);
      expect(harness.site.requests).toEqual([]);
      expect(harness.err.join('')).not.toBe('');
    }
  });

  it('exits 2 for an unknown --only name or an unknown argument', async () => {
    for (const argv of [
      ['--origin', ORIGIN, '--only', 'nope'],
      ['--origin', ORIGIN, '--frobnicate'],
    ]) {
      const harness = cli(argv);
      expect(await harness.run()).toBe(2);
      expect(harness.site.requests).toEqual([]);
    }
  });

  it('refuses --insecure-tls for any origin whose host is not localhost', async () => {
    const harness = cli([...THREE, '--insecure-tls']);
    expect(await harness.run()).toBe(2);
    expect(harness.site.requests).toEqual([]);
    expect(harness.err.join('')).toContain('localhost');
  });

  it('passes insecureTls to send for a localhost origin and not otherwise', async () => {
    const local = 'https://localhost:7028';
    const site = fakeSite({
      [`GET ${local}/health`]: health(),
      [`GET ${local}/api/v1/__smoke-missing`]: problem(404),
      [`GET ${local}/api/v1/site-settings`]: problem(401),
    });
    const insecure = cli(['--origin', local, '--only', 'health,unknown-api,default-deny', '--insecure-tls'], {}, site);
    expect(await insecure.run()).toBe(0);
    expect(site.requests.every((request) => request.insecureTls === true)).toBe(true);

    const strict = healthySite();
    await cli(THREE, {}, strict).run();
    expect(strict.requests.every((request) => request.insecureTls !== true)).toBe(true);
  });

  it('appends a Markdown table to GITHUB_STEP_SUMMARY when it is set', async () => {
    const harness = cli(THREE, { GITHUB_STEP_SUMMARY: '/tmp/summary.md' });
    await harness.run();
    expect(harness.appended).toHaveLength(1);
    expect(harness.appended[0]?.file).toBe('/tmp/summary.md');
    expect(harness.appended[0]?.text).toContain('| health |');
    expect(harness.appended[0]?.text).toContain('| Check | Result | Detail |');
  });

  it('writes no step summary when GITHUB_STEP_SUMMARY is unset', async () => {
    const harness = cli(THREE);
    await harness.run();
    expect(harness.appended).toEqual([]);
  });
});
