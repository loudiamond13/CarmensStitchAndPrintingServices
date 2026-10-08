// @vitest-environment node
// Proves that each architecture, D-33 and Tailwind lint rule fires (WEB-04, WEB-10, QUAL-02, D-33, D-36), and stays
// quiet where it must. The rules run through ESLint's Linter on virtual file names, with no type information, exactly
// as eslint.config.mjs exports them; the Tailwind rules resolve classes against the real src/styles/app.css theme.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { architectureRules, tailwindRules } from '../../eslint.config.mjs';

const webRoot = fileURLToPath(new URL('../../', import.meta.url));
const linter = new Linter({ cwd: webRoot, configType: 'flat' });
const config: Linter.Config[] = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  },
  ...architectureRules,
  ...tailwindRules,
];

type Finding = [string | null, Linter.Severity, string];

/** Rule id, severity and message of every finding, so a parse error (rule id null) never passes as a clean result. */
function lint(code: string, file: string): Finding[] {
  return linter
    .verify(code, config, { filename: path.join(webRoot, file) })
    .map((m): Finding => [m.ruleId, m.severity, m.message]);
}

const feature = 'src/features/x.ts';
const featureTsx = 'src/features/x.tsx';

const callApi = 'Call an api.ts function instead (WEB-04).';
const httpOnlyApi = 'Only src/lib/api.ts may use the HTTP client (WEB-04).';
const cssImport = 'D-33: no stylesheet imports; style with utilities. Only main.tsx imports @/styles/app.css.';
const rawHtml = 'Raw HTML injection is forbidden (CWE-79).';
const styleObject = 'D-33: style may only set CSS custom properties (--*); use a utility for everything else.';
const styleValue = 'D-33: style must be an inline object of --* custom properties.';
const classNameTemplate = 'D-33: class names must be complete literals (no template literals in className).';
const classNameConcat = 'D-33: no class-name concatenation in className; use complete literal tokens.';
const classCallTemplate = 'D-33: class names must be complete literals (no template literals in clsx or tw).';
const classCallConcat = 'D-33: no class-name concatenation in clsx or tw; use complete literal tokens.';

const syntax = (message: string): Finding => ['no-restricted-syntax', 2, message];
const restrictedGlobal = (name: string): Finding => [
  'no-restricted-globals',
  2,
  `Unexpected use of '${name}'. ${callApi}`,
];
const restrictedPath = (name: string, message: string): Finding => [
  'no-restricted-imports',
  2,
  `'${name}' import is restricted from being used. ${message}`,
];
const restrictedPattern = (name: string, message: string): Finding => [
  'no-restricted-imports',
  2,
  `'${name}' import is restricted from being used by a pattern. ${message}`,
];
const restrictedName = (importName: string, source: string, message: string): Finding => [
  'no-restricted-imports',
  2,
  `'${importName}' import from '${source}' is restricted. ${message}`,
];

const httpImport =
  "import { createHttpClient } from '@/lib/http/httpClient';\nexport const client = createHttpClient;\n";
const rawHtmlJsx = "export const Html = () => <div dangerouslySetInnerHTML={{ __html: '<b>x</b>' }} />;\n";
const classNameTemplateJsx = 'export const A = (tone: string) => <div className={`bg-${tone}`} />;\n';

