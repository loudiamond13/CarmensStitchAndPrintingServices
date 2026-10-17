// @vitest-environment node
// Pins the production smoke test (OPS-04, OPS-05, D-06, D-13). Every case drives smoke.mjs through a fake `send` and a
// fake clock, so no request leaves the machine. Each failure mode has its own case, because a smoke that follows
// redirects or counts an IIS HTML page as ProblemDetails would pass vacuously (T-03-32).
import { describe, expect, it } from 'vitest';
import { CHECKS, evaluate, main, readProbe, runSmoke } from './smoke.mjs';

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
type Route = Reply | ((request: FakeRequest) => Reply);

function fakeSite(routes: Record<string, Route>) {
  const requests: FakeRequest[] = [];
  const send = (request: FakeRequest): Promise<FakeResponse> => {
    requests.push(request);
    // A request that sets a Host header is looked up as "METHOD url Host=value" first.
    const host = request.headers?.Host;
    const route =
      (host === undefined ? undefined : routes[`${request.method} ${request.url} Host=${host}`]) ??
      routes[`${request.method} ${request.url}`];
    if (route === undefined) {
      return Promise.reject(new Error(`unplanned request ${request.method} ${request.url}`));
    }
    const answer = typeof route === 'function' ? route(request) : route;
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { send, requests };
}

function healthySite(overrides: Record<string, Route> = {}) {
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

// Task 2: the OPS-05 hosting checks, the first-deploy host checks and the probe reader.

const HOST = 'smoke.test';
const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'";
const HSTS = 'max-age=31536000; includeSubDomains';
const SHELL = reply(
  200,
  {
    'content-type': 'text/html',
    'cache-control': 'no-cache',
    'strict-transport-security': HSTS,
    'content-security-policy': STRICT_CSP,
  },
  '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-Ab12Cd.js"></script></head></html>',
);
const ASSET = reply(
  200,
  {
    'content-type': 'text/javascript',
    'cache-control': 'public, max-age=31536000, immutable',
    'content-encoding': 'br',
  },
  'compressed-bytes',
);

/** A production site that is right in every way the smoke looks; each case breaks one thing. */
function fullSite(overrides: Record<string, Route> = {}) {
  return healthySite({
    [`GET ${ORIGIN}/missing-smoke.js`]: problem(404),
    [`GET http://${HOST}/`]: reply(301, { location: `https://${HOST}/` }),
    [`GET ${ORIGIN}/`]: SHELL,
    [`GET ${ORIGIN}/ Host=smoke.invalid`]: reply(
      400,
      { 'content-type': 'text/html' },
      'Bad Request - Invalid Hostname',
    ),
    [`GET ${ORIGIN}/assets/index-Ab12Cd.js`]: ASSET,
    [`POST ${ORIGIN}/api/v1/__smoke`]: problem(413),
    ...overrides,
  });
}

function withHeaders(base: FakeResponse, change: Record<string, string | null>): FakeResponse {
  const kept = Object.entries(base.headers).filter(([name]) => change[name] !== null);
  const set = Object.entries(change).filter((entry): entry is [string, string] => entry[1] !== null);
  return { ...base, headers: Object.fromEntries([...kept, ...set]) };
}

describe('CHECKS order', () => {
  it('lists every check in the planned order', () => {
    expect(CHECKS.map((check) => check.name)).toEqual([
      'health',
      'unknown-api',
      'default-deny',
      'missing-file',
      'https-redirect',
      'security-headers',
      'no-banners',
      'shell-cache',
      'hashed-asset',
      'json-not-compressed',
      'host-filter',
      'request-limit',
    ]);
  });

  it('passes every check against a site that is right', async () => {
    const clock = fakeClock();
    const results = await runSmoke({ origin: ORIGIN, send: fullSite().send, now: clock.now, sleep: clock.sleep });
    expect(results.filter((result) => !result.ok)).toEqual([]);
    expect(results).toHaveLength(CHECKS.length);
  });
});

describe('missing-file', () => {
  it('passes on 404 ProblemDetails', async () => {
    expect(await runOne('missing-file', fullSite())).toMatchObject({ name: 'missing-file', ok: true });
  });

  it('fails on an IIS HTML 404', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/missing-smoke.js`]: reply(404, { 'content-type': 'text/html' }) });
    const result = await runOne('missing-file', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('text/html');
  });

  it('fails when the SPA shell answers 200 for a missing file', async () => {
    const result = await runOne('missing-file', fullSite({ [`GET ${ORIGIN}/missing-smoke.js`]: SHELL }));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('200');
  });
});

describe('https-redirect', () => {
  it.each([301, 307, 308])('passes on %i to an https location, asked over plain http', async (status) => {
    const site = fullSite({ [`GET http://${HOST}/`]: reply(status, { location: `https://${HOST}/` }) });
    expect(await runOne('https-redirect', site)).toMatchObject({ ok: true });
    expect(site.requests[0]).toMatchObject({ method: 'GET', url: `http://${HOST}/` });
  });

  it('fails on a plain 200 over http', async () => {
    const result = await runOne('https-redirect', fullSite({ [`GET http://${HOST}/`]: SHELL }));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('200');
  });

  it('fails on a 302 (temporary, not one of 301, 307, 308)', async () => {
    const result = await runOne(
      'https-redirect',
      fullSite({ [`GET http://${HOST}/`]: reply(302, { location: `https://${HOST}/` }) }),
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('302');
  });

  it('fails when the location is not https', async () => {
    const result = await runOne(
      'https-redirect',
      fullSite({ [`GET http://${HOST}/`]: reply(301, { location: `http://${HOST}/home` }) }),
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('Location');
  });

  it('fails when there is no location', async () => {
    const result = await runOne('https-redirect', fullSite({ [`GET http://${HOST}/`]: reply(301, {}) }));
    expect(result.ok).toBe(false);
  });

  it('fails when plain http does not answer', async () => {
    const result = await runOne(
      'https-redirect',
      fullSite({ [`GET http://${HOST}/`]: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }) }),
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('ECONNREFUSED');
  });
});

describe('security-headers', () => {
  it('passes with HSTS and a CSP that has script-src self and no unsafe-', async () => {
    expect(await runOne('security-headers', fullSite())).toMatchObject({ ok: true });
  });

  it('fails without Strict-Transport-Security', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/`]: withHeaders(SHELL, { 'strict-transport-security': null }) });
    const result = await runOne('security-headers', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('Strict-Transport-Security');
  });

  it('fails without a CSP', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/`]: withHeaders(SHELL, { 'content-security-policy': null }) });
    const result = await runOne('security-headers', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('Content-Security-Policy');
  });

  it.each(["script-src 'self' 'unsafe-eval'", "script-src 'self'; style-src 'unsafe-inline'"])(
    'fails when the CSP contains unsafe- (%s)',
    async (csp) => {
      const site = fullSite({ [`GET ${ORIGIN}/`]: withHeaders(SHELL, { 'content-security-policy': csp }) });
      const result = await runOne('security-headers', site);
      expect(result.ok).toBe(false);
      expect(result.detail).toContain('unsafe-');
    },
  );

  it("fails when script-src does not allow 'self'", async () => {
    const site = fullSite({
      [`GET ${ORIGIN}/`]: withHeaders(SHELL, {
        'content-security-policy': "default-src 'self'; script-src https://cdn.test",
      }),
    });
    const result = await runOne('security-headers', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('script-src');
  });
});

