// @vitest-environment node
// Pins the monthly maintenance call (JOB-01, D-21, D-22, D-36). Every case drives maintenance.mjs through a fake fetch,
// a fake clock and a fake summary file, so no request leaves the machine. The key and the raw answer must never appear in
// any logged or summarised text, because the repository and its run logs are public.
import { describe, expect, it } from 'vitest';
import { formatSummary, runMaintenance } from './maintenance.mjs';

const ORIGIN = 'https://example.test';
const KEY = 'fake-maintenance-key-for-tests-only-0000000000';
const ENDPOINT = 'https://example.test/api/v1/maintenance/run';
const FAILED_CLOSING = 'Some maintenance jobs failed. See the lines above.';
const FINISHED_CLOSING = 'All maintenance jobs finished.';

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

function count(label: string, value: number): Line {
  return { label, value, failed: false, text: null };
}

const REQUEST_KEYS = count('Expired request keys removed', 2);

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
    const raw = typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? {});
    return Promise.resolve(new Response(raw, { status: next.status }));
  };
  let code: number | string;
  try {
    code = await runMaintenance({
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
  } catch (error) {
    // The CLI must turn every failure into an exit code, so a throw is reported as its own value.
    code = `threw ${error instanceof Error ? error.name : 'something'}`;
  }
  const summary = summaries.join('');
  return { code, calls, sleeps, summary, logs, everything: [...summaries, ...logs].join('\n') };
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
    expect(run.summary).toContain(FINISHED_CLOSING);
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

  it('never follows a redirect, so the key cannot travel to another host', async () => {
    const run = await drive([answer([REQUEST_KEYS])]);

    expect(run.calls[0]?.init.redirect).toBe('error');
  });

  it('puts a time limit on each call', async () => {
    const run = await drive([answer([REQUEST_KEYS])]);

    expect(run.calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('accepts the origin with a trailing slash', async () => {
    const run = await drive([answer([REQUEST_KEYS])], { SITE_ORIGIN: 'https://example.test/' });

    expect(run.code).toBe(0);
    expect(run.calls[0]?.url).toBe(ENDPOINT);
  });
});

describe('a long run', () => {
  it('calls again while the answer says more and joins the lines of every call', async () => {
    const run = await drive([
      answer([count('First job', 1)], { more: true }),
      answer([count('Second job', 2)], { more: true }),
      answer([count('Third job', 3)]),
    ]);

    expect(run.code).toBe(0);
    expect(run.calls).toHaveLength(3);
    expect(run.summary).toContain('- First job: 1');
    expect(run.summary).toContain('- Second job: 2');
    expect(run.summary).toContain('- Third job: 3');
    expect(run.summary).toContain(FINISHED_CLOSING);
  });

  it('stops after 10 calls and fails the run when there is still more', async () => {
    const run = await drive([answer([REQUEST_KEYS], { more: true })]);

    expect(run.calls).toHaveLength(10);
    expect(run.code).toBe(1);
    expect(run.summary).toContain('- Stopped after 10 calls with work still left. Run it again.');
    expect(run.summary).toContain(FAILED_CLOSING);
  });
});

describe('failures turn the run red', () => {
  it('exits 1 when the answer says ok is false and still lists every line', async () => {
    const failedLine: Line = {
      label: 'Photo removals',
      value: null,
      failed: true,
      text: 'The job failed. Check the server log.',
    };
    const run = await drive([answer([REQUEST_KEYS, failedLine], { ok: false })]);

    expect(run.code).toBe(1);
    expect(run.summary).toContain('- Expired request keys removed: 2');
    expect(run.summary).toContain('- Photo removals: The job failed. Check the server log.');
    expect(run.summary).toContain(FAILED_CLOSING);
    expect(run.summary).not.toContain(FINISHED_CLOSING);
  });

  it('exits 1 when a line failed even though the answer says ok', async () => {
    const failedLine: Line = { label: 'Photo removals', value: 3, failed: true, text: null };
    const run = await drive([answer([failedLine])]);

    expect(run.code).toBe(1);
    expect(run.summary).toContain(FAILED_CLOSING);
  });

  it('answers 401 with the fixed key line, exits 1 and asks only once', async () => {
    const run = await drive([{ status: 401, body: { detail: 'fake-error-body-text' } }]);

    expect(run.code).toBe(1);
    expect(run.calls).toHaveLength(1);
    expect(run.summary).toContain('- The maintenance key was refused.');
    expect(run.summary).toContain(FAILED_CLOSING);
    expect(run.everything).not.toContain('fake-error-body-text');
    expect(run.everything).not.toContain(KEY);
  });

  it('waits 60 seconds and retries when the site answers 409, then carries on', async () => {
    const run = await drive([{ status: 409 }, answer([REQUEST_KEYS])]);

    expect(run.code).toBe(0);
    expect(run.calls).toHaveLength(2);
    expect(run.sleeps).toEqual([60_000]);
    expect(run.summary).toContain('- Expired request keys removed: 2');
  });

  it('gives up after four retries when the site keeps answering 409', async () => {
    const run = await drive([{ status: 409 }]);

    expect(run.code).toBe(1);
    expect(run.calls).toHaveLength(5);
    expect(run.sleeps).toEqual([60_000, 60_000, 60_000, 60_000]);
    expect(run.summary).toContain('- Another maintenance run was still going after 5 tries.');
    expect(run.summary).toContain(FAILED_CLOSING);
  });

  it.each([
    [429, '- The site refused the call because there were too many calls (HTTP 429). Wait and run it again.'],
    [500, '- The site answered with an error (HTTP 500).'],
    [503, '- The site answered with an error (HTTP 503).'],
    [404, '- The site answered with an error (HTTP 404).'],
  ])('answers %i with a fixed line and no body text', async (status, line) => {
    const run = await drive([{ status, body: { detail: 'fake-error-body-text' } }]);

    expect(run.code).toBe(1);
    expect(run.calls).toHaveLength(1);
    expect(run.summary).toContain(line);
    expect(run.summary).toContain(FAILED_CLOSING);
    expect(run.everything).not.toContain('fake-error-body-text');
  });

  it('answers a network error with a fixed line and never prints the error text', async () => {
    const run = await drive([new TypeError(`fetch failed for ${ORIGIN} with ${KEY} and fake-host-detail`)]);

    expect(run.code).toBe(1);
    expect(run.summary).toContain('- The site could not be reached.');
    expect(run.summary).toContain(FAILED_CLOSING);
    expect(run.everything).not.toContain(KEY);
    expect(run.everything).not.toContain('fake-host-detail');
  });

  it.each([
    ['text that is not JSON', 'fake-raw-text'],
    ['an answer with no lines', { ok: true, more: false }],
    ['an answer whose ok is not a boolean', { ok: 'yes', more: false, lines: [] }],
    ['a line with no label', { ok: true, more: false, lines: [{ value: 1, failed: false, text: null }] }],
  ])('fails with a fixed line on %s', async (_name, body) => {
    const run = await drive([{ status: 200, body }]);

    expect(run.code).toBe(1);
    expect(run.summary).toContain('- The site gave an answer this script could not read.');
    expect(run.summary).toContain(FAILED_CLOSING);
    expect(run.everything).not.toContain('fake-raw-text');
  });
});

describe('the settings are checked before any call', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['http', 'http://example.test'],
    ['with a path', 'https://example.test/app'],
    ['with a query', 'https://example.test/?a=1'],
    ['with sign-in details', 'https://user:secret@example.test'],
    ['not an address', 'example.test'],
  ])('refuses an origin that is %s and makes no call', async (_name, origin) => {
    const run = await drive([answer([REQUEST_KEYS])], { SITE_ORIGIN: origin });

    expect(run.code).toBe(1);
    expect(run.calls).toHaveLength(0);
    expect(run.summary).toContain('- SITE_ORIGIN must be an https address with no path, such as https://example.test.');
    expect(run.summary).toContain(FAILED_CLOSING);
    expect(run.everything).not.toContain('secret@');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['only spaces', '   '],
    ['holding a line break', 'fake-key\nX-Other: 1'],
  ])('refuses a key that is %s and makes no call', async (_name, key) => {
    const run = await drive([answer([REQUEST_KEYS])], { MAINTENANCE_KEY: key });

    expect(run.code).toBe(1);
    expect(run.calls).toHaveLength(0);
    expect(run.summary).toContain('- MAINTENANCE_KEY is not set correctly.');
    expect(run.everything).not.toContain('X-Other');
  });
});