describe('WEB-04: the HTTP client stays behind api.ts', () => {
  it('an @/lib/http import outside api.ts is exactly one no-restricted-imports error', () => {
    expect(lint(httpImport, feature)).toEqual([restrictedPattern('@/lib/http/httpClient', httpOnlyApi)]);
  });

  it('the same import in src/lib/api.ts is clean', () => {
    expect(lint(httpImport, 'src/lib/api.ts')).toEqual([]);
  });

  it('a relative lib/http import outside api.ts is an error', () => {
    const code = "import { createHttpClient } from '../lib/http/httpClient';\nexport const c = createHttpClient;\n";
    expect(lint(code, feature)).toEqual([restrictedPattern('../lib/http/httpClient', httpOnlyApi)]);
  });

  it('a lib/http module may import its own modules', () => {
    const code = "import { HttpError } from '@/lib/http/httpError';\nexport { HttpError };\n";
    expect(lint(code, 'src/lib/http/httpClient.ts')).toEqual([]);
  });

  it('bare fetch outside lib/http is an error', () => {
    expect(lint("export const load = () => fetch('/x');\n", feature)).toEqual([restrictedGlobal('fetch')]);
  });

  it('bare fetch inside lib/http is clean', () => {
    expect(lint("export const load = () => fetch('/x');\n", 'src/lib/http/httpClient.ts')).toEqual([]);
  });

  it('window.fetch outside lib/http is an error', () => {
    expect(lint("export const load = () => window.fetch('/x');\n", feature)).toEqual([syntax(callApi)]);
  });

  it('globalThis.fetch outside lib/http is an error', () => {
    expect(lint("export const load = () => globalThis.fetch('/x');\n", feature)).toEqual([syntax(callApi)]);
  });

  it('self.fetch outside lib/http is an error', () => {
    expect(lint("export const load = () => self.fetch('/x');\n", feature)).toEqual([syntax(callApi)]);
  });

  it('globalThis.fetch inside lib/http is clean', () => {
    expect(lint("export const load = () => globalThis.fetch('/x');\n", 'src/lib/http/httpClient.ts')).toEqual([]);
  });

  it('new XMLHttpRequest() outside lib/http is an error', () => {
    expect(lint('export const create = () => new XMLHttpRequest();\n', feature)).toEqual([
      restrictedGlobal('XMLHttpRequest'),
    ]);
  });

  it('new XMLHttpRequest() inside lib/http is clean', () => {
    expect(lint('export const create = () => new XMLHttpRequest();\n', 'src/lib/http/xhr.ts')).toEqual([]);
  });
});

describe('forbidden packages and deprecated paths', () => {
  it('an axios import is an error, even in api.ts', () => {
    const code = "import axios from 'axios';\nexport default axios;\n";
    const finding = restrictedPath('axios', 'Forbidden (PRD Prime Directive 8). Use api.ts.');
    expect(lint(code, feature)).toEqual([finding]);
    expect(lint(code, 'src/lib/api.ts')).toEqual([finding]);
  });

  it('a react-router-dom import is an error (D-19)', () => {
    expect(lint("import { Link } from 'react-router-dom';\nexport { Link };\n", feature)).toEqual([
      restrictedPath('react-router-dom', 'Removed in React Router 8 (D-19). Import from react-router.'),
    ]);
  });

  it('the deprecated nuqs/adapters/react-router path is an error', () => {
    const code = "import { NuqsAdapter } from 'nuqs/adapters/react-router';\nexport { NuqsAdapter };\n";
    expect(lint(code, feature)).toEqual([
      restrictedPath('nuqs/adapters/react-router', 'Deprecated. Use nuqs/adapters/react-router/v8.'),
    ]);
  });

  it('the nuqs/adapters/react-router/v6 path is an error', () => {
    const code = "import { NuqsAdapter } from 'nuqs/adapters/react-router/v6';\nexport { NuqsAdapter };\n";
    expect(lint(code, feature)).toEqual([
      restrictedPath('nuqs/adapters/react-router/v6', 'Use nuqs/adapters/react-router/v8.'),
    ]);
  });

  it('the nuqs/adapters/react-router/v7 path is an error', () => {
    const code = "import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';\nexport { NuqsAdapter };\n";
    expect(lint(code, feature)).toEqual([
      restrictedPath('nuqs/adapters/react-router/v7', 'Use nuqs/adapters/react-router/v8.'),
    ]);
  });

  it('the nuqs/adapters/react path is an error', () => {
    const code = "import { NuqsAdapter } from 'nuqs/adapters/react';\nexport { NuqsAdapter };\n";
    expect(lint(code, feature)).toEqual([restrictedPath('nuqs/adapters/react', 'Use nuqs/adapters/react-router/v8.')]);
  });

  it('the nuqs React Router v8 adapter is clean', () => {
    const code = "import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';\nexport { NuqsAdapter };\n";
    expect(lint(code, feature)).toEqual([]);
  });

  it('importing parseAsIsoDate from nuqs is an error', () => {
    expect(lint("import { parseAsIsoDate } from 'nuqs';\nexport { parseAsIsoDate };\n", feature)).toEqual([
      restrictedName('parseAsIsoDate', 'nuqs', 'Use parseAsBusinessDate (Manila YYYY-MM-DD).'),
    ]);
  });

  it('importing parseAsIsoDateTime from nuqs is an error', () => {
    expect(lint("import { parseAsIsoDateTime } from 'nuqs';\nexport { parseAsIsoDateTime };\n", feature)).toEqual([
      restrictedName('parseAsIsoDateTime', 'nuqs', 'Use parseAsBusinessDate (Manila YYYY-MM-DD).'),
    ]);
  });

  it('other nuqs parsers are clean', () => {
    expect(lint("import { parseAsInteger } from 'nuqs';\nexport { parseAsInteger };\n", feature)).toEqual([]);
  });

  it('shallow: false is an error and shallow: true is clean', () => {
    expect(lint('export const options = { shallow: false };\n', feature)).toEqual([
      syntax('Keep the nuqs default shallow: true (nuqs #1563).'),
    ]);
    expect(lint('export const options = { shallow: true };\n', feature)).toEqual([]);
  });

  it('the nuqs startTransition option is an error', () => {
    const code =
      "import { useQueryState } from 'nuqs';\nimport { startTransition } from 'react';\n" +
      "export const useQ = () => useQueryState('q', { startTransition });\n";
    expect(lint(code, feature)).toEqual([syntax('Do not pass the nuqs startTransition option (nuqs #1567).')]);
  });

  it("React's useTransition destructuring is clean", () => {
    const code =
      "import { useTransition } from 'react';\n" +
      'export function usePending() {\n  const [isPending, startTransition] = useTransition();\n' +
      '  return { isPending, start: startTransition };\n}\n';
    expect(lint(code, feature)).toEqual([]);
  });
});

