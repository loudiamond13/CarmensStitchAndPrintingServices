---
phase: 02-web-foundation-design-system
plan: 09
subsystem: ui
tags: [react, design-system, lucide-react, differential-dom-test, react-compiler, spec-deviation, owner-review, playwright]
created: "2026-10-08T02:22:00-05:00"
updated: "2026-10-08T02:22:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "Plan 01: web/ scaffold, lucide-react 1.52.0, React Compiler in the Vite/Vitest chain; plan 02: strict TS/ESLint config with the __reference__ exclusions; plan 04: reconciled csps.ts; plan 05: verbatim CSS and overrides.css; plan 06: Playwright Chromium"
provides:
  - "web/src/ui/__reference__/{index.tsx, mark.ts, icons.ts, README.md}: frozen App. D.3-D.5, proven equal to the spec text"
  - "web/src/ui/index.tsx: the 37 App. D.3 components reconciled with the strict gates, 24 SPEC-DEVIATION markers, same DOM"
  - "web/src/ui/icons.ts: IconName (56 names) and ICONS (lucide-react 1.52.0 per-icon imports)"
  - "web/src/ui/mark.tsx: MarkSvg (App. D.4 as JSX, no raw-HTML prop)"
  - "web/src/app/RouterLink.tsx: App. D.6b"
  - "web/src/test/normalizeDom.ts: canonical DOM form (useId, lucide classes, xmlns, attribute order, icon drawings)"
  - "web/src/ui/differential.test.tsx: 245 prop-matrix cases (each also re-rendered with equal props) + handler parity"
  - "overrides.css: /* D-27 */ button.csp-nav compat rule"
  - "web/SPEC-DEVIATIONS.md: before-fix delta (7 type errors, 67 lint findings) and the 23-entry deviation register"
  - "web/scripts/owner-review-pack.mjs + the local pack in artifacts/owner-review/phase2-rulings/ (git-ignored)"
affects: [02-11, 02-12, 02-13, 02-14, 02-15, 02-17, 02-18, every feature phase that imports @/ui]

deferred:
  - "Task 3 (checkpoint:decision, owner rulings O-1..O-8, the 20 changed icons, D-27 look, D-BL-02): DEFERRED, owner away. Parked as D-BL-03 in backlog 999.1. D-31 and D-32 are NOT recorded in 02-CONTEXT.md. Plan 02-11 and everything depending on it must not run until the owner rules."

actuals:
  tokens: 66072       # chars/4 over git diff 248418b..dd07f56 (264288 chars), 22 KB of it the frozen reference copies
  tasks: 2            # of 3; Task 3 deferred
  commits: 6
plan_head_before: 248418b3077da39b567fdd413c1880c7ff228c35
plan_head_after: dd07f563ab500333a03173563450f489cafc06c8

tech-stack:
  added: []
  patterns:
    - "Differential DOM proof: render the frozen reference and the reconciled module side by side for every case, re-render with equal props (React Compiler memo path), apply interactions, compare normalizeDom output"
    - "Frozen reference modules are loaded with import.meta.glob so tsc and ESLint never follow them; scripts/reference-resolve-plugin.mjs maps their ../lib/csps import"
    - "jsx-a11y static-element handlers move to native listeners attached through React 19 callback refs with cleanup (no DOM change)"
    - "Unlayered overrides.css compat rules may only set properties no layered rule for the same class sets (tested)"
    - "Owner review material is rendered by Vite middleware-mode SSR (hmr and ws off, no port) and Playwright Chromium against the compiled e2e CSS"

key-files:
  created:
    - web/src/ui/__reference__/index.tsx
    - web/src/ui/__reference__/mark.ts
    - web/src/ui/__reference__/icons.ts
    - web/src/ui/__reference__/README.md
    - web/src/ui/index.tsx
    - web/src/ui/icons.ts
    - web/src/ui/mark.tsx
    - web/src/app/RouterLink.tsx
    - web/src/test/normalizeDom.ts
    - web/src/test/normalizeDom.test.ts
    - web/src/ui/differential.test.tsx
    - web/src/ui/reference-verbatim.test.ts
    - web/scripts/reference-resolve-plugin.mjs
    - web/scripts/owner-review-pack.mjs
    - web/SPEC-DEVIATIONS.md
  modified:
    - web/src/styles/overrides.css
    - web/src/styles/overrides.test.ts
    - web/vitest.config.ts
    - web/tsconfig.app.json
    - web/tsconfig.node.json

