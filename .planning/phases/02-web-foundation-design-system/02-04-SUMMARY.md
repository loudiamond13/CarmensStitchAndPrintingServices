---
phase: 02-web-foundation-design-system
plan: 04
subsystem: testing
tags: [eslint, typescript-eslint, eslint-plugin-better-tailwindcss, prettier, prettier-plugin-tailwindcss, vitest, axe-core, jsx-a11y, react-hooks, quality-gates, tdd]
created: "2026-10-08T10:29:00-05:00"
updated: "2026-10-08T10:29:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-02)
    provides: "web/ toolchain at exact pins (eslint 10.11.0, typescript-eslint 8.70.1, react-hooks 7.1.1, jsx-a11y-x 0.2.0, better-tailwindcss 4.7.0, prettier 3.9.9 + prettier-plugin-tailwindcss 0.8.1, vitest 5.0.1, axe-core 4.13.0), the npm scripts table, vitest.config.ts, app.css token theme, PublicPlaceholderPage"
  - phase: 02-web-foundation-design-system (plan 02-37)
    provides: "tsconfig.app.json / tsconfig.node.json (node program owns *.node.test.ts, scripts, configs), vite-env.d.ts"
provides:
  - "web/eslint.config.mjs: strictTypeChecked + stylisticTypeChecked over the project service, react-hooks 7 and jsx-a11y-x strict escalated warn->error, one exported syntaxBans array re-spread in every override, WEB-04/D-19/nuqs/D-33 import and global bans, better-tailwindcss unknown/conflicting/restricted against src/styles/app.css, reportUnusedDisableDirectives error, eslint-config-prettier last. Exports: syntaxBans, escalate, architectureRules, tailwindRules, default"
  - "web/.prettierrc.json + .prettierignore: tabWidth 2, LF, singleQuote (CSS keeps double quotes), printWidth 120, prettier-plugin-tailwindcss with tailwindStylesheet ./src/styles/app.css and tailwindFunctions clsx/tw"
  - "web/scripts/verify.mjs: STEPS = typecheck, lint, format:check, test:coverage, build; run(spawn, env) runs node + npm_execpath, stops at the first failure with its code"
  - "web/src/test/setup.ts (vitest setupFiles): jest-dom matchers, matchMedia mock, RTL cleanup, fail-on-console guard"
  - "web/src/test/consoleGuard.ts: installConsoleGuard, collectConsole, assertNoConsoleOutput"
  - "web/src/test/axe.ts + axeTags.ts: expectNoAxeViolations(container) and AXE_TAGS (wcag2a/2aa/21a/21aa/22aa) for plan 02-09's Playwright fixture"
  - "Proof tests: lint-rules.node.test.ts (71 cases), eslint-config.node.test.ts (15), verify.test.ts (5), consoleGuard.test.ts (7), axe.test.tsx (6), PublicPlaceholderPage.test.tsx (4)"
affects: [02-05, 02-06, 02-09, 02-10, 02-12, 02-13, 02-29, 02-33, 02-40, every-later-web-plan, lint, verify, a11y]

actuals:
  tokens: 17700    # chars/4 over the realized diff (70,753 chars, 21 files)
  tasks: 3
  commits: 6
plan_head_before: d1871e8429c568fd91011cc88f0a00524e2f959a
plan_head_after: 8abdd65d5c72b6989bfc532cbf433ddadf6e78ee

tech-stack:
  added: []
  patterns:
    - "One exported syntaxBans array; per-file overrides re-spread it (filtering by identity) instead of declaring their own no-restricted-syntax list (Pitfall 33)"
    - "Lint rules are proven through ESLint's Linter on virtual file paths, with the exported architectureRules/tailwindRules blocks and no type information; type-aware rules are pinned through ESLint.calculateConfigForFile instead"
    - "Every Vitest test runs under the console guard: a test that expects console output must take it with collectConsole()"
    - "Component tests re-render with equal props so React Compiler memo-cache branches are covered (L-13)"

