// Flat ESLint config (PRD 17.2, QUAL-02, WEB-04, D-33, D-36). JavaScript, so no config loader package is needed.
// Every rule is 'error' or 'off', never 'warn' (L-19), and `npm run lint` passes --max-warnings 0.
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Raises a rule entry set to 'warn' (or 1) to 'error' and keeps its options, so a warn-level rule in a shared config
 * (react-hooks 7.1.1 ships three) can never pass silently (L-19).
 * @param {import('eslint').Linter.RuleEntry | undefined} entry
 * @returns {import('eslint').Linter.RuleEntry | undefined}
 */
function escalateEntry(entry) {
  if (entry === 'warn' || entry === 1) {
    return 'error';
  }
  if (Array.isArray(entry) && (entry[0] === 'warn' || entry[0] === 1)) {
    /** @type {unknown[]} */
    const options = entry.slice(1);
    return ['error', ...options];
  }
  return entry;
}

/**
 * Returns a copy of a shared config entry with every warn-level rule raised to error, options kept.
 * @param {import('eslint').Linter.Config} config
 * @returns {import('eslint').Linter.Config}
 */
export function escalate(config) {
  if (config.rules === undefined) {
    return config;
  }
  return {
    ...config,
    rules: Object.fromEntries(Object.entries(config.rules).map(([id, entry]) => [id, escalateEntry(entry)])),
  };
}

const callApiMessage = 'Call an api.ts function instead (WEB-04).';
const httpClientMessage = 'Only src/lib/api.ts may use the HTTP client (WEB-04).';
const cssImportMessage =
  'D-33: no stylesheet imports; style with utilities. Only main.tsx and the dev parity entry import @/styles/app.css.';

// The ban on direct fetch/XMLHttpRequest member access. src/lib/http/** (the HTTP client itself) drops only this
// entry, so every other ban still fires there.
const fetchMemberBan = {
  selector: 'MemberExpression[property.name=/^(fetch|XMLHttpRequest)$/][object.name=/^(window|globalThis|self)$/]',
  message: callApiMessage,
};
// D-33 markup bans on style and class strings. The test-only spec fragments under visual/reference/** drop only
// these entries (they are the frozen approved design, not app code).
const styleObjectBan = {
  selector:
    "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > :not(Property[key.value=/^--/])",
  message: 'D-33: style may only set CSS custom properties (--*); use a utility for everything else.',
};
// esquery does not apply a child combinator nested inside :matches(), so the two forms (a string value and an
// expression that is not an inline object) are one selector list on the attribute itself.
const styleValueBan = {
  selector:
    "JSXAttribute[name.name='style'][value.type!='JSXExpressionContainer'], " +
    "JSXAttribute[name.name='style'][value.expression.type!='ObjectExpression']",
  message: 'D-33: style must be an inline object of --* custom properties.',
};
const classNameTemplateBan = {
  selector: "JSXAttribute[name.name='className'] TemplateLiteral",
  message: 'D-33: class names must be complete literals (no template literals in className).',
};
const classNameConcatBan = {
  selector: "JSXAttribute[name.name='className'] BinaryExpression[operator='+']",
  message: 'D-33: no class-name concatenation in className; use complete literal tokens.',
};
const classCallTemplateBan = {
  selector: 'CallExpression[callee.name=/^(clsx|tw)$/] TemplateLiteral',
  message: 'D-33: class names must be complete literals (no template literals in clsx or tw).',
};
const classCallConcatBan = {
  selector: "CallExpression[callee.name=/^(clsx|tw)$/] BinaryExpression[operator='+']",
  message: 'D-33: no class-name concatenation in clsx or tw; use complete literal tokens.',
};
const markupBans = new Set([
  styleObjectBan,
  styleValueBan,
  classNameTemplateBan,
  classNameConcatBan,
  classCallTemplateBan,
  classCallConcatBan,
]);

/**
 * Every architectural and D-33 syntax ban, in ONE array. Flat config replaces a rule's options in later blocks, so a
 * per-file override that set its own no-restricted-syntax list would silently drop every other selector (research
 * Pitfall 33). Each override below re-spreads this array instead.
 */
export const syntaxBans = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'Raw HTML injection is forbidden (CWE-79).',
  },
  {
    selector: "Property[key.name='shallow'][value.value=false]",
    message: 'Keep the nuqs default shallow: true (nuqs #1563).',
  },
  {
    selector: "ObjectExpression > Property[key.name='startTransition']",
    message: 'Do not pass the nuqs startTransition option (nuqs #1567).',
  },
  fetchMemberBan,
  styleObjectBan,
  styleValueBan,
  classNameTemplateBan,
  classNameConcatBan,
  classCallTemplateBan,
  classCallConcatBan,
  {
    selector: "MemberExpression[property.name='cssText']",
    message: 'D-33: no cssText; use utilities, or a --* custom property for a continuous value.',
  },
  {
    selector: "CallExpression[callee.property.name='setAttribute'][arguments.0.value=/^style$/i]",
    message: 'D-33/CSP: never set the style attribute (style-src-attr is blocked).',
  },
];