describe('no-banners', () => {
  it('passes when no response seen carries Server or X-Powered-By', async () => {
    expect(await runOne('no-banners', fullSite())).toMatchObject({ ok: true });
  });

  it('fails on a Server header, naming the header and the request', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/`]: withHeaders(SHELL, { server: 'Microsoft-IIS/10.0' }) });
    const result = await runOne('no-banners', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('Server');
    expect(result.detail).toContain('GET /');
  });

  it('fails on an X-Powered-By header on an earlier response of the same run', async () => {
    const site = fullSite({
      [`GET ${ORIGIN}/api/v1/__smoke-missing`]: withHeaders(problem(404), { 'X-Powered-By': 'ASP.NET' }),
    });
    const clock = fakeClock();
    const results = await runSmoke({
      origin: ORIGIN,
      send: site.send,
      now: clock.now,
      sleep: clock.sleep,
      only: ['unknown-api', 'no-banners'],
    });
    expect(results.map((result) => result.ok)).toEqual([true, false]);
    expect(results[1]?.detail).toContain('X-Powered-By');
    expect(results[1]?.detail).toContain('/api/v1/__smoke-missing');
  });
});

describe('shell-cache', () => {
  it('passes on Cache-Control no-cache', async () => {
    expect(await runOne('shell-cache', fullSite())).toMatchObject({ ok: true });
  });

  it('fails on a cacheable shell', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/`]: withHeaders(SHELL, { 'cache-control': 'public, max-age=3600' }) });
    const result = await runOne('shell-cache', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('max-age=3600');
  });

  it('fails when Cache-Control is missing', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/`]: withHeaders(SHELL, { 'cache-control': null }) });
    expect((await runOne('shell-cache', site)).ok).toBe(false);
  });

  it('fails when the shell is not a 200', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/`]: { ...SHELL, status: 503 } });
    const result = await runOne('shell-cache', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('503');
  });
});