key-decisions:
  - "UiLink renders react-router Link directly (static-components); LinkProvider stays exported but unused by UiLink"
  - "IconProps omits `color`: lucide-react turns it into the stroke instead of an svg attribute; no App. D.3 call site passes it"
  - "MarkSvg takes only the props Mark passes (class, size, role, aria-label, aria-hidden) so the compiler can memoize it"
  - "D-27 compat rule sets only appearance, border-width, text-align and cursor; background, width, font and colour would beat the layered .csp-nav states because overrides.css is unlayered. Measured identical to the link in 34 values"
  - "Task 3 owner rulings deferred to backlog D-BL-03 (owner away); nothing was decided or auto-selected"

patterns-established:
  - "A reconciliation change carries // SPEC-DEVIATION: <rule or decision> at the change and a row in web/SPEC-DEVIATIONS.md"
  - "A new DOM difference in differential.test.tsx is a D-08 stop for the owner, never a normalization"

requirements-completed: [WEB-02]

coverage:
  - id: D1
    description: "Frozen App. D.3/D.4/D.5 copies equal the spec code blocks (LF) and carry a README"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/ui/reference-verbatim.test.ts#frozen reference copies (WEB-02, D-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The reconciled 37 components render the same normalized DOM as the reference over 245 seed-data cases, re-rendered with equal props; Sidebar Logout (D-27) is the only listed difference"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/ui/differential.test.tsx#reconciled design system vs frozen App. D.3 (WEB-02, D-07)"
        status: pass
      - kind: unit
        ref: "web/src/ui/differential.test.tsx#the one listed structural difference: Sidebar Logout (D-27)"
        status: pass
      - kind: unit
        ref: "web/src/test/normalizeDom.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Strict typecheck and ESLint pass with zero findings on the reconciled files; handlers moved to native listeners behave the same"
    requirement: WEB-02
    verification:
      - kind: other
        ref: "npm --prefix web run typecheck && npm --prefix web run lint"
        status: pass
      - kind: unit
        ref: "web/src/ui/differential.test.tsx#handler parity after the listener moves (D-07 step 3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Icons via lucide-react behind the Icon name API (56 names), Mark as JSX"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/ui/differential.test.tsx#icons and mark (D-10, D-12, WEB-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-27 compat rule: the Logout button looks identical to the old link"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#D-27 (O-9): the Sidebar Logout button keeps the .csp-nav link look"
        status: pass
      - kind: automated_ui
        ref: "node web/scripts/owner-review-pack.mjs (Chromium: identical in all 34 measured values, Blush/Espresso, expanded/collapsed, rest/hover)"
        status: pass
    human_judgment: true
    rationale: "The owner confirms the look from the before/after PNGs in the review pack (part of the deferred Task 3, D-BL-03)."
  - id: D6
    description: "Owner rulings on O-1..O-8, the 20 changed icon drawings and D-BL-02, recorded as D-31/D-32"
    requirement: A11Y-04
    verification: []
    human_judgment: true
    rationale: "Owner decision (checkpoint:decision, Task 3). DEFERRED to backlog D-BL-03 because the owner is away; not decided, not recorded."

duration: 43min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 09: Verbatim Design System, Strict-Gate Reconciliation and Owner Review Pack Summary

*Created: 2026-10-08T02:22:00-05:00 · Updated: 2026-10-08T02:22:00-05:00*