key-files:
  created:
    - web/eslint.config.mjs
    - web/.prettierrc.json
    - web/.prettierignore
    - web/scripts/verify.mjs
    - web/scripts/verify.test.ts
    - web/src/test/setup.ts
    - web/src/test/consoleGuard.ts
    - web/src/test/consoleGuard.test.ts
    - web/src/test/axe.ts
    - web/src/test/axeTags.ts
    - web/src/test/axe.test.tsx
    - web/src/test/lint-rules.node.test.ts
    - web/src/test/eslint-config.node.test.ts
    - web/src/app/public/PublicPlaceholderPage.test.tsx
  modified:
    - web/vitest.config.ts
    - web/src/main.tsx
    - web/src/app/public/PublicPlaceholderPage.tsx
    - web/src/styles/app.css
    - web/src/styles/base.css
    - web/src/test/build-config.node.test.ts
    - web/src/test/build-output.node.test.ts

key-decisions:
  - "Type-aware rules (prefer-nullish-coalescing with ignorePrimitives, no-deprecated) sit in their own csps/type-aware block for every file, not in the exported restrictions block: the Linter-based ban tests have no type information and a type-aware rule throws there"
  - "Prettier formats CSS with double quotes (override), so app.css keeps the spec's @import \"tailwindcss\" source(\"../../src\") form; keyframes are expanded and .8s became 0.8s (same values)"
  - "better-tailwindcss runs with messageStyle compact and absolute cwd/entryPoint, so messages are the same locally and on CI and the plugin resolves the theme from any cwd"
  - "The CSS-import negation in patterns.group works (assumption A10 holds): '!@fontsource/**' and '!@fontsource-variable/**' (a '/*' negation would not reach nested weight files) and '!@/styles/app.css' in the main.tsx override only"
  - "Bans are a little stricter than the plan text: the member ban also covers window/globalThis/self.XMLHttpRequest, a spread or a string value in style is banned, rgba() is restricted, and setAttribute('style') matches case-insensitively"

patterns-established:
  - "verify.mjs STEPS is the single ordered gate list; later plans append to it"
  - "Deliberate lint violations in fixtures carry eslint-disable-next-line <rule> -- deliberate; unused directives are errors"

requirements-completed: [QUAL-02, WEB-04, A11Y-01]

coverage:
  - id: D1
    description: "npm run verify runs typecheck, lint, format:check, test:coverage and build in that order and stops at the first failing step with its exit code; it is green on the scaffold"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "web/scripts/verify.test.ts#verify pipeline (5 cases)"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0; 130 tests; coverage 100% statements/branches/functions/lines; build ok)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lint fails on any warning and no resolved rule is at warn level for src, scripts and e2e files; shared-config warns are escalated with options kept; unused disable directives are errors; a pattern matching no files rejects"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "web/src/test/eslint-config.node.test.ts#eslint.config.mjs (12 cases)"
        status: pass
      - kind: other
        ref: "npm --prefix web run lint (eslint . --max-warnings 0, exit 0, no findings)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every WEB-04, D-19, nuqs, CWE-79, D-33 and QUAL-02 ban fires with its exact rule id and message, stays quiet where allowed, and still fires inside every override block (lib/http, api.ts, main.tsx, visual/reference)"
    requirement: WEB-04
    verification:
      - kind: unit
        ref: "web/src/test/lint-rules.node.test.ts (54 architecture/markup/import/override cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "better-tailwindcss reports cleared-theme defaults as unknown, p-4 p-2 as conflicting, hex/rgb/oklch literals and the max-*, @max-*, @min-*, enabled: variants as restricted; spec variants and theme classes are clean; Prettier sorts className/clsx/tw classes deterministically"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "web/src/test/lint-rules.node.test.ts#D-36 Tailwind class rules against the CSPS theme (17 cases)"
        status: pass
      - kind: unit
        ref: "web/src/test/eslint-config.node.test.ts#Prettier with prettier-plugin-tailwindcss (D-36) (3 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "expectNoAxeViolations runs axe-core 4.13 with the WCAG 2.0/2.1/2.2 A+AA tags, rejects an empty container, sorts violations by id then target; the placeholder page passes it with exactly one h1 named 'Site update in progress.'"
    requirement: A11Y-01
    verification:
      - kind: unit
        ref: "web/src/test/axe.test.tsx#expectNoAxeViolations (6 cases)"
        status: pass
      - kind: unit
        ref: "web/src/app/public/PublicPlaceholderPage.test.tsx (4 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Any console.error or console.warn during a Vitest test fails that test; console.info passes"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "web/src/test/consoleGuard.test.ts#console guard (7 cases)"
        status: pass
      - kind: other
        ref: "throwaway probe test (deleted): console.error and console.warn tests failed with 'Unexpected console output in this test', a quiet test passed"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 04: Static Quality Gates (ESLint, Prettier, Console Guard, Axe Helper, Verify) Summary

