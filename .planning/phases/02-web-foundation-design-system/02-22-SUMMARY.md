---
phase: 02-web-foundation-design-system
plan: 22
subsystem: ui
tags: [overlays, modal, confirm-dialog, focus-trap, scroll-lock, cascade-delete, type-to-confirm, parity, tailwind, wcag, tdd, web-02, web-06, a11y-02, o-6, d-33]
created: "2026-10-08T19:27:00-05:00"
updated: "2026-10-08T19:27:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-17)
    provides: "Button (ref, loading = aria-disabled busy state that swallows activation)"
  - phase: 02-web-foundation-design-system (plan 02-20)
    provides: "Field and messageClasses (the .csp-msg-error look)"
  - phase: 02-web-foundation-design-system (plan 02-21)
    provides: "iconButtonClasses for the Close button; FREEZE finishes finite entry animations"
  - phase: 02-web-foundation-design-system (plan 02-16)
    provides: "describeHttpError and the useSubmission outcome shape"
provides:
  - "web/src/ui/overlays: Modal (dialog semantics, focus trap, Esc/scrim close except while loading, scroll lock, slide-over, inline), ConfirmDialog (cascade, type-to-confirm, one confirm per attempt, stay-open failure), Overlay (App. C .s-overlay region, data-ui=\"s-overlay\")"
  - "useFocusTrap(ref, { active, initialFocus, returnFocus }) and useBodyScrollLock(active), exported from @/ui/overlays"
  - "overlays.recipe.ts: overlay, modal, head/title/desc/body/foot, confirm and cascade looks, overlayRegionClasses, bodyScrollLockClass"
  - "web/src/dev/scenarios/groups/overlays.ts: 5 viewport-frame scenarios (4 compared, 1 implementation-only)"
  - "Wrapper pairs OpenedDialog and FailedConfirmDialog (previews + reference fragments) and the Overlay reference fragment"
affects: [02-23, 02-26, 02-28, 02-29, 02-30, 02-31, 02-34, 02-35, parity]

actuals:
  tokens: 23042    # chars/4 over the realized diff (92,168 chars, 18 files)
  tasks: 2
  commits: 5
plan_head_before: 6779f5b9db15369cb1d7e50ae6ea45e881da3088
plan_head_after: 6a0f8fafee2704cb4297424fc761d5eabc3d2d03

tech-stack:
  added: []
  patterns:
    - "Focus trap on a ref to an element the component already renders (no wrapper element); the effect hands the element to a plain function, because the React Compiler treats a hook's arguments as read-only"
    - "Scrim and Esc listeners through refs + an effect with useEffectEvent (latest loading/onClose without re-subscribing)"
    - "A class-toggle body scroll lock with a holder count (nested overlays)"
    - "An async confirm action tracked by the dialog: a promise rejection or a resolved { ok: false } submission outcome is a failure"
    - "Viewport-frame parity cases wrapped in OpenedDialog: the reference side reproduces the opened state the converted component reaches by itself"

key-files:
  created:
    - web/src/ui/overlays/overlays.recipe.ts
    - web/src/ui/overlays/useFocusTrap.ts
    - web/src/ui/overlays/useFocusTrap.test.tsx
    - web/src/ui/overlays/useBodyScrollLock.ts
    - web/src/ui/overlays/Modal.tsx
    - web/src/ui/overlays/Modal.test.tsx
    - web/src/ui/overlays/Overlay.tsx
    - web/src/ui/overlays/ConfirmDialog.tsx
    - web/src/ui/overlays/ConfirmDialog.test.tsx
    - web/src/ui/overlays/index.ts
    - web/src/dev/scenarios/groups/overlays.ts
    - web/src/dev/previews/OpenedDialog.tsx
    - web/src/dev/previews/FailedConfirmDialog.tsx
    - web/src/dev/previews/typeInto.ts
    - web/visual/reference/fragments/OpenedDialog.tsx
    - web/visual/reference/fragments/FailedConfirmDialog.tsx
    - web/visual/reference/fragments/Overlay.tsx
  modified:
    - docs/web/parity.md