**The approved App. D.3-D.5 design-system code is now in `web/src/ui/`, clean under the strict TypeScript 7 and ESLint gates, with lucide-react icons and a JSX mark. A differential test renders all 37 components from the frozen spec copy and from the reconciled module over 245 seed-data cases and finds the same DOM, except the owner-ruled Sidebar Logout button (D-27). A local owner review pack shows the 20 changed icon drawings, O-1..O-8, the D-27 look and D-BL-02. Tasks 1 and 2 are complete. Task 3, the owner's rulings, is DEFERRED to the backlog as D-BL-03 because the owner is away. D-31 and D-32 are not recorded, and plan 02-11 must not run until the owner rules.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-10-08T06:37:43Z
- **Completed:** 2026-10-08T07:20:20Z
- **Tasks:** 2 of 3 complete. Task 3 (checkpoint:decision) is deferred.
- **Files modified:** 20 (15 created, 5 modified, 1 deleted)

## Accomplishments

- **Verbatim import and measured delta (D-07 steps 1-2).** The App. D.3, D.4 and D.5 blocks are frozen in `src/ui/__reference__/`, and a test proves they still equal the spec text. Before any fix, the verbatim copy gave **7 type errors** (the 7 Pitfall 7 predicted) and **67 lint findings** (65 in index.tsx, 1 in icons.ts, 1 in mark.ts). The research probe counted 99, but 15 of those were in csps.ts, already fixed in plan 04, and 17 came from `prefer-nullish-coalescing`, which this config limits by design. The full list by code, rule, file and line is in `web/SPEC-DEVIATIONS.md`.
- **Reconciliation (D-07 step 3).** Each fix is the smallest one that changes no DOM, and each is marked `SPEC-DEVIATION` (24 markers in index.tsx) and registered in a 23-entry table:
  - `UiLink` renders react-router's `Link` directly.
  - `Icon` renders `ICONS[name]` from lucide-react with the App. D.3 wrapper.
  - `Mark` renders `MarkSvg` JSX instead of the raw-HTML prop.
  - The drop-zone, thumbnail and Modal backdrop handlers moved to native listeners attached through callback refs.
  - Sidebar Logout is now `<button type="button" class="csp-nav">` (D-27).
  - The rest are mechanical fixes: `String()` in templates, block-bodied handlers, `T[]`, removed useless defaults, and partial-map reads that keep the unknown-status fallback.
  - No `eslint-disable` was added, no non-null assertion was used, and `||` was kept everywhere it guards a primitive.
- **Proof of no DOM change.** `differential.test.tsx` covers all 37 exports with 245 cases from the UI-SPEC §12 seed data: Carmen Reyes, Jomar Santos, ORD-2026-0148, ORD-2026-0151, ORD-2026-0153 and a loss-making ORD-2026-0142.
  - It includes interactions: drawer open, password show, tab and segment clicks, chart hover, type-to-confirm, uploader drag/reorder/drop/browse, toasts pushed and dismissed.
  - Every case is also re-rendered with equal props, so the React Compiler's memo-cache path is compared too.
  - Handler-parity tests prove that onFiles/onChange, Modal close, onLogout/onNavigate, onSearch and the 4.5 s toast timer behave the same in both modules.
  - `normalizeDom` hides only useId values, lucide classes, `xmlns`, attribute order and icon inner drawings, and its own 19 tests prove that everything else still counts.
- **D-27 compat rule.** `button.csp-nav { appearance: none; border-width: 0; text-align: start; cursor: pointer; }` is in overrides.css. A test proves it sets no property that any layered `.csp-nav` rule sets.
- **Owner review pack (Task 2).** Running `node web/scripts/owner-review-pack.mjs` writes `artifacts/owner-review/phase2-rulings/index.html` and 17 PNGs (git-ignored, verified with `git check-ignore`). The pack contains:
  - **Icons:** 56 icons, 20 of them changed (2 also renamed by lucide), at 24 and 48 px.
  - **O-1..O-8:** each in plain words. O-3 has a before/after phone-drawer picture, and O-8 has measured sizes.
  - **D-27:** in Blush and Espresso, expanded and collapsed, at rest and on hover. Chromium measures it identical in all 34 values.
  - **D-BL-02:** the Manager tag, today and with option A.
  - **New D-08 items:** none.

