// @vitest-environment node
// Pins the process merge gate (OPS-01, D-08): GitHub Free cannot enforce branch rules on this private repository, so the
// merge command itself refuses unless the pull request is open, targets main, is not a draft, is not behind main, has no
// conflicts, has a passing `gate (full)` or `gate (docs)` check on its head commit, has no failed, pending or cancelled
// check, and has every Definition of Done item ticked. Every rule fails closed (T-03-10).
//
// The `[ci skip]` ship-note rule is the owner's "parent-rule" ruling (2026-10-15T22:05-05:00): a head commit with a skip
// token that changes nothing outside .planning/ and has exactly one parent is judged by that parent, which must pass the
// gate check and have nothing failed or running. Any other skip-token head is refused (T-03-12).
//
// The merge command sets the squash message from the PR title, and the gate refuses a title that would put a skip marker,
// a double quote or a control character into it.
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  collect,
  decide,
  DOD_HEADING,
  GATE_CHECKS,
  GateInputError,
  isPlanningOnlySkipHead,
  LOCAL_GATE_COMMANDS,
  LOCAL_GATE_HEADING,
  LOCAL_GATE_WARNING,
  main,
  SKIP_TOKENS,
  skipMarkersIn,
  squashMessage,
} from './merge-gate.mjs';

type GateInput = Parameters<typeof decide>[0];
type PullRequest = GateInput['pr'];
type PrCheck = GateInput['checks'][number];
type HeadCommit = NonNullable<GateInput['headCommit']>;
type CheckRun = NonNullable<GateInput['parentChecks']>[number];

const HEAD = 'a'.repeat(40);
const PARENT = 'b'.repeat(40);
const SLUG = 'owner/repo';

const TICKED_BODY = [
  '## Summary',
  '',
  'Something.',
  '',
  '## Definition of Done',
  '',
  'Tick every item.',
  '',
  '- [x] Requirements are traced.',
  '- [x] Tests pass.',
  '- [X] N/A: no UI here.',
  '',
  '## Local full gate',
  '',
  '- `dotnet build Csps.slnx` : exit code and output',
].join('\n');

function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 7,
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'main',
    headRefOid: HEAD,
    title: 'feat(03-03): something',
    body: TICKED_BODY,
    mergeable: 'MERGEABLE',
    ...overrides,
  };
}

function check(name: string, bucket = 'pass'): PrCheck {
  return { name, bucket };
}

function run(name: string, conclusion: string | null = 'success', status = 'completed'): CheckRun {
  return { name, status, conclusion };
}

function commit(overrides: Partial<HeadCommit> = {}): HeadCommit {
  return { message: 'feat: code change', parents: [PARENT], files: ['web/src/App.tsx'], ...overrides };
}

function shipNote(overrides: Partial<HeadCommit> = {}): HeadCommit {
  return commit({
    message: 'docs(03): ship phase 3 [ci skip]',
    files: ['.planning/STATE.md'],
    ...overrides,
  });
}

function input(overrides: Partial<GateInput> = {}): GateInput {
  return {
    pr: pr(),
    checks: [check('gate (full)')],
    behindBy: 0,
    headCommit: commit(),
    ...overrides,
  };
}

function refusalOf(overrides: Partial<GateInput>): string[] {
  const verdict = decide(input(overrides));
  expect(verdict.allowed).toBe(false);
  return verdict.reasons;
}

describe('constants', () => {
  it('lists the six GitHub skip tokens and the two gate check names, and cannot be changed', () => {
    expect([...SKIP_TOKENS].sort()).toEqual(
      ['[skip ci]', '[ci skip]', '[no ci]', '[skip actions]', '[actions skip]', 'skip-checks: true'].sort(),
    );
    expect([...GATE_CHECKS]).toEqual(['gate (full)', 'gate (docs)']);
    expect(DOD_HEADING).toBe('## Definition of Done');
    expect(Object.isFrozen(SKIP_TOKENS)).toBe(true);
    expect(Object.isFrozen(GATE_CHECKS)).toBe(true);
  });
});

describe('decide: the pull request is allowed', () => {
  it('allows an open, ready, current, mergeable pull request with a passing gate (full) and a ticked list', () => {
    expect(decide(input())).toEqual({ allowed: true, reasons: [] });
  });

  it('allows gate (docs) the same way', () => {
    expect(decide(input({ checks: [check('gate (docs)')] }))).toEqual({ allowed: true, reasons: [] });
  });

  it('allows other checks that passed or were skipped', () => {
    const checks = [check('gate (full)'), check('classify'), check('zizmor', 'skipping'), check('gate (fast)')];

    expect(decide(input({ checks }))).toEqual({ allowed: true, reasons: [] });
  });
});

