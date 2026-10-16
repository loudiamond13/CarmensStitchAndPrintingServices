// @ts-check
// `node web/scripts/smoke.mjs --origin <https url> [--only <names>] [--insecure-tls]` (OPS-04, OPS-05, D-06, D-13):
// the read-only production smoke test that decides whether a deploy is kept. One plain line per check; exit 0 when every
// check passes, 1 when any fails, 2 for bad usage. Response bodies are never printed, only the statuses and header
// values a check needs (T-03-33). Node built-ins only, because the deploy runner runs it without `npm ci`.
//
// Requests go through an injected `send`, whose default is built on node:https / node:http. It never follows redirects
// (a followed redirect would let the HTTPS check pass vacuously) and can set the TLS server name separately from the
// Host header (the host-filter check needs that).
import { appendFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ method: string, url: string, headers?: Record<string, string>, body?: string, servername?: string, insecureTls?: boolean }} SmokeRequest
 * @typedef {{ status: number, headers: Record<string, string>, body: string }} SmokeResponse
 * @typedef {(request: SmokeRequest) => Promise<SmokeResponse>} Send
 * @typedef {{ name: string, ok: boolean, detail: string }} CheckResult
 * @typedef {{ ok: boolean, detail: string }} Verdict
 * @typedef {{ origin: URL, send: Send, now: () => number, sleep: (ms: number) => Promise<void>, insecureTls: boolean, seen: { label: string, response: SmokeResponse }[] }} Context
 * @typedef {{ readonly name: string, readonly run: (ctx: Context) => Promise<Verdict> }} Check
 * @typedef {{ origin: string, send?: Send, now?: () => number, sleep?: (ms: number) => Promise<void>, only?: readonly string[], insecureTls?: boolean }} SmokeOptions
 * @typedef {{ send: Send, now: () => number, sleep: (ms: number) => Promise<void>, stdout: (text: string) => void, stderr: (text: string) => void, appendFile: (file: string, text: string) => void }} MainDeps
 */

/** The health check is retried for about this long after a cold start (research Pitfall 8). */
export const HEALTH_DEADLINE_MS = 90_000;
/** Waits between health attempts; the last value repeats. */
export const HEALTH_BACKOFF_MS = Object.freeze([2000, 4000, 8000, 15_000]);
const REQUEST_TIMEOUT_MS = 20_000;
const HEALTH_CHECKS = Object.freeze(['self', 'database', 'time-zone']);

/** @type {(ms: number) => Promise<void>} */
const realSleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * The default `send`: one request over node:https or node:http, no redirect following, no decompression. `servername`
 * sets the TLS SNI independently of the Host header; `insecureTls` accepts the local development certificate.
 * @type {Send}
 */
