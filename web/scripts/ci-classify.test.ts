// @vitest-environment node
// Pins the CI mode decision (OPS-02, D-14): drafts run the fast part, documentation-only pull requests run the fast part
// too, every other ready pull request runs the full gate, and anything uncertain (an empty or failed diff) runs the
// full gate. A wrong `docs` answer would skip real checks, so each rule fails toward `full`. A push to main builds the
// deploy package only when the merged pull request's head has the identical git tree and a green `gate (full)` run
// (Pattern 9); any missing data, mismatch or API failure runs the full gate.
import { describe, expect, it } from 'vitest';
import { classify, findProvenTree, isDocsPath, main, MODES } from './ci-classify.mjs';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
}

/** A fake spawn that answers each call with the next planned result and records what was run. */
function fakeSpawn(results: readonly { status: number | null; stdout?: string }[]) {
  const calls: SpawnCall[] = [];
  const spawn = (command: string, args: readonly string[]) => {
    calls.push({ command, args });
    return results[calls.length - 1] ?? { status: 0, stdout: '' };
  };
  return { calls, spawn };
}

/** The injected I/O of main: an in-memory GITHUB_OUTPUT and captured log lines. */
function harness(spawn: (command: string, args: readonly string[]) => { status: number | null; stdout?: string }) {
  const written: { file: string; text: string }[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    written,
    logs,
    errors,
    deps: {
      spawn,
      appendOutput: (file: string, text: string) => {
        written.push({ file, text });
      },
      log: (line: string) => logs.push(line),
      error: (line: string) => errors.push(line),
    },
  };
}

const prEnv = {
  GITHUB_EVENT_NAME: 'pull_request',
  PR_DRAFT: 'false',
  BASE_SHA: BASE,
  HEAD_SHA: HEAD,
  GITHUB_OUTPUT: '/tmp/out',
};

describe('MODES', () => {
  it('lists exactly docs, fast, full and package, and cannot be changed', () => {
    expect(Object.values(MODES).sort()).toEqual(['docs', 'fast', 'full', 'package']);
    expect(Object.isFrozen(MODES)).toBe(true);
  });
});

describe('isDocsPath', () => {
  it.each([
    '.planning/STATE.md',
    '.planning/config.json',
    '.planning/phases/03-x/anything.cs',
    'docs/operations/deploy.md',
    'README.md',
    '.claude/CLAUDE.md',
    'DOCS/X.MD',
    'docs/Notes.Md',
    './README.md',
  ])('treats %s as documentation', (path) => {
    expect(isDocsPath(path)).toBe(true);
  });

  it.each([
    'web/src/App.tsx',
    'web/README.md',
    'WEB/README.md',
    '.github/workflows/ci.yml',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'docs/dependencies.json',
    'tools/scripts/x.md',
    'src/Csps.Server/README.md',
    'tests/Csps.Domain.Tests/notes.md',
    'Src/Csps.Server/README.md',
    '',
    'md',
    'docs/x.md.cs',
    '.planning',
    '.PLANNING/x.md2',
    '.planning/../src/a.cs',
    'docs/../src/a.md',
    '"docs/caf\\303\\251.md"',
  ])('does not treat %s as documentation', (path) => {
    expect(isDocsPath(path)).toBe(false);
  });

  it('reads Windows separators like forward slashes', () => {
    expect(isDocsPath('.planning\\STATE.md')).toBe(true);
    expect(isDocsPath('web\\README.md')).toBe(false);
  });
});