describe('decide: the pull request is refused', () => {
  it.each(['CLOSED', 'MERGED'])('refuses a %s pull request and says it is not open', (state) => {
    const reasons = refusalOf({ pr: pr({ state }) });

    expect(reasons).toEqual([`The pull request is not open (it is ${state.toLowerCase()}).`]);
  });

  it('refuses a pull request that targets another branch', () => {
    expect(refusalOf({ pr: pr({ baseRefName: 'develop' }) })).toEqual([
      'The pull request targets "develop", not main.',
    ]);
  });

  it('refuses a draft', () => {
    expect(refusalOf({ pr: pr({ isDraft: true }) })).toEqual([
      'The pull request is a draft. Mark it ready for review first.',
    ]);
  });

  it('refuses a branch that is behind main and counts the commits', () => {
    expect(refusalOf({ behindBy: 3 })).toEqual(['The branch is 3 commits behind main. Update it first.']);
    expect(refusalOf({ behindBy: 1 })).toEqual(['The branch is 1 commit behind main. Update it first.']);
  });

  it.each([null, Number.NaN, -1, 1.5])(
    'refuses when it cannot tell how far behind main the branch is (%s)',
    (behindBy) => {
      expect(refusalOf({ behindBy })).toEqual(['Could not tell how far the branch is behind main. Try again.']);
    },
  );

  it('refuses a branch with conflicts', () => {
    expect(refusalOf({ pr: pr({ mergeable: 'CONFLICTING' }) })).toEqual([
      'The branch has merge conflicts with main. Resolve them first.',
    ]);
  });

  it.each(['UNKNOWN', '', 'SOMETHING_NEW'])('refuses while GitHub has not decided mergeability (%s)', (mergeable) => {
    expect(refusalOf({ pr: pr({ mergeable }) })).toEqual([
      'GitHub has not finished checking whether the branch can merge. Wait a moment and run the command again.',
    ]);
  });

  it('refuses a head commit with zero checks', () => {
    expect(refusalOf({ checks: [] })).toEqual(['No checks have run on the newest commit (aaaaaaa).']);
  });

  it('refuses a head commit that only has gate (fast)', () => {
    expect(refusalOf({ checks: [check('gate (fast)')] })).toEqual([
      'Only "gate (fast)" ran on the newest commit (aaaaaaa). Mark the pull request ready for review so the full gate runs.',
    ]);
  });

  it('refuses a head commit with only unrelated checks', () => {
    expect(refusalOf({ checks: [check('classify')] })).toEqual([
      'Neither "gate (full)" nor "gate (docs)" ran on the newest commit (aaaaaaa).',
    ]);
  });

  it('refuses a gate check that was skipped', () => {
    expect(refusalOf({ checks: [check('gate (full)', 'skipping')] })).toEqual([
      'Neither "gate (full)" nor "gate (docs)" ran on the newest commit (aaaaaaa).',
    ]);
  });

  it.each([
    ['fail', 'The check "gate (full)" failed.'],
    ['pending', 'The check "gate (full)" is still running.'],
    ['cancel', 'The check "gate (full)" was cancelled.'],
    ['mystery', 'The check "gate (full)" has an unknown result ("mystery").'],
  ])('refuses a gate check in the %s state', (bucket, reason) => {
    expect(refusalOf({ checks: [check('gate (full)', bucket)] })).toEqual([reason]);
  });

  it('refuses when gate (full) passed but gate (docs) failed', () => {
    const checks = [check('gate (full)'), check('gate (docs)', 'fail')];

    expect(refusalOf({ checks })).toEqual(['The check "gate (docs)" failed.']);
  });

  it.each([
    ['fail', 'The check "zizmor" failed.'],
    ['pending', 'The check "zizmor" is still running.'],
    ['cancel', 'The check "zizmor" was cancelled.'],
  ])('refuses any other check in the %s state', (bucket, reason) => {
    expect(refusalOf({ checks: [check('gate (full)'), check('zizmor', bucket)] })).toEqual([reason]);
  });

  it('refuses a body with no Definition of Done section', () => {
    expect(refusalOf({ pr: pr({ body: '## Summary\n\n- [x] a thing' }) })).toEqual([
      'The pull request body has no "## Definition of Done" section.',
    ]);
    expect(refusalOf({ pr: pr({ body: '' }) })).toEqual([
      'The pull request body has no "## Definition of Done" section.',
    ]);
  });

  it('refuses a Definition of Done section with no task-list lines', () => {
    const body = '## Definition of Done\n\nAll done, trust me.\n\n## Other\n\n- [x] elsewhere';

    expect(refusalOf({ pr: pr({ body }) })).toEqual(['The "## Definition of Done" section has no task-list items.']);
  });

  it('refuses every unticked item and names it', () => {
    const body = '## Definition of Done\n- [x] one\n- [ ] two\n  - [ ] three nested\n* [ ] four';

    expect(refusalOf({ pr: pr({ body }) })).toEqual([
      'Definition of Done item not ticked: two',
      'Definition of Done item not ticked: three nested',
      'Definition of Done item not ticked: four',
    ]);
  });

  it('gives several reasons in a fixed order, and none contains an em dash or en dash', () => {
    const reasons = refusalOf({
      pr: pr({ state: 'CLOSED', baseRefName: 'dev', isDraft: true, mergeable: 'CONFLICTING', body: '' }),
      behindBy: 2,
      checks: [check('gate (full)', 'fail'), check('zizmor', 'pending')],
    });

    expect(reasons).toEqual([
      'The pull request is not open (it is closed).',
      'The pull request targets "dev", not main.',
      'The pull request is a draft. Mark it ready for review first.',
      'The branch is 2 commits behind main. Update it first.',
      'The branch has merge conflicts with main. Resolve them first.',
      'The check "gate (full)" failed.',
      'The check "zizmor" is still running.',
      'The pull request body has no "## Definition of Done" section.',
    ]);
    expect(reasons.join('\n')).not.toMatch(new RegExp(`[${String.fromCodePoint(0x2013, 0x2014)}]`, 'u'));
  });
});

describe('decide: the Definition of Done section', () => {
  it('ends the section at the next heading, so ticks in other sections do not count', () => {
    const body = '## Definition of Done\n- [x] done\n## Local full gate\n- [ ] not part of the list\n# Title\n- [ ] no';

    expect(decide(input({ pr: pr({ body }) })).allowed).toBe(true);
  });

  it('reads Windows line endings and a heading with trailing spaces', () => {
    const body = '## Definition of Done  \r\n\r\n- [x] a\r\n- [x] b\r\n';

    expect(decide(input({ pr: pr({ body }) })).allowed).toBe(true);
    expect(decide(input({ pr: pr({ body: '## Definition of Done\r\n- [ ] a\r\n' }) })).allowed).toBe(false);
  });

  it('ignores task-list lines and headings inside a fenced code block', () => {
    const fenced = '## Definition of Done\n- [x] real\n```\n- [ ] sample\n## Other\n```\n- [x] after the fence';
    const fakeHeading = '```\n## Definition of Done\n- [x] sample\n```\n';

    expect(decide(input({ pr: pr({ body: fenced }) })).allowed).toBe(true);
    expect(refusalOf({ pr: pr({ body: fakeHeading }) })).toEqual([
      'The pull request body has no "## Definition of Done" section.',
    ]);
  });

  it('judges a heading written twice by both sections', () => {
    const body = '## Definition of Done\n- [x] a\n\n## Definition of Done\n- [ ] b';

    expect(refusalOf({ pr: pr({ body }) })).toEqual(['Definition of Done item not ticked: b']);
  });

  it('does not take a different heading that merely starts the same way', () => {
    const body = '## Definition of Done and more\n- [x] a';

    expect(refusalOf({ pr: pr({ body }) })).toEqual(['The pull request body has no "## Definition of Done" section.']);
  });

  it('treats a missing body as empty', () => {
    expect(refusalOf({ pr: pr({ body: undefined as unknown as string }) })).toEqual([
      'The pull request body has no "## Definition of Done" section.',
    ]);
  });
});

