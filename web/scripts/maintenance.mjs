// @ts-check
// `node web/scripts/maintenance.mjs` (JOB-01, D-21, D-22, D-36): the monthly maintenance call that maintenance.yml runs.
// It posts to the site with the secret key, repeats while the answer says there is more, writes the counts to the run
// summary and exits 1 when anything failed, so the GitHub run turns red and GitHub emails the owner. The repository and
// its run logs are public, so only cleaned labels, numbers and fixed sentences are printed: never the key, the raw answer
// or an error body. Node built-ins only, because maintenance.yml runs this without `npm ci`.
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ label: string, value: number | null, failed: boolean, text: string | null }} Line
 * @typedef {{ env: Record<string, string | undefined>, fetch: (url: string, init: RequestInit) => Promise<Response>,
 *   sleep: (ms: number) => Promise<void>, appendSummary: (text: string) => void, log: (text: string) => void }} Deps
 * @typedef {{ ok: boolean, more: boolean, lines: Line[] }} Answer
 * @typedef {{ answer: Answer } | { busy: true } | { failure: string }} Attempt
 */

const ENDPOINT_PATH = '/api/v1/maintenance/run';
const KEY_HEADER = 'X-Maintenance-Key';
/** One call may run up to its 90 second budget on the server, so each call gets a little more than that. */
const CALL_TIMEOUT_MS = 120_000;
const MAX_CALLS = 10;
const CONFLICT_RETRIES = 4;
const CONFLICT_WAIT_MS = 60_000;
const TEXT_LIMIT = 120;

const FINISHED = 'All maintenance jobs finished.';
const FAILED = 'Some maintenance jobs failed. See the lines above.';
const BAD_ORIGIN = 'SITE_ORIGIN must be an https address with no path, such as https://example.test.';
const BAD_KEY = 'MAINTENANCE_KEY is not set correctly.';
const KEY_REFUSED = 'The maintenance key was refused.';
const BUSY = `Another maintenance run was still going after ${String(CONFLICT_RETRIES + 1)} tries.`;
const TOO_MANY = 'The site refused the call because there were too many calls (HTTP 429). Wait and run it again.';
const UNREACHABLE = 'The site could not be reached.';
const UNREADABLE = 'The site gave an answer this script could not read.';
const UNEXPECTED = 'The maintenance script stopped unexpectedly.';
const NOT_FINISHED = `Stopped after ${String(MAX_CALLS)} calls with work still left. Run it again.`;

/**
 * One printable line of at most TEXT_LIMIT characters: control and line-break characters become spaces, runs of spaces
 * shrink to one, and the ends are trimmed.
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  const spaced = String(value)
    .replaceAll(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return Array.from(spaced).slice(0, TEXT_LIMIT).join('').trimEnd();
}

/**
 * The run summary: one `- label: value or text` line per answer line, a plain `- sentence` for each note the script
 * adds, then the closing sentence.
 * @param {readonly (Line | string)[]} lines
 * @param {boolean} ok
 * @returns {string}
 */
export function formatSummary(lines, ok) {
  const bullets = lines.map((line) => {
    if (typeof line === 'string') {
      return `- ${cleanText(line)}`;
    }
    const tail = line.value === null ? cleanText(line.text ?? '') : String(line.value);
    return `- ${cleanText(line.label)}: ${tail}`.trimEnd();
  });
  return ['## Maintenance run', '', ...bullets, '', ok ? FINISHED : FAILED, ''].join('\n');
}

/**
 * The site origin when it is an https address with no path, query or sign-in details; otherwise null.
 * @param {string | undefined} raw
 * @returns {string | null}
 */
function parseOrigin(raw) {
  let url;
  try {
    url = new URL((raw ?? '').trim());
  } catch {
    return null;
  }
  const plain = url.protocol === 'https:' && url.pathname === '/' && url.search === '' && url.hash === '';
  return plain && url.username === '' && url.password === '' ? url.origin : null;
}

/**
 * @param {unknown} body
 * @returns {Answer | null} the answer when it has the endpoint's shape, else null.
 */