describe('the summary text', () => {
  it('cuts a label with a line break or 300 characters to one printable line of 120 characters', async () => {
    const run = await drive([
      answer([count('Alpha\nBeta\u0007 Gamma', 3), count('x'.repeat(300), 5), count('  Padded   label  ', 7)]),
    ]);

    expect(run.summary).toContain('- Alpha Beta Gamma: 3');
    expect(run.summary).toContain(`- ${'x'.repeat(120)}: 5`);
    expect(run.summary).not.toContain('x'.repeat(121));
    expect(run.summary).toContain('- Padded label: 7');
  });

  it('shows the text of a line that has no number, cleaned the same way', () => {
    const summary = formatSummary(
      [
        { label: 'Usage', value: null, failed: false, text: 'Storage is fine.\nNothing to do.' },
        { label: 'Empty', value: null, failed: false, text: null },
      ],
      true,
    );

    expect(summary).toContain('- Usage: Storage is fine. Nothing to do.');
    expect(summary).toContain('- Empty:');
  });

  it('closes with the finished sentence when ok and the failed sentence otherwise', () => {
    expect(formatSummary([], true)).toContain(FINISHED_CLOSING);
    expect(formatSummary([], true)).not.toContain(FAILED_CLOSING);
    expect(formatSummary([], false)).toContain(FAILED_CLOSING);
    expect(formatSummary([], false)).not.toContain(FINISHED_CLOSING);
  });
});