describe('classify', () => {
  it('runs the fast part for a draft pull request, even when only documentation changed', () => {
    expect(classify({ event: 'pull_request', draft: true, changedFiles: ['src/a.cs'] })).toBe(MODES.fast);
    expect(classify({ event: 'pull_request', draft: true, changedFiles: ['README.md'] })).toBe(MODES.fast);
    expect(classify({ event: 'pull_request', draft: true, changedFiles: [] })).toBe(MODES.fast);
  });

  it('runs the docs mode for a ready pull request whose files are all documentation', () => {
    const changedFiles = ['.planning/STATE.md', 'docs/operations/deploy.md', 'README.md', '.claude/CLAUDE.md'];

    expect(classify({ event: 'pull_request', draft: false, changedFiles })).toBe(MODES.docs);
  });

  it.each([
    'web/src/App.tsx',
    '.github/workflows/ci.yml',
    'docs/dependencies.json',
    'tools/scripts/x.md',
    'src/Csps.Server/README.md',
  ])('runs the full gate when %s joins documentation changes', (extra) => {
    const changedFiles = ['.planning/STATE.md', 'README.md', extra];

    expect(classify({ event: 'pull_request', draft: false, changedFiles })).toBe(MODES.full);
  });

  it('runs the full gate for an empty file list, never a vacuous docs match', () => {
    expect(classify({ event: 'pull_request', draft: false, changedFiles: [] })).toBe(MODES.full);
    expect(classify({ event: 'pull_request', draft: false })).toBe(MODES.full);
  });

  it('treats a draft flag that is not exactly true as a ready pull request', () => {
    expect(classify({ event: 'pull_request', changedFiles: ['src/a.cs'] })).toBe(MODES.full);
  });

  it('builds the package for a push only when the tree is proven', () => {
    expect(classify({ event: 'push', treeProven: true })).toBe(MODES.package);
    expect(classify({ event: 'push', treeProven: false })).toBe(MODES.full);
    expect(classify({ event: 'push' })).toBe(MODES.full);
  });

  it.each([
    'workflow_dispatch',
    'schedule',
    'workflow_call',
    'repository_dispatch',
    'merge_group',
    '',
    'pull_request_target',
  ])('runs the full gate for the %s event', (event) => {
    expect(classify({ event, draft: true, changedFiles: ['README.md'], treeProven: true })).toBe(MODES.full);
  });
});

describe('main for a pull request', () => {
  it('reads the real changed files between the base and head, and writes one mode line', () => {
    const { calls, spawn } = fakeSpawn([{ status: 0, stdout: 'src/a.cs\nREADME.md\n' }]);
    const { written, logs, deps } = harness(spawn);

    expect(main(prEnv, deps)).toBe(0);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe('git');
    expect(calls[0]?.args).toEqual(['diff', '--name-only', '--no-renames', `${BASE}...${HEAD}`]);
    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
    expect(logs).toHaveLength(1);
  });

  it('writes mode=docs when every changed file is documentation', () => {
    const { spawn } = fakeSpawn([{ status: 0, stdout: '.planning/STATE.md\r\ndocs/a.md\r\n\r\n' }]);
    const { written, deps } = harness(spawn);

    expect(main(prEnv, deps)).toBe(0);

    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=docs\n' }]);
  });

  it('writes mode=fast for a draft without asking git for the diff', () => {
    const { calls, spawn } = fakeSpawn([]);
    const { written, deps } = harness(spawn);

    expect(main({ ...prEnv, PR_DRAFT: 'true' }, deps)).toBe(0);

    expect(calls).toEqual([]);
    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=fast\n' }]);
  });

  it('falls back to full with a one-line notice when git exits non-zero', () => {
    const { spawn } = fakeSpawn([{ status: 128, stdout: '.planning/STATE.md\n' }]);
    const { written, logs, deps } = harness(spawn);

    expect(main(prEnv, deps)).toBe(0);

    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('git diff failed');
    expect(logs[0]).toContain('full');
  });

  it('falls back to full when git is killed by a signal or cannot start', () => {
    const { written, deps } = harness(fakeSpawn([{ status: null }]).spawn);

    expect(main(prEnv, deps)).toBe(0);

    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
  });

  it('falls back to full for an empty diff', () => {
    const { written, logs, deps } = harness(fakeSpawn([{ status: 0, stdout: '' }]).spawn);

    expect(main(prEnv, deps)).toBe(0);

    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
    expect(logs[0]).toContain('no changed files');
  });

  it.each([
    ['a missing base', { BASE_SHA: undefined }],
    ['a blank head', { HEAD_SHA: '  ' }],
    ['a base that is not a commit id', { BASE_SHA: '--output=/etc/x' }],
    ['a head with a ref name', { HEAD_SHA: 'main' }],
  ])('runs the full gate without calling git for %s', (_name, override) => {
    const { calls, spawn } = fakeSpawn([{ status: 0, stdout: 'README.md\n' }]);
    const { written, deps } = harness(spawn);

    expect(main({ ...prEnv, ...override }, deps)).toBe(0);

    expect(calls).toEqual([]);
    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
  });

  it('lists a rename as both paths so moving code into a docs folder is not docs', () => {
    const { calls, spawn } = fakeSpawn([{ status: 0, stdout: 'src/a.cs\ndocs/a.md\n' }]);
    const { written, deps } = harness(spawn);

    main(prEnv, deps);

    expect(calls[0]?.args).toContain('--no-renames');
    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
  });
});