function parseAnswer(body) {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const { ok, more, lines } = /** @type {Record<string, unknown>} */ (body);
  if (typeof ok !== 'boolean' || typeof more !== 'boolean' || !Array.isArray(lines)) {
    return null;
  }
  /** @type {Line[]} */
  const parsed = [];
  for (const entry of /** @type {unknown[]} */ (lines)) {
    if (typeof entry !== 'object' || entry === null) {
      return null;
    }
    const { label, value, failed, text } = /** @type {Record<string, unknown>} */ (entry);
    if (typeof label !== 'string' || cleanText(label) === '') {
      return null;
    }
    parsed.push({
      label,
      value: typeof value === 'number' && Number.isFinite(value) ? value : null,
      failed: failed === true,
      text: typeof text === 'string' ? text : null,
    });
  }
  return { ok, more, lines: parsed };
}

/**
 * @param {Response} response
 * @returns {Promise<void>}
 */
async function discard(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The body is never read, so a failed cancel changes nothing.
  }
}

/**
 * One keyed POST. Redirects are refused so the key can never travel to another host, and every failure becomes a fixed
 * sentence that holds no part of the error or the answer.
 * @param {Deps['fetch']} fetch
 * @param {string} url
 * @param {string} key
 * @returns {Promise<Attempt>}
 */
async function post(fetch, url, key) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { [KEY_HEADER]: key, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch {
    return { failure: UNREACHABLE };
  }
  const { status } = response;
  if (status === 200) {
    try {
      const answer = parseAnswer(JSON.parse(await response.text()));
      return answer === null ? { failure: UNREADABLE } : { answer };
    } catch {
      return { failure: UNREADABLE };
    }
  }
  await discard(response);
  if (status === 409) {
    return { busy: true };
  }
  if (status === 401) {
    return { failure: KEY_REFUSED };
  }
  if (status === 429) {
    return { failure: TOO_MANY };
  }
  return { failure: `The site answered with an error (HTTP ${String(status)}).` };
}

/**
 * One call, repeated after a 409 (another run is going) up to CONFLICT_RETRIES times with a wait between the tries.
 * @param {Deps} deps
 * @param {string} url
 * @param {string} key
 * @returns {Promise<{ answer: Answer } | { failure: string }>}
 */
async function callWithRetry({ fetch, sleep, log }, url, key) {
  for (let retry = 0; retry <= CONFLICT_RETRIES; retry += 1) {
    const attempt = await post(fetch, url, key);
    if (!('busy' in attempt)) {
      return attempt;
    }
    if (retry < CONFLICT_RETRIES) {
      log(`Another maintenance run is going. Waiting ${String(CONFLICT_WAIT_MS / 1000)} seconds.`);
      await sleep(CONFLICT_WAIT_MS);
    }
  }
  return { failure: BUSY };
}

/**
 * Calls the site until it has nothing more to do, then writes the summary.
 * @param {Deps} deps
 * @returns {Promise<number>} the exit code: 0 when every job finished, otherwise 1. It never throws.
 */
export async function runMaintenance(deps) {
  /** @type {(Line | string)[]} */
  const entries = [];
  let ok = true;

  /** @returns {number} */
  const finish = () => {
    const text = formatSummary(entries, ok);
    deps.appendSummary(text);
    deps.log(text.trimEnd());
    return ok ? 0 : 1;
  };

  try {
    const origin = parseOrigin(deps.env.SITE_ORIGIN);
    const key = (deps.env.MAINTENANCE_KEY ?? '').trim();
    if (origin === null || !/^[\x21-\x7e]+$/.test(key)) {
      ok = false;
      entries.push(origin === null ? BAD_ORIGIN : BAD_KEY);
      return finish();
    }

    let more = true;
    for (let calls = 0; more && calls < MAX_CALLS; calls += 1) {
      const result = await callWithRetry(deps, `${origin}${ENDPOINT_PATH}`, key);
      if ('failure' in result) {
        ok = false;
        entries.push(result.failure);
        return finish();
      }
      entries.push(...result.answer.lines);
      ok = ok && result.answer.ok && !result.answer.lines.some((line) => line.failed);
      ({ more } = result.answer);
    }
    if (more) {
      ok = false;
      entries.push(NOT_FINISHED);
    }
    return finish();
  } catch {
    ok = false;
    try {
      entries.push(UNEXPECTED);
      return finish();
    } catch {
      return 1;
    }
  }
}

/** @returns {Deps} */
function defaultDeps() {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  return {
    env: process.env,
    fetch: (url, init) => fetch(url, init),
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
    appendSummary: (text) => {
      if (summaryFile !== undefined && summaryFile !== '') {
        appendFileSync(summaryFile, text);
      }
    },
    log: (text) => {
      process.stdout.write(`${text}\n`);
    },
  };
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runMaintenance(defaultDeps());
}