export function defaultSend({ method, url, headers = {}, body, servername, insecureTls = false }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const secure = target.protocol === 'https:';
    const payload = body === undefined ? undefined : Buffer.from(body, 'utf8');
    /** @type {https.RequestOptions} */
    const options = {
      method,
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: payload === undefined ? headers : { ...headers, 'Content-Length': String(payload.length) },
      timeout: REQUEST_TIMEOUT_MS,
    };
    if (target.port !== '') {
      options.port = Number(target.port);
    }
    if (secure) {
      options.servername = servername ?? target.hostname;
      options.rejectUnauthorized = !insecureTls;
    }
    const request = (secure ? https : http).request(options, (response) => {
      /** @type {Buffer[]} */
      const chunks = [];
      response.on('data', (/** @type {Buffer} */ chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        /** @type {Record<string, string>} */
        const flat = {};
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) {
            flat[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
          }
        }
        resolve({ status: response.statusCode ?? 0, headers: flat, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('timed out'));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

/**
 * One request to the site under test, with header names lower-cased so a check reads them in any letter case. Unless
 * `record` is false, the response is kept in `ctx.seen` for the no-banners check. `scheme` http asks the same host on
 * the default http port.
 * @param {Context} ctx
 * @param {{ path: string, method?: string, scheme?: 'https' | 'http', headers?: Record<string, string>, body?: string, servername?: string, record?: boolean }} spec
 * @returns {Promise<SmokeResponse>}
 */
async function call(
  ctx,
  { path: requestPath, method = 'GET', scheme = 'https', headers, body, servername, record = true },
) {
  const base = scheme === 'https' ? ctx.origin.origin : `http://${ctx.origin.hostname}`;
  /** @type {SmokeRequest} */
  const request = { method, url: `${base}${requestPath}` };
  if (headers !== undefined) {
    request.headers = headers;
  }
  if (body !== undefined) {
    request.body = body;
  }
  if (servername !== undefined) {
    request.servername = servername;
  }
  if (ctx.insecureTls) {
    request.insecureTls = true;
  }
  const response = await ctx.send(request);
  /** @type {Record<string, string>} */
  const lowered = {};
  for (const [name, value] of Object.entries(response.headers)) {
    lowered[name.toLowerCase()] = value;
  }
  const answer = { status: response.status, headers: lowered, body: response.body };
  if (record) {
    ctx.seen.push({ label: `${method} ${scheme === 'https' ? '' : base}${requestPath}`, response: answer });
  }
  return answer;
}

/**
 * @param {unknown} error
 * @returns {string} a short, body-free description of a failed request.
 */
function describeError(error) {
  if (error instanceof Error) {
    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    return typeof code === 'string' ? code : error.message;
  }
  return 'unknown error';
}

/**
 * @param {SmokeResponse} response
 * @returns {string} the media type of Content-Type, lower-cased, or '' when absent.
 */
function mediaType(response) {
  return (response.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

/**
 * @param {string | undefined} value a comma-separated header value
 * @returns {string[]} lower-cased, trimmed members.
 */
function tokens(value) {
  return (value ?? '')
    .toLowerCase()
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '');
}

/**
 * @param {string} text
 * @returns {unknown} the parsed JSON, or undefined when the text is not JSON.
 */
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What is wrong with a response that must be a ProblemDetails with this status, as short phrases (empty when right).
 * An IIS HTML page or the SPA shell fails here, which is the point.
 * @param {SmokeResponse} response
 * @param {number} status
 * @returns {string[]}
 */
function problemFaults(response, status) {
  /** @type {string[]} */
  const faults = [];
  if (response.status !== status) {
    faults.push(`status ${String(response.status)}, expected ${String(status)}`);
  }
  if (mediaType(response) !== 'application/problem+json') {
    faults.push(`content-type ${mediaType(response) || 'missing'}, expected application/problem+json`);
  }
  return faults;
}

/**
 * @param {string[]} faults
 * @param {string} passed
 * @returns {Verdict}
 */
function verdictOf(faults, passed) {
  return faults.length === 0 ? { ok: true, detail: passed } : { ok: false, detail: faults.join('; ') };
}

/**
 * One health attempt: 200, JSON, no-store, status Healthy, and the self, database and time-zone checks Healthy.
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function healthAttempt(ctx) {
  /** @type {SmokeResponse} */
  let response;
  try {
    response = await call(ctx, { path: '/health' });
  } catch (error) {
    return { ok: false, detail: `no answer (${describeError(error)})` };
  }
  /** @type {string[]} */
  const faults = [];
  if (response.status !== 200) {
    faults.push(`status ${String(response.status)}, expected 200`);
  }
  if (mediaType(response) !== 'application/json') {
    faults.push(`content-type ${mediaType(response) || 'missing'}, expected application/json`);
  }
  if (!tokens(response.headers['cache-control']).includes('no-store')) {
    faults.push(`Cache-Control ${response.headers['cache-control'] ?? 'missing'}, expected no-store`);
  }
  if (faults.length === 0) {
    const body = parseJson(response.body);
    if (!isRecord(body)) {
      faults.push('body is not JSON');
    } else {
      if (body.status !== 'Healthy') {
        faults.push('status is not Healthy');
      }
      const entries = Array.isArray(body.checks) ? body.checks : [];
      const notHealthy = HEALTH_CHECKS.filter(
        (name) => !entries.some((entry) => isRecord(entry) && entry.name === name && entry.status === 'Healthy'),
      );
      if (notHealthy.length > 0) {
        faults.push(`checks not Healthy: ${notHealthy.join(', ')}`);
      }
    }
  }
  return verdictOf(faults, `200 Healthy (${HEALTH_CHECKS.join(', ')})`);
}

/**
 * /health, retried with backoff until HEALTH_DEADLINE_MS after the first attempt, because the first request after a
 * deploy starts the app (Data Protection keys, EF model).
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkHealth(ctx) {
  const started = ctx.now();
  for (let attempt = 0; ; attempt += 1) {
    const verdict = await healthAttempt(ctx);
    if (verdict.ok) {
      return verdict;
    }
    const wait = HEALTH_BACKOFF_MS[Math.min(attempt, HEALTH_BACKOFF_MS.length - 1)] ?? 15_000;
    if (ctx.now() + wait - started > HEALTH_DEADLINE_MS) {
      const seconds = Math.round((ctx.now() - started) / 1000);
      return {
        ok: false,
        detail: `${verdict.detail} (still failing after ${String(seconds)} s, ${String(attempt + 1)} attempts)`,
      };
    }
    await ctx.sleep(wait);
  }
}

/**
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkUnknownApi(ctx) {
  const response = await call(ctx, { path: '/api/v1/__smoke-missing' });
  const faults = problemFaults(response, 404);
  if (faults.length === 0) {
    const body = parseJson(response.body);
    if (!isRecord(body) || typeof body.traceId !== 'string' || body.traceId === '') {
      faults.push('ProblemDetails has no traceId');
    }
  }
  return verdictOf(faults, '404 ProblemDetails with a traceId');
}

/**
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkDefaultDeny(ctx) {
  const response = await call(ctx, { path: '/api/v1/site-settings' });
  return verdictOf(problemFaults(response, 401), 'anonymous request answered 401 ProblemDetails');
}

/**
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkMissingFile(ctx) {
  const response = await call(ctx, { path: '/missing-smoke.js' });
  return verdictOf(problemFaults(response, 404), 'a missing static file answered 404 ProblemDetails');
}

/**
 * Plain http must answer a permanent or method-preserving redirect to https. The redirect is never followed.
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkHttpsRedirect(ctx) {
  let response;
  try {
    response = await call(ctx, { path: '/', scheme: 'http' });
  } catch (error) {
    return { ok: false, detail: `plain http did not answer (${describeError(error)})` };
  }
  /** @type {string[]} */
  const faults = [];
  if (![301, 307, 308].includes(response.status)) {
    faults.push(`http answered ${String(response.status)}, expected 301, 307 or 308`);
  } else if (!(response.headers.location ?? '').startsWith('https://')) {
    faults.push(`Location ${response.headers.location ?? 'missing'}, expected an https:// address`);
  }
  return verdictOf(faults, `http answered ${String(response.status)} to https`);
}

/**
 * HSTS is present and the CSP keeps script-src to 'self' with no unsafe- source anywhere (OPS-05).
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkSecurityHeaders(ctx) {
  const response = await call(ctx, { path: '/' });
  /** @type {string[]} */
  const faults = [];
  if (response.headers['strict-transport-security'] === undefined) {
    faults.push('Strict-Transport-Security missing');
  }
  const csp = response.headers['content-security-policy'];
  if (csp === undefined) {
    faults.push('Content-Security-Policy missing');
  } else {
    const script = csp
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .find((parts) => parts[0] === 'script-src');
    if (script === undefined) {
      faults.push('CSP has no script-src');
    } else if (!script.includes("'self'")) {
      faults.push("CSP script-src does not allow 'self'");
    }
    if (csp.toLowerCase().includes('unsafe-')) {
      faults.push('CSP contains unsafe-');
    }
  }
  return verdictOf(faults, "HSTS present, CSP script-src 'self' with no unsafe-");
}

/**
 * No response seen in this run names the server software. When no other check has run, it asks for the shell itself.
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkNoBanners(ctx) {
  if (ctx.seen.length === 0) {
    await call(ctx, { path: '/' });
  }
  const banners = new Set();
  for (const { label, response } of ctx.seen) {
    for (const [name, title] of /** @type {const} */ ([
      ['server', 'Server'],
      ['x-powered-by', 'X-Powered-By'],
    ])) {
      const value = response.headers[name];
      if (value !== undefined) {
        banners.add(`${title} (${value}) on ${label}`);
      }
    }
  }
  return banners.size === 0
    ? { ok: true, detail: `no Server or X-Powered-By on ${String(ctx.seen.length)} responses` }
    : { ok: false, detail: [...banners].join('; ') };
}