describe('main for other events', () => {
  it.each(['workflow_dispatch', 'schedule', 'workflow_call', 'repository_dispatch', 'something_new'])(
    'writes mode=full for %s without running anything',
    (event) => {
      const { calls, spawn } = fakeSpawn([]);
      const { written, deps } = harness(spawn);

      expect(main({ GITHUB_EVENT_NAME: event, GITHUB_OUTPUT: '/tmp/out' }, deps)).toBe(0);

      expect(calls).toEqual([]);
      expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
    },
  );

  it('writes mode=full when the event name is missing', () => {
    const { written, deps } = harness(fakeSpawn([]).spawn);

    expect(main({ GITHUB_OUTPUT: '/tmp/out' }, deps)).toBe(0);

    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
  });
});

describe('main output file', () => {
  it.each([undefined, '', '   '])('exits 2 and writes nothing when GITHUB_OUTPUT is %j', (value) => {
    const { written, errors, deps } = harness(fakeSpawn([]).spawn);

    expect(main({ ...prEnv, GITHUB_OUTPUT: value }, deps)).toBe(2);

    expect(written).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('GITHUB_OUTPUT');
  });

  it('exits 2 when the output file cannot be written', () => {
    const { errors, deps } = harness(fakeSpawn([]).spawn);
    deps.appendOutput = () => {
      throw new Error('disk full');
    };

    expect(main({ ...prEnv, PR_DRAFT: 'true' }, deps)).toBe(2);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('GITHUB_OUTPUT');
  });
});

const MERGE = 'c'.repeat(40);
const PR_HEAD = 'd'.repeat(40);
const REPO = 'owner/repo';
const TREE = 'e'.repeat(40);

interface GhReply {
  readonly status: number | null;
  readonly stdout?: string;
}

/** The four GitHub answers of a healthy merge; a test replaces the piece it wants to break. */
function healthy(overrides: Partial<Record<'pulls' | 'mergeTree' | 'headTree' | 'checks', GhReply>> = {}) {
  const ok = (value: unknown): GhReply => ({ status: 0, stdout: JSON.stringify(value) });
  return {
    pulls: ok([{ merged_at: '2026-10-15T12:00:00Z', merge_commit_sha: MERGE, head: { sha: PR_HEAD } }]),
    mergeTree: ok({ tree: { sha: TREE } }),
    headTree: ok({ tree: { sha: TREE } }),
    checks: ok({ check_runs: [{ name: 'gate (full)', status: 'completed', conclusion: 'success' }] }),
    ...overrides,
  };
}

/** A fake gh that answers by endpoint and records every argument list. */
function fakeGh(replies: ReturnType<typeof healthy>) {
  const calls: (readonly string[])[] = [];
  const gh = (args: readonly string[]): GhReply => {
    calls.push(args);
    const endpoint = args[1] ?? '';
    if (endpoint === `repos/${REPO}/commits/${MERGE}/pulls`) return replies.pulls;
    if (endpoint === `repos/${REPO}/git/commits/${MERGE}`) return replies.mergeTree;
    if (endpoint === `repos/${REPO}/git/commits/${PR_HEAD}`) return replies.headTree;
    if (endpoint.startsWith(`repos/${REPO}/commits/${PR_HEAD}/check-runs`)) return replies.checks;
    return { status: 1, stdout: '' };
  };
  return { calls, gh };
}

