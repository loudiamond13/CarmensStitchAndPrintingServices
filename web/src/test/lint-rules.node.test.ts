// @vitest-environment node
// Proves that each architecture, D-33 and Tailwind lint rule fires (WEB-04, WEB-10, QUAL-02, D-33). The rules run
// through ESLint's Linter on virtual file names, with no type information, exactly as eslint.config.mjs exports them.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

/** Rule id, severity and message of every finding, so a parse error (rule id null) never passes as a clean result. */
function lint(code: string, file: string): [string | null, Linter.Severity, string][] {
  return linter
    .verify(code, config, { filename: path.join(webRoot, file) })
    .map((m) => [m.ruleId, m.severity, m.message]);
}

const httpMessage = 'Only src/lib/api.ts may use the HTTP client (WEB-04).';

describe('architecture lint rules', () => {
  it('an @/lib/http import outside api.ts is exactly one no-restricted-imports error', () => {
    const code = "import { createHttpClient } from '@/lib/http/httpClient';\nexport const client = createHttpClient;\n";
    expect(lint(code, 'src/features/x.ts')).toEqual([
      ['no-restricted-imports', 2, expect.stringContaining(httpMessage)],
    ]);
  });

  it('the same import in src/lib/api.ts is clean', () => {
    const code = "import { createHttpClient } from '@/lib/http/httpClient';\nexport const client = createHttpClient;\n";
    expect(lint(code, 'src/lib/api.ts')).toEqual([]);
  });
});