/**
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkShellCache(ctx) {
  const response = await call(ctx, { path: '/' });
  /** @type {string[]} */
  const faults = [];
  if (response.status !== 200) {
    faults.push(`status ${String(response.status)}, expected 200`);
  }
  if (!tokens(response.headers['cache-control']).includes('no-cache')) {
    faults.push(`Cache-Control ${response.headers['cache-control'] ?? 'missing'}, expected no-cache`);
  }
  return verdictOf(faults, 'index.html is Cache-Control no-cache');
}

/** The first /assets/*.js named in index.html, in document order. */
const ASSET_PATTERN = /\/assets\/[^"'\s<>?#]+\.js/;

/**
 * The first hashed script in index.html is immutable for a year and compressed with br or gzip.
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkHashedAsset(ctx) {
  const shell = await call(ctx, { path: '/', headers: { 'Accept-Encoding': 'identity' } });
  const assetPath = ASSET_PATTERN.exec(shell.body)?.[0];
  if (shell.status !== 200 || assetPath === undefined) {
    return {
      ok: false,
      detail:
        shell.status === 200
          ? 'index.html names no /assets/*.js file'
          : `index.html status ${String(shell.status)}, expected 200`,
    };
  }
  const asset = await call(ctx, { path: assetPath, headers: { 'Accept-Encoding': 'br, gzip' } });
  /** @type {string[]} */
  const faults = [];
  if (asset.status !== 200) {
    faults.push(`status ${String(asset.status)}, expected 200`);
  }
  const cache = tokens(asset.headers['cache-control']);
  if (!['public', 'max-age=31536000', 'immutable'].every((token) => cache.includes(token))) {
    faults.push(
      `Cache-Control ${asset.headers['cache-control'] ?? 'missing'}, expected public, max-age=31536000, immutable`,
    );
  }
  const encoding = asset.headers['content-encoding'];
  if (encoding !== 'br' && encoding !== 'gzip') {
    faults.push(`Content-Encoding ${encoding ?? 'missing'}, expected br or gzip`);
  }
  return verdictOf(faults, `${assetPath} is immutable and ${String(encoding)} compressed`);
}

