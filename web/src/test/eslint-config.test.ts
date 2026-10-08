// @vitest-environment node
// Pins the shape of the ESLint config (QUAL-02): no warn-level rule anywhere, unused disable directives are errors,
// the Pitfall 6 nullish-coalescing options, the global ignores and eslint-config-prettier last.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ESLint, Linter } from 'eslint';
import prettier from 'eslint-config-prettier';
import { describe, expect, it } from 'vitest';
import config from '../../eslint.config.mjs';

const webRoot = fileURLToPath(new URL('../../', import.meta.url));

function severityOf(entry: Linter.RuleEntry | undefined): unknown {
  return Array.isArray(entry) ? entry[0] : entry;
}

/** Every rule id set to 'warn' or 1 in any entry of the config array. */
function warnLevelRules(entries: readonly Linter.Config[]): string[] {
  return entries.flatMap((entry) =>
    Object.entries(entry.rules ?? {})
      .filter(([, rule]) => severityOf(rule) === 'warn' || severityOf(rule) === 1)
      .map(([id]) => id),
  );
}

describe('eslint.config.mjs', () => {
  it('has no rule at warn level in any entry', () => {
    expect(config.length).toBeGreaterThan(10);
    expect(warnLevelRules(config)).toEqual([]);
  });

  it.each(['src/features/a.ts', 'src/features/a.tsx', 'scripts/tool.ts', 'eslint.config.mjs'])(
    'resolves no warn-level rule for %s',
    async (file) => {
      const eslint = new ESLint({ cwd: webRoot });
      const resolved = (await eslint.calculateConfigForFile(path.join(webRoot, file))) as Linter.Config;
      const rules = Object.entries(resolved.rules ?? {});
      expect(rules.length).toBeGreaterThan(50);
      expect(rules.filter(([, rule]) => severityOf(rule) === 1 || severityOf(rule) === 'warn')).toEqual([]);
    },
  );

  it('reports unused eslint-disable directives as errors', () => {
    const options = config.find((entry) => entry.linterOptions !== undefined)?.linterOptions;
    expect(options?.reportUnusedDisableDirectives).toBe('error');

    const linter = new Linter({ configType: 'flat' });
    const messages = linter.verify('// eslint-disable-next-line no-console\nexport const x = 1;\n', [
      { linterOptions: options ?? {}, rules: { 'no-console': 'error' } },
    ]);
    expect(messages.map((m) => m.severity)).toEqual([2]);
    expect(messages[0]?.message).toContain('Unused eslint-disable directive');
  });

  it('keeps || on string, number and boolean fallbacks (research Pitfall 6)', async () => {
    const eslint = new ESLint({ cwd: webRoot });
    const resolved = (await eslint.calculateConfigForFile(path.join(webRoot, 'src/ui/index.tsx'))) as Linter.Config;
    expect(resolved.rules?.['@typescript-eslint/prefer-nullish-coalescing']).toEqual([
      2,
      expect.objectContaining({ ignorePrimitives: { string: true, number: true, boolean: true } }),
    ]);
  });

  it('globally ignores the frozen reference copies and the generated API types', () => {
    const globalIgnores = config
      .filter((entry) => entry.ignores !== undefined && entry.files === undefined && entry.rules === undefined)
      .flatMap((entry) => entry.ignores ?? []);
    expect(globalIgnores).toEqual(expect.arrayContaining(['src/ui/__reference__/**', 'src/types/api.generated.ts']));
  });

  it('applies jsx-a11y-x strict to TSX and the type-aware project service', async () => {
    const eslint = new ESLint({ cwd: webRoot });
    const tsx = (await eslint.calculateConfigForFile(path.join(webRoot, 'src/features/a.tsx'))) as Linter.Config;
    expect(severityOf(tsx.rules?.['jsx-a11y-x/alt-text'])).toBe(2);
    expect(severityOf(tsx.rules?.['react-hooks/exhaustive-deps'])).toBe(2);
    expect(severityOf(tsx.rules?.['@typescript-eslint/no-unsafe-assignment'])).toBe(2);
    expect(tsx.languageOptions?.parserOptions).toEqual(expect.objectContaining({ projectService: true }));
  });

  it('puts eslint-config-prettier last, so formatting rules never fight Prettier', () => {
    expect(config.at(-1)).toBe(prettier);
  });
});
