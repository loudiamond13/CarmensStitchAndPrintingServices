---
phase: 02-web-foundation-design-system
plan: 05
subsystem: testing
tags: [tailwindcss, compile, typescript-ast, vitest, stylesheet-contract, class-gate, d-33, d-02, quality-gates, tdd]
created: "2026-10-08T10:45:30-05:00"
updated: "2026-10-08T10:45:30-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-02)
    provides: "web/src/styles/app.css (Tailwind entry with source(\"../../src\"), custom variants, cleared @theme) and base.css (token blocks, global element rules); tailwindcss 4.3.3"
  - phase: 02-web-foundation-design-system (plan 02-37)
    provides: "tsconfig.node.json owning scripts/** and src/**/*.node.test.ts; the typescript alias (TS 6 API, D-15)"
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "verify pipeline, console guard, ESLint D-33 bans and better-tailwindcss rules, Prettier CSS formatting"
provides:
  - "web/src/styles/stylesheet-contract.node.test.ts: exact two-file set (app.css, base.css) and an allowed-construct contract; local parseCssBlocks(text) tokenizer"
  - "web/scripts/class-gate.mjs: collectClassTokens(fileName, sourceText), checkClassTokens(tokens, { file }), buildCss(tokens), listSourceFiles(), runClassGate(); CLI `node scripts/class-gate.mjs`"
  - "web/scripts/class-gate.config.mjs: OPACITY_ALLOW ({ pattern, files?, decision }) and COLOUR_LITERAL"
  - "web/scripts/tailwind-classes.test.ts: 26 cases incl. the six variant query texts and the real-source sweep"
  - "docs/web/styling.md: how to style under D-33 for every later phase"
affects: [02-06, 02-09, 02-10, 02-25, 02-29, 02-33, 02-34, 02-40, every-later-web-plan, verify, a11y]

actuals:
  tokens: 13400    # chars/4 over the realized diff (53,550 chars, 5 files)
  tasks: 2
  commits: 5
plan_head_before: bbb37e332bab7f8760eb207135927e214d2e544c
plan_head_after: 9111ff3dfdfbd96c471bffb590619018f9908a4d

tech-stack:
  added: []
  patterns:
    - "Class gate: tailwindcss compile() over the real app.css, build() called incrementally; a token is known when adding it changes the output, cached per token"
    - "Class tokens are collected with the TypeScript AST (createSourceFile), never with regexes over source text"
    - "Every string literal in a *.recipe.ts file is a class string; recipe files hold no other strings"
    - "Opacity allow-list entries carry a decision ID, enforced by a test"
    - "Stylesheet tests run in the node environment and read files with fs (Pitfall 32)"

key-files:
  created:
    - web/src/styles/stylesheet-contract.node.test.ts
    - web/scripts/class-gate.mjs
    - web/scripts/class-gate.config.mjs
    - web/scripts/tailwind-classes.test.ts
    - docs/web/styling.md
  modified: []

key-decisions:
  - "The stylesheet contract is per file: app.css may hold only at-rules (import, source not, custom-variant, theme/theme inline, keyframes inside @theme); base.css only the allowed selector blocks, @font-face and the reduced-motion @media (with only `*` inside it)"
  - "The Tailwind entry is accepted as source(\"../src\") or source(\"../../src\"); the real file uses ../../src (02-02 deviation)"
  - "group/peer marker classes (group, group/<name>, peer, peer/<name>) are accepted by the class gate because Tailwind emits no CSS for them by design"
  - "Each token gets at most one finding, in the order colour-literal, opacity, unknown"
  - "Opacity detection reads the utility after the variants, so hover:opacity-80 and the arbitrary [opacity:.5] are caught too"

patterns-established:
  - "Recipe files (`*.recipe.ts`): module-level as const maps of complete tokens wrapped in tw('…'), and no non-class strings"
  - "A new D-02 opacity allow-list entry needs a decision ID in class-gate.config.mjs"

requirements-completed: [WEB-02, A11Y-04]

