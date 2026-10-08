// Flat ESLint config (PRD 17.2, QUAL-02). JavaScript, so no config loader package is needed.
// Every rule is 'error' or 'off', never 'warn', and `npm run lint` passes --max-warnings 0.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Raises a rule entry set to 'warn' (or 1) to 'error' and keeps its options, so a warn-level rule in a shared config
 * (react-hooks ships three) can never pass silently.
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
 * @param {import('eslint').Linter.Config} config
 * @returns {import('eslint').Linter.Config}
 */
function escalate(config) {
  if (config.rules === undefined) {
    return config;
  }
  return {
    ...config,
    rules: Object.fromEntries(Object.entries(config.rules).map(([id, entry]) => [id, escalateEntry(entry)])),
  };
}

const httpClientMessage = 'Only src/lib/api.ts may use the HTTP client (WEB-04).';
const callApiMessage = 'Call an api.ts function instead (WEB-04).';

/** @type {Array<string | { name: string, importNames?: string[], message: string }>} */
const restrictedImportPaths = [
  { name: 'axios', message: 'Forbidden (PRD Prime Directive 8). Use api.ts.' },
  { name: 'react-router-dom', message: 'Removed in React Router 8. Import from react-router.' },
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

const rawHtmlSelector = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: 'Raw HTML injection is forbidden (CWE-79).',
};
const nuqsSelectors = [
  {
    selector: "ObjectExpression > Property[key.name='shallow'][value.value=false]",
    message: 'Keep the nuqs default shallow: true (nuqs #1563).',
  },
  {
    selector: "ObjectExpression > Property[key.name='startTransition']",
    message: 'Do not pass the nuqs startTransition option (nuqs #1567).',
  },
];
const fetchMemberSelector = {
  selector: "MemberExpression[property.name='fetch'][object.name=/^(window|globalThis|self)$/]",
  message: callApiMessage,
};

/**
 * Architecture restrictions for app source (WEB-04, WEB-10, QUAL-02). Exported so src/test/lint-rules.test.ts can run
 * them through ESLint's Linter and prove that each one fires.
 * @type {import('eslint').Linter.Config[]}
 */
export const architectureRules = [
  {
    name: 'csps/architecture',
    files: ['src/**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictedImportPaths,
          patterns: [
            { group: ['**/lib/http', '**/lib/http/**', '@/lib/http', '@/lib/http/*'], message: httpClientMessage },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: callApiMessage },
        { name: 'XMLHttpRequest', message: callApiMessage },
      ],
      'no-restricted-syntax': ['error', rawHtmlSelector, ...nuqsSelectors, fetchMemberSelector],
      'no-console': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // The HTTP client itself is the one place that may touch fetch and XMLHttpRequest.
    name: 'csps/architecture/http-client',
    files: ['src/lib/http/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': ['error', rawHtmlSelector, ...nuqsSelectors],
    },
  },
  {
    // api.ts is the only consumer of the HTTP client (WEB-04).
    name: 'csps/architecture/api',
    files: ['src/lib/api.ts', 'src/lib/api.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: restrictedImportPaths }],
    },
  },
];

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    name: 'csps/ignores',
    ignores: [
      'dist/**',
      '.vite/**',
      '.e2e-dist/**',
      '.budget-dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'src/ui/__reference__/**',
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
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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
  ...architectureRules,
  {
    // A `||` fallback on a string, number or boolean must stay `||`: `??` keeps '' and 0 and changes what renders
    // (research Pitfall 6).
    name: 'csps/nullish-coalescing',
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true, number: true, boolean: true } },
      ],
    },
  },
  {
    name: 'csps/node-globals',
    files: ['scripts/**/*.{ts,mjs}', 'e2e/**/*.ts', '*.config.{ts,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    name: 'csps/scripts-console',
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    name: 'csps/linter-options',
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  prettier,
];