key-decisions:
  - "Overlay is a production component (App. C .s-overlay with data-ui=\"s-overlay\"): App. D.3 has no component for it, and screens need it to render dialogs as the mockups do (`<Overlay><Modal inline … /></Overlay>`). A mousedown on the region closes an inline Modal"
  - "Modal adds `loading` (Esc, scrim and Close do nothing while true) and `initialFocus` (a ref), and names the dialog with aria-labelledby/aria-describedby instead of App. D.3's aria-label; tabIndex -1 on the dialog (attributes only)"
  - "ConfirmDialog.onConfirm returns unknown: a promise is tracked (pending blocks further confirms, Esc, scrim and Cancel); a rejection or a resolved { ok: false, error } is a failure, so `onConfirm={() => submission.submit()}` works with useSubmission and its retry keeps the Idempotency-Key"
  - "Failure line: the describeHttpError title as a sentence, then the body (\"Reference: {traceId}\"), in the field-error look with a 14px triangle-alert, at the end of the text column; a null copy (cancelled request, 401) shows nothing and re-enables Delete"
  - "The App. B paragraph margins of .csp-modal-desc, .csp-cascade-lead and .csp-cascade-foot are 0 in the approved result (App. C .s-page p wins), as 02-21 found for the empty-state message"
  - "App. B's 420px cascade-grid rule is not transcribed: inside the page root App. C's later phone rule always decides the result"

patterns-established:
  - "Screens open a dialog as `{open && <Overlay><Modal inline …/></Overlay>}` (mockup layout) or a bare `<Modal …/>` (App. B centred scrim / bottom sheet); both lock body scroll and trap focus"
  - "Pass a stable ref to `initialFocus` when the first field is not the right start (ConfirmDialog does this for Cancel)"
  - "Destructive actions: `<ConfirmDialog confirmText={order.number} counts={…} onConfirm={() => submission.submit()} />`; the dialog shows failures itself, so do not also raise a toast for them"

requirements-completed: [WEB-02, WEB-06, A11Y-02]