/**
 * JSON is never compressed (BREACH): /health answers without Content-Encoding even when br and gzip are offered.
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkJsonNotCompressed(ctx) {
  const response = await call(ctx, { path: '/health', headers: { 'Accept-Encoding': 'br, gzip' } });
  /** @type {string[]} */
  const faults = [];
  if (response.status !== 200 || mediaType(response) !== 'application/json') {
    faults.push(
      `/health answered ${String(response.status)} ${mediaType(response) || 'without a content-type'}, nothing proven`,
    );
  }
  const encoding = response.headers['content-encoding'];
  if (encoding !== undefined) {
    faults.push(`JSON carries Content-Encoding ${encoding} (BREACH)`);
  }
  return verdictOf(faults, '/health JSON has no Content-Encoding');
}

/** A host name no deployment answers to; AllowedHosts must refuse it. */
const FOREIGN_HOST = 'smoke.invalid';

/**
 * A request for another Host header, with the real TLS server name, is refused (AllowedHosts or IIS). Its response is
 * not recorded for no-banners, because a refusal may come from HTTP.sys with its own Server header.
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkHostFilter(ctx) {
  let response;
  try {
    response = await call(ctx, {
      path: '/',
      headers: { Host: FOREIGN_HOST },
      servername: ctx.origin.hostname,
      record: false,
    });
  } catch (error) {
    return { ok: false, detail: `no answer (${describeError(error)}), so no refusal was seen` };
  }
  return response.status >= 200 && response.status < 300
    ? { ok: false, detail: `Host ${FOREIGN_HOST} was answered ${String(response.status)}, expected a refusal` }
    : { ok: true, detail: `Host ${FOREIGN_HOST} was refused with ${String(response.status)}` };
}

/** Bytes in the oversized request; above the request limit the host sets in web.config. */
const OVERSIZED_BODY_BYTES = 1_500_000;
/** Errors that mean the host closed the connection while the body was still being sent. */
const CLOSED_WHILE_SENDING = new Set(['ECONNRESET', 'EPIPE', 'ECONNABORTED']);