describe('hashed-asset', () => {
  it('passes for the first /assets/*.js in index.html, asked with Accept-Encoding br, gzip', async () => {
    const site = fullSite();
    expect(await runOne('hashed-asset', site)).toMatchObject({ ok: true });
    const asset = site.requests.find((request) => request.url.endsWith('.js'));
    expect(asset?.url).toBe(`${ORIGIN}/assets/index-Ab12Cd.js`);
    expect(asset?.headers?.['Accept-Encoding']).toBe('br, gzip');
  });

  it('passes with gzip', async () => {
    const site = fullSite({
      [`GET ${ORIGIN}/assets/index-Ab12Cd.js`]: withHeaders(ASSET, { 'content-encoding': 'gzip' }),
    });
    expect((await runOne('hashed-asset', site)).ok).toBe(true);
  });

  it('fails when index.html names no /assets/*.js', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/`]: { ...SHELL, body: '<html></html>' } });
    const result = await runOne('hashed-asset', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('/assets/');
  });

  it('fails when the asset is not immutable', async () => {
    const site = fullSite({
      [`GET ${ORIGIN}/assets/index-Ab12Cd.js`]: withHeaders(ASSET, { 'cache-control': 'public, max-age=3600' }),
    });
    const result = await runOne('hashed-asset', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('immutable');
  });

  it('fails when the asset is not compressed', async () => {
    const site = fullSite({
      [`GET ${ORIGIN}/assets/index-Ab12Cd.js`]: withHeaders(ASSET, { 'content-encoding': null }),
    });
    const result = await runOne('hashed-asset', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('Content-Encoding');
  });

  it('fails when the asset is missing', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/assets/index-Ab12Cd.js`]: problem(404) });
    const result = await runOne('hashed-asset', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('404');
  });
});