**`npm run verify` now runs typecheck, strict type-aware ESLint (with every WEB-04, D-33 and Tailwind ban proven by its own test), Prettier with Tailwind class sorting, Vitest with coverage under a fail-on-console guard, and the build. It is green on the scaffold at 100% coverage. The in-house axe helper is ready for every component test.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-08T15:11:56Z
- **Completed:** 2026-10-08T15:28:44Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- `eslint.config.mjs` is the full PRD 17.2 rule set: `strictTypeChecked` + `stylisticTypeChecked` through the project service, react-hooks 7.1.1 and jsx-a11y-x strict with every shipped `warn` raised to `error` (options kept), the WEB-04 HTTP-client fence, the D-19/nuqs import bans, the CWE-79 and D-33 markup bans in one `syntaxBans` array, the D-33 stylesheet-import ban, `no-console`, no `!`, no `any`, and better-tailwindcss checking every `className`, `clsx(…)` and `tw(…)` class against the real CSPS theme.
- 71 lint-rule cases run each ban through ESLint's `Linter`, with the exact rule id and message, including inside each per-file override (Pitfall 33). 15 config cases check that no rule resolves to warn level for `src/ui`, `scripts` and `e2e` files, that a lint target matching no files fails, and that Prettier puts classes in Tailwind order.
- Prettier formats the web folder the same way on every machine (2 spaces, LF, single quotes in TS, double quotes in CSS). All existing files were formatted once.
- Every Vitest test now fails on `console.error` or `console.warn`. A throwaway probe confirmed it. jest-dom, the `matchMedia` mock and RTL cleanup load for every file.
- `expectNoAxeViolations` rejects an empty render and gives deterministic, sorted failure text. The placeholder page passes it.
- `npm --prefix web run verify` exits 0: typecheck clean, lint clean, format clean, 130 tests pass, coverage 100%, and the build succeeds.

## Task Commits

1. **Task 1: Tracer, where `npm run verify` gates the scaffold and lint rejects an HTTP-client import outside api.ts**
   - RED `6a8c6ed` (test): lint-rules and verify tests against an inert config and an inert verify.mjs (`RED_EVIDENCE_OK` for both files)
   - GREEN `f5e9651` (feat): the flat config, Prettier config, verify.mjs, the one-time format and one lint fix
   - Tracer gate (interactive, end-of-phase, automated-only verify): re-ran both verify commands after the commit (7/7 pass, lint has no findings), then expanded.
2. **Task 2: Every architecture, D-33 and Tailwind lint rule fires, including inside every override block**
   - RED `7d6d194` (test): 70 lint-rule cases + 15 config cases. `style={styles}` failed on its assertion (`RED_EVIDENCE_OK`).
   - GREEN `f566cf2` (feat): the style-value selector fix, plus a string-style case
3. **Task 3: Fail-on-console guard, in-house axe matcher, and the placeholder page passes it**
   - RED `06133ea` (test): guard, axe and page tests against inert helpers (`RED_EVIDENCE_OK` for consoleGuard.test.ts and axe.test.tsx)
   - GREEN `8abdd65` (feat): guard, axe helper, tags, setup.ts, the vitest config, and the memo-cache re-render case

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `web/eslint.config.mjs`: the flat config. Exports `syntaxBans`, `escalate`, `architectureRules`, `tailwindRules` and the default array.
- `web/.prettierrc.json` / `web/.prettierignore`: format rules and the files Prettier leaves alone (lockfile, tool output, generated API types, notices)
- `web/scripts/verify.mjs` / `verify.test.ts`: the ordered gate and its contract test
- `web/src/test/setup.ts`: Vitest setup (jest-dom, matchMedia, guard, cleanup)
- `web/src/test/consoleGuard.ts` / `.test.ts`: the fail-on-console guard
- `web/src/test/axe.ts`, `axeTags.ts`, `axe.test.tsx`: the D-18 axe helper and its tags
- `web/src/test/lint-rules.node.test.ts`, `eslint-config.node.test.ts`: the lint and format proofs
- `web/src/app/public/PublicPlaceholderPage.test.tsx`: one h1, the order copy, the memo re-render, axe clean
- `web/vitest.config.ts`: `setupFiles`, plus coverage excludes `src/dev/**` and `src/**/*.d.ts`
- `web/src/main.tsx`, `PublicPlaceholderPage.tsx`, `styles/app.css`, `styles/base.css`, `build-output.node.test.ts`: Prettier formatting only (class order, line breaks, expanded CSS rules)
- `web/src/test/build-config.node.test.ts`: `define?.__DEV_ROUTES__` in dot notation (lint fix)