describe('findProvenTree', () => {
  it('is proven when the merged PR head has the same tree and a successful gate (full) run', () => {
    const { calls, gh } = fakeGh(healthy());

    const result = findProvenTree({ sha: MERGE, repo: REPO, gh });

    expect(result.proven).toBe(true);
    expect(result.reason).not.toBe('');

    expect(calls.every((args) => args[0] === 'api')).toBe(true);
    expect(calls.map((args) => args[1])).toEqual([
      `repos/${REPO}/commits/${MERGE}/pulls`,
      `repos/${REPO}/git/commits/${MERGE}`,
      `repos/${REPO}/git/commits/${PR_HEAD}`,
      expect.stringContaining(`repos/${REPO}/commits/${PR_HEAD}/check-runs`),
    ]);
  });

  it('ignores associated PRs that did not produce this commit', () => {
    const replies = healthy({
      pulls: {
        status: 0,
        stdout: JSON.stringify([
          { merged_at: null, merge_commit_sha: MERGE, head: { sha: 'f'.repeat(40) } },
          { merged_at: '2026-10-14T12:00:00Z', merge_commit_sha: 'a'.repeat(40), head: { sha: 'f'.repeat(40) } },
          { merged_at: '2026-10-15T12:00:00Z', merge_commit_sha: MERGE, head: { sha: PR_HEAD } },
        ]),
      },
    });

    expect(findProvenTree({ sha: MERGE, repo: REPO, gh: fakeGh(replies).gh }).proven).toBe(true);
  });

  const json = (value: unknown): GhReply => ({ status: 0, stdout: JSON.stringify(value) });
  const mergedPr = { merged_at: '2026-10-15T12:00:00Z', merge_commit_sha: MERGE, head: { sha: PR_HEAD } };
  const gateRun = (conclusion: string | null, status = 'completed') => ({ name: 'gate (full)', status, conclusion });
  const checkRuns = (...runs: object[]): GhReply => json({ check_runs: runs });

  it.each<[string, Partial<ReturnType<typeof healthy>>]>([
    ['no associated PR', { pulls: json([]) }],
    ['a PR that was never merged', { pulls: json([{ ...mergedPr, merged_at: null }]) }],
    ['a PR whose merge commit is another commit', { pulls: json([{ ...mergedPr, merge_commit_sha: 'a'.repeat(40) }]) }],
    ['two merged PRs claiming the commit', { pulls: json([mergedPr, mergedPr]) }],
    ['a PR with no head commit', { pulls: json([{ ...mergedPr, head: {} }]) }],
    ['a PR head that is not a commit id', { pulls: json([{ ...mergedPr, head: { sha: '../x' } }]) }],
    ['a pulls answer that is not a list', { pulls: json({ message: 'Not Found' }) }],
    ['different trees', { headTree: json({ tree: { sha: '1'.repeat(40) } }) }],
    ['a pushed commit without a tree', { mergeTree: json({}) }],
    ['a head commit without a tree', { headTree: json({ tree: {} }) }],
    ['no check runs', { checks: checkRuns() }],
    ['only another check', { checks: checkRuns({ name: 'gate (fast)', status: 'completed', conclusion: 'success' }) }],
    ['a failed gate run', { checks: checkRuns(gateRun('failure')) }],
    ['a cancelled gate run', { checks: checkRuns(gateRun('cancelled')) }],
    ['a skipped gate run', { checks: checkRuns(gateRun('skipped')) }],
    ['a gate run still running', { checks: checkRuns(gateRun(null, 'in_progress')) }],
    ['a queued gate run', { checks: checkRuns(gateRun(null, 'queued')) }],
    ['a success next to a failure of the same gate', { checks: checkRuns(gateRun('success'), gateRun('failure')) }],
    ['a check list that is missing', { checks: json({}) }],
    ['a pulls call that fails', { pulls: { status: 1, stdout: '[]' } }],
    ['a merge tree call that fails', { mergeTree: { status: 4, stdout: '{}' } }],
    ['a head tree call that fails', { headTree: { status: 1, stdout: '{}' } }],
    ['a check-runs call that fails', { checks: { status: 1, stdout: '{}' } }],
    ['a call killed by a signal', { checks: { status: null } }],
    ['a pulls answer that is not JSON', { pulls: { status: 0, stdout: '<html>' } }],
    ['a tree answer that is not JSON', { mergeTree: { status: 0, stdout: 'oops' } }],
    ['an empty check answer', { checks: { status: 0, stdout: '' } }],
    ['a JSON null', { pulls: { status: 0, stdout: 'null' } }],
  ])('is not proven for %s, with a one-line reason', (_name, overrides) => {
    const result = findProvenTree({ sha: MERGE, repo: REPO, gh: fakeGh(healthy(overrides)).gh });

    expect(result.proven).toBe(false);
    expect(result.reason).not.toBe('');
    expect(result.reason).not.toContain('\n');
  });

  it('asks for no checks when the trees already differ', () => {
    const { calls, gh } = fakeGh(healthy({ headTree: json({ tree: { sha: '1'.repeat(40) } }) }));

    findProvenTree({ sha: MERGE, repo: REPO, gh });

    expect(calls.some((args) => (args[1] ?? '').includes('check-runs'))).toBe(false);
  });

  it('is not proven when gh throws', () => {
    const gh = (): GhReply => {
      throw new Error('spawn gh ENOENT');
    };

    const result = findProvenTree({ sha: MERGE, repo: REPO, gh });

    expect(result.proven).toBe(false);
    expect(result.reason).not.toContain('\n');
  });

  it.each([
    ['a sha that is not a commit id', 'main', REPO],
    ['a blank sha', '', REPO],
    ['a repository without an owner', MERGE, 'repo'],
    ['a repository that tries to climb', MERGE, '../x/y'],
    ['a blank repository', MERGE, ''],
  ])('is not proven for %s, without calling gh', (_name, sha, repo) => {
    const { calls, gh } = fakeGh(healthy());

    expect(findProvenTree({ sha, repo, gh }).proven).toBe(false);

    expect(calls).toEqual([]);
  });

  it('never repeats the gh answer in its reason', () => {
    const replies = healthy({ pulls: { status: 1, stdout: 'ghp_secret-token-value' } });

    const result = findProvenTree({ sha: MERGE, repo: REPO, gh: fakeGh(replies).gh });

    expect(result.reason).not.toContain('ghp_secret');
  });
});