describe('json-not-compressed', () => {
  it('passes when /health JSON has no Content-Encoding even though br, gzip was offered', async () => {
    const site = fullSite();
    expect(await runOne('json-not-compressed', site)).toMatchObject({ ok: true });
    expect(site.requests[0]?.headers?.['Accept-Encoding']).toBe('br, gzip');
  });

  it('fails when the JSON is compressed (BREACH)', async () => {
    const good = health();
    const site = fullSite({ [`GET ${ORIGIN}/health`]: withHeaders(good, { 'content-encoding': 'gzip' }) });
    const result = await runOne('json-not-compressed', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('gzip');
  });

  it('fails when /health is not a 200 JSON answer (nothing proven)', async () => {
    const site = fullSite({ [`GET ${ORIGIN}/health`]: reply(503, { 'content-type': 'text/html' }) });
    expect((await runOne('json-not-compressed', site)).ok).toBe(false);
  });
});

describe('host-filter', () => {
  it('passes when a request for Host smoke.invalid is refused, sent with the real server name', async () => {
    const site = fullSite();
    expect(await runOne('host-filter', site)).toMatchObject({ ok: true });
    expect(site.requests[0]).toMatchObject({
      method: 'GET',
      url: `${ORIGIN}/`,
      servername: HOST,
      headers: { Host: 'smoke.invalid' },
    });
  });

  it.each([200, 204])('fails when the other Host is answered with %i', async (status) => {
    const site = fullSite({ [`GET ${ORIGIN}/ Host=smoke.invalid`]: { ...SHELL, status } });
    const result = await runOne('host-filter', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain(String(status));
  });

  it('fails when nothing answers, because a refusal was not seen', async () => {
    const site = fullSite({
      [`GET ${ORIGIN}/ Host=smoke.invalid`]: Object.assign(new Error('x'), { code: 'ECONNRESET' }),
    });
    const result = await runOne('host-filter', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('ECONNRESET');
  });
});

describe('request-limit', () => {
  it('passes on a 413 ProblemDetails answer and says the app refused it', async () => {
    const site = fullSite();
    const result = await runOne('request-limit', site);
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('refused by the app');
    const post = site.requests[0];
    expect(post).toMatchObject({ method: 'POST', url: `${ORIGIN}/api/v1/__smoke` });
    expect(post?.body?.length).toBeGreaterThanOrEqual(1_500_000);
  });

  it('passes on a 413 that is not ProblemDetails and says IIS refused it', async () => {
    const site = fullSite({ [`POST ${ORIGIN}/api/v1/__smoke`]: reply(413, { 'content-type': 'text/html' }) });
    const result = await runOne('request-limit', site);
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('refused by IIS');
  });

  it.each([400, 401, 403, 404, 500])(
    'fails on a %i, which any unknown route answers without a body limit',
    async (status) => {
      for (const answer of [problem(status), reply(status, { 'content-type': 'text/html' }, '<html></html>')]) {
        const site = fullSite({ [`POST ${ORIGIN}/api/v1/__smoke`]: answer });
        const result = await runOne('request-limit', site);
        expect(result.ok).toBe(false);
        expect(result.detail).toContain(String(status));
        expect(result.detail).toContain('expected 413');
      }
    },
  );

  it.each([200, 201, 204])('fails on a %i answer', async (status) => {
    const site = fullSite({ [`POST ${ORIGIN}/api/v1/__smoke`]: reply(status, {}) });
    const result = await runOne('request-limit', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain(String(status));
    expect(result.detail).toContain('expected 413');
  });

  it('counts a connection closed while the body is sent as refused by IIS', async () => {
    const site = fullSite({
      [`POST ${ORIGIN}/api/v1/__smoke`]: Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
    });
    const result = await runOne('request-limit', site);
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('refused by IIS');
  });

  it('fails when the host cannot be reached at all', async () => {
    const site = fullSite({
      [`POST ${ORIGIN}/api/v1/__smoke`]: Object.assign(new Error('x'), { code: 'ECONNREFUSED' }),
    });
    const result = await runOne('request-limit', site);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('ECONNREFUSED');
  });
});

describe('readProbe', () => {
  const KEY = 'k7Qp-2xYv9-Lm4Zt-8Rw3-Hn6Jd-5Bc1Fs';
  const FACTS = { runtime: '10.0.7', contentRoot: 'D:\\site', logsWritable: true };
  const probeOk = reply(200, { 'content-type': 'application/json' }, JSON.stringify(FACTS));

  function probeSite(overrides: Record<string, Route> = {}) {
    return fakeSite({
      [`GET ${ORIGIN}/probe`]: probeOk,
      [`GET http://${HOST}/probe`]: reply(301, { location: `https://${HOST}/probe` }),
      ...overrides,
    });
  }

  it('sends the key in X-Probe-Key, passes on 200 JSON and prints the facts', async () => {
    const site = probeSite();
    const result = await readProbe({ origin: ORIGIN, key: KEY, send: site.send });
    expect(result.ok).toBe(true);
    expect(site.requests[0]?.headers?.['X-Probe-Key']).toBe(KEY);
    const text = result.lines.join('\n');
    expect(text).toContain('PASS probe');
    expect(text).toContain('"runtime": "10.0.7"');
  });

  it('prints every certificate attempt in full and hides the key inside a nested message', async () => {
    const attempts = [
      {
        name: 'ephemeral',
        ok: false,
        step: 'load',
        exceptionType: 'CryptographicException',
        hResult: '0x80090016',
        message: `Keyset does not exist ${KEY}`,
        keyCleanup: 'none',
      },
      {
        name: 'machine',
        ok: true,
        step: null,
        exceptionType: null,
        hResult: null,
        message: null,
        keyCleanup: 'removed',
      },
    ];
    const body = JSON.stringify({ ...FACTS, certificateRoundTrips: attempts });
    const site = probeSite({ [`GET ${ORIGIN}/probe`]: reply(200, { 'content-type': 'application/json' }, body) });
    const result = await readProbe({ origin: ORIGIN, key: KEY, send: site.send });
    const text = result.lines.join('\n');
    expect(result.ok).toBe(true);
    expect(text).toContain('"name": "ephemeral"');
    expect(text).toContain('"step": "load"');
    expect(text).toContain('"hResult": "0x80090016"');
    expect(text).toContain('"keyCleanup": "removed"');
    expect(text).not.toContain(KEY);
  });

  it('never prints the key, even when the probe echoes it back', async () => {
    const echoed = reply(200, { 'content-type': 'application/json' }, JSON.stringify({ ...FACTS, echo: KEY }));
    const result = await readProbe({
      origin: ORIGIN,
      key: KEY,
      send: probeSite({ [`GET ${ORIGIN}/probe`]: echoed }).send,
    });
    expect(result.lines.join('\n')).not.toContain(KEY);
  });

  it('reports a 301 from http://host/probe to https as the rewrite being present', async () => {
    const result = await readProbe({ origin: ORIGIN, key: KEY, send: probeSite().send });
    expect(result.lines.join('\n')).toMatch(/http-redirect.*301.*rewrite present/);
  });

  it('reports a rewrite that is not present when http answers something else, and still passes', async () => {
    const site = probeSite({ [`GET http://${HOST}/probe`]: reply(404, {}) });
    const result = await readProbe({ origin: ORIGIN, key: KEY, send: site.send });
    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).toMatch(/http-redirect.*404.*no rewrite/);
  });

  it('reports an http request that gets no answer without failing the probe', async () => {
    const site = probeSite({ [`GET http://${HOST}/probe`]: Object.assign(new Error('x'), { code: 'ECONNREFUSED' }) });
    const result = await readProbe({ origin: ORIGIN, key: KEY, send: site.send });
    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).toContain('ECONNREFUSED');
  });

  it.each([401, 503])('fails on %i without printing the body', async (status) => {
    const site = probeSite({ [`GET ${ORIGIN}/probe`]: reply(status, {}, SECRET_BODY_MARKER) });
    const result = await readProbe({ origin: ORIGIN, key: KEY, send: site.send });
    expect(result.ok).toBe(false);
    expect(result.lines.join('\n')).toContain(String(status));
    expect(result.lines.join('\n')).not.toContain(SECRET_BODY_MARKER);
  });

  it('fails on a 200 that is not JSON', async () => {
    const site = probeSite({
      [`GET ${ORIGIN}/probe`]: reply(200, { 'content-type': 'text/html' }, SECRET_BODY_MARKER),
    });
    const result = await readProbe({ origin: ORIGIN, key: KEY, send: site.send });
    expect(result.ok).toBe(false);
    expect(result.lines.join('\n')).not.toContain(SECRET_BODY_MARKER);
  });

  it('fails when the probe cannot be reached', async () => {
    const site = probeSite({ [`GET ${ORIGIN}/probe`]: new Error('socket hang up') });
    const result = await readProbe({ origin: ORIGIN, key: KEY, send: site.send });
    expect(result.ok).toBe(false);
  });
});

describe('main probe', () => {
  const KEY = 'k7Qp-2xYv9-Lm4Zt-8Rw3-Hn6Jd-5Bc1Fs';

  function probeCli(argv: readonly string[], env: Record<string, string>) {
    const out: string[] = [];
    const err: string[] = [];
    const site = fakeSite({
      [`GET ${ORIGIN}/probe`]: reply(
        200,
        { 'content-type': 'application/json' },
        JSON.stringify({ runtime: '10.0.7' }),
      ),
      [`GET http://${HOST}/probe`]: reply(301, { location: `https://${HOST}/probe` }),
    });
    const clock = fakeClock();
    return {
      site,
      out,
      err,
      run: () =>
        main(argv, env, {
          send: site.send,
          now: clock.now,
          sleep: clock.sleep,
          stdout: (text: string) => out.push(text),
          stderr: (text: string) => err.push(text),
          appendFile: () => undefined,
        }),
    };
  }

  it('exits 0, prints the facts and never the key', async () => {
    const harness = probeCli(['probe', '--origin', ORIGIN], { HOSTPROBE_KEY: KEY });
    expect(await harness.run()).toBe(0);
    expect(harness.out.join('')).toContain('"runtime": "10.0.7"');
    expect(harness.out.join('') + harness.err.join('')).not.toContain(KEY);
  });

  it('exits 2 before any request when HOSTPROBE_KEY is missing or blank', async () => {
    for (const env of [{}, { HOSTPROBE_KEY: '' }]) {
      const harness = probeCli(['probe', '--origin', ORIGIN], env);
      expect(await harness.run()).toBe(2);
      expect(harness.site.requests).toEqual([]);
      expect(harness.err.join('')).toContain('HOSTPROBE_KEY');
    }
  });

  it('exits 2 before any request when the key is under 32 characters, without printing it', async () => {
    const short = 'short-key-0123456789';
    const harness = probeCli(['probe', '--origin', ORIGIN], { HOSTPROBE_KEY: short });
    expect(await harness.run()).toBe(2);
    expect(harness.site.requests).toEqual([]);
    expect(harness.err.join('') + harness.out.join('')).not.toContain(short);
  });

  it('exits 2 for a probe without --origin or with --only', async () => {
    for (const argv of [['probe'], ['probe', '--origin', ORIGIN, '--only', 'health']]) {
      const harness = probeCli(argv, { HOSTPROBE_KEY: KEY });
      expect(await harness.run()).toBe(2);
      expect(harness.site.requests).toEqual([]);
    }
  });

  it('exits 1 when the probe does not answer 200', async () => {
    const harness = probeCli(['probe', '--origin', ORIGIN], { HOSTPROBE_KEY: KEY });
    const failing = fakeSite({ [`GET ${ORIGIN}/probe`]: reply(401, {}) });
    const clock = fakeClock();
    const code = await main(
      ['probe', '--origin', ORIGIN],
      { HOSTPROBE_KEY: KEY },
      {
        send: failing.send,
        now: clock.now,
        sleep: clock.sleep,
        stdout: (text: string) => harness.out.push(text),
        stderr: (text: string) => harness.err.push(text),
        appendFile: () => undefined,
      },
    );
    expect(code).toBe(1);
  });
});