coverage:
  - id: D1
    description: "web/src/styles holds exactly app.css and base.css, with only the allowed constructs; a class selector, @apply or @utility fails and is named"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/styles/stylesheet-contract.node.test.ts (19 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every class token in src compiles against the CSPS theme; cleared defaults and typos are reported as unknown, CSPS theme names pass"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/scripts/tailwind-classes.test.ts#checkClassTokens + the real source"
        status: pass
    human_judgment: false
  - id: D3
    description: "No class token carries a hex, rgb( or oklch( colour literal"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/scripts/tailwind-classes.test.ts#reports rgb( and oklch( colour literals"
        status: pass
    human_judgment: false
  - id: D4
    description: "The custom variants emit the exact spec query text, and hover: is a plain :hover"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/scripts/tailwind-classes.test.ts#the custom variants emit the exact spec query text"
        status: pass
    human_judgment: false
  - id: D5
    description: "opacity-* is accepted only from the D-02/D-05 allow-list, by file"
    requirement: "A11Y-04"
    verification:
      - kind: unit
        ref: "web/scripts/tailwind-classes.test.ts#allows the thumb reveal opacity only in the ImageUploader files (D-05)"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/web/styling.md explains the D-33 rules, tw() recipes, every custom variant, the banned built-ins and the gates"
    verification: []
    human_judgment: true
    rationale: "Whether the guide reads clearly for later phases is a judgment call; the greps only prove it names tw('…') and all 12 variants."

duration: 12min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 05: Stylesheet Contract and Class Gate Summary

**Two node-environment gates lock D-33: a stylesheet contract that allows only the theme, variants, keyframes, fonts and base rules in app.css/base.css, and a class gate that compiles every src class token with tailwindcss `compile()` against the real theme and rejects silent no-CSS tokens, colour literals and text opacity.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-08T15:32:57Z
- **Completed:** 2026-10-08T15:45:10Z
- **Tasks:** 2
- **Files modified:** 5 (all created)

## Accomplishments

- The stylesheet contract (`stylesheet-contract.node.test.ts`) checks that `web/src/styles` holds exactly `app.css` and `base.css`. A local `parseCssBlocks` tokenizer handles comments, strings and parentheses, and records nesting and lines. A third stylesheet fails the test (checked by adding a temporary `overrides.css`).
- The class gate (`class-gate.mjs`) walks the TypeScript AST for `className`, `clsx`/`tw` arguments and `*.recipe.ts` strings. It compiles each token against the real `app.css` and reports `unknown`, `colour-literal` and `opacity` with the file, line and token. It also runs from the command line: `node scripts/class-gate.mjs` exits 1 on any finding (checked with a temporary `bg-blue-500 opacity-60` file).
- Variant proof: `pg-phone`, `pg-tablet`, `pg-md-up`, `vp-lt-sm` and `no-hover` emit the spec's query text, and `hover:` emits no `(hover: hover)` wrapper.
- The real source sweep (`src/main.tsx`, `PublicPlaceholderPage.tsx`) reports zero findings. A separate test proves the sweep actually collects tokens.
- `docs/web/styling.md` is the styling guide for every later phase.

## Task Commits

1. **Task 1: Stylesheet contract (tracer)**: RED `9c9365d` (test), GREEN `b16b96f` (feat)
2. **Task 2: Class gate**: RED `c730eb2` (test), GREEN `80edbc8` (feat)
3. **Guide follow-up** (marker classes, CLI): `9111ff3` (docs)

**Plan metadata:** see the docs(02-05) completion commit.

## Files Created/Modified

- `web/src/styles/stylesheet-contract.node.test.ts`: two-file set, per-file at-rule and selector allow-lists, 19 tests
- `web/scripts/class-gate.mjs`: token collector, compile() checker, source sweep, CLI
- `web/scripts/class-gate.config.mjs`: `OPACITY_ALLOW` (D-02 disabled/aria-disabled 45%, D-05 ImageUploader thumb reveal) and `COLOUR_LITERAL`
- `web/scripts/tailwind-classes.test.ts`: 26 tests (collector, checker, variants, config, real source)
- `docs/web/styling.md`: D-33 rules, tokens, recipes with `tw('…')`, context and dynamic values, every custom variant, banned built-ins, gates

## Decisions Made

- **The contract is per file and stricter than a shared allow-list.** `app.css` holds only at-rules: `@import` limited to the Tailwind entry and the `base.css` layer import, `@source not "…"`, top-level `@custom-variant`, `@theme`/`@theme inline`, and `@keyframes` only inside `@theme`. `base.css` holds only the allowed selector blocks (top level), `@font-face` and the reduced-motion `@media`, and only `*` may sit inside that `@media`. Children of a rejected block are reported once, under the parent.
- **The class gate reports one finding per token,** in this order: colour literal, then opacity, then unknown.
- **The opacity check reads the utility after the variants,** so `hover:opacity-80`, `[opacity:.5]` and `-opacity-*` are caught. The `/NN` colour-opacity modifiers (`text-ink/60`) are not opacity tokens under this plan's definition. Lint and the parity harness cover them (see Next Phase Readiness).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's must-have text names `source("../src")`, but the real entry is `source("../../src")`**
- **Found during:** Task 1
- **Issue:** The truth's literal `../src` would reject the correct file (02-02 deviation 1).
- **Fix:** The contract accepts `source("../src")` and `source("../../src")` through one regex, `/^@import "tailwindcss" source\("(?:\.\.\/){1,2}src"\)$/`. Any other `@import` fails.
- **Files modified:** `web/src/styles/stylesheet-contract.node.test.ts`
- **Committed in:** `b16b96f`

**2. [Rule 1 - Bug] `group/thumb` (the D-05 named group) was reported as unknown**
- **Found during:** Task 2 (GREEN)
- **Issue:** Tailwind emits no CSS for the `group`/`peer` marker classes by design, so the "no CSS means unknown" rule flagged them. The spec relies on `group/nav` and `group/thumb`.
- **Fix:** Tokens matching `^(?:group|peer)(?:\/[A-Za-z0-9_-]+)?$` skip the compile check. Tests show that `group`, `group/nav`, `peer`, `peer/check` and their variants pass, while `group/` and `peergroup` still fail.
- **Files modified:** `web/scripts/class-gate.mjs`, `web/scripts/tailwind-classes.test.ts`
- **Committed in:** `80edbc8`

**3. [Rule 2 - Missing critical] Allow-list entries must carry a decision ID**
- **Found during:** Task 2
- **Issue:** The plan says a new entry "needs a decision ID in its comment", but nothing enforced that.
- **Fix:** Each `OPACITY_ALLOW` entry has a `decision` field, and a test fails any entry without `D-<n>`.
- **Committed in:** `80edbc8`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2)
**Impact on plan:** All three were needed for correctness. No scope creep and no package change.