/** @type {Array<{ name: string, importNames?: string[], message: string }>} */
const restrictedImportPaths = [
  { name: 'axios', message: 'Forbidden (PRD Prime Directive 8). Use api.ts.' },
  { name: 'react-router-dom', message: 'Removed in React Router 8 (D-19). Import from react-router.' },
  { name: 'nuqs/adapters/react-router', message: 'Deprecated. Use nuqs/adapters/react-router/v8.' },
  { name: 'nuqs/adapters/react-router/v6', message: 'Use nuqs/adapters/react-router/v8.' },
  { name: 'nuqs/adapters/react-router/v7', message: 'Use nuqs/adapters/react-router/v8.' },
  { name: 'nuqs/adapters/react', message: 'Use nuqs/adapters/react-router/v8.' },
  {
    name: 'nuqs',
    importNames: ['parseAsIsoDate', 'parseAsIsoDateTime'],
    message: 'Use parseAsBusinessDate (Manila YYYY-MM-DD).',
  },
];

/**
 * The no-restricted-imports entry. `http` keeps the lib/http ban (off only in api.ts and lib/http itself); `appCss`
 * lets the one stylesheet entry through (main.tsx only); `referenceCss` lets the parity reference entry import its
 * test-only stylesheet (visual/reference/main.tsx only). Fontsource weight files are always allowed (PERF-05).
 * @param {{ http: boolean, appCss: boolean, referenceCss?: boolean }} allow
 * @returns {import('eslint').Linter.RuleEntry}
 */
function importBans(allow) {
  const cssGroup = ['*.css', '!@fontsource/**', '!@fontsource-variable/**'];
  if (allow.appCss) {
    cssGroup.push('!@/styles/app.css');
  }
  if (allow.referenceCss === true) {
    cssGroup.push('!./reference.css');
  }
  const patterns = [{ group: cssGroup, message: cssImportMessage }];
  if (!allow.http) {
    patterns.unshift({
      group: ['**/lib/http', '**/lib/http/**', '@/lib/http', '@/lib/http/**'],
      message: httpClientMessage,
    });
  }
  return ['error', { paths: restrictedImportPaths, patterns }];
}

const appFiles = ['src/**/*.{ts,tsx}', 'visual/**/*.{ts,tsx}'];

/**
 * Architecture restrictions for app source (WEB-04, WEB-10, QUAL-02, D-33) and their per-file overrides. Exported so
 * src/test/lint-rules.node.test.ts can run them through ESLint's Linter and prove that each one fires.
 * @type {import('eslint').Linter.Config[]}
 */
export const architectureRules = [
  {
    name: 'csps/restrictions',
    files: appFiles,
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-restricted-imports': importBans({ http: false, appCss: false }),
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: callApiMessage },
        { name: 'XMLHttpRequest', message: callApiMessage },
      ],
      'no-restricted-syntax': ['error', ...syntaxBans],
      'no-console': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // The HTTP client itself is the one place that may touch fetch and XMLHttpRequest, and import its own modules.
    name: 'csps/restrictions/http-client',
    files: ['src/lib/http/**'],
    rules: {
      'no-restricted-imports': importBans({ http: true, appCss: false }),
      'no-restricted-globals': 'off',
      'no-restricted-syntax': ['error', ...syntaxBans.filter((ban) => ban !== fetchMemberBan)],
    },
  },
  {
    // api.ts is the only consumer of the HTTP client (WEB-04). Its test builds the client over a fake fetch to drive
    // createApi (plan 02-15), so it shares the exception.
    name: 'csps/restrictions/api',
    files: ['src/lib/api.ts', 'src/lib/api.test.ts'],
    rules: {
      'no-restricted-imports': importBans({ http: true, appCss: false }),
      'no-restricted-syntax': ['error', ...syntaxBans],
    },
  },
  {
    // main.tsx imports the single stylesheet entry (D-33). Recorded exception (plan 02-14): the dev-only parity entry
    // (src/dev/parity-main.tsx, never in the production build, D-20) imports the same fonts and stylesheet, so the
    // implementation side of the look-equality proof renders with exactly the app's CSS.
    name: 'csps/restrictions/main',
    files: ['src/main.tsx', 'src/dev/parity-main.tsx'],
    rules: {
      'no-restricted-imports': importBans({ http: false, appCss: true }),
      'no-restricted-syntax': ['error', ...syntaxBans],
    },
  },
  {
    // The console guard (Pitfall 20) is the one place that must replace and call console methods (L-21).
    name: 'csps/restrictions/console-guard',
    files: ['src/test/consoleGuard.ts', 'src/test/consoleGuard.test.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Recorded D-33 exception (plan 02-13): the parity reference entry imports its stylesheet, which is the verbatim
    // approved App. A.2 CSS chain plus the test-only rulings layer. It is never shipped, and nothing else may import it.
    name: 'csps/restrictions/visual-reference-entry',
    files: ['visual/reference/main.tsx'],
    rules: {
      'no-restricted-imports': importBans({ http: false, appCss: false, referenceCss: true }),
    },
  },
  {
    // Test-only frozen spec fragments (the parity reference) keep the approved design's markup verbatim.
    name: 'csps/restrictions/visual-reference',
    files: ['visual/reference/**'],
    rules: {
      'no-restricted-syntax': ['error', ...syntaxBans.filter((ban) => !markupBans.has(ban))],
    },
  },
];