## Task Commits

1. **Task 1: Tracer, verbatim D.3-D.5 compile and lint clean, same DOM as the frozen reference**
   - `478f76a` test: frozen reference copies, verbatim working copies, differential/normalizeDom/reference-verbatim tests (RED)
   - `8fdc6d9` feat: reconciled index.tsx, lucide icon map, mark.tsx, normalizeDom, SPEC-DEVIATIONS.md (GREEN)
   - `8b95bb5` test: D-27 compat-rule tests (RED)
   - `928b6c3` feat: D-27 compat rule in overrides.css (GREEN)
2. **Task 2: Owner review pack**
   - `900e2a8` fix: the D-27 rule restates only `border-width` (the pack measured a `border-top-style` difference)
   - `dd07f56` feat: `web/scripts/owner-review-pack.mjs`, plus the review-pack section of SPEC-DEVIATIONS.md
3. **Task 3: Owner rules on O-1..O-8, the changed icons and any new markup-changing fix.** **DEFERRED** (no commit). The owner is away. The orchestrator parks the item as **D-BL-03** in `.planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md`. Nothing was decided or auto-selected. **D-31 and D-32 are NOT written** into 02-CONTEXT.md, and there is no owner reply to repeat here.

**Tracer gate (Task 1):** the run is interactive, the mode is `end-of-phase`, and the `<verify>` is automated-only. Both verify commands were re-run and passed before Task 2 started: 293 tests in the three files, then typecheck and lint with 0 findings. No checkpoint was needed.

## TDD Gate Compliance (RED evidence)

| Cycle | RED run | Failing target (assertion) | Checker |
|---|---|---|---|
| T1 normalizeDom | `vitest run` of the 3 files, exit 1, 55 of 277 failed | `_r_1_` vs `_r_7_` fragments: "expected '<label for="_r_1_">…' to be '<label for="_r_7_">…'" (identity placeholder) | RED_EVIDENCE_OK (`p09/t1-red-normalize.json`) |
| T1 D-27 | same run | "reconciled Logout button: expected null not to be null" (still the verbatim anchor) | RED_EVIDENCE_OK (`p09/t1-red-d27.json`) |
| T1 icons | same run | "expected [ Array(56) ] to deeply equal []"; menu "expected '<line x1="4" …' to contain 'M4 5h16'" | RED_EVIDENCE_OK (`p09/t1-red-icons.json`) |
| T1 README | same run | `__reference__/README.md`: "expected null not to be null" | RED_EVIDENCE_OK (`p09/t1-red-readme.json`) |
| T1b D-27 CSS | `vitest run src/styles/overrides.test.ts`, exit 1, 2 of 25 failed | "button.csp-nav { appearance: none } in top level: expected +0 to be 1" | RED_EVIDENCE_OK (`p09/t1b-red.json`) |

In RED, most differential DOM cases already passed. That is expected: the reconciled file was still the verbatim copy, so those cases are characterization checks of identical code. They became meaningful once GREEN changed the code. Every `test(02-09)` commit comes before its `feat(02-09)` commit. Task 2 is `type="auto"` (a local tool, not TDD).

## Files Created/Modified

- `web/src/ui/__reference__/{index.tsx, mark.ts, icons.ts}`: frozen App. D.3/D.4/D.5. Never edit them.
- `web/src/ui/__reference__/README.md`: the rules for the frozen copies.
- `web/src/ui/index.tsx`: the reconciled design system (37 `export function`, plus STATUS_TONE, PAYMENT_TONE, EXPENSE_TONE, SITE_LINKS, ADMIN_NAV and useToast).
- `web/src/ui/icons.ts`: `IconName` and `ICONS`.
- `web/src/ui/mark.tsx`: `MarkSvg` and `MarkSvgProps`. `web/src/ui/mark.ts` was deleted on purpose, replaced by mark.tsx.
- `web/src/app/RouterLink.tsx`: App. D.6b.
- `web/src/test/normalizeDom.ts` (+ test): `normalizeDom(html)`.
- `web/src/ui/differential.test.tsx`, `web/src/ui/reference-verbatim.test.ts`: the WEB-02 proofs.
- `web/scripts/reference-resolve-plugin.mjs`: resolves the reference copy's `../lib/csps` import (tests and the pack only).
- `web/scripts/owner-review-pack.mjs`: the local review pack.
- `web/SPEC-DEVIATIONS.md`: the delta report, the deviation register, normalization rules, a coverage note and the review pack.
- `web/src/styles/overrides.css` (+ `overrides.test.ts`): the D-27 rule and its tests.
- `web/vitest.config.ts`: registers the reference resolve plugin.
- `web/tsconfig.app.json`, `web/tsconfig.node.json`: reference-verbatim.test.ts is node-typed.