describe('CWE-79 and D-33 markup bans', () => {
  it('dangerouslySetInnerHTML is an error', () => {
    expect(lint(rawHtmlJsx, featureTsx)).toEqual([syntax(rawHtml)]);
  });

  it('style={{ width }} is an error', () => {
    expect(lint('export const A = (width: number) => <div style={{ width }} />;\n', featureTsx)).toEqual([
      syntax(styleObject),
    ]);
  });

  it('style={styles} is an error', () => {
    const code = 'const styles = { width: 1 };\nexport const A = () => <div style={styles} />;\n';
    expect(lint(code, featureTsx)).toEqual([syntax(styleValue)]);
  });

  it('a string style attribute is an error', () => {
    expect(lint('export const A = () => <div style="color: red" />;\n', featureTsx)).toEqual([syntax(styleValue)]);
  });

  it('a spread inside style is an error', () => {
    const code = 'const s = { width: 1 };\nexport const A = () => <div style={{ ...s }} />;\n';
    expect(lint(code, featureTsx)).toEqual([syntax(styleObject)]);
  });

  it("style={{ '--sk-w': w }} (a CSS custom property) is clean", () => {
    expect(lint("export const A = (w: string) => <div style={{ '--sk-w': w }} />;\n", featureTsx)).toEqual([]);
  });

  it('a template literal in className is an error', () => {
    expect(lint(classNameTemplateJsx, featureTsx)).toEqual([syntax(classNameTemplate)]);
  });

  it("className={'bg-' + tone} is an error", () => {
    expect(lint("export const A = (tone: string) => <div className={'bg-' + tone} />;\n", featureTsx)).toEqual([
      syntax(classNameConcat),
    ]);
  });

  it('clsx(`x-${y}`) is an error', () => {
    const code = "import clsx from 'clsx';\nexport const c = (y: string) => clsx(`x-${y}`);\n";
    expect(lint(code, feature)).toEqual([syntax(classCallTemplate)]);
  });

  it("tw('a' + b) is an error", () => {
    const code = "declare function tw(s: string): string;\nexport const c = (b: string) => tw('a' + b);\n";
    expect(lint(code, feature)).toEqual([syntax(classCallConcat)]);
  });

  it('cssText is an error', () => {
    expect(lint("export const f = (el: HTMLElement) => { el.style.cssText = 'color: red'; };\n", feature)).toEqual([
      syntax('D-33: no cssText; use utilities, or a --* custom property for a continuous value.'),
    ]);
  });

  it("setAttribute('style', …) is an error", () => {
    expect(lint("export const f = (el: HTMLElement) => el.setAttribute('style', 'color: red');\n", feature)).toEqual([
      syntax('D-33/CSP: never set the style attribute (style-src-attr is blocked).'),
    ]);
  });

  it("setAttribute('class', …) is clean", () => {
    expect(lint("export const f = (el: HTMLElement) => el.setAttribute('class', 'p-4');\n", feature)).toEqual([]);
  });
});