## Issues Encountered

- A stale `.git/gsd-plan-head-before-02-05` ledger from the superseded run pointed at `abefa5d`. I reset it to this plan's real base `bbb37e3` before the first commit, so `commits: 5` is measured against the right base.
- The GSD RED-evidence checker reads the JUnit `classname` (the test file path) as the test name, so the RED records target the test file. Both RED records returned `RED_EVIDENCE_OK`.

## Verification

- `npm --prefix web run test -- --run src/styles/stylesheet-contract.node.test.ts`: 19/19 passed
- `npm --prefix web run test -- --run scripts/tailwind-classes.test.ts`: 26/26 passed
- `npm --prefix web run typecheck`: clean
- `npm --prefix web run verify` (typecheck, lint, format:check, test:coverage, build): all passed, 10 files and 175 tests, coverage 100%, build clean
- Acceptance greps: `compile` 16, `createSourceFile` 1, `opacity-45` 1, and the variant test asserts all six query strings. `tw('` appears 5 times in the guide, which names all 12 custom variants.

## TDD Gate Compliance

- Task 1: RED `9c9365d` comes before GREEN `b16b96f`. RED evidence was `RED_EVIDENCE_OK` (16 of 19 failed on assertions against a stub tokenizer).
- Task 2: RED `c730eb2` comes before GREEN `80edbc8`. RED evidence was `RED_EVIDENCE_OK` (19 of 24 failed on assertions against stub modules).
- No refactor commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved. The gate uses the installed `typescript` alias and `tailwindcss` 4.3.3.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **02-40 (`tw.ts`, recipes):** the gate already reads `tw('…')` and every `*.recipe.ts` string. Recipe files must hold no other strings, such as comparisons or labels.
- **02-25 / 02-34 (ImageUploader):** the D-05 reveal tokens are allowed only in `src/ui/media/ImageUploader*.{ts,tsx}`. Any other path fails the gate.
- **Skeleton, entry-animation, profile stripe and login numeral opacity:** UI-SPEC D-02 lists these as allowed later, but the allow-list doesn't hold them yet. The plan that builds each one adds its entry with a decision ID.
- **Colour-opacity modifiers** (`text-ink/60`) are not checked by the class gate. They mix in oklab, and Pitfall 26 says to transcribe `color-mix` literally. If a later plan wants this machine-checked, add a pattern next to `COLOUR_LITERAL`.
- **PERF-05 `@font-face`** in `base.css` already passes the contract.

## Self-Check: PASSED

- All 5 created files exist on disk.
- All 5 task commits (`9c9365d`, `b16b96f`, `c730eb2`, `80edbc8`, `9111ff3`) are in the git log.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*
