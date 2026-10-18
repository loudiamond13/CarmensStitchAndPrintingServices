---
phase: 05-profile-user-management
plan: 35
subsystem: ui
tags: [react, component-showcase, lazy-chunk, bundle-budget, build-rules, manager-only, demo-data, secret-scan, playwright, tdd, d-30, d-31, d-32, d-33, d-41]
created: "2026-10-18T14:10:00-05:00"
updated: "2026-10-18T14:10:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-30 (Edit User panel and the Phase 5 components the showcase shows) and 05-33 (Audit Log, ResponsiveTable detail rows); 05-03 requireManager loader and the admin route table; 02-34 showcase, kit, scenarios and previews"
provides:
  - "/admin/components: the Component Showcase for Managers (Admin redirected to /admin like /admin/users, visitor to sign-in with the return path), inside the admin shell, in no nav, as the lazy ComponentShowcaseRoute chunk"
  - "Demo data warning Badge beside the h1 and the Demo data Note as the first block after the page head on every showcase page; title 'Component Showcase · CSPS Admin'"
  - "modules/admin/pages/ComponentShowcasePage.tsx and modules/admin/components/showcase/{ShowcaseDemos.tsx, showcaseSections.ts, showcaseCopy.ts, showcase.recipe.ts} (git mv, history kept); /dev/components stays a dev-routes-only route on the same module"
  - "budget.ts SHOWCASE_ONLY_MODULE_PREFIXES and SHOWCASE_PAGE: src/dev/ and the showcase parts may sit in production only in chunks the showcase page reaches and the initial JS never loads; DEV_ONLY now names the parity entry, visual/, AdminPreviewPage and previewCopy"
  - "build-output.node.test.ts: one lazy showcase chunk, showcase copy only in its chunks, no dev route path, a secret and address scan of the showcase chunks, admin initial JS at most 250 KB"
  - "src/dev/PreviewBody.tsx: the shell previews take AdminPreviewPage only where dev routes exist"
affects: [05-37 screen review (C1 banner capture), 05-42 Phase 5 demos in the showcase, Phase 5 security review, later phases that add showcase cases]

actuals:
  tokens: 16100
  tasks: 2
  commits: 6
plan_head_before: e1b82f08cb8802dabf7463c4b7e5c13167b1a4a2
plan_head_after: cb6a4785f3a9118e76e047b3dcf38cbf35489e4a

tech-stack:
  added: []
  patterns:
    - "A page that renders dev scenarios ships as one lazy admin chunk, and the build proves the scenario code is reachable only through that chunk (showcaseErrors over the chunk graph)"
    - "A dev-only page used by a kit preview is chosen at module level behind the literal-false __DEV_ROUTES__, so production drops it"
    - "A module counts as shipped code only when it renders more than region comments and the CommonJS interop bindings of its imports"

key-files:
  created:
    - web/src/dev/PreviewBody.tsx
  modified:
    - web/src/modules/admin/pages/ComponentShowcasePage.tsx
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
    - web/src/modules/admin/components/showcase/showcaseSections.ts
    - web/src/modules/admin/components/showcase/showcaseSections.test.ts
    - web/src/modules/admin/components/showcase/showcaseCopy.ts
    - web/src/modules/admin/components/showcase/showcase.recipe.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/dev/previews/AdminShell.tsx
    - web/src/dev/previews/OpenedNavDrawer.tsx
    - web/scripts/budget.ts
    - web/scripts/budget.test.ts
    - web/scripts/vite-budget-plugin.ts
    - web/scripts/vite-budget-plugin.test.ts
    - web/src/test/build-output.node.test.ts
    - web/e2e/showcase.spec.ts
    - docs/web/budgets.md
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "The showcase page, its demos and copy moved out of src/dev (git mv); the shared kit, scenarios, renderScenario and previews stay in src/dev because the parity harness imports them with relative paths. The page imports them with '@/dev/...'."
  - "/dev/components remains, in the dev-route builds only, on the same lazy module (showcasePage in routes.tsx); the production routes have no /dev/components (the existing test still proves it falls through to the holding page)."
  - "Build rule shape: production fails when a showcase-only module sits in a chunk the public or admin initial JS loads, in a chunk the showcase page's static import closure does not reach, or in a chunk a non-showcase chunk imports; it also fails when such modules exist but no chunk holds the showcase page. The parity entry (src/dev/parity-main), visual/, AdminPreviewPage and previewCopy fail anywhere in production."
  - "The kit's eager glob pulls the AdminShell and OpenedNavDrawer previews, which imported AdminPreviewPage, into the showcase chunk. They now take their body from PreviewBody (AdminPreviewPage where __DEV_ROUTES__ is true, nothing in production), so 'Development only' never ships; the shell scenarios are layout groups the showcase page does not render anyway."
  - "Rolldown leaves the CommonJS import bindings of a tree-shaken module in its chunk (React is CommonJS), so AdminPreviewPage still showed renderedLength 238 with no code of its own. The budget plugin now counts a module only when it renders something beyond those bindings."
  - "Secret scan allow-list is exact addresses, not domains: a domain list would pass the owner's own gmail.com address. The list holds the spec section 12 sample addresses found in the showcase chunks plus the reserved example domains."

