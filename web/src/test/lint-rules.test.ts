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

const featureFile = 'src/features/a.ts';

function lint(code: string, file: string): Linter.LintMessage[] {
  return linter.verify(code, config, { filename: path.join(webRoot, file) });
}

/** Rule id and severity of every message, so a parse error (rule id null) can never pass as a clean result. */
function findings(code: string, file = featureFile): [string | null, Linter.Severity][] {
  return lint(code, file).map((m) => [m.ruleId, m.severity]);
}

describe('architecture lint rules', () => {
  it('httpClient import outside api.ts is an error', () => {
    const code = "import { createHttpClient } from '@/lib/http/httpClient';\nexport const client = createHttpClient;\n";

    const outside = lint(code, 'src/features/demo.tsx');
    expect(outside.map((m) => [m.ruleId, m.severity])).toEqual([['no-restricted-imports', 2]]);
    expect(outside[0]?.message).toContain('Only src/lib/api.ts may use the HTTP client');

    expect(lint(code, 'src/lib/api.ts')).toEqual([]);
  });

  it('a relative lib/http import outside api.ts is an error, and api.test.ts may import it', () => {
    const code =
      "import { createHttpClient } from '../lib/http/httpClient';\nexport const client = createHttpClient;\n";

    expect(findings(code, 'src/features/a.ts')).toEqual([['no-restricted-imports', 2]]);
    expect(
      findings(
        "import { createHttpClient } from '@/lib/http/httpClient';\nexport const c = createHttpClient;\n",
        'src/lib/api.test.ts',
      ),
    ).toEqual([]);
  });

  it('an axios import is an error', () => {
    expect(findings("import axios from 'axios';\nexport default axios;\n")).toEqual([['no-restricted-imports', 2]]);
  });

  it('axios stays forbidden in api.ts', () => {
    expect(findings("import axios from 'axios';\nexport default axios;\n", 'src/lib/api.ts')).toEqual([
      ['no-restricted-imports', 2],
    ]);
  });

  it('a react-router-dom import is an error', () => {
    expect(findings("import { Link } from 'react-router-dom';\nexport { Link };\n")).toEqual([
      ['no-restricted-imports', 2],
    ]);
  });

  it.each([
    'nuqs/adapters/react-router',
    'nuqs/adapters/react-router/v6',
    'nuqs/adapters/react-router/v7',
    'nuqs/adapters/react',
  ])('the deprecated nuqs adapter path %s is an error', (adapter) => {
    expect(findings(`import { NuqsAdapter } from '${adapter}';\nexport { NuqsAdapter };\n`)).toEqual([
      ['no-restricted-imports', 2],
    ]);
  });

  it('the nuqs React Router v8 adapter is clean', () => {
    expect(findings("import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';\nexport { NuqsAdapter };\n")).toEqual(
      [],
    );
  });

  it.each(['parseAsIsoDate', 'parseAsIsoDateTime'])('importing %s from nuqs is an error', (parser) => {
    const messages = lint(`import { ${parser} } from 'nuqs';\nexport { ${parser} };\n`, featureFile);
    expect(messages.map((m) => [m.ruleId, m.severity])).toEqual([['no-restricted-imports', 2]]);
    expect(messages[0]?.message).toContain('parseAsBusinessDate');
  });

  it('other nuqs parsers are clean', () => {
    expect(findings("import { parseAsInteger } from 'nuqs';\nexport { parseAsInteger };\n")).toEqual([]);
  });

  it('the nuqs startTransition option is an error', () => {
    const code =
      "import { useQueryState } from 'nuqs';\nimport { startTransition } from 'react';\n" +
      "export const useQ = () => useQueryState('q', { startTransition });\n";
    expect(findings(code)).toEqual([['no-restricted-syntax', 2]]);
  });

  it("React's useTransition destructuring is clean", () => {
    const code =
      "import { useTransition } from 'react';\n" +
      'export function usePending() {\n  const [isPending, startTransition] = useTransition();\n  return { isPending, start: startTransition };\n}\n';
    expect(findings(code)).toEqual([]);
  });

  it('shallow: false is an error and shallow: true is clean', () => {
    expect(findings('export const options = { shallow: false };\n')).toEqual([['no-restricted-syntax', 2]]);
    expect(findings('export const options = { shallow: true };\n')).toEqual([]);
  });

  it('bare fetch outside lib/http is an error, and lib/http may use it', () => {
    const code = "export const load = () => fetch('/x');\n";
    expect(findings(code)).toEqual([['no-restricted-globals', 2]]);
    expect(findings(code, 'src/lib/http/httpClient.ts')).toEqual([]);
  });

  it.each(['window', 'globalThis', 'self'])('%s.fetch outside lib/http is an error', (owner) => {
    expect(findings(`export const load = () => ${owner}.fetch('/x');\n`)).toEqual([['no-restricted-syntax', 2]]);
  });

  it('globalThis.fetch inside lib/http is clean', () => {
    expect(findings("export const load = () => globalThis.fetch('/x');\n", 'src/lib/http/httpClient.ts')).toEqual([]);
  });

  it('new XMLHttpRequest() outside lib/http is an error, and lib/http may use it', () => {
    const code = 'export const create = () => new XMLHttpRequest();\n';
    expect(findings(code)).toEqual([['no-restricted-globals', 2]]);
    expect(findings(code, 'src/lib/http/xhr.ts')).toEqual([]);
  });

  it('the raw-HTML JSX attribute is an error, also inside lib/http', () => {
    const code = "export const Html = () => <div dangerouslySetInnerHTML={{ __html: '<b>x</b>' }} />;\n";
    expect(findings(code, 'src/features/a.tsx')).toEqual([['no-restricted-syntax', 2]]);
    expect(findings(code, 'src/lib/http/a.tsx')).toEqual([['no-restricted-syntax', 2]]);
  });

  it('console in app code is an error', () => {
    expect(findings("console.log('x');\n")).toEqual([['no-console', 2]]);
    expect(findings("console.error('x');\n")).toEqual([['no-console', 2]]);
  });

  it('a non-null assertion is an error', () => {
    expect(findings('export const first = (value: string | undefined) => value!;\n')).toEqual([
      ['@typescript-eslint/no-non-null-assertion', 2],
    ]);
  });

  it('an explicit any is an error', () => {
    expect(findings('let x: any = 1;\nexport { x };\n')).toEqual([['@typescript-eslint/no-explicit-any', 2]]);
  });

  it('the rules apply only to app source', () => {
    expect(findings("import axios from 'axios';\nconsole.log(axios);\n", 'scripts/tool.ts')).toEqual([]);
  });
});
