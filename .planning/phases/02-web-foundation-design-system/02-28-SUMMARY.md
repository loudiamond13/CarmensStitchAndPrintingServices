---
phase: 02-web-foundation-design-system
plan: 28
subsystem: ui
tags: [react, tailwind, a11y, skeleton, aria-busy, aria-live, lazy-image, error-state, parity]
created: "2026-10-08T23:26:00-05:00"
updated: "2026-10-08T23:26:00-05:00"

requires:
  - phase: 02-16
    provides: "describeHttpError mapper copy (modal-level ErrorState banners)"
  - phase: 02-17
    provides: "Button (secondary sm Try Again) and buttonClasses"
  - phase: 02-18
    provides: "MediaPlaceholder label={false} for the LazyImage fallback"
  - phase: 02-21
    provides: "Skeleton with --sk-w/--sk-h/--sk-r and the shimmer look that stops under reduced motion"
provides:
  - "@/ui/states: ErrorState, SkeletonText, SkeletonCard, SkeletonImage, LoadingRegion, useDelayedFlag, LazyImage, STATES_COPY"
  - "states scenario group: 8 implementation-only cases checked for axe and CSP in three engines"
  - "dev-only wrappers TracedErrorState, PendingLazyImage, FailedLazyImage"
affects: [02-30, 02-34, 02-36, list screens, detail screens, public gallery]

actuals:
  tokens: 15400
  tasks: 2
  commits: 4
plan_head_before: c7e0e231d226339a9a00048a2ad3308db5b87c90
plan_head_after: 646904dc1d16cc59a48d4499d4e6e656359af404

tech-stack:
  added: []
  patterns:
    - "LoadingRegion: aria-busy on the region, one sr-only polite status node as its sibling (never inside the busy subtree)"
    - "State resets during render (LazyImage on a new src, useDelayedFlag on a false flag, LoadingRegion on loading edges) instead of effects"
    - "Dev-only wrappers hold an image state without network: stop `load` in the capture phase on the frame; fire `error` once after mount"

key-files:
  created:
    - web/src/ui/states/states.recipe.ts
    - web/src/ui/states/copy.ts
    - web/src/ui/states/ErrorState.tsx
    - web/src/ui/states/Skeletons.tsx
    - web/src/ui/states/LoadingRegion.tsx
    - web/src/ui/states/useDelayedFlag.ts
    - web/src/ui/states/LazyImage.tsx
    - web/src/ui/states/index.ts
    - web/src/ui/states/ErrorState.test.tsx
    - web/src/ui/states/loading.test.tsx
    - web/src/ui/states/useDelayedFlag.test.tsx
    - web/src/ui/states/LazyImage.test.tsx
    - web/src/dev/scenarios/groups/states.ts
    - web/src/dev/previews/TracedErrorState.tsx
    - web/src/dev/previews/PendingLazyImage.tsx
    - web/src/dev/previews/FailedLazyImage.tsx
  modified:
    - docs/web/parity.md
    - .planning/phases/02-web-foundation-design-system/deferred-items.md

key-decisions:
  - "ErrorState keeps the App. C banner rules as written, including `.s-banner.is-danger span { color: --ink-muted }`, which also mutes the Try Again label (the approved computed App. E.8 look). Owner question logged in deferred-items.md; a one-line recipe change either way."
  - "ErrorState's text column is `min-w-0 flex-1 wrap-anywhere`: a long traceId wraps at 320px instead of pushing Try Again out of the banner (found by the parity axe pass)."
  - "LoadingRegion's prop is `loading` (plan wording), with optional `failed` that keeps the status silent because the ErrorState alert announces the failure."
  - "ErrorState accepts either `things` (list-load copy) or `title`/`message` (describeHttpError copy for modal-level banners); a reference already in the message is never repeated."

patterns-established:
  - "List screens: <LoadingRegion loading={isPending || slowRefetch} things=\"orders\" failed={isError}> around SkeletonCard/SkeletonTable; <ErrorState things=\"orders\" error={error} onRetry={refetch} /> above"
  - "LazyImage everywhere a remote image shows; `priority` only on the LCP image"

requirements-completed: [WEB-06]