describe('isPlanningOnlySkipHead', () => {
  it.each([...SKIP_TOKENS])('accepts a one-parent head with %s that changes only .planning files', (token) => {
    expect(isPlanningOnlySkipHead(shipNote({ message: `docs: note\n\nbody ${token}` }))).toBe(true);
  });

  it.each([
    ['no skip token', shipNote({ message: 'docs(03): ship phase 3' })],
    ['a different-case token', shipNote({ message: 'docs: ship [CI SKIP]' })],
    ['a code file', shipNote({ files: ['.planning/STATE.md', 'web/src/App.tsx'] })],
    ['a file outside .planning', shipNote({ files: ['README.md'] })],
    ['a rename out of source into .planning', shipNote({ files: ['.planning/moved.ts', 'web/src/App.tsx'] })],
    ['a path that climbs out of .planning', shipNote({ files: ['.planning/../src/a.cs'] })],
    ['a lookalike folder', shipNote({ files: ['.planning-extra/a.md'] })],
    ['a bare .planning path', shipNote({ files: ['.planning'] })],
    ['a backslash path', shipNote({ files: ['.planning\\..\\src\\a.cs'] })],
    ['an empty segment', shipNote({ files: ['.planning//a.md'] })],
    ['no files at all', shipNote({ files: [] })],
    [
      'a file list that may be cut off',
      shipNote({ files: Array.from({ length: 300 }, (_v, i) => `.planning/f${String(i)}.md`) }),
    ],
    ['two parents (a merge commit)', shipNote({ parents: [PARENT, 'c'.repeat(40)] })],
    ['no parent', shipNote({ parents: [] })],
  ])('refuses a head with %s', (_name, headCommit) => {
    expect(isPlanningOnlySkipHead(headCommit)).toBe(false);
  });

  it('refuses a missing head commit', () => {
    expect(isPlanningOnlySkipHead(undefined)).toBe(false);
  });
});

describe('decide: the ship note rule (parent-rule, T-03-12)', () => {
  const shipped = (overrides: Partial<GateInput> = {}): GateInput =>
    input({ checks: [], headCommit: shipNote(), parentChecks: [run('gate (full)'), run('classify')], ...overrides });

  it('allows a ship note with no checks when its single parent passed the gate', () => {
    expect(decide(shipped())).toEqual({ allowed: true, reasons: [] });
    const message = squashMessage(pr());
    expect(skipMarkersIn(`${message.subject}\n${message.body}`)).toEqual([]);
  });

  it('accepts gate (docs) on the parent, and parent checks that were skipped or neutral', () => {
    const parentChecks = [run('gate (docs)'), run('zizmor', 'skipped'), run('other', 'neutral')];

    expect(decide(shipped({ parentChecks }))).toEqual({ allowed: true, reasons: [] });
  });

  it('still applies every other rule to the pull request', () => {
    expect(decide(shipped({ behindBy: 2, pr: pr({ body: '## Definition of Done\n- [ ] x' }) })).reasons).toEqual([
      'The branch is 2 commits behind main. Update it first.',
      'Definition of Done item not ticked: x',
    ]);
  });

  it.each([
    ['failure'],
    ['timed_out'],
    ['cancelled'],
    ['action_required'],
    ['startup_failure'],
    ['stale'],
    [null],
    ['something_new'],
  ])('refuses when a check on the parent ended as %s', (conclusion) => {
    const parentChecks = [run('gate (full)'), run('classify', conclusion)];

    expect(decide(shipped({ parentChecks })).reasons).toEqual([
      `Ship note rule: the check "classify" on the commit before it did not succeed (${String(conclusion)}).`,
    ]);
  });

  it('refuses when a parent check is still running', () => {
    const parentChecks = [run('gate (full)'), run('classify', null, 'in_progress')];

    expect(decide(shipped({ parentChecks })).reasons).toEqual([
      'Ship note rule: the check "classify" on the commit before it is still running.',
    ]);
  });

  it('refuses when the parent gate check did not pass', () => {
    expect(decide(shipped({ parentChecks: [run('gate (full)', 'failure')] })).reasons).toEqual([
      'Ship note rule: the check "gate (full)" on the commit before it did not succeed (failure).',
    ]);
  });

  it.each([
    ['no checks', []],
    ['only gate (fast)', [run('gate (fast)')]],
    ['only unrelated checks', [run('classify')]],
  ])('refuses when the parent has %s', (_name, parentChecks) => {
    expect(decide(shipped({ parentChecks })).reasons).toEqual([
      'Ship note rule: the commit before the ship note has no passing "gate (full)" or "gate (docs)" check.',
    ]);
  });

  it('refuses when the parent checks could not be read', () => {
    expect(decide(shipped({ parentChecks: undefined })).reasons).toEqual([
      'Ship note rule: the checks on the commit before the ship note could not be read.',
    ]);
  });

  it('refuses a chain of two ship notes, because the parent has no gate check of its own', () => {
    expect(decide(shipped({ parentChecks: [] })).allowed).toBe(false);
  });

  it.each([
    ['a code file', shipNote({ files: ['.planning/STATE.md', 'web/src/App.tsx'] })],
    ['two parents', shipNote({ parents: [PARENT, 'c'.repeat(40)] })],
    ['no files', shipNote({ files: [] })],
  ])('refuses a skip-token head with %s and asks for a CI commit', (_name, headCommit) => {
    expect(decide(shipped({ headCommit })).reasons).toEqual([
      'The newest commit (aaaaaaa) has a skip token but is not a planning-only note, so CI did not check it. Push a commit without a skip token so CI runs.',
    ]);
  });

  it('refuses a head without a skip token and without checks, even when it only touches .planning', () => {
    const headCommit = shipNote({ message: 'docs(03): note' });

    expect(decide(shipped({ headCommit })).reasons).toEqual(['No checks have run on the newest commit (aaaaaaa).']);
  });

  it('refuses a ship note whose own check failed, whatever the parent did', () => {
    expect(decide(shipped({ checks: [check('classify', 'fail')] })).reasons).toEqual(['The check "classify" failed.']);
  });

  it('does not look at the parent when the head itself passed the gate', () => {
    const headCommit = shipNote();

    expect(decide(input({ headCommit, parentChecks: [run('gate (full)', 'failure')] }))).toEqual({
      allowed: true,
      reasons: [],
    });
  });
});

