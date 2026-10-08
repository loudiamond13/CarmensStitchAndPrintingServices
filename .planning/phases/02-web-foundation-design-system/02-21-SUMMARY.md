---
phase: 02-web-foundation-design-system
plan: 21
subsystem: ui
tags: [feedback, empty-state, skeleton, toast, toast-queue, live-region, reduced-motion, parity, tailwind, wcag, tdd, d-04, o-5, o-6, o-7, d-33]
created: "2026-10-08T18:48:00-05:00"
updated: "2026-10-08T18:48:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-14)
    provides: "the live parity harness (kit, scenario groups, matrix incl. the reduced-motion pass, comparator)"
  - phase: 02-web-foundation-design-system (plan 02-17)
    provides: "Button (EmptyState action in the scenarios)"
  - phase: 02-web-foundation-design-system (plan 02-40)
    provides: "tw and the Icon wrapper"
provides:
  - "web/src/ui/feedback: EmptyState (level prop, default h2), Skeleton (--sk-w/--sk-h/--sk-r), Toast (4 tones, Dismiss), ToastProvider, useToast ({ show, dismiss })"
  - "web/src/ui/feedback/toastQueue.ts: createToastQueue({ now, schedule }), MAX_TOASTS (3), AUTO_DISMISS_MS (4500), isPersistent, ToastItem/ToastInput/ToastQueue types"
  - "feedback.recipe.ts: empty*, skeletonClasses, toast*, toastLayerClasses (App. C .s-toast-layer) and iconButtonClasses (.csp-iconbtn), exported from @/ui/feedback"
  - "web/src/dev/scenarios/groups/feedback.ts: 9 parity scenarios (2 empty states, 2 skeletons, 5 toasts; skeleton and toast in the reduced-motion pass)"
  - "Parity harness: FREEZE finishes finite animations (entry animations) and pauses only infinite ones"
affects: [02-22, 02-23, 02-24, 02-26, 02-28, 02-29, 02-30, 02-31, 02-34, parity]

actuals:
  tokens: 18260    # chars/4 over the realized diff (73,039 chars, 13 files)
  tasks: 3
  commits: 6
plan_head_before: bb5d6ed6852d9e9213ad2917466eb90c2a107905
plan_head_after: 8f4e934479cf7b95591017ef8dedbbf3d3f1da79

tech-stack:
  added: []
  patterns:
    - "A pure queue with an injected clock and scheduler, read by React through useSyncExternalStore (stable snapshot object per change)"
    - "Watch-only container listeners (pointerenter/leave, focusin/out) added with addEventListener, so a passive region gets no role and no JSX interaction handlers"
    - "Per-instance sizes through custom properties only (--sk-w/--sk-h/--sk-r), numbers converted to px as React does for real properties"
    - "Heading level as a prop with a tag map, the look identical at every level"

key-files:
  created:
    - web/src/ui/feedback/feedback.recipe.ts
    - web/src/ui/feedback/EmptyState.tsx
    - web/src/ui/feedback/Skeleton.tsx
    - web/src/ui/feedback/Toast.tsx
    - web/src/ui/feedback/toastQueue.ts
    - web/src/ui/feedback/toastQueue.test.ts
    - web/src/ui/feedback/ToastProvider.tsx
    - web/src/ui/feedback/ToastProvider.test.tsx
    - web/src/ui/feedback/feedback.test.tsx
    - web/src/ui/feedback/index.ts
    - web/src/dev/scenarios/groups/feedback.ts
  modified:
    - web/visual/parity.spec.ts
    - docs/web/parity.md

key-decisions:
  - "EmptyState takes a `level` prop (2|3|4, default h2, SPEC-DEVIATION A11Y-02); the parity scenarios pass level 3 so both sides render App. D.3's h3"
  - "The empty-state message has no bottom margin: in the approved design App. C `.s-page p { margin: 0 }` overrides `.csp-empty-msg`'s 12px, and the first parity run showed it"
  - "useToast returns { show, dismiss } (SPEC-DEVIATION D-04: a persistent toast must be closable by the screen that raised it); outside a provider it is a no-op, as App. D.3"
  - "The toast layer is always rendered (O-5), with aria-live=\"polite\" and data-ui=\"s-toast-layer\", no role; pause listeners are watch-only addEventListener calls"
  - "A 4th toast removes the oldest non-persistent toast already shown; only when the three shown are all persistent is the oldest of them removed"
  - "Parity FREEZE now finishes finite animations instead of pausing them at their start; infinite ones (spinner, shimmer) still pause at the start"