patterns-established:
  - "Tests that need an absent module use inert stubs only in the RED commit (budget.ts names), never a missing import, so the RED run fails on assertions"

requirements-completed: [USER-08]

coverage:
  - id: D1
    description: "D-30 / D-31: a Manager opens /admin/components inside the admin shell and sees the showcase, with no sidebar or tab-bar item current and no link to it; an Admin is sent on to /admin (Signed-in devices); a visitor goes to sign-in with the return path"
    requirement: "USER-08"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx#the component showcase for Managers (D-30, D-31, D-32)"
        status: pass
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@showcase a Manager opens /admin/components ... and #@showcase an Admin who opens /admin/components is sent on to /admin (50 passed, 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-32: every showcase page shows the h1 with a warning Demo data badge and, first in main after the head, the Note 'Demo data. Every order, name and amount on this page is made up to show the design. Nothing here is a real record.'; document title 'Component Showcase · CSPS Admin'"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ComponentShowcasePage.test.tsx#marks every showcase page as demo data; #has no axe violations in the page head and the demo-data banner"
        status: pass
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@showcase a Manager opens /admin/components: Demo data badge and banner first, axe-clean (page-level axe, CSP and console guard)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-33: the showcase page makes no API call other than the session refresh, does not scroll sideways at 320 and 1920 px, and breaks no CSP rule or console rule"
    verification:
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@showcase a Manager opens /admin/components (request listener: only /api/v1/auth/refresh); #@showcase /admin/components does not scroll sideways at 320px and 1920px"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-33 / D-41 Q3: the production build holds src/dev and the showcase parts only in chunks the showcase page reaches (lazy, outside the initial admin and public JS), and the parity entry, visual/, AdminPreviewPage and previewCopy fail the build anywhere"
    verification:
      - kind: unit
        ref: "web/scripts/budget.test.ts#evaluateBudgets: the showcase in production (D-33, D-41 Q3); #no dev code in production"
        status: pass
      - kind: unit
        ref: "web/scripts/vite-budget-plugin.test.ts#ignores a dev-only module the bundler reduced to the CommonJS bindings of its imports"
        status: pass
      - kind: other
        ref: "npm --prefix web run build (production budget rules ok: public 122.21 KB, admin 204.85 KB, CSS 14.61 KB) and npm --prefix web run build:budget (admin 206.77 KB)"
        status: pass
    human_judgment: false
  - id: D5
    description: "T-05-96 / T-05-97: the production output has one lazy showcase chunk, the showcase copy only in its chunks, no 'Development only' or 'Open Component Showcase', no dev route path, and no JWT, private key, connection string, cloud key, bearer token or unlisted address in the showcase chunks"
    verification:
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts (28 tests, read against the real production build)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The showcase sample data (spec section 12) includes addresses at real providers (gmail.com, yahoo.com) and one barangay.gov.ph address, now served from a public static chunk"
    verification: []
    human_judgment: true
    rationale: "The addresses are the made-up spec section 12 samples already in the public repo, but whether any could belong to a real person is a call only the owner can make; listed under Threat Flags."