/**
 * A 1.5 MB POST is never accepted. A ProblemDetails answer means the app refused it; any other answer (or a closed
 * connection) means IIS refused it before the app saw it.
 * @param {Context} ctx
 * @returns {Promise<Verdict>}
 */
async function checkRequestLimit(ctx) {
  let response;
  try {
    response = await call(ctx, {
      path: '/api/v1/__smoke',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'x'.repeat(OVERSIZED_BODY_BYTES),
      record: false,
    });
  } catch (error) {
    const reason = describeError(error);
    return CLOSED_WHILE_SENDING.has(reason)
      ? { ok: true, detail: `refused by IIS (connection closed while the body was sent: ${reason})` }
      : { ok: false, detail: `no answer (${reason}), so no refusal was seen` };
  }
  if (response.status >= 200 && response.status < 300) {
    return { ok: false, detail: `a 1.5 MB POST was answered ${String(response.status)}, expected a refusal` };
  }
  const layer = mediaType(response) === 'application/problem+json' ? 'the app' : 'IIS';
  return { ok: true, detail: `refused by ${layer} with ${String(response.status)}` };
}

/** The smoke checks in the order they run. */
export const CHECKS = Object.freeze(
  /** @type {readonly Check[]} */ ([
    { name: 'health', run: checkHealth },
    { name: 'unknown-api', run: checkUnknownApi },
    { name: 'default-deny', run: checkDefaultDeny },
    { name: 'missing-file', run: checkMissingFile },
    { name: 'https-redirect', run: checkHttpsRedirect },
    { name: 'security-headers', run: checkSecurityHeaders },
    { name: 'no-banners', run: checkNoBanners },
    { name: 'shell-cache', run: checkShellCache },
    { name: 'hashed-asset', run: checkHashedAsset },
    { name: 'json-not-compressed', run: checkJsonNotCompressed },
    { name: 'host-filter', run: checkHostFilter },
    { name: 'request-limit', run: checkRequestLimit },
  ]),
);

/**
 * The verdict for a set of results: every check ok (and at least one ran), plus one plain line per check.
 * @param {readonly CheckResult[]} results
 * @returns {{ ok: boolean, lines: string[] }}
 */
export function evaluate(results) {
  return {
    ok: results.length > 0 && results.every((result) => result.ok),
    lines: results.map((result) => `${result.ok ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`),
  };
}

/**
 * Runs the checks (all of CHECKS, or the ones named in `only`) in CHECKS order. A check that throws fails with a
 * short description; the run goes on.
 * @param {SmokeOptions} options
 * @returns {Promise<CheckResult[]>}
 */
export async function runSmoke({
  origin,
  send = defaultSend,
  now = Date.now,
  sleep = realSleep,
  only,
  insecureTls = false,
}) {
  /** @type {Context} */
  const ctx = { origin: new URL(origin), send, now, sleep, insecureTls, seen: [] };
  /** @type {CheckResult[]} */
  const results = [];
  for (const check of CHECKS) {
    if (only !== undefined && !only.includes(check.name)) {
      continue;
    }
    try {
      results.push({ name: check.name, ...(await check.run(ctx)) });
    } catch (error) {
      results.push({ name: check.name, ok: false, detail: describeError(error) });
    }
  }
  return results;
}