// D-36: Tailwind class linting against the real CSPS theme. The class order belongs to prettier-plugin-tailwindcss.
const tailwindRuleIds = [
  'better-tailwindcss/no-unknown-classes',
  'better-tailwindcss/no-conflicting-classes',
  'better-tailwindcss/no-restricted-classes',
];

/**
 * Tailwind class rules (D-36). Exported so the lint-rule test can prove each one against the real app.css theme.
 * @type {import('eslint').Linter.Config[]}
 */
export const tailwindRules = [
  {
    name: 'csps/tailwind',
    files: appFiles,
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      'better-tailwindcss': {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        entryPoint: fileURLToPath(new URL('./src/styles/app.css', import.meta.url)),
        messageStyle: 'compact',
        selectors: [
          { kind: 'attribute', name: '^className$' },
          { kind: 'attribute', name: '^className$', match: [{ type: 'strings' }] },
          { kind: 'callee', name: '^(clsx|tw)$', match: [{ type: 'strings' }, { type: 'objectKeys' }] },
        ],
      },
    },
    rules: {
      'better-tailwindcss/no-unknown-classes': 'error',
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            { pattern: '#[0-9a-fA-F]{3,8}', message: 'D-33: no hex colour in a class; use a theme token.' },
            { pattern: 'rgba?\\(', message: 'D-33: no rgb() colour in a class; use a theme token.' },
            { pattern: 'oklch\\(', message: 'D-33: no oklch() colour in a class; use a theme token.' },
            {
              pattern: '(?:^|:)max-(?:\\[[^\\]]*\\]|[^:\\[]+):',
              message: 'Built-in max-* variants are off by one (Pitfall 22); use a pg-*/vp-* variant.',
            },
            {
              pattern: '(?:^|:)@(?:max|min)-',
              message: 'Built-in @max-*/@min-* container variants differ from the spec (Pitfall 22); use pg-*.',
            },
            {
              pattern: '(?:^|:)enabled:',
              message: 'enabled: does not match links (Pitfall 27); use not-disabled:.',
            },
          ],
        },
      ],
      'better-tailwindcss/enforce-consistent-class-order': 'off',
    },
  },
  {
    name: 'csps/tailwind/visual-reference',
    files: ['visual/reference/**'],
    rules: Object.fromEntries(tailwindRuleIds.map((id) => [id, 'off'])),
  },
];

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    name: 'csps/ignores',
    ignores: [
      'node_modules/**',
      'coverage/**',
      '.e2e-dist/**',
      '.budget-dist/**',
      '.reference-dist/**',
      'visual/.reference-src/**',
      '.vitest/**',
      '.parity/**',
      '.parity-dist/**',
      '.locks/**',
      'test-results/**',
      'playwright-report/**',
      'src/types/api.generated.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map(escalate),
  ...tseslint.configs.stylisticTypeChecked.map(escalate),
  {
    name: 'csps/typescript-project',
    languageOptions: {
      parserOptions: {
        // web/tsconfig.json references tsconfig.app.json (src) and tsconfig.node.json (configs, scripts, e2e,
        // visual, src/**/*.node.test.ts, src/**/*.golden.test.ts); the project service picks the program that owns each
        // file.
        projectService: true,
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
  },
  escalate(reactHooks.configs.flat.recommended),
  { ...escalate(jsxA11y.configs.strict), files: ['**/*.tsx'] },
  {
    name: 'csps/browser-globals',
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    name: 'csps/node-globals',
    files: ['scripts/**', 'e2e/**', 'visual/**', '*.config.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  ...architectureRules,
  ...tailwindRules,
  {
    // Type-aware strictness that the virtual-file lint tests cannot run (they have no type information).
    name: 'csps/type-aware',
    rules: {
      // A `||` fallback on a string, number or boolean must stay `||`: `??` keeps '' and 0 and changes what renders
      // (research Pitfall 6).
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true, number: true, boolean: true } },
      ],
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
  {
    name: 'csps/linter-options',
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  prettier,
];