## Decisions Made

See the `key-decisions` list in the frontmatter. The owner decision of this plan (Task 3) was **not** made. It is deferred.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The frozen reference cannot resolve its own `../lib/csps` import**
- **Found during:** Task 1 (RED)
- **Issue:** App. D.3 was written for `src/ui/`, so from `src/ui/__reference__/` its `../lib/csps` import points at a folder that does not exist. The copy cannot be edited.
- **Fix:** `scripts/reference-resolve-plugin.mjs` resolves that one specifier, only for importers inside `__reference__`. Vitest and the review pack use it, and the build never needs it.
- **Committed in:** 478f76a

**2. [Rule 2 - Missing critical] Handler parity and the compiler memo path were not covered by a DOM-only comparison**
- **Found during:** Task 1 (GREEN)
- **Issue:** Moving the uploader and Modal handlers to native listeners changes no DOM, so a DOM comparison cannot catch a behaviour regression. The React Compiler's cache-hit branches were also unexercised, and global branch coverage fell to 76.8%, below the 90% gate.
- **Fix:** Added 8 uploader drag/drop/browse cases, a handler-parity block (uploader callbacks, Modal backdrop/Escape, Sidebar, Topbar/SegmentedControl, the toast timer and useToast outside a provider), an equal-props re-render of every case, and a MarkSvg re-render test. Coverage rose to 97.67% statements and 94.75% branches.
- **Committed in:** 8fdc6d9

**3. [Rule 1 - Bug] The D-27 rule produced a measurable `border-top-style` difference**
- **Found during:** Task 2 (first review-pack run)
- **Issue:** `border: 0` computed `border-top-style: none`, but the link has `solid` (from Tailwind preflight `border: 0 solid`). The difference is invisible but measurable.
- **Fix:** Set `border-width: 0` instead, and the test now forbids the shorthand. The rerun measured the link and the button as identical in all 34 values.
- **Committed in:** 900e2a8

**4. [Plan wording] The D-27 rule omits the plan's "transparent background, full width, inherited font and colour"**
- **Issue:** overrides.css is unlayered (enforced by a test), so those properties would beat the layered `.csp-nav` hover, current-item, collapsed and tablet-width rules.
- **Fix:** Preflight already supplies them, and the flex column stretches the button. A test enforces "no property a layered `.csp-nav` rule sets", and the review pack confirms the computed result is identical.
- **Committed in:** 928b6c3

**5. [Plan wording] `IconProps` omits `color` and `MarkSvg` takes explicit props**
- **Issue:** lucide-react consumes `color` as the stroke colour, and a `{...props}` spread kept the compiler cache from ever hitting.
- **Fix:** Both are type-only changes, with no DOM change for any App. D.3 call site. Both are registered in SPEC-DEVIATIONS.md.
- **Committed in:** 8fdc6d9

**6. [Plan wording] The review pack also rebuilds when `src/styles` is newer than `.e2e-dist`**
- **Issue:** The plan said "if missing". A stale bundle would have hidden the new D-27 rule from the screenshots.
- **Fix:** The script rebuilds when the bundle is missing or older than `src/styles`.
- **Committed in:** dd07f56

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug), plus 3 documented plan-wording adjustments.
**Impact on plan:** No DOM change beyond D-27, no new package, and no verbatim file was edited.