patterns-established:
  - "Screens raise toasts with `const toast = useToast(); toast.show({ tone, title, message })`; keep the id to `toast.dismiss(id)` a persistent toast"
  - "Place <ToastProvider> inside the page root (layouts 02-29/02-31); the layer then takes data-theme and the pg container"
  - "Tests that need toast timing inject `queue={createToastQueue({ now, schedule })}`"

requirements-completed: [WEB-06, WEB-02, A11Y-04]

coverage:
  - id: D1
    description: "EmptyState (icon tile turned -6deg, icon upright, title, message up to 380px, one action) equals the approved design in both themes at 320/390/820/1440 in Chromium, and at 390/1440 in Firefox and WebKit; heading level prop, default h2"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/feedback/feedback.test.tsx (EmptyState, 10 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @feedback (34 passed: chromium 18, firefox 8, webkit 8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Skeleton sizes only through --sk-w/--sk-h/--sk-r, is aria-hidden, shimmers with animate-csp-shimmer and stops under reduced motion (O-6), equal to the spec in three engines and in the Chromium reduced-motion pass"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/feedback/feedback.test.tsx (Skeleton, 6 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @feedback (incl. @motion rows, light and dark)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Toast in four tones (danger role=alert, others role=status, Dismiss button) equal to the spec at rest, the Dismiss button on hover and keyboard focus, and with the entry animation stopped under reduced motion"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/feedback/feedback.test.tsx (Toast, 14 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @feedback"
        status: pass
    human_judgment: false
  - id: D4
    description: "Toast queue: max 3 newest first, success/info leave after 4500 ms of running time, pause/resume keep the remaining time, danger/warning persist, trim protects persistent toasts, dismiss by id"
    requirement: "A11Y-04"
    verification:
      - kind: unit
        ref: "web/src/ui/feedback/toastQueue.test.ts (20 tests, 100% statements and branches)"
        status: pass
    human_judgment: false
  - id: D5
    description: "ToastProvider: layer always mounted as the polite live region inside the provider's parent (no portal), useToast show/dismiss, pause while hovered or focused, resume when the stack empties, axe clean"
    requirement: "A11Y-04"
    verification:
      - kind: unit
        ref: "web/src/ui/feedback/ToastProvider.test.tsx (14 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Screen-reader announcement of toasts through the always-mounted polite layer (NVDA/VoiceOver)"
    verification: []
    human_judgment: true
    rationale: "jsdom and axe check the roles and aria-live, not what a real screen reader announces; A11Y-05 covers the manual passes"

duration: 25min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 21: Feedback Primitives (EmptyState, Skeleton, Toast) and the Toast Queue Summary

**EmptyState, Skeleton and Toast are converted to utilities and equal to the approved design in Chromium, Firefox and WebKit, in both themes, with the shimmer and the toast entry stopping under reduced motion. A pure toast queue carries the owner's rules: at most 3, newest on top, success and info leave after 4.5 s of running time and pause while the pointer or focus is in the stack, danger and warning stay, and a 4th toast pushes out the oldest non-persistent one. ToastProvider keeps the layer mounted as the polite live region, and `useToast()` returns `{ show, dismiss }`.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-08T23:22:03Z
- **Completed:** 2026-10-08T23:47:40Z
- **Tasks:** 3 of 3
- **Files modified:** 13 (11 created, 2 modified)

## Accomplishments

- **EmptyState.** The App. D.3 markup on the feedback recipe:
  - the 64px `--accent-soft` tile turned `[transform:rotate(-6deg)]`, with the 28px icon turned back by `[transform:rotate(6deg)]`;
  - the display title, the message (max 380px) and one action.
  - The title's level is a prop (default h2). The scenarios pass level 3, so both sides render App. D.3's h3.
- **Skeleton.** A hidden span whose style holds only `--sk-w`, `--sk-h` and `--sk-r`. Numbers become px, and the radius defaults to App. B's 6px. It shimmers with `animate-csp-shimmer` and has `motion-reduce:animate-none`.
- **Toast.** The tone icon (success `circle-check`, danger and warning `triangle-alert`, info `info`), the bold title over the message, an optional action and the 36px "Dismiss" icon button. The stitched left edge is a `::before` in the tone colour. The entry is `animate-csp-rise`, with `motion-reduce:animate-none`.
- **Toast queue (`toastQueue.ts`).**
  - It is pure: `createToastQueue({ now, schedule })` with `show`, `dismiss`, `pause`, `resume`, `getSnapshot` and `subscribe`.
  - Each timed toast keeps its own remaining time across pauses. A toast shown while paused gets its full 4.5 s once the clock runs.
  - On trimming, it removes the oldest non-persistent toast already shown, or the oldest of all when the three are persistent.
- **ToastProvider.**
  - The layer (`data-ui="s-toast-layer"`, `aria-live="polite"`, App. C `.s-toast-layer` look incl. the phone position) renders right after the children, never in a portal.
  - Watch-only pointer and focus listeners pause the clock. When the stack empties, the clock runs again.
- **Scenarios (feedback group, 9 cases).**
  - `empty-first-use`, `empty-no-matches` (responsive).
  - `skeleton-line`, `skeleton-block`.
  - `toast-success` (rest, hover and focus-visible on Dismiss), `toast-info`, `toast-warning`, `toast-danger`, `toast-long-copy`.
  - Skeletons and toasts run the reduced-motion pass.

## Task Commits

1. **Task 1 (tracer): the empty states match in both themes.**
   - RED `22c7820`: `feedback.test.tsx` failed 9 of 12 against an inert stub (`RED_EVIDENCE_OK`).
   - GREEN `de0bfe0`: the first Chromium run found one real difference, the message margin (deviation 1). After the fix, Chromium `@feedback` passed 8/8.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit (12/12, then Chromium 8/8) before expanding.
2. **Task 2: Skeleton and Toast, including the reduced-motion pass.**
   - RED `e647850`: 15 of 36 failed against inert stubs (`RED_EVIDENCE_OK`).
   - GREEN `ed55b48`: the first Chromium run failed the four focus-visible rows on a harness timing race (deviation 2). After the fix, Chromium passed 18/18, and all three engines passed 34/34.
   - A throw-away mutation (removing both `motion-reduce:animate-none`) failed the `@motion` rows on `animation-name`, `animation-duration` and `background-position`; it was reverted.
   - Chromium regression of every group after the harness change: 81 passed.
3. **Task 3: the toast queue and the provider.**
   - RED `22308b7`: `toastQueue.test.ts` failed 17 of 20 and `ToastProvider.test.tsx` 12 of 14 (`RED_EVIDENCE_OK` for each file).
   - GREEN `8f4e934`: 70/70 feedback tests. `toastQueue.ts` is at 100% statements, branches, functions and lines. `verify` exited 0.

**Plan metadata:** recorded in the docs(02-21) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/feedback/feedback.recipe.ts`: the `.csp-empty*`, `.csp-skel`, `.csp-toast*`, `.csp-iconbtn` and App. C `.s-toast-layer` looks
- `web/src/ui/feedback/EmptyState.tsx`, `Skeleton.tsx`, `Toast.tsx`: the converted components
- `web/src/ui/feedback/toastQueue.ts` / `toastQueue.test.ts` (20 tests): the pure queue
- `web/src/ui/feedback/ToastProvider.tsx` / `ToastProvider.test.tsx` (14 tests): the layer and `useToast`
- `web/src/ui/feedback/feedback.test.tsx` (36 tests): EmptyState, Skeleton, Toast and the scenario set
- `web/src/ui/feedback/index.ts`: the barrel (components, types, queue exports, `iconButtonClasses`)
- `web/src/dev/scenarios/groups/feedback.ts`: 9 parity scenarios
- `web/visual/parity.spec.ts`: FREEZE finishes finite animations
- `docs/web/parity.md`: section 7 describes the new FREEZE rule

## Decisions Made

See `key-decisions` in the frontmatter. Later plans need these most:

- **02-22 (Modal).** The modal and slide-over entries are finite animations, so FREEZE now reads them at their end state on both sides. `iconButtonClasses` (`.csp-iconbtn`) is exported from `@/ui/feedback` for the modal close button.
- **02-23/02-24/02-28 (Skeleton users).** `Skeleton` takes `width`, `height` and `radius` (number = px, string = any length) and `className` for layout glue only.
- **02-29/02-31 (layouts).** Put `<ToastProvider>` inside the page root. Logout's info toast is `toast.show({ tone: 'info', title: 'Not available yet', message: 'Sign-out comes with the sign-in phase.' })`. EmptyState under a page h1 keeps the default h2.
- **02-16 wiring.** `onFailure(copy)` → `toast.show({ tone: 'danger', title: copy.title, message: copy.body })`. It persists until closed, and the screen may `toast.dismiss(id)` after a successful retry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The empty-state message margin differed from the approved computed result**
- **Found during:** Task 1 (first Chromium parity run)
- **Issue:** App. B gives `.csp-empty-msg` `margin: 0 0 12px`. But App. C `.s-page p { margin: 0 }` (0,1,1) is more specific and comes later, so in the approved design the margin is 0 and the action sits 8px under the message (the column gap). The implementation had `mb-3`, which made it 12px taller.
- **Fix:** `m-0` with a comment naming the App. C rule. EmptyState always sits inside the page root.
- **Files modified:** web/src/ui/feedback/feedback.recipe.ts
- **Committed in:** `de0bfe0`

**2. [Rule 3 - Blocking] The parity FREEZE read a running entry animation on one side only**
- **Found during:** Task 2 (first Chromium run, `toast-success` focus-visible rows)
- **Issue:** FREEZE paused every non-transition animation at its start. In the focus-visible rows the Tab presses take a different time on each side. The reference toast's 0.2 s `csp-rise` had finished (so it was no longer listed by `getAnimations()`), while the implementation's was still running and was frozen at opacity 0 and translateY(8px). The comparator reported opacity and box differences, while the pixels (Playwright fast-forwards finite animations) were equal. No component difference was involved.
- **Fix:** FREEZE now calls `finish()` on finite animations, as it already did for transitions. Infinite ones (spinner, shimmer) are still paused at their start. This is not a normalization or a tolerance: nothing compared is ignored, and both sides are read at the settled frame the pixels already used. The mutation run proved the reduced-motion pass still catches a missing `motion-reduce:animate-none`.
- **Files modified:** web/visual/parity.spec.ts, docs/web/parity.md
- **Verification:** `@feedback` 34/34 in three engines; Chromium regression of all groups 81/81
- **Committed in:** `ed55b48`

**3. [Rule 3 - Blocking] Lint rules shaped the provider and queue API**
- **Found during:** Task 3 (GREEN)
- **Issue:**
  - `@typescript-eslint/unbound-method` rejected passing `queue.subscribe` and `queue.getSnapshot` to `useSyncExternalStore`, because they were declared as methods.
  - `jsx-a11y-x/no-static-element-interactions` rejected pointer and focus handlers on the layer `div`.
- **Fix:**
  - `ToastQueue` and `ToastApi` members are readonly function properties.
  - The layer's listeners are added with `addEventListener` in an effect. They only watch and never act on input, so the layer gets no role and no new ARIA (a named region landmark would have changed the ARIA structure beyond the intentional-differences list).
- **Committed in:** `8f4e934`

**4. [Rule 2 - Missing critical] The clock restarts when the stack empties**
- **Found during:** Task 3 (design)
- **Issue:** After the last toast is closed with its Dismiss button, the pointer and focus were "inside" a stack that no longer has a size. Some browsers fire no focusout when a focused element is removed. The clock could then stay paused, and every later success toast would never leave.
- **Fix:** When the stack becomes empty, the provider clears both flags and resumes the queue. A test pins it.
- **Committed in:** `22308b7`, `8f4e934`

**5. [Rule 2 - Missing critical] Extra cases and files beyond the plan's lists**
- **Found during:** Tasks 2 and 3
- **Issue:**
  - The Dismiss button's hover and focus looks (`.csp-iconbtn`) were not in the plan's case list.
  - The App. C `.s-toast-layer` look had no home.
  - Tests needed a way to drive the provider's clock.
- **Fix:**
  - `toast-success` also runs hover and focus-visible on the button.
  - `toastLayerClasses` and `iconButtonClasses` live in `feedback.recipe.ts` (the Task 3 file list did not name the recipe).
  - `ToastProvider` takes an optional `queue` prop, read once.
- **Committed in:** `e647850`, `22308b7`, `8f4e934`

---

**Total deviations:** 5 auto-fixed (1 Rule 1, 2 Rule 3, 2 Rule 2)
**Impact on plan:** Every must-have truth is proven by unit tests and by the three-engine parity run including the reduced-motion pass. No look, element, text or ARIA structure changed beyond the intentional-differences list (O-5's always-mounted layer carries `aria-live`, which is that ruling). No tolerance or normalization was added.

## Issues Encountered

- **Coverage.** `ToastProvider.tsx` has one unreachable branch: the effect's `layerRef.current === null` guard (98.8% statements, 97.3% branches). `toastQueue.ts` is at 100%. The global thresholds pass: 99.18 / 97.87 / 100 / 99.9.
- **Shell tooling.** A Python heredoc containing `Couldn't` broke Git Bash quoting. The edit scripts were written to the scratchpad and run from there instead.

## TDD Gate Compliance

- Task 1: RED `22c7820` comes before GREEN `de0bfe0` (`RED_EVIDENCE_OK`, `feedback.test.tsx`).
- Task 2: RED `e647850` comes before GREEN `ed55b48` (`RED_EVIDENCE_OK`, `feedback.test.tsx`).
- Task 3: RED `22308b7` comes before GREEN `8f4e934` (`RED_EVIDENCE_OK` for `toastQueue.test.ts` and for `ToastProvider.test.tsx`).
- The scenario-declaration tests and the queue-constant test passed at RED, because the scenario data and the constants were committed with the stubs. They pin that data.
- The RED commits hold stubs with unused parameters; lint is clean at each GREEN commit.
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved; `package.json` and `package-lock.json` are unchanged.

## Look Gate (D-08 conditional checkpoint)

It did not fire. The one look difference (the message margin) was an implementation error against the approved computed result and was fixed in the implementation. The focus-visible difference was a harness timing race, not a look difference. No tolerance or normalization was added.

## Threat Flags

None. T-02-51 is mitigated: danger and warning toasts persist, and the trim rule protects them (tested). T-02-52 is mitigated: titles and messages render as React text nodes, with no HTML sinks. T-02-SC: no installs. No endpoint, auth path or file access was added.

## Verification

- `npm --prefix web run test -- --run src/ui/feedback`: 3 files, 70/70 passed.
- `npm --prefix web run test -- --run src/ui/feedback --coverage "--coverage.include=src/ui/feedback/toastQueue.ts"`: 100% statements, branches, functions and lines.
- Preflight showed all four ports free and no other project's processes. Then:
  - `npm --prefix web run parity -- --grep @feedback --project chromium`: 18 passed (incl. the `@motion` rows).
  - `npm --prefix web run parity -- --grep @feedback`: **34 passed** (Chromium 18, Firefox 8, WebKit 8) in 1.1 min.
  - Regression: `--grep "@parity|@reference" --project chromium`: 81 passed in 4.5 min.
- `npm --prefix web run verify` exited 0. It ran typecheck (3 programs), lint, format, 63 files with 1642 tests, coverage at 99.18 / 97.87 / 100 / 99.9, the build, the license gate and notices.
- Acceptance greps:
  - `\[transform:rotate(-6deg)\]` in feedback.recipe.ts: 1.
  - `motion-reduce:animate-none` in feedback.recipe.ts: 2 (skeleton and toast).
  - `4500` in toastQueue.ts: 1, and `MAX_TOASTS`: 2. `toastQueue.test.ts` asserts `MAX_TOASTS` is 3.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Imports.** `EmptyState`, `Skeleton`, `Toast`, `ToastProvider` and `useToast` come from `@/ui/feedback`, plus the queue exports and `iconButtonClasses`.
- **02-34** (barrel export list) finds EmptyState, Skeleton, Toast, ToastProvider and `useToast` under their App. D.3 names.
- **Phase 14 (A11Y-05).** Confirm with NVDA and VoiceOver that toasts are announced through the always-mounted polite layer (coverage D6).

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 11 created files and the 2 modified files exist on disk.
- Commits `22c7820`, `de0bfe0`, `e647850`, `ed55b48`, `22308b7` and `8f4e934` are on `gsd/phase-2-web-foundation-design-system`.