/** The shortest HOSTPROBE_KEY the HostProbe accepts (tools/Csps.HostProbe ProbeKey.MinimumLength). */
export const PROBE_KEY_MIN_LENGTH = 32;

/**
 * Reads the one-time HostProbe: GET /probe with the key in X-Probe-Key, then reports whether plain http /probe is
 * redirected to https (the rewrite rule). The key is sent over https only and is removed from every line returned.
 * The probe's JSON facts are the only body content printed.
 * @param {{ origin: string, key: string, send?: Send, insecureTls?: boolean }} options
 * @returns {Promise<{ ok: boolean, lines: string[] }>}
 */
export async function readProbe({ origin, key, send = defaultSend, insecureTls = false }) {
  /** @type {Context} */
  const ctx = { origin: new URL(origin), send, now: Date.now, sleep: realSleep, insecureTls, seen: [] };
  /** @type {string[]} */
  const lines = [];
  let ok = false;
  try {
    const response = await call(ctx, { path: '/probe', headers: { 'X-Probe-Key': key } });
    const facts =
      response.status === 200 && mediaType(response) === 'application/json' ? parseJson(response.body) : undefined;
    if (response.status !== 200) {
      lines.push(`FAIL probe: status ${String(response.status)}, expected 200`);
    } else if (facts === undefined) {
      lines.push(`FAIL probe: content-type ${mediaType(response) || 'missing'}, expected a JSON body`);
    } else {
      ok = true;
      lines.push(
        'PASS probe: 200 JSON',
        'probe facts:',
        ...JSON.stringify(facts, null, 2)
          .split('\n')
          .map((line) => `  ${line}`),
      );
    }
  } catch (error) {
    lines.push(`FAIL probe: no answer (${describeError(error)})`);
  }
  const target = `http://${ctx.origin.hostname}/probe`;
  try {
    // Plain http carries no key.
    const response = await call(ctx, { path: '/probe', scheme: 'http', record: false });
    const redirected =
      [301, 307, 308].includes(response.status) && (response.headers.location ?? '').startsWith('https://');
    lines.push(
      redirected
        ? `INFO http-redirect: ${target} answered ${String(response.status)} to https (rewrite present)`
        : `INFO http-redirect: ${target} answered ${String(response.status)} (no rewrite)`,
    );
  } catch (error) {
    lines.push(`INFO http-redirect: ${target} got no answer (${describeError(error)})`);
  }
  return { ok, lines: key === '' ? lines : lines.map((line) => line.replaceAll(key, '[hidden]')) };
}

/**
 * @typedef {{ command: 'smoke' | 'probe', origin: URL, only: string[] | undefined, insecureTls: boolean }} Parsed
 * @param {readonly string[]} args every argument after the script name
 * @returns {{ error: string } | Parsed}
 */
function parseArguments(args) {
  const command = args[0] === 'probe' ? 'probe' : 'smoke';
  const argv = command === 'probe' ? args.slice(1) : args;
  /** @type {string | undefined} */
  let originText;
  /** @type {string[] | undefined} */
  let only;
  let insecureTls = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--origin' || argument === '--only') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        return { error: `${argument} needs a value.` };
      }
      index += 1;
      if (argument === '--origin') {
        originText = value;
      } else {
        only = value.split(',').map((name) => name.trim());
      }
    } else if (argument === '--insecure-tls') {
      insecureTls = true;
    } else {
      return {
        error: `Unknown argument ${String(argument)}. Use --origin <https url> [--only <names>] [--insecure-tls].`,
      };
    }
  }
  if (originText === undefined) {
    return { error: 'Give the site with --origin <https url>.' };
  }
  /** @type {URL} */
  let origin;
  try {
    origin = new URL(originText);
  } catch {
    return { error: '--origin must be a full https URL such as https://example.com.' };
  }
  if (origin.protocol !== 'https:') {
    return { error: '--origin must be an https URL.' };
  }
  if (insecureTls && origin.hostname !== 'localhost') {
    return { error: '--insecure-tls is allowed only when the origin host is localhost.' };
  }
  if (command === 'probe' && only !== undefined) {
    return { error: '--only does not apply to probe.' };
  }
  if (only !== undefined) {
    const known = CHECKS.map((check) => check.name);
    const unknown = only.filter((name) => !known.includes(name));
    if (unknown.length > 0) {
      return { error: `Unknown check name: ${unknown.join(', ')}. Known checks: ${known.join(', ')}.` };
    }
  }
  return { command, origin, only, insecureTls };
}