duration: 55min
completed: 2026-10-18
---

# Phase 5 Plan 35: Component Showcase in Production Summary

**The component showcase now ships at /admin/components for Managers, labelled Demo data, as one lazy admin chunk (about 28.5 KB gzip, outside the 204.85 KB initial admin JS), while a new build rule and a build-output secret scan keep the scenario code, the parity entry, the preview page and any secret out of everything else.**

## Performance

- **Duration:** about 55 min
- **Started:** 2026-10-18T18:13:00Z (approximate; the start time was not recorded at launch)
- **Completed:** 2026-10-18T19:10:00Z
- **Tasks:** 2 planned (plus one extra RED/GREEN cycle for the budget plugin, see Deviations)
- **Files modified:** 19 in the code commits (1 created: `src/dev/PreviewBody.tsx`; 7 moved with `git mv`)

## Accomplishments

- **Tracer (Task 1):** `ComponentShowcaseRoute` renders the existing page with a warning `Demo data` badge beside the h1 and the `Note` banner as the first block after the head. `/admin/components` is a child of the guarded admin layout with the `requireManager` loader, so an Admin goes to `/admin` and a visitor to sign-in with the return path. The page is not in the sidebar or tab bar and no item is current. Browser proof: `@showcase` passes 50 of 50 in chromium, firefox, webkit, pixel and iphone (banner and badge first, axe, CSP and console guard, only `/api/v1/auth/refresh` called, no sideways scroll at 320 and 1920 px, Admin sent on to `/admin`, the old `/dev/components` cases unchanged).
- **Moves (OR-6):** `ComponentShowcase.tsx` became `modules/admin/pages/ComponentShowcasePage.tsx`; `ShowcaseDemos`, `showcaseSections` (+ test), `showcaseCopy` and `showcase.recipe` moved to `modules/admin/components/showcase/`, all with `git mv`. Kit, scenarios, `renderScenario` and previews stay in `src/dev`, so the parity entry is untouched.
- **Build rule (Task 2):** `budget.ts` splits the old dev list. `DEV_ONLY_MODULE_PREFIXES` is now AdminPreviewPage, previewCopy, `src/dev/parity-main` and `visual/`. `SHOWCASE_ONLY_MODULE_PREFIXES` (`src/dev/`, the showcase folder, the showcase page) are allowed in production only in chunks the showcase page's static closure reaches, that no initial chunk loads, and that no outside chunk imports. Measured on the real build: public 122.21 KB, admin 204.85 KB, CSS 14.61 KB (budget build: admin 206.77 KB); `npm --prefix web run verify` passes.
- **Output proof:** `build-output.node.test.ts` reads the real production build: one `ComponentShowcasePage-*.js`, not loaded by `/`; "Component Showcase" only in that chunk and the chunks it imports; no "Development only" or "Open Component Showcase"; no `/dev/` route path; no JWT, PEM key, connection string, cloud key or bearer token; every address in the showcase chunks is on the explicit made-up list or a reserved example domain.
- **Docs:** `docs/web/budgets.md` has a section on the rule and the numbers.

## Task Commits

1. **Task 1 (tracer): showcase at /admin/components for Managers** - `6579e0e` (test, RED), `48ecc19` (feat, GREEN), `e14b556` (style: one wrapped import)
2. **Task 2: build rules keep the showcase lazy and clean** - `3b295e0` (test, RED), `c11093d` (test, RED for the plugin fix), `cb6a478` (feat, GREEN)

**Plan metadata:** the docs commit that follows this file (`docs(05-35): complete component showcase in production plan`).

## TDD Gate Compliance

Both tasks have a `test(05-35)` RED commit before the `feat(05-35)` GREEN commit. No `refactor` commit was needed.