## Decisions Made

- The type-aware rules got their own block (see Deviations 1).
- CSS keeps double quotes, so app.css still reads `source("../../src")`, the form the 02-02 cross-plan note gives 02-05.
- better-tailwindcss uses the `compact` message style and absolute paths, so its messages are the same locally and on CI.
- The CSS-import negation works (A10). Fontsource needs `/**` negations, and `@/styles/app.css` is allowed only through the main.tsx override.
- The `src/lib/http/**` override also drops the lib/http import pattern, so the client can import its own modules (`@/lib/http/httpError`). Every syntax ban except the fetch member ban still fires there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type-aware rules cannot sit in the Linter-tested restrictions block**
- **Found during:** Task 1 (GREEN design)
- **Issue:** The plan puts `prefer-nullish-coalescing` and `no-deprecated` in the one restrictions block, but that block is also run through ESLint's `Linter` on virtual files, which have no type information. A type-aware rule throws there.
- **Fix:** They moved to a `csps/type-aware` block that covers every file (wider than src). The eslint-config test pins both on the resolved config for `src/ui/x.tsx`.
- **Files modified:** `web/eslint.config.mjs`
- **Committed in:** `f5e9651`

**2. [Rule 1 - Bug] The style-value ban never fired**
- **Found during:** Task 2 (RED)
- **Issue:** `JSXAttribute[name.name='style'] > :matches(Literal, JSXExpressionContainer > :not(ObjectExpression))` matched nothing, because esquery doesn't apply a child combinator nested inside `:matches()`. So `style={styles}` passed lint.
- **Fix:** It is now one selector list on the attribute: `…[value.type!='JSXExpressionContainer'], …[value.expression.type!='ObjectExpression']`. A string `style="…"` case was added.
- **Files modified:** `web/eslint.config.mjs`, `web/src/test/lint-rules.node.test.ts`
- **Committed in:** `f566cf2`

**3. [Rule 2 - Missing critical] Ban gaps closed (T-02-12, T-02-14)**
- **Found during:** Task 1
- **Issue:** As written, the selectors let `style={{ ...s }}`, a string `style`, `globalThis.XMLHttpRequest`, `rgba(` and `setAttribute('STYLE')` through.
- **Fix:** The style-object ban matches any child that is not a `--*` property, so spreads are caught too. The member ban covers `fetch|XMLHttpRequest`. The restriction list matches `rgba?\(`. The setAttribute ban matches `/^style$/i`. Each case has a test.
- **Files modified:** `web/eslint.config.mjs`, `web/src/test/lint-rules.node.test.ts`
- **Committed in:** `f5e9651`, `7d6d194`

**4. [Rule 3 - Blocking] Coverage threshold failed on the React Compiler memo branches**
- **Found during:** Task 3 (verify)
- **Issue:** The compiled placeholder page has cache-hit branches that one render never takes (75% statements, 50% branches).
- **Fix:** The page test re-renders with equal props and checks that the output is identical (L-13). Coverage is now 100%. No ignore comments were used.
- **Files modified:** `web/src/app/public/PublicPlaceholderPage.test.tsx`
- **Committed in:** `8abdd65`

**5. [Rule 2 - Missing critical] The console guard's own test file needs `no-console` off**
- **Found during:** Task 1
- **Issue:** The plan exempts only `src/test/consoleGuard.ts`, but `consoleGuard.test.ts` must call `console.error` to prove the guard (L-21: "its own files").
- **Fix:** The override covers both files.
- **Committed in:** `f5e9651`