coverage:
  - id: D1
    description: "ErrorState: role=alert banner in the .s-banner.is-danger look, triangle-alert 20, \"Couldn't load {things}.\" + the reassurance line, \"Reference: {traceId}\" for an HttpError that has one, never server title/detail, secondary sm Try Again calling onRetry (click and keyboard), mapper copy for modal banners, axe clean"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/states/ErrorState.test.tsx (18 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SkeletonText (3 lines 14px at 100/90/60%, gap 8), SkeletonCard (App. E.8 order-card skeleton), SkeletonImage (--ratio box, full-box radius-0 Skeleton): aria-hidden, sizes only via --sk-*, shimmer stops under reduced motion"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/states/loading.test.tsx#SkeletonText|SkeletonCard|SkeletonImage"
        status: pass
    human_judgment: false
  - id: D3
    description: "LoadingRegion: aria-busy=true while loading, one sibling sr-only role=status aria-live=polite node saying \"Loading orders…\" then \"Orders loaded.\", silent when never loading or after a failed load"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/states/loading.test.tsx#LoadingRegion (8 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "useDelayedFlag(flag, 200): true only after 200 ms of a true flag, false at once when the flag turns false, waits the full delay again"
    verification:
      - kind: unit
        ref: "web/src/ui/states/useDelayedFlag.test.tsx (6 tests, fake timers)"
        status: pass
    human_judgment: false
  - id: D5
    description: "LazyImage: --ratio box (4 / 3 default), img loading=lazy decoding=async width height alt, priority -> eager + fetchpriority high, Skeleton until load, chip-less MediaPlaceholder on error with role=img named by the alt, empty alt stays decorative, new src starts over"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/states/LazyImage.test.tsx (11 tests)"
        status: pass
      - kind: other
        ref: "scratch probe in chromium/firefox/webkit: loading case keeps its skeleton after the image loads, failed case shows the named placeholder, both 390x292.5, no console messages"
        status: pass
    human_judgment: false
  - id: D6
    description: "All 8 states scenarios load with zero axe, CSP, console and request findings in Chromium, Firefox and WebKit (incl. the reduced-motion pass for the skeletons)"
    requirement: "WEB-06"
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @states (18 passed)"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0: 81 files, 2051 tests, coverage 99.03/97.94/100/99.9; ui/states 100%)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The SPEC-GAP state primitives look right to the owner (no reference exists to compare against), including the muted Try Again label question"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC: SPEC-GAP primitives are reviewed by the owner in the D-23 screenshots (plan 02-36); the Try Again label colour is an open owner question"

duration: 16min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 28: Loading, Error and Image States Summary

**The SPEC-GAP states every list and detail screen composes, in `@/ui/states`:**
- **ErrorState** is the App. E.8 danger banner. It is an alert with the approved copy only, ends with "Reference: {traceId}" when the server sent one, and has a secondary sm "Try Again" that calls the query's refetch.
- **SkeletonText, SkeletonCard and SkeletonImage** are aria-hidden first-load placeholders in the final layout. Their shimmer stops under reduced motion.
- **LoadingRegion** puts `aria-busy` on the region and announces "Loading orders…" and then "Orders loaded." through one polite status node.
- **useDelayedFlag** gives the 200 ms refetch delay.
- **LazyImage** reserves its 4 / 3 box (no layout shift), shows a Skeleton until the image loads and the chip-less MediaPlaceholder if it fails.

**All eight states scenarios pass axe and the CSP guard in Chromium, Firefox and WebKit.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-09T04:09:04Z
- **Completed:** 2026-10-09T04:25:30Z
- **Tasks:** 2 of 2
- **Files modified:** 18 (16 created, 2 modified)

## Accomplishments

- **ErrorState (WEB-06, T-02-62).**
  - Banner recipe transcribed from App. C `.s-banner` + `.is-danger` (flex, gap 12, padding 12/16, radius 8, 14/20, `--danger-soft`, `--danger`, a 1px `color-mix(in srgb, --danger 40%, transparent)` border), with App. E.8's centred items. The `strong`/`span` descendant rules come along as written.
  - `things` gives the list-load copy. `title` + `message` take describeHttpError copy for modal-level banners. An empty second line is left out unless there is a reference, and a reference already in the message is not repeated.
  - Only the traceId comes from the server; a test proves the server title and detail never show.
- **Skeleton family.** `SkeletonText` (grid gap 8, 14px lines at 100/90/60%), `SkeletonCard` (`cardClasses` + `overflow-hidden`, a 180px radius-0 block, then `grid gap-2.5 p-4` with 40%, 75%×22, 55% and a 56px block), `SkeletonImage` (`aspect-(--ratio)` box with a full-box radius-0 Skeleton). All aria-hidden.
- **LoadingRegion.** The busy edges are tracked during render, so the announcement changes in the same render as `aria-busy`. The status node is `srOnlyClasses`, a sibling of the region, and silent after a failed load.
- **useDelayedFlag.** Reset during render on a false flag; one timer per true stretch.
- **LazyImage.** Box `relative overflow-hidden aspect-(--ratio)`; img `block size-full object-cover`; Skeleton `absolute inset-0`; fallback `MediaPlaceholder label={false}` with `h-full`; role img + aria-label only when failed with a non-empty alt, aria-hidden when failed and decorative.
- **States scenario group (8 cases, all `parity: false`).** `error-state-orders`, `error-state-trace`, `skeleton-text|card|image` (with the motion pass), `loading-region`, `lazy-image-loading`, `lazy-image-error`.

## Task Commits

1. **Task 1 (tracer): ErrorState**
   - RED `36d0aae`: 15 of 18 tests failed against an inert stub (`RED_EVIDENCE_OK`, target `src/ui/states/ErrorState.test.tsx`).
   - GREEN `1022352`: 18/18 passed.
   - Tracer gate: the run is interactive (`auto_advance` false), the mode is `end-of-phase`, and the verify is automated only. I re-ran the verify after the GREEN commit (18/18 passed) and then started Task 2. No checkpoint was needed.
2. **Task 2: Skeleton family, LoadingRegion, useDelayedFlag and LazyImage**
   - RED `e8320b2`:
     - `loading.test.tsx`: 12 of 16 failed (`RED_EVIDENCE_OK`).
     - `useDelayedFlag.test.tsx`: 4 of 6 failed (`RED_EVIDENCE_OK`).
     - `LazyImage.test.tsx`: 10 of 11 failed (`RED_EVIDENCE_OK`).
   - GREEN `646904d`:
     - 51/51 states tests passed.
     - parity `@states`: 18 passed in three engines (the first run found the 320px overflow, fixed in this commit).
     - `verify` exited 0.

**Plan metadata:** recorded in the docs(02-28) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/states/states.recipe.ts`: banner, skeleton and LazyImage looks (class lists only)
- `web/src/ui/states/copy.ts`: `STATES_COPY` (error and loading strings)
- `web/src/ui/states/ErrorState.tsx`, `Skeletons.tsx`, `LoadingRegion.tsx`, `useDelayedFlag.ts`, `LazyImage.tsx`, `index.ts`
- `web/src/ui/states/ErrorState.test.tsx` (18), `loading.test.tsx` (16), `useDelayedFlag.test.tsx` (6), `LazyImage.test.tsx` (11)
- `web/src/dev/scenarios/groups/states.ts`: 8 implementation-only scenarios
- `web/src/dev/previews/TracedErrorState.tsx`, `PendingLazyImage.tsx`, `FailedLazyImage.tsx`: dev-only wrappers
- `docs/web/parity.md`: the three wrappers (§5)
- `deferred-items.md`: the "Try Again" label colour question under "Owner decisions pending"

## Decisions Made

See `key-decisions` in the frontmatter. These matter most to later plans:

- **02-30 (ResponsiveTable):** wrap the table in `<LoadingRegion loading={…} things="orders" failed={isError}>`. Render `<ErrorState things="orders" error={error} onRetry={() => void refetch()} />` above it. Drive `data-refetching` from `useDelayedFlag(isPlaceholderData && isFetching, 200)`. `SkeletonTable` is still yours to build, inside the wrapper look.
- **02-34 (barrel):** `@/ui/states` exports `ErrorState`, `SkeletonText`, `SkeletonCard`, `SkeletonImage`, `LoadingRegion`, `useDelayedFlag`, `LazyImage`, `STATES_COPY` and the prop types. There is no `SkeletonTable` here.
- **Modals:** a modal-level error is `<ErrorState title={copy.title} message={copy.body} error={error} />` with `copy = describeHttpError(error)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A long traceId pushed "Try Again" out of the banner at 320px**
- **Found during:** Task 2 (the first `@states` parity run)
- **Issue:** The App. E.8 text column is only `flex: 1`. Its automatic minimum width is the longest unbreakable run, so the 32-character trace segment pushed the button past the banner and the frame (axe reported a color-contrast failure on the button label, which sat over the page background, in Chromium at 320 and Firefox at 390, dark).
- **Fix:** `bannerTextClasses` is `min-w-0 flex-1 wrap-anywhere`. App. E.8 never shows a reference, so it has no rule to follow here.
- **Files modified:** `web/src/ui/states/states.recipe.ts`, `web/src/ui/states/ErrorState.test.tsx`
- **Verification:** a three-engine probe shows the button's right edge at 373 inside a 390 banner, and the scroll width equals the viewport. The parity run passed 18/18.
- **Committed in:** `646904d`

**2. [Rule 3 - Blocking] A recipe module (`states.recipe.ts`), which is not in the plan's file list for Task 2**
- **Found during:** Task 1
- **Issue:** Class strings must be complete `tw()` literals that the class gate and lint can read.
- **Fix:** All looks are in `states.recipe.ts`. The only exception is `aspect-(--ratio)`, which stays next to its `style` in the component, as MediaPlaceholder does.
- **Committed in:** `1022352`, `646904d`

**3. [Rule 3 - Blocking] Three dev-only scenario wrappers**
- **Found during:** Task 1 and Task 2
- **Issue:** Scenario props must be plain data, and an HttpError is a class instance. A LazyImage in its loading or error state needs a download that never finishes or that fails, and either one is a guard finding (a pending/failed request or a console message).
- **Fix:**
  - `TracedErrorState` builds the HttpError from a plain `traceId` prop.
  - `PendingLazyImage` and `FailedLazyImage` load a 1×1 inline GIF and stop its `load` event in the capture phase on their frame. `FailedLazyImage` then fires `error` once after mount.
  - LazyImage itself is unchanged.
  - All three are documented in parity.md §5.
- **Committed in:** `36d0aae`, `e8320b2`

### Plan-text adjustments (no behaviour impact)

- The plan's must-have names the Try Again look as "secondary sm". The approved App. C `span` rule also mutes the label inside the banner. I kept that computed look (contrast passes AA in both themes) and logged the question for the owner instead of changing the look.
- `ErrorState` also takes `title`/`message`, from the 74621f5 reference, so modal-level banners (UI-SPEC Interaction "Validation") use the same primitive.

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 2 Rule 3), plus 2 plan-text adjustments.
**Impact on plan:** Every must-have is proven by unit tests and the three-engine parity run. No package changed, no lint rule was disabled, and no tolerance was added.