- **RED 1 (`6579e0e`):** the target tests ran and failed on the planned assertions: the page title still read `... CSPS (dev)`, no `Demo data` text anywhere, and `/admin/components` stayed at `/admin/components` for a Manager (no heading), an Admin (never moved to `/admin/sessions`) and a visitor (never moved to `/admin/login`). The Admin and visitor cases first hit the 5 s test timeout before their own poll finished, so they got an explicit 15 s test timeout to show the real assertion. One older test in `routes.test.tsx` also timed out in that run (the known slow first lazy import in `deferred-items.md`); it is not a target. `semanticAssessment`: the new tests executed and failed for the intended reasons; no compile, discovery or fixture fault.
- **RED 2 (`3b295e0`):** 21 new tests failed on assertions. `budget.ts` held inert placeholders (`SHOWCASE_ONLY_MODULE_PREFIXES = []`, `SHOWCASE_PAGE = ''`) so the files loaded; the budget cases failed because the old `src/dev/` rule reported errors and no showcase message existed, and the build-output cases failed because the stale production build had no showcase chunk. `semanticAssessment`: intended failures only.
- **RED 3 (`c11093d`):** the plugin test that feeds a module cut down to its CommonJS bindings failed (the build was rejected); its companion that adds a real function passed at RED by design, as a guard.
- The Vitest JUnit report is not a format `gsd check tdd-red-evidence` accepts here, so the semantic inspection above is the evidence (as in 05-29, 05-32, 05-33 and 05-41).

## Files Created/Modified

- `web/src/modules/admin/pages/ComponentShowcasePage.tsx` (+ test) - the page, `ComponentShowcaseRoute`, badge and banner
- `web/src/modules/admin/components/showcase/*` - demos, sections (+ test), copy (badge, banner, title), recipe (`titleRowClasses`)
- `web/src/modules/admin/routes.tsx` (+ test) - `components` child behind `requireManager`; the dev route uses the same lazy module
- `web/scripts/budget.ts` (+ test), `web/scripts/vite-budget-plugin.ts` (+ test) - the showcase rule and the own-code count
- `web/src/test/build-output.node.test.ts` - showcase chunk checks and the secret and address scan
- `web/src/dev/PreviewBody.tsx`, `previews/AdminShell.tsx`, `previews/OpenedNavDrawer.tsx` - AdminPreviewPage only where dev routes exist
- `web/e2e/showcase.spec.ts` - the `/admin/components` journeys; the title check for `/dev/components` follows the new title
- `docs/web/budgets.md` - the showcase section

## Decisions Made

See `key-decisions`. In short: the page moves, the shared dev kit stays; `/dev/components` stays dev-only on the same module; a three-part reachability rule; `PreviewBody` and the own-code count to keep `AdminPreviewPage` out; an exact-address allow-list for the scan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AdminPreviewPage reached the showcase chunk through the kit's previews**
- **Found during:** Task 2 (first production build)
- **Issue:** `kit.ts` eagerly globs `./previews/*.tsx`; `AdminShell` and `OpenedNavDrawer` imported `AdminPreviewPage`, which holds the "Development only" copy. The plan's rule (and the build-output test) forbid it in production, so the build failed on a module the plan did not mention.
- **Fix:** New `src/dev/PreviewBody.tsx` chooses `AdminPreviewPage` at module level behind `__DEV_ROUTES__`; both previews use it. Parity and the dev builds render exactly what they did; production renders nothing there (those shell scenarios are layout groups the showcase page never renders).
- **Files modified:** `web/src/dev/PreviewBody.tsx` (new), `web/src/dev/previews/AdminShell.tsx`, `web/src/dev/previews/OpenedNavDrawer.tsx`
- **Verification:** production build passes; `build-output.node.test.ts` finds no "Development only"; parity matrix run (see Issues Encountered)
- **Committed in:** `cb6a478`