**6. [Rule 3 - Blocking] Existing code failed the new lint**
- **Found during:** Task 1 (lint on the 02-02/02-37 code)
- **Issue:** `build-config.node.test.ts` used `define?.['__DEV_ROUTES__']`, which `@typescript-eslint/dot-notation` rejects.
- **Fix:** It now uses `define?.__DEV_ROUTES__`. That was the only finding. The code was fixed and no rule was changed.
- **Committed in:** `f5e9651`

---

**Total deviations:** 6 auto-fixed (2 Rule 1, 2 Rule 2, 2 Rule 3)
**Impact on plan:** All bans the plan names are in place and proven. The extra strictness only closes bypasses. No rule was relaxed and no package changed.

## Issues Encountered

- A stale `.git/gsd-plan-head-before-02-04` ledger from the superseded run (2026-10-07) pointed at `e449097`. I reset it to this plan's real base `d1871e8` before the first commit, so `commits: 6` is measured against the right base.
- Type-aware lint of the whole web folder takes about 13 s, most of it creating the TS program.

## Notes for Later Plans

- **02-05 (stylesheet contract):** Prettier now owns `app.css`/`base.css` formatting. Keyframes are multi-line and `.8s` reads `0.8s`. Quotes stay double. Don't match one-line CSS text.
- **02-06 / 02-33:** append steps to `STEPS` in `web/scripts/verify.mjs` (a frozen array; edit the literal).
- **02-10 (api.ts):** only `src/lib/api.ts` is exempt from the lib/http import ban. If `src/lib/api.test.ts` imports from `@/lib/http`, add it to the `csps/restrictions/api` override's `files`.
- **Parity harness plan:** `visual/**` gets every ban and the Tailwind rules. `visual/reference/**` turns off only the D-33 markup bans and the Tailwind rules, so `dangerouslySetInnerHTML` (frozen App. D.4) and CSS imports still error there and will need a recorded override.
- **Class gate (UI-SPEC D-36 open point):** better-tailwindcss reads only the `className` attribute and `clsx`/`tw` call arguments. Module-level recipe maps (`*.recipe.ts` `as const` objects) are not linted by it unless their strings are passed through `tw(…)`. The planner's call on the `compile()` class gate still matters.
- **Every test file** runs under the console guard. A test that expects console output must take it with `collectConsole()`, or the after-each check fails it.

## TDD Gate Compliance

- Task 1: RED `6a8c6ed` comes before GREEN `f5e9651`. RED evidence was `RED_EVIDENCE_OK` for `src/test/lint-rules.node.test.ts` and `scripts/verify.test.ts`.
- Task 2: RED `7d6d194` comes before GREEN `f566cf2`. RED evidence was `RED_EVIDENCE_OK` for `src/test/lint-rules.node.test.ts` (`style={styles}`). The other 84 cases passed at RED because the plan's Task 1 action already built every ban. Those cases are regression proofs for Task 1. The one real gap they found was fixed in GREEN.
- Task 3: RED `06133ea` comes before GREEN `8abdd65`. RED evidence was `RED_EVIDENCE_OK` for `src/test/consoleGuard.test.ts` and `src/test/axe.test.tsx`.
- No refactor commits were needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved, and `package.json` / `package-lock.json` are unchanged.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Feature and primitive plans can now write component tests with `expectNoAxeViolations`, and lint enforces the D-33 class rules as they convert components.
- `npm --prefix web run verify` is the one static gate. It is green at HEAD `8abdd65`.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 14 created files and 7 modified files exist on disk.
- Commits `6a8c6ed`, `f5e9651`, `7d6d194`, `f566cf2`, `06133ea` and `8abdd65` are on `gsd/phase-2-web-foundation-design-system`.
- Acceptance criteria re-run: `export const syntaxBans` = 1, `...syntaxBans` = 5, `reportUnusedDisableDirectives` = 1, `prettier-plugin-tailwindcss` = 1, `"tabWidth": 2` = 1, `format:check` exits 0, `it(` in lint-rules = 71 (≥ 35), the eslint-config test covers 3 globs plus the empty pattern, `wcag22aa` = 1, `setupFiles` = 1, `thresholds` = 1, deliberate fixtures carry `-- deliberate`, `verify` exits 0.