// ---- collect ----

interface Answer {
  readonly status: number | null;
  readonly stdout?: string;
  readonly stderr?: string;
}

interface GhCall {
  readonly command: string;
  readonly args: readonly string[];
}

type Route = readonly [(args: readonly string[]) => boolean, Answer | (() => Answer)];

/** A fake gh: the first route whose matcher accepts the arguments answers; anything else fails the call. */
function fakeGh(routes: readonly Route[]) {
  const calls: GhCall[] = [];
  const runner = (command: string, args: readonly string[]) => {
    calls.push({ command, args });
    for (const [matches, answer] of routes) {
      if (matches(args)) {
        return typeof answer === 'function' ? answer() : answer;
      }
    }
    return { status: 1, stdout: '', stderr: 'unexpected call' };
  };
  return { calls, runner };
}

const joined = (args: readonly string[]) => args.join(' ');
const has = (text: string) => (args: readonly string[]) => joined(args).includes(text);

const prJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    number: 7,
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'main',
    headRefOid: HEAD,
    title: 'feat: x',
    body: TICKED_BODY,
    mergeable: 'MERGEABLE',
    ...overrides,
  });

const commitJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    sha: HEAD,
    commit: { message: 'feat: code change' },
    parents: [{ sha: PARENT }],
    files: [{ filename: 'web/src/App.tsx' }],
    ...overrides,
  });

const happyRoutes = (): Route[] => [
  [has('repo view'), { status: 0, stdout: JSON.stringify({ nameWithOwner: SLUG }) }],
  [has('pr view'), { status: 0, stdout: prJson() }],
  [
    has('pr checks'),
    {
      status: 0,
      stdout: JSON.stringify([{ name: 'gate (full)', state: 'SUCCESS', bucket: 'pass', workflow: 'CI' }]),
    },
  ],
  [has(`compare/main...${HEAD}`), { status: 0, stdout: '0\n' }],
  [has(`commits/${HEAD}`), { status: 0, stdout: commitJson() }],
];