/**
 * @param {string} text
 * @returns {string} text safe inside a Markdown table cell.
 */
function tableCell(text) {
  return text.replaceAll('|', '\\|').replaceAll(/\s+/g, ' ');
}

/**
 * @param {string} host
 * @param {readonly CheckResult[]} results
 * @returns {string}
 */
function stepSummary(host, results) {
  const rows = results.map(
    (result) => `| ${result.name} | ${result.ok ? 'pass' : 'FAIL'} | ${tableCell(result.detail)} |`,
  );
  return [`### Smoke test: ${host}`, '', '| Check | Result | Detail |', '| --- | --- | --- |', ...rows, '', ''].join(
    '\n',
  );
}

/**
 * The probe subcommand: checks HOSTPROBE_KEY before any request, then prints the probe's facts.
 * @param {Parsed} parsed
 * @param {Readonly<Record<string, string | undefined>>} env
 * @param {{ send: Send, stdout: (text: string) => void, stderr: (text: string) => void }} io
 * @returns {Promise<number>}
 */
async function runProbe(parsed, env, { send, stdout, stderr }) {
  const key = env.HOSTPROBE_KEY ?? '';
  if (key === '') {
    stderr('smoke: set HOSTPROBE_KEY to the probe key (it is read from the environment and never printed).\n');
    return 2;
  }
  if (key.length < PROBE_KEY_MIN_LENGTH) {
    stderr(`smoke: HOSTPROBE_KEY must be at least ${String(PROBE_KEY_MIN_LENGTH)} characters.\n`);
    return 2;
  }
  const result = await readProbe({ origin: parsed.origin.origin, key, send, insecureTls: parsed.insecureTls });
  for (const line of result.lines) {
    stdout(`${line}\n`);
  }
  return result.ok ? 0 : 1;
}

/**
 * @param {readonly string[]} argv the arguments after the script name.
 * @param {Readonly<Record<string, string | undefined>>} env
 * @param {Partial<MainDeps>} [deps]
 * @returns {Promise<number>} the exit code: 0 pass, 1 fail, 2 usage.
 */
export async function main(argv, env, deps = {}) {
  const {
    send = defaultSend,
    now = Date.now,
    sleep = realSleep,
    stdout = (/** @type {string} */ text) => process.stdout.write(text),
    stderr = (/** @type {string} */ text) => process.stderr.write(text),
    appendFile = appendFileSync,
  } = deps;
  const parsed = parseArguments(argv);
  if ('error' in parsed) {
    stderr(`smoke: ${parsed.error}\n`);
    return 2;
  }
  if (parsed.command === 'probe') {
    return runProbe(parsed, env, { send, stdout, stderr });
  }
  const results = await runSmoke({
    origin: parsed.origin.origin,
    send,
    now,
    sleep,
    ...(parsed.only === undefined ? {} : { only: parsed.only }),
    insecureTls: parsed.insecureTls,
  });
  const verdict = evaluate(results);
  for (const line of verdict.lines) {
    stdout(`${line}\n`);
  }
  const failed = results.filter((result) => !result.ok).length;
  stdout(
    verdict.ok
      ? `smoke: ${String(results.length)} of ${String(results.length)} checks passed\n`
      : `smoke: ${String(failed)} of ${String(results.length)} checks FAILED\n`,
  );
  const summaryFile = env.GITHUB_STEP_SUMMARY;
  if (summaryFile !== undefined && summaryFile !== '') {
    try {
      appendFile(summaryFile, stepSummary(parsed.origin.host, results));
    } catch (error) {
      stderr(`smoke: could not write the step summary (${describeError(error)}).\n`);
    }
  }
  return verdict.ok ? 0 : 1;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env);
}
