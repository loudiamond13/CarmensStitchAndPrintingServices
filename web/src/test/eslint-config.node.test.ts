// @vitest-environment node
// Pins the shape of the lint and format gates (QUAL-02): no rule left at warn level in the resolved config for app,
// script and e2e files (L-19), shared-config warns escalated with their options kept, unused disable directives are
// errors, a mistyped lint target fails instead of passing vacuously, and Prettier sorts Tailwind classes.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint, Linter } from 'eslint';
import prettierConfig from 'eslint-config-prettier';
import * as prettier from 'prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { describe, expect, it } from 'vitest';
import config, { escalate } from '../../eslint.config.mjs';

const webRoot = fileURLToPath(new URL('../../', import.meta.url));

function severityOf(entry: Linter.RuleEntry | undefined): unknown {
  return Array.isArray(entry) ? entry[0] : entry;
}

async function resolvedRules(file: string): Promise<Partial<Linter.RulesRecord>> {
  const eslint = new ESLint({ cwd: webRoot });
  const resolved = (await eslint.calculateConfigForFile(path.join(webRoot, file))) as Linter.Config;
  return resolved.rules ?? {};
}

describe('eslint.config.mjs', () => {
  it.each(['src/ui/x.tsx', 'scripts/x.mjs', 'e2e/x.spec.ts'])('resolves no rule at warn level for %s', async (file) => {
    const rules = Object.entries(await resolvedRules(file));
    expect(rules.length).toBeGreaterThan(50);
    expect(rules.filter(([, rule]) => severityOf(rule) === 1 || severityOf(rule) === 'warn')).toEqual([]);
  });

  it('has no rule at warn level in any entry of the raw config', () => {
    const warnLevel = config.flatMap((entry) =>
      Object.entries(entry.rules ?? {})
        .filter(([, rule]) => severityOf(rule) === 'warn' || severityOf(rule) === 1)
        .map(([id]) => id),
    );
    expect(warnLevel).toEqual([]);
  });

  it('escalates react-hooks exhaustive-deps (shipped at warn) to error', async () => {
    expect(severityOf(reactHooks.configs.flat.recommended.rules['react-hooks/exhaustive-deps'])).toBe('warn');
    const rules = await resolvedRules('src/ui/x.tsx');
    expect(severityOf(rules['react-hooks/exhaustive-deps'])).toBe(2);
    expect(severityOf(rules['react-hooks/incompatible-library'])).toBe(2);
    expect(severityOf(rules['react-hooks/unsupported-syntax'])).toBe(2);
  });

  it('escalate() raises warn to error and keeps the options', () => {
    const options = { additionalHooks: '(useMyEffect)' };
    expect(escalate({ rules: { a: ['warn', options], b: 1, c: 'error', d: ['off'], e: [1, 'x'] } }).rules).toEqual({
      a: ['error', options],
      b: 'error',
      c: 'error',
      d: ['off'],
      e: ['error', 'x'],
    });
    expect(escalate({ name: 'no-rules' })).toEqual({ name: 'no-rules' });
  });

  it('keeps || on string, number and boolean fallbacks (research Pitfall 6) and bans deprecated APIs', async () => {
    const rules = await resolvedRules('src/ui/x.tsx');
    expect(rules['@typescript-eslint/prefer-nullish-coalescing']).toEqual([
      2,
      expect.objectContaining({ ignorePrimitives: { string: true, number: true, boolean: true } }),
    ]);
    expect(severityOf(rules['@typescript-eslint/no-deprecated'])).toBe(2);
  });

  it('applies jsx-a11y-x strict, type-aware rules, the bans and the Tailwind rules to app TSX', async () => {
    const rules = await resolvedRules('src/ui/x.tsx');
    expect(severityOf(rules['jsx-a11y-x/alt-text'])).toBe(2);
    expect(severityOf(rules['@typescript-eslint/no-unsafe-assignment'])).toBe(2);
    expect(severityOf(rules['no-restricted-syntax'])).toBe(2);
    expect(severityOf(rules['better-tailwindcss/no-unknown-classes'])).toBe(2);
    expect(severityOf(rules['better-tailwindcss/enforce-consistent-class-order'])).toBe(0);
  });

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

  it('globally ignores tool output and the generated API types', () => {
    const globalIgnores = config
      .filter((entry) => entry.ignores !== undefined && entry.files === undefined && entry.rules === undefined)
      .flatMap((entry) => entry.ignores ?? []);
    expect(globalIgnores).toEqual(
      expect.arrayContaining(['node_modules/**', '.e2e-dist/**', '.vitest/**', 'src/types/api.generated.ts']),
    );
  });

  it('puts eslint-config-prettier last, so formatting rules never fight Prettier', () => {
    expect(config.at(-1)).toBe(prettierConfig);
  });

  it('rejects a lint target that matches no files (QUAL-02 empty edge)', async () => {
    const eslint = new ESLint({ cwd: webRoot });
    await expect(eslint.lintFiles(['src/does-not-exist/**/*.tsx'])).rejects.toThrow(/No files matching/);
  });
});

describe('Prettier with prettier-plugin-tailwindcss (D-36)', () => {
  async function format(code: string): Promise<string> {
    const filepath = path.join(webRoot, 'src/ui/x.tsx');
    const options = await prettier.resolveConfig(filepath, { editorconfig: true });
    return prettier.format(code, { ...options, filepath });
  }

  it('sorts className classes into Tailwind order (QUAL-02 ordering edge)', async () => {
    expect(await format('export const A = () => <div className="p-4 flex" />;\n')).toBe(
      'export const A = () => <div className="flex p-4" />;\n',
    );
  });

  it('sorts clsx and tw arguments', async () => {
    expect(await format("export const a = clsx('p-4 flex');\nexport const b = tw('p-4 flex');\n")).toBe(
      "export const a = clsx('flex p-4');\nexport const b = tw('flex p-4');\n",
    );
  });

  it('formats deterministically: 2-space indent, single quotes, LF', async () => {
    const out = await format('export function f() {\r\nreturn "x"\r\n}\r\n');
    expect(out).toBe("export function f() {\n  return 'x';\n}\n");
  });
});
