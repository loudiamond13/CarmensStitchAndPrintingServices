// @vitest-environment node
// Proves that each architecture lint rule fires (WEB-04, WEB-10, QUAL-02). The rules run through ESLint's Linter on
// virtual file names, with no type information, exactly as they are exported from eslint.config.mjs.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { architectureRules } from '../../eslint.config.mjs';

const webRoot = fileURLToPath(new URL('../../', import.meta.url));
const linter = new Linter({ cwd: webRoot, configType: 'flat' });
const config: Linter.Config[] = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  },
  ...architectureRules,
];

function lint(code: string, file: string): Linter.LintMessage[] {
  return linter.verify(code, config, { filename: path.join(webRoot, file) });
}

describe('architecture lint rules', () => {
  it('httpClient import outside api.ts is an error', () => {
    const code = "import { createHttpClient } from '@/lib/http/httpClient';\nexport const client = createHttpClient;\n";

    const outside = lint(code, 'src/features/demo.tsx');
    expect(outside.map((m) => [m.ruleId, m.severity])).toEqual([['no-restricted-imports', 2]]);
    expect(outside[0]?.message).toContain('Only src/lib/api.ts may use the HTTP client');

    expect(lint(code, 'src/lib/api.ts')).toEqual([]);
  });
});
