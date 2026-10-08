// @vitest-environment node
// The golden-vector generator (WEB-07, D-09): it builds at least 200 uniquely named cases across every category from
// fixed seeds, and `--check` fails when tests/fixtures/order-math-golden-vectors.json differs from its exact output.
// These tests only READ the committed file; every write goes to a temporary copy (WEB-07 concurrency edge).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CATEGORIES, VECTOR_FILE, buildCases, firstDifference, renderVectorFile } from './gen-golden-vectors.mjs';

const script = fileURLToPath(new URL('./gen-golden-vectors.mjs', import.meta.url));
const SEED_ORDERS = [
  'ord-2026-0139',
  'ord-2026-0142',
  'ord-2026-0148',
  'ord-2026-0151',
  'ord-2026-0153',
  'ord-2026-0155',
  'ord-2026-0157',
  'ord-2026-0159',
];
const AMOUNT = /^-?\d+\.\d+$|^\d+$/;

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryFile(text: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'csps-golden-'));
  temporaryDirectories.push(directory);
  const file = path.join(directory, 'vectors.json');
  writeFileSync(file, text);
  return file;
}

function run(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

describe('buildCases', () => {
  const cases = buildCases();

  it('builds at least 200 cases with unique ids', () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it('covers exactly the eight categories', () => {
    expect(CATEGORIES).toEqual([
      'midpoint',
      'ord-fixture',
      'percent-100',
      'zero-items',
      'multi-discount',
      'negative-balance',
      'large-value',
      'seeded-random',
    ]);
    expect([...new Set(cases.map((c) => c.category))].sort()).toEqual([...CATEGORIES].sort());
  });

  it('keeps the tracer case ids and every spec section 12.2 seed order', () => {
    const ids = cases.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['midpoint-7-5-percent-of-17', 'zero-items', ...SEED_ORDERS]));
    expect(
      cases
        .filter((c) => c.category === 'ord-fixture')
        .map((c) => c.id)
        .sort(),
    ).toEqual(SEED_ORDERS);
  });

  it('writes every amount as a decimal string and every quantity as a whole number', () => {
    for (const c of cases) {
      const amounts = [
        ...c.items.map((i) => i.unitPrice),
        ...c.discounts.map((d) => d.value),
        ...c.payments,
        ...c.expenses,
        ...Object.values(c.expected).filter((value) => typeof value === 'string'),
      ];
      expect(amounts.every((amount) => AMOUNT.test(amount))).toBe(true);
      expect(c.items.every((i) => Number.isInteger(i.quantity) && i.quantity >= 0)).toBe(true);
    }
  });

  it('is deterministic: the same seeds always render the same bytes', () => {
    expect(renderVectorFile(buildCases())).toBe(renderVectorFile(cases));
  });

  it('renders LF-only JSON with a trailing newline and the pinned operation order', () => {
    const text = renderVectorFile(cases);
    expect(text).not.toContain('\r');
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toMatchObject({
      version: 1,
      operationOrder:
        'round the items total; round each discount; sum the discounts and round the sum; subtract (D-09)',
    });
  });
});

describe('the drift check', () => {
  it('finds no difference between the committed file and the generator output', () => {
    expect(firstDifference(readFileSync(VECTOR_FILE, 'utf8'), renderVectorFile(buildCases()))).toBeUndefined();
  });

  it('names the first differing line', () => {
    expect(firstDifference('a\nb\nc\n', 'a\nB\nc\n')).toBe('line 2: expected "B" but found "b"');
    expect(firstDifference('a\n', 'a\nb\n')).toBe('line 2: expected "b" but found the end of the file');
    expect(firstDifference('a\nb\n', 'a\n')).toBe('line 2: expected the end of the file but found "b"');
    expect(firstDifference('a', 'a\n')).toBe('the final newline differs');
  });

  it('--check exits 0 on the committed file and never writes it', () => {
    const before = statSync(VECTOR_FILE).mtimeMs;
    const result = run('--check');
    expect(result.status, result.stderr).toBe(0);
    expect(statSync(VECTOR_FILE).mtimeMs).toBe(before);
  });

  it('--check exits 1 on a drifted copy, and --write repairs it', () => {
    const file = temporaryFile(renderVectorFile(buildCases()).replace('"1.28"', '"1.27"'));

    const drifted = run('--check', '--file', file);
    expect(drifted.status).toBe(1);
    expect(drifted.stderr).toContain('expected');

    expect(run('--write', '--file', file).status).toBe(0);
    expect(run('--check', '--file', file).status).toBe(0);
  });

  it('--check exits 1 when the file is missing', () => {
    const file = path.join(path.dirname(temporaryFile('')), 'missing.json');
    expect(run('--check', '--file', file).status).toBe(1);
  });

  it('needs exactly one of --write or --check', () => {
    expect(run().status).toBe(1);
    expect(run('--write', '--check').status).toBe(1);
  });
});