describe('collect', () => {
  it('reads the pull request, its checks, how far behind main it is, and the head commit through gh', () => {
    const { calls, runner } = fakeGh(happyRoutes());

    const data = collect(7, runner);

    expect(data.pr).toMatchObject({
      number: 7,
      state: 'OPEN',
      headRefOid: HEAD,
      baseRefName: 'main',
      mergeable: 'MERGEABLE',
    });
    expect(data.checks).toEqual([{ name: 'gate (full)', bucket: 'pass' }]);
    expect(data.behindBy).toBe(0);
    expect(data.headCommit).toEqual({ message: 'feat: code change', parents: [PARENT], files: ['web/src/App.tsx'] });
    expect(data.parentChecks).toBeUndefined();
    expect(decide(data)).toEqual({ allowed: true, reasons: [] });
    expect(calls.every((call) => call.command === 'gh')).toBe(true);
    expect(calls.find((call) => joined(call.args).startsWith('pr view'))?.args).toEqual([
      'pr',
      'view',
      '7',
      '--repo',
      SLUG,
      '--json',
      'number,state,isDraft,baseRefName,headRefOid,title,body,mergeable',
    ]);
  });

  it('only reads: no call merges, edits or sends anything', () => {
    const { calls, runner } = fakeGh(happyRoutes());

    collect(7, runner);

    for (const call of calls) {
      expect(['repo', 'pr', 'api']).toContain(call.args[0]);
      expect(call.args).not.toContain('merge');
      expect(call.args).not.toContain('-X');
      expect(call.args).not.toContain('--method');
      expect(call.args).not.toContain('-f');
      expect(call.args).not.toContain('-F');
    }
  });

  it.each([1, 8])('reads the check list when gh pr checks exits %i for a failing or pending check', (status) => {
    const checks = JSON.stringify([{ name: 'gate (full)', state: 'FAILURE', bucket: 'fail', workflow: 'CI' }]);
    const { runner } = fakeGh([[has('pr checks'), { status, stdout: checks }], ...happyRoutes()]);

    expect(collect(7, runner).checks).toEqual([{ name: 'gate (full)', bucket: 'fail' }]);
  });

  it.each([
    ["no checks reported on the 'feature' branch", ''],
    ['', "no checks reported on the 'feature' branch"],
  ])('treats "no checks reported" as an empty list (%#)', (stderr, stdout) => {
    const { runner } = fakeGh([[has('pr checks'), { status: 1, stdout, stderr }], ...happyRoutes()]);

    const data = collect(7, runner);

    expect(data.checks).toEqual([]);
    expect(decide(data).allowed).toBe(false);
  });

  it('looks at the parent commit check runs only when the ship note rule needs them', () => {
    const checkRuns = JSON.stringify({
      total_count: 2,
      check_runs: [
        { name: 'gate (full)', status: 'completed', conclusion: 'success', id: 1 },
        { name: 'classify', status: 'completed', conclusion: 'success', id: 2 },
      ],
    });
    const note = commitJson({
      commit: { message: 'docs(03): ship phase 3 [ci skip]' },
      files: [{ filename: '.planning/STATE.md' }],
    });
    const { calls, runner } = fakeGh([
      [has('pr checks'), { status: 1, stdout: '', stderr: "no checks reported on the 'x' branch" }],
      [has(`commits/${PARENT}/check-runs`), { status: 0, stdout: checkRuns }],
      [has(`commits/${HEAD}`), { status: 0, stdout: note }],
      ...happyRoutes(),
    ]);

    const data = collect(7, runner);

    expect(data.parentChecks).toEqual([
      { name: 'gate (full)', status: 'completed', conclusion: 'success' },
      { name: 'classify', status: 'completed', conclusion: 'success' },
    ]);
    expect(decide(data)).toEqual({ allowed: true, reasons: [] });
    expect(calls.some((call) => joined(call.args).includes(`commits/${PARENT}/check-runs`))).toBe(true);
  });

  it('does not look at the parent for an ordinary head commit or when the head already passed', () => {
    const { calls, runner } = fakeGh(happyRoutes());

    collect(7, runner);

    expect(calls.some((call) => joined(call.args).includes('check-runs'))).toBe(false);
  });

  it('lists both paths of a rename, so a move into .planning cannot hide the source path', () => {
    const note = commitJson({
      commit: { message: 'docs: x [skip ci]' },
      files: [{ filename: '.planning/moved.cs', previous_filename: 'src/real.cs', status: 'renamed' }],
    });
    const { runner } = fakeGh([[has(`commits/${HEAD}`), { status: 0, stdout: note }], ...happyRoutes()]);

    const data = collect(7, runner);

    expect(data.headCommit?.files).toEqual(['.planning/moved.cs', 'src/real.cs']);
    expect(isPlanningOnlySkipHead(data.headCommit)).toBe(false);
  });

  it('refuses a parent check list that GitHub says is longer than what it returned', () => {
    const checkRuns = JSON.stringify({
      total_count: 150,
      check_runs: [{ name: 'gate (full)', status: 'completed', conclusion: 'success' }],
    });
    const note = commitJson({ commit: { message: 'x [ci skip]' }, files: [{ filename: '.planning/STATE.md' }] });
    const { runner } = fakeGh([
      [has('pr checks'), { status: 1, stdout: 'no checks reported on the branch' }],
      [has(`commits/${PARENT}/check-runs`), { status: 0, stdout: checkRuns }],
      [has(`commits/${HEAD}`), { status: 0, stdout: note }],
      ...happyRoutes(),
    ]);

    expect(() => collect(7, runner)).toThrow(GateInputError);
    expect(() => collect(7, runner)).toThrow(/more check runs than/);
  });

  it.each([
    ['the repository answer is not JSON', has('repo view'), 'the repository'],
    ['the pull request answer is not JSON', has('pr view'), 'the pull request'],
    ['the check list is not JSON', has('pr checks'), 'the check list'],
    ['the commit answer is not JSON', has(`commits/${HEAD}`), 'the head commit'],
  ])('refuses when %s', (_name, matcher, label) => {
    const { runner } = fakeGh([[matcher, { status: 0, stdout: '<html>rate limited</html>' }], ...happyRoutes()]);

    expect(() => collect(7, runner)).toThrow(GateInputError);
    expect(() => collect(7, runner)).toThrow(label);
    expect(() => collect(7, runner)).toThrow(/not valid JSON|not usable/);
  });

  it.each([
    ['a repository name with odd characters', has('repo view'), JSON.stringify({ nameWithOwner: 'a/b;rm -rf' })],
    ['a pull request without a state', has('pr view'), prJson({ state: undefined })],
    ['a head commit id that is not 40 hex characters', has('pr view'), prJson({ headRefOid: '../main' })],
    ['a draft flag that is not a boolean', has('pr view'), prJson({ isDraft: 'false' })],
    ['a check without a bucket', has('pr checks'), JSON.stringify([{ name: 'gate (full)' }])],
    ['a check list that is not a list', has('pr checks'), JSON.stringify({ name: 'gate (full)', bucket: 'pass' })],
    ['a behind count that is not a number', has('compare/'), 'many'],
    ['a negative behind count', has('compare/'), '-1'],
    ['a commit with no parents list', has(`commits/${HEAD}`), JSON.stringify({ commit: { message: 'x' }, files: [] })],
    ['a commit with no message', has(`commits/${HEAD}`), JSON.stringify({ commit: {}, parents: [], files: [] })],
  ])('refuses %s', (_name, matcher, stdout) => {
    const { runner } = fakeGh([[matcher, { status: 0, stdout }], ...happyRoutes()]);

    expect(() => collect(7, runner)).toThrow(GateInputError);
  });

  it.each([
    ['repo view', has('repo view')],
    ['pr view', has('pr view')],
    ['compare', has('compare/')],
    ['the commit lookup', has(`commits/${HEAD}`)],
  ])('refuses when gh fails for %s, without repeating gh output', (_name, matcher) => {
    const { runner } = fakeGh([
      [matcher, { status: 1, stdout: '', stderr: 'token ghp_secret leaked' }],
      ...happyRoutes(),
    ]);

    expect(() => collect(7, runner)).toThrow(GateInputError);
    expect(() => collect(7, runner)).not.toThrow(/ghp_secret/);
  });

  it('refuses when gh exits with a code that is not a check status', () => {
    const { runner } = fakeGh([[has('pr checks'), { status: 4, stdout: '[]' }], ...happyRoutes()]);

    expect(() => collect(7, runner)).toThrow(GateInputError);
  });

  it('refuses when gh cannot start, or is killed by a signal', () => {
    expect(() =>
      collect(7, () => {
        throw new Error('spawn gh ENOENT');
      }),
    ).toThrow(GateInputError);
    expect(() => collect(7, () => ({ status: null, stdout: '' }))).toThrow(GateInputError);
  });
});

// ---- main ----

function harness(routes = happyRoutes()) {
  const { calls, runner } = fakeGh(routes);
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    calls,
    logs,
    errors,
    deps: { run: runner, log: (line: string) => logs.push(line), error: (line: string) => errors.push(line) },
  };
}