## Issues Encountered

- A scratch probe was first run with `npx tsx`, and npx fetched `tsx@4.23.15` into the user's npx cache. It is not a project dependency: no manifest or lockfile changed. Later probes ran on Node's own type stripping (`node probe.mts`).
- In a combined render, the loading LazyImage case's `<img>` and the failed case's box share the alt name, so the scenario test queries `within` each case.

## TDD Gate Compliance

- Task 1: RED `36d0aae`, then GREEN `1022352` (`RED_EVIDENCE_OK`, `src/ui/states/ErrorState.test.tsx`).
- Task 2: RED `e8320b2`, then GREEN `646904d` (`RED_EVIDENCE_OK` for `loading.test.tsx`, `useDelayedFlag.test.tsx` and `LazyImage.test.tsx`).
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

The gate did not fire. No package was installed, upgraded or re-resolved in the project (see Issues for the npx cache note).

## Threat Mitigations

- **T-02-62 (CWE-209):** fixed copy plus the traceId only. A test with leaky server title/detail asserts that neither shows.
- **T-02-63:** LazyImage never touches the CSP. React escapes `src`, and the wrappers use `data:`, which `img-src` already allows.
- **T-02-SC:** No installs.

## Known Stubs

None. The jersey alt text and the trace id in the scenarios are dev-only showcase data.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- `@/ui/states` is ready for 02-30 (ResponsiveTable list states), 02-34 (barrel), the showcase and every feature list and detail screen.
- Open owner question: the colour of the "Try Again" label (deferred-items.md, "Owner decisions pending"). It is not blocking.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 16 created files and 2 modified files exist on disk.
- Commits `36d0aae`, `1022352`, `e8320b2` and `646904d` are on `gsd/phase-2-web-foundation-design-system`.
- Acceptance checks:
  - `grep -c 'role="alert"' ErrorState.tsx` = 1.
  - `grep -c "Try Again" copy.ts` = 1.
  - `grep -c 'aria-live="polite"' LoadingRegion.tsx` = 1.
  - `grep -c fetchPriority LazyImage.tsx` = 1.
- Verification:
  - `npm --prefix web run test -- --run src/ui/states`: 51/51.
  - `npm --prefix web run parity -- --grep @states`: 18 passed, after a preflight that showed every port free.
  - `npm --prefix web run verify`: exit 0.
