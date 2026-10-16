// @vitest-environment node
// Pins the CI mode decision (OPS-02, D-14): drafts run the fast part, documentation-only pull requests run the fast part
// too, every other ready pull request runs the full gate, and anything uncertain (an empty or failed diff) runs the
// full gate. A wrong `docs` answer would skip real checks, so each rule fails toward `full`.
import { describe, expect, it } from 'vitest';
import { classify, isDocsPath, main, MODES } from './ci-classify.mjs';

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