describe('main', () => {
  it('exits 0 and prints head=<sha> when the gate allows the pull request', () => {
    const { logs, errors, deps } = harness();

    expect(main(['7'], deps)).toBe(0);

    expect(logs).toContain(`head=${HEAD}`);
    expect(errors).toEqual([]);
  });

  it('exits 1 and prints each reason when the gate refuses', () => {
    const { logs, errors, deps } = harness([
      [has('pr view'), { status: 0, stdout: prJson({ state: 'MERGED' }) }],
      ...happyRoutes(),
    ]);

    expect(main(['7'], deps)).toBe(1);

    expect(logs.join('\n')).not.toContain('head=');
    expect(errors.join('\n')).toContain('The pull request is not open (it is merged).');
    expect(errors.join('\n')).toContain('#7');
  });

  it('exits 1 with a plain reason when gh output cannot be read', () => {
    const { logs, errors, deps } = harness([[has('pr view'), { status: 0, stdout: 'nope' }], ...happyRoutes()]);

    expect(main(['7'], deps)).toBe(1);

    expect(logs.join('\n')).not.toContain('head=');
    expect(errors.join('\n')).toContain('not valid JSON');
    expect(errors.join('\n')).toContain('refuses');
  });

  it.each([
    ['no arguments', []],
    ['a word', ['seven']],
    ['zero', ['0']],
    ['a negative number', ['-3']],
    ['a decimal', ['1.5']],
    ['a number with trailing text', ['7abc']],
    ['two numbers', ['7', '8']],
    ['an unknown flag', ['7', '--force']],
    ['only a flag', ['--local-gate']],
  ])('exits 2 and prints the usage for %s, without calling gh', (_name, argv) => {
    const { calls, errors, deps } = harness();

    expect(main(argv, deps)).toBe(2);

    expect(calls).toEqual([]);
    expect(errors.join('\n')).toContain('Usage: node web/scripts/merge-gate.mjs <pull-request-number>');
  });
});

// ---- local full gate (D-16) ----

const LOCAL_LINES = [
  '- `dotnet build Csps.slnx` : exit 0, Build succeeded',
  '- `dotnet test --solution Csps.slnx` : exit 0, 1200 passed',
  '- `tools/scripts/Invoke-CoverageGate.ps1` : exit 0',
  '- `npm --prefix web run verify` : exit 0',
  '- `npm --prefix web run e2e` : exit 0, 80 passed',
];

/** A body with a ticked Definition of Done and the given lines under the Local full gate heading. */
const bodyWithLocalGate = (lines: readonly string[] = LOCAL_LINES) =>
  ['## Definition of Done', '- [x] done', '', '## Local full gate', '', 'Output pasted below.', '', ...lines, ''].join(
    '\n',
  );

const localInput = (overrides: Partial<GateInput> = {}): GateInput =>
  input({ checks: [], pr: pr({ body: bodyWithLocalGate() }), ...overrides });

describe('local full gate constants', () => {
  it('lists the five D-16 commands and the heading, and cannot be changed', () => {
    expect([...LOCAL_GATE_COMMANDS]).toEqual([
      'dotnet build Csps.slnx',
      'dotnet test --solution Csps.slnx',
      'Invoke-CoverageGate.ps1',
      'npm --prefix web run verify',
      'npm --prefix web run e2e',
    ]);
    expect(LOCAL_GATE_HEADING).toBe('## Local full gate');
    expect(Object.isFrozen(LOCAL_GATE_COMMANDS)).toBe(true);
  });

  it('has a warning that says CI did not check the pull request and has no long dash', () => {
    expect(LOCAL_GATE_WARNING).toBe(
      'WARNING: merging on the local full gate (D-16) because the free CI minutes are used up. CI did not check this PR.',
    );
  });
});

