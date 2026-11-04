// @vitest-environment node
// Pins the monthly maintenance call (JOB-01, D-21, D-22, D-36). Every case drives maintenance.mjs through a fake fetch,
// a fake clock and a fake summary file, so no request leaves the machine. The key and the raw answer must never appear in
// any logged or summarised text, because the repository and its run logs are public.
import { describe, expect, it } from 'vitest';
import { runMaintenance } from './maintenance.mjs';

const ORIGIN = 'https://example.test';
const KEY = 'fake-maintenance-key-for-tests-only-0000000000';
const ENDPOINT = 'https://example.test/api/v1/maintenance/run';

interface Line {
  readonly label: string;
  readonly value: number | null;
  readonly failed: boolean;
  readonly text: string | null;
}

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

type Answer = Error | { readonly status: number; readonly body?: unknown };

/** A 200 answer in the endpoint's shape. */
function answer(lines: readonly Line[], { ok = true, more = false }: { ok?: boolean; more?: boolean } = {}): Answer {
  return { status: 200, body: { ok, more, lines } };
}

const REQUEST_KEYS: Line = { label: 'Expired request keys removed', value: 2, failed: false, text: null };

/** Runs the script against scripted answers; the last answer repeats when the script asks again. */
async function drive(answers: readonly Answer[], env: Record<string, string | undefined> = {}) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const summaries: string[] = [];
  const logs: string[] = [];
  const fetch = (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const next = answers[Math.min(calls.length, answers.length) - 1];
    if (next === undefined) {
      throw new Error('The test scripted no answer.');
    }
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(new Response(JSON.stringify(next.body ?? {}), { status: next.status }));
  };
  const code = await runMaintenance({
    env: { MAINTENANCE_KEY: KEY, SITE_ORIGIN: ORIGIN, ...env },
    fetch,
    sleep: (ms: number) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    appendSummary: (text: string) => {
      summaries.push(text);
    },
    log: (text: string) => {
      logs.push(text);
    },
  });
  return { code, calls, sleeps, summary: summaries.join(''), logs, everything: [...summaries, ...logs].join('\n') };
}

describe('the maintenance call', () => {
  it('posts once with the key header and writes the counts to the summary', async () => {
    const run = await drive([answer([REQUEST_KEYS])]);

    expect(run.code).toBe(0);
    expect(run.calls).toHaveLength(1);
    expect(run.calls[0]?.url).toBe(ENDPOINT);
    expect(run.calls[0]?.init.method).toBe('POST');
    expect(new Headers(run.calls[0]?.init.headers).get('X-Maintenance-Key')).toBe(KEY);
    expect(run.summary).toContain('- Expired request keys removed: 2');
    expect(run.summary).toContain('All maintenance jobs finished.');
  });

  it('keeps the key and the raw answer out of the summary and the log', async () => {
    const run = await drive([
      {
        status: 200,
        body: {
          ok: true,
          more: false,
          lines: [REQUEST_KEYS],
          cloudName: 'fake-cloud-name',
          publicId: 'fake-public-id',
        },
      },
    ]);

    expect(run.code).toBe(0);
    expect(run.everything).not.toContain(KEY);
    expect(run.everything).not.toContain('fake-cloud-name');
    expect(run.everything).not.toContain('fake-public-id');
    expect(run.everything).not.toContain('"lines"');
  });
});
