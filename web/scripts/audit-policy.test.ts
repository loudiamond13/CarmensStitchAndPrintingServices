// @vitest-environment node
// npm audit policy (OPS-03, 07.1 D-46). Every advisory npm audit reports fails the gate unless the owner accepted that
// exact advisory id for the packages it names, and the acceptance is not past its review date. An acceptance no advisory
// needs is stale.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { advisoriesOf, evaluateAudit, validateAuditExceptions } from './audit-policy.mjs';

const GLOB = 'GHSA-3g3m-2fjr-6pw4';
const MINIMATCH = 'GHSA-g3hv-75wg-m249';

function advisory(name: string, id: string, title = 'Some flaw', severity = 'moderate') {
  return { source: 1, name, title, severity, url: `https://github.com/advisories/${id}`, range: '<1.0.0' };
}

function report(...vias: ReturnType<typeof advisory>[]) {
  const vulnerabilities: Record<string, unknown> = {};
  for (const via of vias) {
    vulnerabilities[via.name] = { name: via.name, severity: via.severity, via: [via] };
  }
  // A package flagged only through a dependency names it as a string; it adds no advisory of its own.
  vulnerabilities.eslint = { name: 'eslint', severity: 'moderate', via: vias.map((via) => via.name) };
  return { vulnerabilities, metadata: { vulnerabilities: { total: vias.length + 1 } } };
}

function accepted(id: string, packages: string[], reviewBy = '2026-11-14') {
  return {
    id,
    packages,
    reason: 'Used only by the lint, test and license tools; never shipped to the browser.',
    approved: '2026-10-31',
    approvedBy: 'owner',
    reviewBy,
  };
}

describe('advisoriesOf', () => {
  it('lists each advisory once with its GHSA id, package, severity and title', () => {
    const result = advisoriesOf(report(advisory('glob', GLOB, 'Glob flaw'), advisory('minimatch', MINIMATCH)));

    expect(result).toEqual([
      { id: GLOB, package: 'glob', severity: 'moderate', title: 'Glob flaw' },
      { id: MINIMATCH, package: 'minimatch', severity: 'moderate', title: 'Some flaw' },
    ]);
  });

  it('gives nothing for a clean report', () => {
    expect(advisoriesOf({ vulnerabilities: {} })).toEqual([]);
  });

  it('throws when npm audit itself failed', () => {
    expect(() => advisoriesOf({ error: { summary: 'network down' } })).toThrow('npm audit could not run: network down');
  });
});

describe('validateAuditExceptions', () => {
  it('accepts a complete owner acceptance', () => {
    expect(validateAuditExceptions([accepted(GLOB, ['glob'])])).toEqual([]);
  });

  it('reports a bad id, no packages, a missing reason and a non-owner approval', () => {
    const bad = { ...accepted('CVE-1', []), reason: '', approvedBy: 'bot' };

    expect(validateAuditExceptions([bad])).toEqual([
      "Audit exception 1: id 'CVE-1' is not a GHSA id.",
      'Audit exception 1: packages must list at least one package name.',
      'Audit exception 1: reason is required.',
      "Audit exception 1: approvedBy must be 'owner'.",
    ]);
  });

  it('reports a review date that is missing or before the approval', () => {
    expect(
      validateAuditExceptions([accepted(GLOB, ['glob'], '2026-10-01'), accepted(MINIMATCH, ['minimatch'], '')]),
    ).toEqual([
      `Audit exception 1 (${GLOB}): reviewBy must be a date on or after approved.`,
      `Audit exception 2 (${MINIMATCH}): reviewBy must be a date on or after approved.`,
    ]);
  });

  it('reports a list that is not an array', () => {
    expect(validateAuditExceptions({})).toEqual(['Audit exceptions must be a list.']);
  });
});

describe('evaluateAudit', () => {
  const both = [advisoriesOf(report(advisory('glob', GLOB), advisory('minimatch', MINIMATCH)))].flat();

  it('passes when every advisory is accepted and still in date', () => {
    const result = evaluateAudit(both, [accepted(GLOB, ['glob']), accepted(MINIMATCH, ['minimatch'])], '2026-10-31');

    expect(result.problems).toEqual([]);
    expect(result.accepted).toEqual([`${GLOB} (glob)`, `${MINIMATCH} (minimatch)`]);
  });

  it('fails on an advisory nobody accepted', () => {
    const result = evaluateAudit(both, [accepted(GLOB, ['glob'])], '2026-10-31');

    expect(result.problems).toEqual([
      `minimatch: ${MINIMATCH} (moderate) Some flaw. Not accepted: fix it or ask the owner.`,
    ]);
  });

  it('fails on an accepted id reported for a package the acceptance does not name', () => {
    const result = evaluateAudit(
      advisoriesOf(report(advisory('other-glob', GLOB))),
      [accepted(GLOB, ['glob'])],
      '2026-10-31',
    );

    expect(result.problems).toEqual([
      `other-glob: ${GLOB} (moderate) Some flaw. Not accepted: fix it or ask the owner.`,
      `Audit exception ${GLOB} (glob) matches no advisory. Remove it.`,
    ]);
  });

  it('still passes on the review date and fails the day after', () => {
    const exceptions = [accepted(GLOB, ['glob']), accepted(MINIMATCH, ['minimatch'])];

    expect(evaluateAudit(both, exceptions, '2026-11-14').problems).toEqual([]);
    expect(evaluateAudit(both, exceptions, '2026-11-15').problems).toEqual([
      `glob: ${GLOB} was accepted until 2026-11-14. Review it with the owner.`,
      `minimatch: ${MINIMATCH} was accepted until 2026-11-14. Review it with the owner.`,
    ]);
  });

  it('reports an acceptance that no advisory needs as stale', () => {
    const result = evaluateAudit([], [accepted(GLOB, ['glob'])], '2026-10-31');

    expect(result.problems).toEqual([`Audit exception ${GLOB} (glob) matches no advisory. Remove it.`]);
  });
});

describe('audit-gate.mjs', () => {
  const gate = path.join(path.dirname(fileURLToPath(import.meta.url)), 'audit-gate.mjs');

  function run(reports: unknown[], exceptions: unknown, today: string) {
    const dir = mkdtempSync(path.join(tmpdir(), 'audit-gate-'));
    try {
      const args = [gate, '--today', today, '--exceptions', path.join(dir, 'exceptions.json')];
      writeFileSync(path.join(dir, 'exceptions.json'), JSON.stringify({ npmAuditExceptions: exceptions }));
      reports.forEach((item, index) => {
        const file = path.join(dir, `report-${String(index)}.json`);
        writeFileSync(file, JSON.stringify(item));
        args.push('--report', file);
      });
      return spawnSync(process.execPath, args, { encoding: 'utf8' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('exits 0 when every advisory in every tree is accepted', () => {
    const result = run(
      [report(advisory('glob', GLOB), advisory('minimatch', MINIMATCH)), report(advisory('minimatch', MINIMATCH))],
      [accepted(GLOB, ['glob']), accepted(MINIMATCH, ['minimatch'])],
      '2026-10-31',
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Accepted: ${GLOB} (glob)`);
  });

  it('exits 1 and names the advisory when one is not accepted', () => {
    const result = run([report(advisory('glob', GLOB))], [], '2026-10-31');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`glob: ${GLOB} (moderate) Some flaw. Not accepted`);
  });
});