describe('decide: local full gate mode (D-16)', () => {
  it('waives the green-gate rule when every command line says exit 0, even with zero checks', () => {
    expect(decide(localInput({ localGate: true }))).toEqual({ allowed: true, reasons: [] });
  });

  it('does not waive the green-gate rule when the mode is off', () => {
    expect(decide(localInput()).reasons).toEqual(['No checks have run on the newest commit (aaaaaaa).']);
  });

  it('allows the mode with only gate (fast) or unrelated passing checks', () => {
    expect(decide(localInput({ localGate: true, checks: [check('gate (fast)'), check('classify')] })).allowed).toBe(
      true,
    );
  });

  it('still refuses a check that failed, is running or was cancelled', () => {
    for (const [bucket, reason] of [
      ['fail', 'The check "gate (full)" failed.'],
      ['pending', 'The check "gate (full)" is still running.'],
      ['cancel', 'The check "gate (full)" was cancelled.'],
    ] as const) {
      const verdict = decide(localInput({ localGate: true, checks: [check('gate (full)', bucket)] }));

      expect(verdict.reasons).toEqual([reason]);
    }
  });

  it('still applies every other rule', () => {
    const verdict = decide(
      localInput({
        localGate: true,
        behindBy: 4,
        pr: pr({
          isDraft: true,
          body: `## Definition of Done\n- [ ] open\n\n## Local full gate\n${LOCAL_LINES.join('\n')}`,
        }),
      }),
    );

    expect(verdict.reasons).toEqual([
      'The pull request is a draft. Mark it ready for review first.',
      'The branch is 4 commits behind main. Update it first.',
      'Definition of Done item not ticked: open',
    ]);
  });

  it('does not use the ship note rule, so a skip-token head needs no parent checks', () => {
    expect(decide(localInput({ localGate: true, headCommit: shipNote(), parentChecks: undefined })).allowed).toBe(true);
    expect(decide(localInput({ localGate: true, headCommit: shipNote({ files: ['web/src/App.tsx'] }) })).allowed).toBe(
      true,
    );
  });

  it('refuses a body with no Local full gate section', () => {
    const body = '## Definition of Done\n- [x] done';

    expect(decide(localInput({ localGate: true, pr: pr({ body }) })).reasons).toEqual([
      'The pull request body has no "## Local full gate" section.',
    ]);
  });

  it('refuses a placeholder section that has not been filled in', () => {
    const lines = LOCAL_LINES.map((line) => line.replace(/ : exit 0.*/, ' : exit code and output'));
    const reasons = decide(localInput({ localGate: true, pr: pr({ body: bodyWithLocalGate(lines) }) })).reasons;

    expect(reasons).toHaveLength(5);
    expect(reasons[0]).toBe('The "## Local full gate" line for "dotnet build Csps.slnx" does not say exit 0.');
  });

  it.each(LOCAL_GATE_COMMANDS)('refuses a section with no line for %s and names the command', (command) => {
    const lines = LOCAL_LINES.filter((line) => !line.includes(command));
    const verdict = decide(localInput({ localGate: true, pr: pr({ body: bodyWithLocalGate(lines) }) }));

    expect(verdict.reasons).toEqual([`The "## Local full gate" section has no line for "${command}".`]);
  });

  it.each(LOCAL_GATE_COMMANDS)('refuses a %s line that does not say exit 0, and names the command', (command) => {
    const lines = LOCAL_LINES.map((line) => (line.includes(command) ? `- \`${command}\` : it passed` : line));
    const verdict = decide(localInput({ localGate: true, pr: pr({ body: bodyWithLocalGate(lines) }) }));

    expect(verdict.reasons).toEqual([`The "## Local full gate" line for "${command}" does not say exit 0.`]);
  });

  it.each(['exit 1', 'exit 0 then exit 2', 'exit 10', 'exit 01'])(
    'refuses a line that says "%s" instead of a clean exit 0',
    (text) => {
      const lines = LOCAL_LINES.map((line) =>
        line.includes('web run verify') ? `- \`npm --prefix web run verify\` : ${text}` : line,
      );

      expect(decide(localInput({ localGate: true, pr: pr({ body: bodyWithLocalGate(lines) }) })).reasons).toEqual([
        'The "## Local full gate" line for "npm --prefix web run verify" does not say exit 0.',
      ]);
    },
  );

  it('accepts the command on a line other than the first when one line says exit 0', () => {
    const lines = ['PS> npm --prefix web run verify', ...LOCAL_LINES];

    expect(decide(localInput({ localGate: true, pr: pr({ body: bodyWithLocalGate(lines) }) })).allowed).toBe(true);
  });

  it('ignores a command line that sits in another section or inside a code fence', () => {
    const lines = LOCAL_LINES.slice(0, 4);
    const body = [
      '## Definition of Done',
      '- [x] done',
      '## Local full gate',
      ...lines,
      '```',
      LOCAL_LINES[4] ?? '',
      '```',
      '## Notes',
      LOCAL_LINES[4] ?? '',
    ].join('\n');

    expect(decide(localInput({ localGate: true, pr: pr({ body }) })).reasons).toEqual([
      'The "## Local full gate" section has no line for "npm --prefix web run e2e".',
    ]);
  });

  it('reads Windows line endings', () => {
    const body = bodyWithLocalGate().replaceAll('\n', '\r\n');

    expect(decide(localInput({ localGate: true, pr: pr({ body }) })).allowed).toBe(true);
  });
});

describe('main with --local-gate', () => {
  const localRoutes = (): Route[] => [
    [has('pr view'), { status: 0, stdout: prJson({ body: bodyWithLocalGate() }) }],
    [has('pr checks'), { status: 1, stdout: '', stderr: "no checks reported on the 'x' branch" }],
    ...happyRoutes(),
  ];

  it('allows the merge on the local gate, prints head=<sha>, and writes the warning once to stderr', () => {
    const { logs, errors, deps } = harness(localRoutes());

    expect(main(['7', '--local-gate'], deps)).toBe(0);

    expect(logs).toContain(`head=${HEAD}`);
    expect(errors).toEqual([LOCAL_GATE_WARNING]);
  });

  it('takes the flag before the number too', () => {
    const { logs, deps } = harness(localRoutes());

    expect(main(['--local-gate', '7'], deps)).toBe(0);

    expect(logs).toContain(`head=${HEAD}`);
  });

  it('writes the warning even when the gate refuses, and still refuses a failed check', () => {
    const { logs, errors, deps } = harness([
      [has('pr checks'), { status: 1, stdout: JSON.stringify([{ name: 'gate (full)', bucket: 'fail' }]) }],
      ...localRoutes(),
    ]);

    expect(main(['7', '--local-gate'], deps)).toBe(1);

    expect(logs.join('\n')).not.toContain('head=');
    expect(errors.filter((line) => line === LOCAL_GATE_WARNING)).toHaveLength(1);
    expect(errors.join('\n')).toContain('The check "gate (full)" failed.');
  });

  it('refuses a body without the pasted local gate', () => {
    const { logs, errors, deps } = harness([
      [has('pr view'), { status: 0, stdout: prJson({ body: '## Definition of Done\n- [x] done' }) }],
      [has('pr checks'), { status: 1, stdout: '', stderr: 'no checks reported' }],
      ...happyRoutes(),
    ]);

    expect(main(['7', '--local-gate'], deps)).toBe(1);

    expect(logs.join('\n')).not.toContain('head=');
    expect(errors.join('\n')).toContain('The pull request body has no "## Local full gate" section.');
  });

  it('does not write the warning without the flag', () => {
    const { errors, deps } = harness();

    expect(main(['7'], deps)).toBe(0);

    expect(errors).toEqual([]);
  });

  it('exits 2 for a repeated flag, without calling gh or writing the warning', () => {
    const { calls, errors, deps } = harness(localRoutes());

    expect(main(['7', '--local-gate', '--local-gate'], deps)).toBe(2);

    expect(calls).toEqual([]);
    expect(errors.join('\n')).toContain('Usage: node web/scripts/merge-gate.mjs <pull-request-number> [--local-gate]');
    expect(errors).not.toContain(LOCAL_GATE_WARNING);
  });
});

