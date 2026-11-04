// @ts-check
// `node web/scripts/maintenance.mjs` (JOB-01, D-21, D-22, D-36): the monthly maintenance call that maintenance.yml runs.
// It posts to the site with the secret key, writes the counts to the run summary and exits 1 when anything failed, so the
// GitHub run turns red and GitHub emails the owner. The repository and its run logs are public, so only fixed labels and
// numbers are printed: never the key, the raw answer or an error body. Node built-ins only (no `npm ci` on the runner).
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ label: string, value: number | null, failed: boolean, text: string | null }} Line
 * @typedef {{ env: Record<string, string | undefined>, fetch: (url: string, init: RequestInit) => Promise<Response>,
 *   sleep: (ms: number) => Promise<void>, appendSummary: (text: string) => void, log: (text: string) => void }} Deps
 */

const ENDPOINT_PATH = '/api/v1/maintenance/run';
const KEY_HEADER = 'X-Maintenance-Key';

/**
 * The run summary: one `- label: value` line per answer line, then the closing sentence.
 * @param {readonly Line[]} lines
 * @param {boolean} ok
 * @returns {string}
 */
export function formatSummary(lines, ok) {
  const bullets = lines.map((line) => `- ${line.label}: ${String(line.value ?? line.text ?? '')}`);
  const closing = ok ? 'All maintenance jobs finished.' : 'Some maintenance jobs failed. See the lines above.';
  return ['## Maintenance run', '', ...bullets, '', closing, ''].join('\n');
}

/**
 * Calls the site once and reports the counts.
 * @param {Deps} deps
 * @returns {Promise<number>} the exit code.
 */
export async function runMaintenance({ env, fetch, appendSummary, log }) {
  const origin = env.SITE_ORIGIN ?? '';
  const response = await fetch(`${origin}${ENDPOINT_PATH}`, {
    method: 'POST',
    headers: { [KEY_HEADER]: env.MAINTENANCE_KEY ?? '', Accept: 'application/json' },
  });
  const body = /** @type {{ ok: boolean, lines: Line[] }} */ (await response.json());
  const text = formatSummary(body.lines, body.ok);
  appendSummary(text);
  log(text);
  return body.ok ? 0 : 1;
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