describe('D-33 stylesheet imports', () => {
  it("import './x.css' is an error", () => {
    expect(lint("import './x.css';\n", featureTsx)).toEqual([restrictedPattern('./x.css', cssImport)]);
  });

  it('a Fontsource weight file is clean', () => {
    const code = "import '@fontsource/barlow-condensed/800.css';\nimport '@fontsource-variable/archivo/wght.css';\n";
    expect(lint(code, featureTsx)).toEqual([]);
  });

  it("'@/styles/app.css' outside main.tsx is an error", () => {
    expect(lint("import '@/styles/app.css';\n", 'src/app/App.tsx')).toEqual([
      restrictedPattern('@/styles/app.css', cssImport),
    ]);
  });

  it("main.tsx may import '@/styles/app.css' and nothing else", () => {
    expect(lint("import '@/styles/app.css';\n", 'src/main.tsx')).toEqual([]);
    expect(lint("import '@/styles/base.css';\n", 'src/main.tsx')).toEqual([
      restrictedPattern('@/styles/base.css', cssImport),
    ]);
  });
});

describe('QUAL-02 language bans', () => {
  it('console.log is an error', () => {
    expect(lint("console.log('x');\n", feature)).toEqual([['no-console', 2, 'Unexpected console statement.']]);
  });

  it('the console guard may call console', () => {
    expect(lint("console.error('x');\n", 'src/test/consoleGuard.ts')).toEqual([]);
  });

  it('a non-null assertion is an error', () => {
    expect(lint('export const first = (value: string | undefined) => value!;\n', feature)).toEqual([
      ['@typescript-eslint/no-non-null-assertion', 2, 'Forbidden non-null assertion.'],
    ]);
  });

  it('an explicit any is an error', () => {
    expect(lint('export const f = (value: any) => value;\n', feature)).toEqual([
      ['@typescript-eslint/no-explicit-any', 2, 'Unexpected any. Specify a different type.'],
    ]);
  });
});

describe('Pitfall 33: every ban still fires inside each override block', () => {
  it('dangerouslySetInnerHTML is an error in src/lib/http/x.tsx', () => {
    expect(lint(rawHtmlJsx, 'src/lib/http/x.tsx')).toEqual([syntax(rawHtml)]);
  });

  it('a className template literal is an error in src/lib/http/x.tsx', () => {
    expect(lint(classNameTemplateJsx, 'src/lib/http/x.tsx')).toEqual([syntax(classNameTemplate)]);
  });

  it('the class-call, cssText and nuqs bans fire in src/lib/api.ts (a .ts file cannot hold JSX)', () => {
    const code =
      "import clsx from 'clsx';\nexport const c = (y: string) => clsx(`x-${y}`);\n" +
      "export const options = { shallow: false };\nexport const f = (el: HTMLElement) => { el.style.cssText = ''; };\n";
    expect(lint(code, 'src/lib/api.ts').map(([ruleId]) => ruleId)).toEqual([
      'no-restricted-syntax',
      'no-restricted-syntax',
      'no-restricted-syntax',
    ]);
  });

  it('dangerouslySetInnerHTML is an error in src/main.tsx', () => {
    expect(lint(rawHtmlJsx, 'src/main.tsx')).toEqual([syntax(rawHtml)]);
  });

  it('a className template literal is an error in src/main.tsx', () => {
    expect(lint(classNameTemplateJsx, 'src/main.tsx')).toEqual([syntax(classNameTemplate)]);
  });

  it('the fetch member ban still fires in src/main.tsx and src/lib/api.ts', () => {
    const code = "export const load = () => window.fetch('/x');\n";
    expect(lint(code, 'src/main.tsx')).toEqual([syntax(callApi)]);
    expect(lint(code, 'src/lib/api.ts')).toEqual([syntax(callApi)]);
  });

  it('visual/reference keeps the frozen markup but still bans raw HTML', () => {
    expect(
      lint(
        'export const A = (w: number) => <div style={{ width: w }} className="csp-btn" />;\n',
        'visual/reference/D3.tsx',
      ),
    ).toEqual([]);
    expect(lint(rawHtmlJsx, 'visual/reference/D3.tsx')).toEqual([syntax(rawHtml)]);
  });

  it('outside visual/reference the visual folder gets every ban', () => {
    expect(lint('export const A = (w: number) => <div style={{ width: w }} />;\n', 'visual/scenes.tsx')).toEqual([
      syntax(styleObject),
    ]);
  });
});

