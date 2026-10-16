// @vitest-environment node
// Pins the Conventional Commits check (OPS-01): the PR title and every non-merge commit subject in base..head must read
// `type(scope)!: summary`, or be a git `Revert "..."` subject. Each refusal names what is wrong, and the PR title only ever
// arrives through env.
import { describe, expect, it } from 'vitest';
import { checkSubject, CONVENTIONAL_TYPES, main } from './commit-lint.mjs';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

/** A fake spawn that answers with one planned result and records what was run. */
function harness(result: { status: number | null; stdout?: string } | 'throw') {
  const calls: { command: string; args: readonly string[] }[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    calls,
    logs,
    errors,
    deps: {
      spawn: (command: string, args: readonly string[]) => {
        calls.push({ command, args });
        if (result === 'throw') {
          throw new Error('spawn failed');
        }
        return result;
      },
      log: (line: string) => logs.push(line),
      error: (line: string) => errors.push(line),
    },
  };
}

const env = { PR_TITLE: 'feat(03): CI/CD pipeline', BASE_SHA: BASE, HEAD_SHA: HEAD };

describe('CONVENTIONAL_TYPES', () => {
  it('lists the eleven allowed types and cannot be changed', () => {
    expect([...CONVENTIONAL_TYPES].sort()).toEqual([
      'build',
      'chore',
      'ci',
      'docs',
      'feat',
      'fix',
      'perf',
      'refactor',
      'revert',
      'style',
      'test',
    ]);
    expect(Object.isFrozen(CONVENTIONAL_TYPES)).toBe(true);
  });
});

describe('checkSubject accepts', () => {
  it.each([
    'docs(03): create phase plan',
    'feat(03-01): ordered CI gate',
    'fix(quick-261014-ctx): x',
    'build(deps): bump vite from 8.3.3 to 8.3.4',
    'ci: pin actions',
    'refactor!: drop x',
    'feat(api)!: drop the old route',
    'chore(web/scripts.v2): tidy',
    'Revert "feat(03-01): x"',
    'docs(03): ship phase 3 — PR #5 [ci skip]',
  ])('%s', (subject) => {
    expect(checkSubject(subject)).toEqual({ ok: true, reason: '' });
  });
});

describe('checkSubject refuses', () => {
  it.each([
    ['Update stuff', 'type(scope): summary'],
    ['Feat: x', 'lower case'],
    ['feat(Scope): x', 'scope'],
    ['feat(03):x', 'space'],
    ['feat(03): ', 'summary'],
    ['feat(03):  x', 'space'],
    ['wip(03): x', 'wip'],
    ['feat(): x', 'scope'],
    ['feat(03)', 'type(scope): summary'],
    ['', 'empty'],
    ['   ', 'empty'],
    ['Revert ""', 'Revert'],
  ])('%j with a reason naming %s', (subject, word) => {
    const verdict = checkSubject(subject);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain(word);
  });
});

describe('main', () => {
  it('lists subjects without merges for base..head, passes a clean history and exits 0', () => {
    const { calls, logs, errors, deps } = harness({ status: 0, stdout: 'feat(03-01): a\nfix: b\n' });
    expect(main(env, deps)).toBe(0);
    expect(calls).toEqual([
      { command: 'git', args: ['log', '--no-merges', '--format=%s', `${BASE}..${HEAD}`] },
    ]);
    expect(errors).toEqual([]);
    expect(logs.join('\n')).toContain('2 commit subjects');
  });

  it('exits 1 and prints every offending subject with its reason, title included', () => {
    const { errors, deps } = harness({ status: 0, stdout: 'feat(03-01): a\nUpdate stuff\nFeat: y\n' });
    expect(main({ ...env, PR_TITLE: 'Fix things' }, deps)).toBe(1);
    const text = errors.join('\n');
    expect(text).toContain('PR title');
    expect(text).toContain('Fix things');
    expect(text).toContain('Update stuff');
    expect(text).toContain('Feat: y');
    expect(text).not.toContain('feat(03-01): a');
  });

  it('exits 1 for an empty or missing PR title', () => {
    const { errors, deps } = harness({ status: 0, stdout: 'fix: b\n' });
    expect(main({ BASE_SHA: BASE, HEAD_SHA: HEAD }, deps)).toBe(1);
    expect(errors.join('\n')).toContain('PR title');
  });

  it.each([
    ['BASE_SHA', { PR_TITLE: 'fix: a', HEAD_SHA: HEAD }],
    ['HEAD_SHA', { PR_TITLE: 'fix: a', BASE_SHA: BASE }],
    ['BASE_SHA', { PR_TITLE: 'fix: a', BASE_SHA: '--output=x', HEAD_SHA: HEAD }],
    ['HEAD_SHA', { PR_TITLE: 'fix: a', BASE_SHA: BASE, HEAD_SHA: ' ' }],
  ])('exits 2 without running git when %s is missing or not a commit id', (name, bad) => {
    const { calls, errors, deps } = harness({ status: 0, stdout: '' });
    expect(main(bad, deps)).toBe(2);
    expect(calls).toEqual([]);
    expect(errors.join('\n')).toContain(name);
  });

  it('exits 2 when git fails, because nothing could be checked', () => {
    const failed = harness({ status: 128, stdout: '' });
    expect(main(env, failed.deps)).toBe(2);
    expect(failed.errors.join('\n')).toContain('git log');

    const thrown = harness('throw');
    expect(main(env, thrown.deps)).toBe(2);

    const killed = harness({ status: null });
    expect(main(env, killed.deps)).toBe(2);
  });

  it('checks only the title when the range holds no commits', () => {
    const { deps } = harness({ status: 0, stdout: '' });
    expect(main(env, deps)).toBe(0);
  });
});