// ---- the squash commit message ----

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');
const fromB64 = (text: string) => Buffer.from(text, 'base64').toString('utf8');
const BODY_LINE = `Merged from pull request #7 at head commit ${HEAD} by tools/scripts/Merge-PullRequest.ps1.`;
const markerReason = (match: string) =>
  `The squash commit message would contain the GitHub skip marker "${match}", so no workflow would run on main after the merge. Remove it from the pull request title.`;

describe('squashMessage', () => {
  it('builds "<title> (#<n>)" with a one-line body naming the pull request and the approved head', () => {
    expect(squashMessage(pr())).toEqual({ subject: 'feat(03-03): something (#7)', body: BODY_LINE });
  });

  it('trims the title', () => {
    expect(squashMessage(pr({ title: '  fix: x  ' })).subject).toBe('fix: x (#7)');
  });

  it('never takes the pull request body into the message (the fb9b20c regression)', () => {
    const body = `${TICKED_BODY}\n\nAn old commit said [skip ci] once.`;
    const request = pr({ body });
    const message = squashMessage(request);

    expect(decide(input({ pr: request }))).toEqual({ allowed: true, reasons: [] });
    expect(`${message.subject}\n${message.body}`).not.toContain('skip ci');
    expect(skipMarkersIn(`${message.subject}\n${message.body}`)).toEqual([]);
  });
});

describe('skipMarkersIn', () => {
  it.each([...SKIP_TOKENS])('finds %s inside a sentence', (token) => {
    expect(skipMarkersIn(`docs: tidy ${token} please`)).toEqual([token]);
  });

  it.each([
    ['[SKIP CI]'],
    ['[Ci Skip]'],
    ['[skip  ci]'],
    ['[ skip ci]'],
    ['[no ci ]'],
    ['[ACTIONS   SKIP]'],
    ['skip-checks:true'],
    ['Skip-Checks:  TRUE'],
  ])('finds the variant %s as written', (variant) => {
    expect(skipMarkersIn(`feat: x ${variant}`)).toEqual([variant]);
  });

  it.each([
    'feat: skip the CI cache step',
    'docs: explain the ci skip rule',
    'fix: skip-checks: false',
    'feat(03-03): something (#7)',
  ])('finds nothing in "%s"', (text) => {
    expect(skipMarkersIn(text)).toEqual([]);
  });

  it('returns every match in text order, as written', () => {
    expect(skipMarkersIn('a [No CI] b [skip actions] c')).toEqual(['[No CI]', '[skip actions]']);
  });
});

describe('decide: the squash commit message', () => {
  it.each([...SKIP_TOKENS.filter((token) => token !== 'skip-checks: true'), '[SKIP CI]'])(
    'refuses a title holding %s',
    (token) => {
      expect(refusalOf({ pr: pr({ title: `feat: x ${token}` }) })).toEqual([markerReason(token)]);
    },
  );

  it('refuses a title holding a skip-checks line', () => {
    expect(refusalOf({ pr: pr({ title: 'feat: x skip-checks:true' }) })).toEqual([markerReason('skip-checks:true')]);
  });

  it('refuses a title with a double quote', () => {
    expect(refusalOf({ pr: pr({ title: 'feat: x" --admin "y' }) })).toEqual([
      'The pull request title has a double quote ("), which the merge command cannot pass to gh safely. Remove it from the title.',
    ]);
  });

  it.each([
    ['a bell character', `feat: x${String.fromCodePoint(7)}y`],
    ['a tab', 'feat:\tx'],
  ])('refuses a title with %s', (_name, title) => {
    expect(refusalOf({ pr: pr({ title }) })).toEqual([
      'The pull request title has a control character. Remove it from the title.',
    ]);
  });

  it('refuses a title with only whitespace', () => {
    expect(refusalOf({ pr: pr({ title: '   ' }) })).toEqual([
      'The pull request title is empty. Give it a title first.',
    ]);
  });

  it('puts the title reasons after the Definition of Done reasons', () => {
    expect(refusalOf({ pr: pr({ title: 'feat: x [skip ci]', body: '' }) })).toEqual([
      'The pull request body has no "## Definition of Done" section.',
      markerReason('[skip ci]'),
    ]);
  });

  it('also refuses in local gate mode', () => {
    const verdict = decide(
      localInput({ localGate: true, pr: pr({ title: 'feat: x [ci skip]', body: bodyWithLocalGate() }) }),
    );

    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons).toEqual([markerReason('[ci skip]')]);
  });
});

describe('main: the squash message lines', () => {
  it('prints the subject, head and base64 subject and body once each when allowed', () => {
    const { logs, errors, deps } = harness();

    expect(main(['7'], deps)).toBe(0);

    expect(logs.filter((line) => line === 'Squash commit subject: feat: x (#7)')).toHaveLength(1);
    expect(logs.filter((line) => line === `head=${HEAD}`)).toHaveLength(1);
    expect(logs.filter((line) => line === `subject-base64=${b64('feat: x (#7)')}`)).toHaveLength(1);
    expect(logs.filter((line) => line === `body-base64=${b64(BODY_LINE)}`)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it('carries a title with the peso sign unchanged through base64', () => {
    const { logs, deps } = harness([
      [has('pr view'), { status: 0, stdout: prJson({ title: 'fix: show ₱ totals' }) }],
      ...happyRoutes(),
    ]);

    expect(main(['7'], deps)).toBe(0);

    const line = logs.find((entry) => entry.startsWith('subject-base64='));
    expect(fromB64(line?.slice('subject-base64='.length) ?? '')).toBe('fix: show ₱ totals (#7)');
  });

  it('refuses a title with a skip marker and prints none of the merge lines', () => {
    const { logs, errors, deps } = harness([
      [has('pr view'), { status: 0, stdout: prJson({ title: 'feat: x [skip ci]' }) }],
      ...happyRoutes(),
    ]);

    expect(main(['7'], deps)).toBe(1);

    expect(errors.join('\n')).toContain(markerReason('[skip ci]'));
    expect(errors.join('\n')).toContain('#7');
    for (const prefix of ['head=', 'subject-base64=', 'body-base64=']) {
      expect(logs.some((line) => line.startsWith(prefix))).toBe(false);
    }
  });
});