describe('D-36 Tailwind class rules against the CSPS theme', () => {
  const ruleIds = (code: string, file = featureTsx) => lint(code, file).map(([ruleId, severity]) => [ruleId, severity]);
  const unknown = ['better-tailwindcss/no-unknown-classes', 2];
  const conflicting = ['better-tailwindcss/no-conflicting-classes', 2];
  const restricted = ['better-tailwindcss/no-restricted-classes', 2];

  it('a cleared default palette colour (bg-blue-500) is unknown', () => {
    expect(lint('export const A = () => <div className="bg-blue-500" />;\n', featureTsx)).toEqual([
      ['better-tailwindcss/no-unknown-classes', 2, expect.stringContaining('bg-blue-500')],
    ]);
  });

  it('a cleared default radius (rounded-xl) is unknown', () => {
    expect(ruleIds('export const A = () => <div className="rounded-xl" />;\n')).toEqual([unknown]);
  });

  it('a cleared default shadow (shadow-lg) is unknown', () => {
    expect(ruleIds('export const A = () => <div className="shadow-lg" />;\n')).toEqual([unknown]);
  });

  it('a cleared default text colour (text-gray-600) is unknown', () => {
    expect(ruleIds('export const A = () => <div className="text-gray-600" />;\n')).toEqual([unknown]);
  });

  it('an unknown class inside clsx(…) is reported', () => {
    expect(ruleIds("import clsx from 'clsx';\nexport const c = clsx('bg-blue-500');\n", feature)).toEqual([unknown]);
  });

  it('an unknown class inside tw(…) is reported', () => {
    const code = "declare function tw(s: string): string;\nexport const c = tw('shadow-lg');\n";
    expect(ruleIds(code, feature)).toEqual([unknown]);
  });

  it('conflicting classes (p-4 p-2) are reported', () => {
    expect(lint('export const A = () => <div className="p-4 p-2" />;\n', featureTsx).map(([r, s]) => [r, s])).toEqual([
      conflicting,
      conflicting,
    ]);
  });

  it('a hex colour literal (bg-[#ff6600]) is restricted', () => {
    expect(lint('export const A = () => <div className="bg-[#ff6600]" />;\n', featureTsx)).toEqual([
      ['better-tailwindcss/no-restricted-classes', 2, 'D-33: no hex colour in a class; use a theme token.'],
    ]);
  });

  it('an rgb() colour literal is restricted', () => {
    expect(ruleIds('export const A = () => <div className="bg-[rgb(1,2,3)]" />;\n')).toEqual([restricted]);
  });

  it('an oklch() colour literal is restricted', () => {
    expect(ruleIds('export const A = () => <div className="text-[oklch(0.5_0.1_20)]" />;\n')).toEqual([restricted]);
  });

  it('the built-in max-sm: variant is restricted', () => {
    expect(lint('export const A = () => <div className="max-sm:hidden" />;\n', featureTsx)).toEqual([
      [
        'better-tailwindcss/no-restricted-classes',
        2,
        'Built-in max-* variants are off by one (Pitfall 22); use a pg-*/vp-* variant.',
      ],
    ]);
  });

  it('the built-in @max-[767px]/pg: container variant is restricted', () => {
    expect(lint('export const A = () => <div className="@max-[767px]/pg:hidden" />;\n', featureTsx)).toEqual([
      [
        'better-tailwindcss/no-restricted-classes',
        2,
        'Built-in @max-*/@min-* container variants differ from the spec (Pitfall 22); use pg-*.',
      ],
    ]);
  });

  it('the built-in @min-[768px]/pg: container variant is restricted', () => {
    expect(ruleIds('export const A = () => <div className="@min-[768px]/pg:hidden" />;\n')).toEqual([restricted]);
  });

  it('the enabled: variant is restricted', () => {
    expect(lint('export const A = () => <div className="enabled:bg-primary" />;\n', featureTsx)).toEqual([
      ['better-tailwindcss/no-restricted-classes', 2, 'enabled: does not match links (Pitfall 27); use not-disabled:.'],
    ]);
  });

  it('max-w-* (a utility, not a variant) is not restricted', () => {
    expect(ruleIds('export const A = () => <div className="max-w-[560px] pg-phone:max-w-[320px]" />;\n')).toEqual([]);
  });

  it('theme classes and the spec variants are clean', () => {
    expect(
      lint(
        'export const A = () => <div className="bg-surface pg-phone:hidden hover:not-disabled:bg-primary-hover" />;\n',
        featureTsx,
      ),
    ).toEqual([]);
  });

  it('visual/reference turns the Tailwind rules off', () => {
    expect(
      ruleIds('export const A = () => <div className="csp-btn bg-blue-500" />;\n', 'visual/reference/D3.tsx'),
    ).toEqual([]);
  });
});