coverage:
  - id: D1
    description: "Modal is a real dialog (role, aria-modal, aria-labelledby), focus goes to the first field (or first focusable, or the dialog), Tab/Shift+Tab are trapped with refs and no wrapper element, Esc and scrim close except while loading, focus returns to the trigger, body gets and loses overflow-hidden through classList"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx (30 tests) and useFocusTrap.test.tsx (16 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A11Y-02 edges: Tab on the last element goes to the first and Shift+Tab on the first to the last; no focusable child focuses the container (tabIndex -1) or Cancel in a ConfirmDialog without a field"
    requirement: "A11Y-02"
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/useFocusTrap.test.tsx; ConfirmDialog.test.tsx (Cancel focus)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Modal (centred, bottom sheet below 640px), the slide-over and the ConfirmDialog in the Overlay region equal the approved design in both themes at 320/390/820/1440 in Chromium and at 390/1440 in Firefox and WebKit, with the entry animations stopped under reduced motion (O-6)"
    requirement: "WEB-02"
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @overlays (18 passed: chromium 10, firefox 4, webkit 4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ConfirmDialog: cascade sentence and five tiles (zero dimmed), \"This can't be undone.\", Delete disabled until the trimmed text matches exactly, one onConfirm per attempt while pending"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/ConfirmDialog.test.tsx (23 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Failure state: dialog stays open with the typed text, role=alert describeHttpError line with the traceId above the buttons (no server text), Delete re-enabled and focused, retry calls onConfirm again, no toast; axe clean"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/ConfirmDialog.test.tsx"
        status: pass
      - kind: automated_ui
        ref: "confirm-delete-order-error (parity: false): axe + CSP guard in three engines"
        status: pass
    human_judgment: false
  - id: D6
    description: "Screen-reader announcement of the dialog name, the cascade alert and the failure alert (NVDA/VoiceOver)"
    verification: []
    human_judgment: true
    rationale: "jsdom and axe check roles and names, not what a real screen reader announces; A11Y-05 covers the manual passes"

duration: 30min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 22: Modal and ConfirmDialog Summary

**The Modal is now a real dialog. It traps Tab and Shift+Tab with refs and adds no wrapper element, closes on Esc and scrim clicks except while loading, returns focus to the trigger, and locks body scroll with the `overflow-hidden` class. ConfirmDialog keeps the approved cascade box and adds an exact trimmed type-to-confirm match, one confirm per attempt, and a failure state that keeps the dialog open with the mapped error and traceId. All of it equals the approved design in Chromium, Firefox and WebKit, in both themes, including the bottom sheet, the slide-over and the reduced-motion pass.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-10-08T23:56:06Z
- **Completed:** 2026-10-09T00:26:14Z
- **Tasks:** 2 of 2
- **Files:** 18 (17 created, 1 modified)

## Accomplishments

- **useFocusTrap.**
  - On open, focus goes to `initialFocus`, else the first field, else the first focusable element, else the container (given tabIndex -1).
  - Tab and Shift+Tab wrap at the ends. Focus that moves outside comes back. When the trap ends, focus returns to the trigger if the trigger is still on the page.
  - The listeners are added with `addEventListener`.
- **useBodyScrollLock.** It toggles `overflow-hidden` on `<body>` through `classList`. A holder count keeps the class until the last open overlay closes, and it never writes `style.overflow`.
- **Modal.** It keeps the App. D.3 markup: scrim, dialog, head with title, description and Close, then body and footer.
  - It is named with `aria-labelledby` and described with `aria-describedby`.
  - Esc and a scrim mousedown close it. Neither works while `loading`, and the Close button doesn't either.
  - Variants: `variant="slideover"` and `inline`. It renders where it is placed, never in a portal.
- **Overlay.** This is the App. C `.s-overlay` region with `data-ui="s-overlay"`. On phone pages the dialog inside it takes the region look.
- **ConfirmDialog.** It keeps the App. D.3 markup and adds the delete-safety and failure behaviour (see key-decisions).
- **Scenarios (overlays group, 5 viewport cases).**
  - `modal-add-payment` and `modal-slideover`.
  - `confirm-delete-order` (field empty) and `confirm-delete-order-typed`, both in the Overlay region.
  - `confirm-delete-order-error` (`parity: false`).
  - All of them run in both themes, at every width, with the reduced-motion pass.

## Task Commits

1. **Task 1 (tracer): the Add Payment modal traps focus, closes on Esc, returns focus and matches the design.**
   - RED `53e64f1`: 32 of 40 failed against inert stubs (`RED_EVIDENCE_OK` for `useFocusTrap.test.tsx` and for `Modal.test.tsx`).
   - GREEN `92a81de`: 46 of 46 passed. Chromium `@overlays` passed 10 of 10 on the first run.
   - A throw-away mutation run proved the comparison is live. It changed three things: the title to 25px, the modal's `motion-reduce:animate-none` removed, and the focus trap turned off. The run reported `font-size`, `animation-name`/`animation-duration` (the `@motion` rows) and the missing focus-ring `box-shadow`, plus pixel differences. Everything was reverted.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit (46 of 46 tests, then Chromium 10 of 10) before expanding.
2. **Task 2: ConfirmDialog.**
   - RED `1f358a7`: 20 of 23 failed against an inert stub (`RED_EVIDENCE_OK`, `ConfirmDialog.test.tsx`).
   - GREEN `5f35fde`: 69 of 69 overlay tests passed. The first Chromium run found one real difference, the inline overlay's z-index (deviation 2). After the fix, Chromium passed 10 of 10 and all three engines passed 18 of 18.
   - `verify` exited 0.
3. **Docs** `6a0f8fa`: `docs/web/parity.md` §5 describes the three new wrapper pairs.

**Plan metadata:** recorded in the docs(02-22) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/overlays/overlays.recipe.ts`: the App. B overlay, modal, confirm and cascade looks, the App. C `.s-overlay` region looks, and the scroll-lock class
- `web/src/ui/overlays/useFocusTrap.ts` / `.test.tsx` (16 tests): the ref-based trap
- `web/src/ui/overlays/useBodyScrollLock.ts`: the class-toggle lock
- `web/src/ui/overlays/Modal.tsx` / `.test.tsx` (30 tests, Overlay included): the converted Modal
- `web/src/ui/overlays/Overlay.tsx`: the `.s-overlay` region
- `web/src/ui/overlays/ConfirmDialog.tsx` / `.test.tsx` (23 tests): the converted ConfirmDialog
- `web/src/ui/overlays/index.ts`: the barrel
- `web/src/dev/scenarios/groups/overlays.ts`: 5 scenarios
- `web/src/dev/previews/{OpenedDialog,FailedConfirmDialog}.tsx`, `typeInto.ts`, plus `web/visual/reference/fragments/{OpenedDialog,FailedConfirmDialog,Overlay}.tsx`: the wrapper pairs
- `docs/web/parity.md`: §5 wrapper notes

## Decisions Made

See `key-decisions` in the frontmatter. Later plans need these most:

- **Feature screens.** To match the mockups, open dialogs as `<Overlay><Modal inline …/></Overlay>`. A bare `<Modal/>` gives App. B's centred scrim, which becomes a bottom sheet below 640px.
  - For destructive actions, pass `onConfirm={() => submission.submit()}` and let the dialog show the failure. Don't also raise a danger toast.
- **02-34 (barrel).** `Modal`, `ConfirmDialog` and the extra `Overlay` export come from `@/ui/overlays`, along with `useFocusTrap`, `useBodyScrollLock` and the types.
- **02-35 (keyboard journeys).** The trap pulls focus back on any `focusin` outside the dialog. A toast's Dismiss button can't take focus while a modal is open. That is modal behaviour, and it doesn't affect ConfirmDialog, which raises no toast.
- **MobileNavDrawer (SPEC-GAP).** It can reuse `useFocusTrap` and `useBodyScrollLock` as they are.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The Overlay region and three wrapper pairs beyond the plan's file list**
- **Found during:** Task 1 (design) and Task 2 (scenarios)
- **Issue:**
  - The plan requires the `data-ui="s-overlay"` marker and the App. C region looks, but App. D.3 has no component that renders the region.
  - The frozen Modal never moves focus, so a reference dialog would be unfocused while the converted one focuses its field.
  - The failure state needs an action that actually fails.
- **Fix:**
  - `Overlay.tsx`, with a reference fragment of the same name.
  - `OpenedDialog` (the reference focuses the first field; both sides type `typed`).
  - `FailedConfirmDialog` (implementation types, then presses Delete against a 500 with a traceId; the reference renders the frozen dialog).
  - All are documented in parity.md §5. They add no look, and the implementation side of OpenedDialog does nothing for focus, so a trap regression still fails parity. The mutation run proved this.
- **Committed in:** `53e64f1`, `92a81de`, `1f358a7`, `5f35fde`, `6a0f8fa`

**2. [Rule 1 - Bug] The inline overlay lost its z-index**
- **Found during:** Task 2 (first Chromium run of the ConfirmDialog cases)
- **Issue:** App. B `.csp-overlay` sets `z-index: var(--z-overlay)`, and `.is-inline` doesn't reset it, so the approved inline overlay computes z-index 80. My recipe had put the z-index in the fixed placement only.
- **Fix:** The z-index is shared by both placements (`overlayStack`).
- **Files modified:** `web/src/ui/overlays/overlays.recipe.ts`
- **Committed in:** `5f35fde`

**3. [Rule 3 - Blocking] React Compiler immutability rule on the trap's element**
- **Found during:** Task 1 (lint)
- **Issue:** `react-hooks/immutability` rejected mutating or passing on the element behind the hook's ref argument inside the hook (`root.tabIndex = -1`, `tabbable(root)`).
- **Fix:** The effect hands the element to a plain module function, `activateTrap(root, initial, returnFocus)`, which returns the cleanup. Behaviour is unchanged.
- **Committed in:** `92a81de`

**4. [Rule 1 - Bug] Cascade-grid rule order**
- **Found during:** Task 1 (compiled-CSS check of the recipe)
- **Issue:** Tailwind emits the `vp-xs:` block after the `pg-phone:` container block. App. B's `repeat(3, 1fr)` would then have beaten App. C's later `repeat(3, minmax(0, 1fr))`. With the long tile labels at 320px, that changes the tile widths.
- **Fix:** App. B's 420px rule is not transcribed. Inside the page root it never decides the result. A comment in the recipe says why.
- **Committed in:** `92a81de`

---

**Total deviations:** 4 auto-fixed (1 Rule 2, 2 Rule 1, 1 Rule 3)
**Impact on plan:** Every must-have truth is proven by unit tests, and the three-engine parity run includes the reduced-motion pass. No look, element, text or ARIA structure changed beyond the intentional-differences list. The focus trap is attributes only, and the error paragraph exists only in the failure state. No tolerance or normalization was added.

## Issues Encountered

- **Coverage.** Three branches are unreachable:
  - Modal's effect guard when `overlayRef.current` is null;
  - the React Compiler cache branch of the `open ? … : null` wrapper (its rest-spread props are a new object each render);
  - ConfirmDialog's defensive `!ok || inFlight` guard (a disabled or aria-disabled button never calls it).
  - The `src/ui/overlays` totals are 98.33 / 98.26 / 100 / 100. The global thresholds pass at 99.04 / 97.94 / 100 / 99.92.
- **A rejected promise created eagerly** (`mockReturnValueOnce(Promise.reject(...))`) tripped Vitest's unhandled-rejection guard. The test now builds it lazily with `mockImplementationOnce`.

## TDD Gate Compliance

- Task 1: RED `53e64f1` comes before GREEN `92a81de` (`RED_EVIDENCE_OK` for `useFocusTrap.test.tsx` and for `Modal.test.tsx`).
- Task 2: RED `1f358a7` comes before GREEN `5f35fde` (`RED_EVIDENCE_OK`, `ConfirmDialog.test.tsx`).
- The scenario-declaration tests passed at RED, because the scenario data was committed with the stubs. They pin that data.
- The RED stubs have unused parameters; lint is clean at each GREEN commit.
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved (no focus-trap library). `package.json` and `package-lock.json` are unchanged.

## Look Gate (D-08 conditional checkpoint)

It did not fire. The one difference parity found (the inline z-index) was an implementation error against the approved computed result and was fixed in the implementation. The error paragraph appears only in the failure state, which is an implementation-only case.

## Threat Flags

None.
- **T-02-53** is mitigated: exact trimmed type-to-confirm, one `onConfirm` per attempt while pending (tested with repeated clicks, Enter and a programmatic click), and a retry through useSubmission keeps the Idempotency-Key.
- **T-02-54** is mitigated: only the describeHttpError copy and the traceId are shown. A test proves the ProblemDetails `detail` ("SqlException…") never appears.
- **T-02-SC:** no installs.

No endpoint, auth path or file access was added.

## Verification

- `npm --prefix web run test -- --run src/ui/overlays`: 3 files, 69 of 69 passed.
- Preflight before every parity run showed all four ports free and no other project's processes. Then:
  - `npm --prefix web run parity -- --grep @overlays --project chromium`: 10 passed.
  - `npm --prefix web run parity -- --grep @overlays`: **18 passed** (Chromium 10, Firefox 4, WebKit 4) in 2.0 min.
  - A probe run with the error case temporarily set to `parity: true` showed the extra error paragraph. The screenshot shows the typed text kept, the mapped error with the reference, and Delete Order focused. It was reverted.
  - Regression: `--grep "@parity|@reference" --project chromium` gave 91 passed in 5.3 min.
- `npm --prefix web run verify` exited 0. It ran typecheck (3 programs), lint, format, 66 files with 1711 tests, coverage at 99.04 / 97.94 / 100 / 99.92, the build, the license gate and notices.
- Acceptance greps:
  - `aria-modal` in Modal.tsx: 1.
  - `createPortal(` in Modal.tsx: 0.
  - `classList` in useBodyScrollLock.ts: 3.
  - `This can't be undone.` in ConfirmDialog.tsx: 1.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Imports.** `Modal`, `ConfirmDialog`, `Overlay`, `useFocusTrap` and `useBodyScrollLock` come from `@/ui/overlays`.
- **Phase 14 (A11Y-05).** Confirm with NVDA and VoiceOver that the dialog name, the cascade alert and the failure alert are announced (coverage D6).

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 17 created files and the 1 modified file exist on disk.
- Commits `53e64f1`, `92a81de`, `1f358a7`, `5f35fde` and `6a0f8fa` are on `gsd/phase-2-web-foundation-design-system`.
