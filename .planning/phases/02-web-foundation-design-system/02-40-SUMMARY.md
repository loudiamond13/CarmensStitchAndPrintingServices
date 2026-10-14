---
phase: 02-web-foundation-design-system
plan: 40
subsystem: web-design-system
tags: [tailwind, tw-marker, icons, lucide-react, a11y, recipes, tdd]
created: "2026-10-08T13:22:00-05:00"
updated: "2026-10-08T13:22:00-05:00"
requires:
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "Lint (better-tailwindcss reads tw/clsx/className; D-33 bans on template literals and + inside tw), Prettier class sorting, the verify gate, expectNoAxeViolations"
  - phase: 02-web-foundation-design-system (plan 02-05)
    provides: "The class gate (scripts/class-gate.mjs: collectClassTokens, checkClassTokens, buildCss) and the real-source sweep in scripts/tailwind-classes.test.ts"
provides:
  - "web/src/ui/tw.ts: tw(classes) identity marker for Prettier, lint and the class gate (D-33)"
  - "web/src/ui/brand/icons.ts: ICONS (the 56 App. D.5 names -> lucide-react 1.53.0 components, trash-2 -> Trash, filter -> Funnel) and IconName = keyof typeof ICONS"
  - "web/src/ui/brand/Icon.tsx: Icon({ name, size = 20, strokeWidth = 2, label?, className? }) and IconProps"
  - "web/src/ui/brand/index.ts: brand barrel exporting Icon, IconProps, IconName"
  - "web/src/ui/layout/layout.recipe.ts: srOnlyClasses (.csp-sr look) and pageRootClasses (.s-page look)"
affects: [02-14, 02-18, 02-29, every-src-ui-component]
actuals:
  tokens: 4340    # chars/4 over the realized diff (17,360 chars, 7 files)
  tasks: 2
  commits: 4
plan_head_before: 902a24403e02647ccbde1d6f04e0f63f51b4c263
plan_head_after: 0927f759220faf01499987dca0c3e69f420655da
tech-stack:
  added: []
  patterns:
    - "Class strings outside a className attribute are complete literals inside tw('…'); Prettier may reorder the tokens, so tests compare sorted token lists, never the raw string"
    - "Icons render only through <Icon name … />; ICONS holds per-icon named lucide-react imports (no namespace import), so unused icons are tree-shaken"
    - "A src/ test that runs the class gate is a *.node.test.ts (node TS program), because tsconfig.app.json cannot import scripts/*.mjs"
key-files:
  created:
    - web/src/ui/tw.ts
    - web/src/ui/brand/icons.ts
    - web/src/ui/brand/Icon.tsx
    - web/src/ui/brand/index.ts
    - web/src/ui/brand/Icon.test.tsx
    - web/src/ui/layout/layout.recipe.ts
    - web/src/ui/layout/layout.recipe.node.test.ts
  modified: []
key-decisions:
  - "Icon keeps the App. D.3 className prop (merged after the .csp-icon look with clsx) for the context colour a src/ui parent passes to an icon it renders itself (UI-SPEC: Sidebar gives its Icon the current-item colour); no other svg props are spread"
  - "Icon treats an empty label like no label (aria-hidden, no role), as App. D.3's truthiness check does, so it never renders an unnamed image"
  - "The layout recipe test is web/src/ui/layout/layout.recipe.node.test.ts, not layout.recipe.test.ts: the class gate is an .mjs module that only the node TS program (allowJs, node types) can import"
  - "App. D.5 prose says 57 icons; its ICONS object holds 56 keys. The 56 keys are the binding list (pinned sorted in Icon.test.tsx)"
patterns-established:
  - "Component tests re-render with the same props and then new props to cover React Compiler memo-cache branches (L-13); without it Icon.tsx showed 61.9% branch coverage"