describe('main for a push to main', () => {
  const pushEnv = { GITHUB_EVENT_NAME: 'push', GITHUB_SHA: MERGE, GITHUB_REPOSITORY: REPO, GITHUB_OUTPUT: '/tmp/out' };

  /** main spawns gh directly, so the router answers through the same spawn seam. */
  function routed(replies: ReturnType<typeof healthy>) {
    const { calls, gh } = fakeGh(replies);
    const spawn = (command: string, args: readonly string[]): GhReply => {
      if (command !== 'gh') return { status: 127 };
      return gh(args);
    };
    return { calls, spawn };
  }

  it('writes mode=package when the tree was proven on the pull request', () => {
    const { calls, spawn } = routed(healthy());
    const { written, logs, deps } = harness(spawn);

    expect(main(pushEnv, deps)).toBe(0);

    expect(calls).toHaveLength(4);
    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=package\n' }]);
    expect(logs).toHaveLength(1);
  });

  it('writes mode=full and logs the reason when the gate run did not pass', () => {
    const failed = {
      status: 0,
      stdout: JSON.stringify({ check_runs: [{ name: 'gate (full)', status: 'completed', conclusion: 'failure' }] }),
    };
    const { written, logs, deps } = harness(routed(healthy({ checks: failed })).spawn);

    expect(main(pushEnv, deps)).toBe(0);

    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('mode=full');
    expect(logs[0]).toContain('gate (full)');
  });

  it('writes mode=full when the GitHub API fails', () => {
    const { written, deps } = harness(routed(healthy({ pulls: { status: 1, stdout: '' } })).spawn);

    expect(main(pushEnv, deps)).toBe(0);

    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
  });

  it.each([
    ['GITHUB_SHA', { GITHUB_SHA: undefined }],
    ['GITHUB_REPOSITORY', { GITHUB_REPOSITORY: ' ' }],
  ])('writes mode=full without calling gh when %s is missing', (_name, override) => {
    const { calls, spawn } = routed(healthy());
    const { written, deps } = harness(spawn);

    expect(main({ ...pushEnv, ...override }, deps)).toBe(0);

    expect(calls).toEqual([]);
    expect(written).toEqual([{ file: '/tmp/out', text: 'mode=full\n' }]);
  });
});