## Issues Encountered

- The first review-pack screenshots clipped the sidebars, because `.s-page` has inline-size containment and the flex panels shrank. A fixed `--sidebar-width` panel fixed it before the final run.
- jsx-a11y `aria-role` read the literal Sidebar/Topbar `role="manager"` prop (a user role) as an ARIA role. The test passes the role as a typed variable. Later call sites that pass a literal will hit the same rule, so pass a variable there too.

## Deferred Items (Task 3, for backlog D-BL-03)

The owner must rule on these. Each recommendation below is only a recommendation:

- **O-1..O-8:** see the review pack and `02-UI-SPEC.md` "Owner Confirmations".
- **The 20 changed icon drawings:** search, trash-2, receipt, users, log-out, menu, phone, message-circle, mail, clock, circle-check, list, filter, calendar, palette, zap, trending-up, trending-down, package, moon.
- **D-27:** confirm the look. It is measured identical.
- **D-BL-02:** the earlier open item, the Manager tag on the selected Users row.
- **New D-08 items:** none.

Resume signal: "option-a", or a per-item list. After the reply, record D-31 and D-32 in 02-CONTEXT.md, update its timestamp, and repeat the reply verbatim in this SUMMARY. Plan 02-11 then applies the rulings.

## User Setup Required

None.

## Next Phase Readiness

- **Blocked:** 02-11 (and everything that depends on it: 02-14, 02-15, 02-16, 02-17 and 02-18) waits on the D-31/D-32 owner rulings (D-BL-03).
- **Can proceed:** 02-10 (it does not depend on 02-09) and 02-12 (SPEC-GAP primitives, which depend on this plan's reconciled `@/ui` but not on the rulings). The orchestrator decides.
- The license gate still exits 1 on exactly the 5 D-BL-01 dev-tree packages. No new failures, and no exceptions were added.

## Verification

- `npm --prefix web run test -- --run src/test/normalizeDom.test.ts src/ui/differential.test.tsx src/ui/reference-verbatim.test.ts`: 3 files, 293+ tests pass (245 differential cases, at least 120 required).
- `npm --prefix web run typecheck && npm --prefix web run lint`: exit 0, 0 warnings.
- `npm --prefix web run verify`: exit 0. 987 tests pass. Coverage is 97.67% statements, 94.75% branches, 100% functions and 99.73% lines (lib/http, lib/url-state and lib/query at 100%). The build has no warnings.
- `npm --prefix web run e2e -- --grep "@smoke|@fixture"` (after preflight): 25 passed.
- `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`: 837/837 passed, 0 warnings.
- `node web/scripts/license-gate.mjs`: exit 1 on exactly the 5 known D-BL-01 packages.
- Task 2 verify: the review-pack command plus the `index.html` and at-least-3-PNG check both exit 0 (17 PNGs). `git check-ignore -q artifacts/owner-review/phase2-rulings/index.html` exits 0.
- Acceptance greps: `grep -cE "^export function" web/src/ui/index.tsx` returns 37, `grep -c SPEC-DEVIATION web/src/ui/index.tsx` returns 24, and index.html lists 56 icons with exactly 20 flagged, plus O-1..O-8 and the D-27 section.
- Plan `<verification>` line 2, "the owner's rulings are recorded as D-31/D-32": **NOT MET**, deferred (D-BL-03).
- No dev server or background process was left running (the preflight after the run shows no processes).

## Self-Check: PASSED (Tasks 1-2). Task 3 NOT done (deferred, D-BL-03)

- All 15 created files and 5 modified files exist on disk. `web/src/ui/mark.ts` was deleted on purpose.
- Commits 478f76a, 8fdc6d9, 8b95bb5, 928b6c3, 900e2a8 and dd07f56 exist (`git rev-list --count 248418b..dd07f56` = 6).
- Not claimed: no owner decision was made, and D-31 and D-32 are absent from 02-CONTEXT.md.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08 (Tasks 1-2; Task 3 deferred)*