requirements-completed: [WEB-02, A11Y-01]
coverage:
  - id: D1
    description: "tw(classes) is an identity marker; every class string in this plan's files is a complete literal in tw('…') or className, and the class gate reports zero findings across src"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/scripts/tailwind-classes.test.ts (26 cases, real-source sweep) and node web/scripts/class-gate.mjs (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "<Icon name size label? /> renders one lucide svg with the App. D.3 wrapper (size default 20 -> width/height, viewBox 0 0 24 24, fill none, stroke currentColor, stroke-width 2, round caps/joins), the .csp-icon look, lucide's own classes, role img + aria-label when labelled, else aria-hidden; strokeWidth and className pass through"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/ui/brand/Icon.test.tsx (Icon describe, 10 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ICONS holds exactly the 56 App. D.5 names, IconName is exactly that union, trash-2 is lucide's Trash and filter is lucide's Funnel (D-32), and every name renders a lucide svg with a drawing"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/ui/brand/Icon.test.tsx (ICONS describe, 59 cases incl. it.each over the 56 names)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A labelled Icon passes expectNoAxeViolations with zero violations"
    requirement: A11Y-01
    verification:
      - kind: unit
        ref: "web/src/ui/brand/Icon.test.tsx#has no axe violations when labelled (A11Y-01)"
        status: pass
    human_judgment: false
  - id: D5
    description: "srOnlyClasses and pageRootClasses equal the .csp-sr and .s-page transcriptions, pass the class gate and compile to their declarations (clip: rect(0 0 0 0); container-type inline-size, container-name pg)"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/ui/layout/layout.recipe.node.test.ts (5 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The 56 icon wrappers look equal to the reference in a real browser"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout; plan 02-18 proves the 56-icon wrapper look in the parity harness"
duration: 8min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 40: tw Marker, Spec Icon over lucide-react, and Layout Recipes Summary

**Components now have three shared building blocks: the `tw('…')` class-string marker, the spec `<Icon name size label? />` API over per-icon lucide-react 1.53.0 imports for all 56 App. D.5 names (with `trash-2` → Trash and `filter` → Funnel), and the `.csp-sr` / `.s-page` looks as recipes that pass the class gate.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-08T18:13:28Z
- **Completed:** 2026-10-08T18:21:16Z
- **Tasks:** 2
- **Files modified:** 7 (all created)

## Accomplishments

- `tw(classes)` returns its argument unchanged. Prettier sorts it, lint checks it, and the class gate compiles it.
- `ICONS` maps the 56 spec names to lucide-react components through named imports (no `import * as`), so unused drawings are tree-shaken. `IconName` comes from its keys, and a test pins it to the exact 56-name union, so an unknown name is a compile error.
- `Icon` keeps the App. D.3 wrapper. `size` (default 20) sets width and height. Stroke width is 2 with round caps and joins. The `.csp-icon` look is `inline-block flex-none align-middle`. lucide's own `lucide lucide-<name>` classes stay (D-28). A `label` gives `role="img"` and `aria-label`; without one the icon is `aria-hidden="true"`. A labelled icon passes axe with zero violations.
- `srOnlyClasses` (`absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]`) and `pageRootClasses` (`@container/pg relative min-h-full bg-bg font-sans text-[16px] leading-6 text-ink`) compile to the spec declarations. Tailwind's own visually-hidden utility is not used.

## Task Commits

1. **Task 1 (tracer): Icon wrapper, tw and the brand barrel**
   - RED `c3216ef` (test): 7 cases against a placeholder Icon that renders an empty span; 6 fail on the svg-count assertion (`RED_EVIDENCE_OK`, target `src/ui/brand/Icon.test.tsx`).
   - GREEN `fb89ad5` (feat): `tw`, `ICONS` (all 56 names, as the plan's Task 1 action says), `Icon`, barrel. The tracer verify (tests + lint) was re-run and passed before expansion (end-of-phase mode, automated-only verify).
2. **Task 2: exact name set, D-32 aliases, layout recipes**
   - RED `296af98` (test): the layout recipe tests against two empty `tw('')` strings; all 5 fail on assertions (`RED_EVIDENCE_OK`, target `src/ui/layout/layout.recipe.node.test.ts`).
   - GREEN `0927f75` (feat): the two recipes, plus an Icon re-render case that covers the React Compiler cache branches.

No REFACTOR commit was needed.

## Files Created/Modified

- `web/src/ui/tw.ts`: the class-string marker.
- `web/src/ui/brand/icons.ts`: `ICONS` and `IconName`, header `// SPEC-DEVIATION: D-10 lucide-react wrapper …`.
- `web/src/ui/brand/Icon.tsx`: the spec Icon API over lucide-react.
- `web/src/ui/brand/index.ts`: exports `Icon`, `IconProps`, `IconName`.
- `web/src/ui/brand/Icon.test.tsx`: 68 cases (wrapper, a11y, memo cache, name set, aliases, every icon).
- `web/src/ui/layout/layout.recipe.ts`: `srOnlyClasses`, `pageRootClasses`.
- `web/src/ui/layout/layout.recipe.node.test.ts`: 5 cases (exact token sets, class gate, compiled declarations).

## Decisions Made

- `Icon` keeps the spec's `className` prop. The plan's action lists `{ name, size, label, strokeWidth }`, but App. D.3 has `className`, and the UI-SPEC says Sidebar passes its Icon the current-item colour. Only that prop is passed through. Other svg props are not spread, which is marked `// SPEC-DEVIATION: D-33` in Icon.tsx.
- An empty `label` counts as no label (hidden, no role), as App. D.3's `label ? … : …` does.
- The spec prose says "57 icons", but its `ICONS` object has 56 keys. The test pins the 56 keys.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Layout recipe test file named `layout.recipe.node.test.ts`**
- **Found during:** Task 2 (RED)
- **Issue:** The plan names `web/src/ui/layout/layout.recipe.test.ts` and asks it to run the 02-05 class gate. The gate is `scripts/class-gate.mjs`, which reads app.css with `node:fs`. Only the node TS program (`allowJs`, node types, `*.node.test.ts`) can import it. `tsconfig.app.json` would fail typecheck on that import (02-07 rule: src tests needing node go in `*.node.test.ts`).
- **Fix:** The test is `layout.recipe.node.test.ts` with `// @vitest-environment node`. The plan's verify filter `src/ui/layout` still selects it.
- **Files modified:** `web/src/ui/layout/layout.recipe.node.test.ts`
- **Committed in:** `296af98`

**2. [Rule 2 - Missing critical] Tests compare sorted token sets, not raw strings**
- **Found during:** Task 2 (GREEN)
- **Issue:** Prettier's Tailwind plugin reorders the classes inside `tw('…')` (for example `whitespace-nowrap` now comes before `[clip:…]`). A raw string-equality test would fail on every format run.
- **Fix:** The test checks that the sorted token list equals the UI-SPEC string's sorted tokens. That is still exact set equality: nothing missing and nothing extra. It also checks the compiled declarations.
- **Committed in:** `296af98`

**3. [Rule 2 - Missing critical] Memo-cache re-render case for Icon coverage**
- **Found during:** Task 2 (verify)
- **Issue:** React Compiler adds cache-hit branches to `Icon.tsx`. With single renders, `verify` reported 61.9% branch coverage for the file. The global threshold still passed, but the file was under-tested.
- **Fix:** Added the L-13 re-render case (same props, then new props). `Icon.tsx` is now at 100% on every metric.
- **Committed in:** `0927f75`

---

**Total deviations:** 3 auto-fixed (1 Rule 3, 2 Rule 2)
**Impact on plan:** Every must-have truth is implemented and tested. No package changed and no look changed, so neither conditional checkpoint (packages, D-08 look) fired.

## TDD Gate Compliance

- Task 1: RED `c3216ef` comes before GREEN `fb89ad5` (`RED_EVIDENCE_OK`).
- Task 2: RED `296af98` comes before GREEN `0927f75` (`RED_EVIDENCE_OK` for the layout recipe test).
- The Task 2 icon name-set and alias cases passed at their RED commit. This is expected and not a gate violation: the plan's Task 1 action builds all 56 names with the D-32 aliases. A mutation run showed the cases have teeth. It dropped `printer` and pointed `filter` at Trash, and 3 cases failed. The file was then restored and nothing was committed.

## Issues Encountered

None.

## Verification

- `npm --prefix web run test -- --run src/ui/brand src/ui/layout scripts/tailwind-classes.test.ts`: 3 files, 99/99 passed.
- `npm --prefix web run lint`: exit 0, no warnings.
- `npm --prefix web run verify`: exit 0. It ran typecheck (three programs), lint, format, 37 files with 1031/1031 tests, coverage, build, notices and the license gate. Coverage is 100% statements, functions and lines, and 99.66% branches. The only uncovered branch is the existing `csps.ts:176`. All five new source files are at 100%.
- `node web/scripts/class-gate.mjs`: exit 0.
- Acceptance greps: `SPEC-DEVIATION: D-10` appears 1 time in icons.ts. `from 'lucide-react'` appears 1 time and `import * as` 0 times. The ICONS key-line count is 56. `sr-only` appears 0 times in layout.recipe.ts and `clip:rect(0_0_0_0)` appears 1 time.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **02-14 (Button):** import `tw` from `@/ui/tw` and `Icon`/`IconName` from `@/ui/brand`. Do not recreate them. Wrap recipe maps in `tw('…')`.
- **02-18 (brand):** add Mark and the other brand exports to `web/src/ui/brand/index.ts`, and prove the 56 wrappers in parity.
- **02-29 (layouts):** switch the root in `web/src/main.tsx` from its own literal to `pageRootClasses`. Use `srOnlyClasses` for SkipLink and for visually hidden table headers.
- For a context colour on an icon inside `src/ui`, pass `className` (for example `text-accent-ink`). Feature code passes only layout glue.

## Self-Check: PASSED

- All 7 files exist under `web/src/ui/`.
- Commits `c3216ef`, `fb89ad5`, `296af98` and `0927f75` are on `gsd/phase-2-web-foundation-design-system`.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*