**2. [Rule 3 - Blocking] The budget plugin counted import bindings as shipped code**
- **Found during:** Task 2 (after fix 1)
- **Issue:** Rolldown keeps `var import_react = ... require_react()` lines for a tree-shaken module whose imports are CommonJS, so `AdminPreviewPage.tsx` still had `renderedLength` 238 and failed the dev-only rule although none of its own code shipped.
- **Fix:** `shipsOwnCode` in `web/scripts/vite-budget-plugin.ts` counts a module only when its rendered code has something beyond region comments and those bindings; a module with a real function beside them still fails. Done as its own RED (`c11093d`) then GREEN.
- **Files modified:** `web/scripts/vite-budget-plugin.ts`, `web/scripts/vite-budget-plugin.test.ts` (neither is in the plan's file list)
- **Verification:** `vite-budget-plugin.test.ts` 21 passed; production build passes
- **Committed in:** `c11093d` (RED), `cb6a478` (GREEN)

**3. [Rule 1 - Bug] Two assertions in my own RED tests needed correcting**
- **Found during:** Task 2 GREEN (`budget.test.ts` import-rule message) and the verify run (Prettier on the moved page)
- **Fix:** the expected text names the chunk with its `assets/` prefix; one long import in the page was wrapped (`e14b556`, a `style` commit).
- **Committed in:** `cb6a478`, `e14b556`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug in my own tests)
**Impact on plan:** The two blocking fixes were necessary for the plan's own rule to hold on the real build; no scope beyond making `AdminPreviewPage` stay out and be measured honestly.

## Issues Encountered

- Between `48ecc19` and `cb6a478` the production build fails the budget check (the old `src/dev/` rule), which is the state the plan's task order produces; it passes again at `cb6a478`.
- The `@showcase` E2E runs the e2e bundle (dev routes on), so the browser did not load the production bundle. The production-only facts (no `AdminPreviewPage`, lazy isolation, no secrets) are proved by the budget build and `build-output.node.test.ts` against the real production output instead.
- The parity matrix (`npm --prefix web run parity -- --grep @parity`) passed 443 of 471. The 28 failures are all `@lists` cases with one difference, `min-width: auto` in the reference against `0px` in the implementation on the user cell text, which plan 05-20 introduced for long-name wrapping. This plan changed nothing those scenarios render, so it is out of scope and recorded in `deferred-items.md` for the Phase 5 close-out test review. The shell layout cases and the previews this plan changed pass.

## User Setup Required

None - no external service configuration required.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: public-static-sample-addresses | web/src/dev/scenarios/groups/lists.ts, web/src/dev/previews/ListTableState.tsx, web/src/dev/previews/AuthScreens.tsx | The showcase chunk is a public static asset and now carries the spec section 12 sample addresses (for example at gmail.com and yahoo.com). They are made up and were already in the public repo, but if any could belong to a real person the owner may want them moved to a reserved domain such as example.com. The scan allow-list in `build-output.node.test.ts` names them exactly, so a new address cannot slip in. |

## Known Stubs

None. (`budget.ts` placeholders existed only in the RED commit.)

## Next Phase Readiness

- 05-42 adds the Phase 5 demos to the same page; its cases ship in the same lazy chunk and the build rule already covers them.
- 05-37 can capture the C1 banner at `/admin/components` with the signed-in capture path.
- Wording ("Demo data" badge and banner) is built as written in the UI-SPEC and awaits the owner's screen review (D-48).

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*

## Self-Check: PASSED

- Created and moved files exist (`ComponentShowcasePage.tsx`, its test, the four files in `components/showcase/`, `PreviewBody.tsx`, `budget.ts`, `docs/web/budgets.md`); `src/dev/ComponentShowcase.tsx` is gone.
- All six commits are ancestors of HEAD (`6579e0e`, `48ecc19`, `e14b556`, `3b295e0`, `c11093d`, `cb6a478`); `git rev-list --count` from `plan_head_before` is 6.
- Acceptance criteria: `path: 'components'` in routes.tsx (2), `Demo data` in showcaseCopy.ts (2), `SHOWCASE_ONLY_MODULE_PREFIXES` in budget.ts (2), `src/dev/parity-main` in budget.ts (2), `D-33` in budgets.md (3).
- Verification: `npm --prefix web run verify` passed (5409 tests, 96.69% statements, both budget builds, licenses, notices); `@showcase` E2E 50 of 50 in five projects (run twice, before and after the build rules); parity 443 of 471 with the 28 `@lists` failures recorded as not caused by this plan.
