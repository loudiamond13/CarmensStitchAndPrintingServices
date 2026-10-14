---
phase: 02-web-foundation-design-system
lane: d41
created: 2026-10-13T15:58:19-05:00
updated: 2026-10-13T15:58:19-05:00
fixed_at: 2026-10-13T15:58:19-05:00
review_path: .planning/phases/02-web-foundation-design-system/02-REVIEW-d41.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report (lane: d41)

*Created: 2026-10-13T15:58:19-05:00 · Updated: 2026-10-13T15:58:19-05:00*

**Fixed at:** 2026-10-13T15:58:19-05:00
**Source review:** .planning/phases/02-web-foundation-design-system/02-REVIEW-d41.md (the review of quick tasks 261013-g6s and 261013-ihp)
**Iteration:** 1
**Scope:** WR-01 to WR-05 only, in quick task 261013-lgi. IN-01 to IN-06 were not touched.

**Summary:**

- Findings in scope: 5
- Fixed: 5
- Skipped: 0
- Every D-41 ruling the fixes touch still holds: Ctrl/Cmd+K replaces "/" (R2-04), `contain: paint` stays on the list-table frame (R2-02), and a refused money paste shows the amount hint (R2-18).

**How the fixes were made:**

- Each task was test-first. The failing tests were committed first (RED, `test(quick-261013-lgi): …`), the RED run was seen, then the fix went in (GREEN, `fix(quick-261013-lgi): …`). One commit pair per task, on the main checkout (branch `gsd/phase-2-web-foundation-design-system`, no worktree).
- Only behaviour and attributes changed, in states the parity suite does not render: shortcut presses, refused pastes, and dialogs in table cells. No class list, recipe, scenario, rulings or reference file changed (`git diff` on `lists.recipe.ts`, `overlays.recipe.ts`, `web/visual` and `web/src/dev` is empty), so parity was not re-run. No portal was added (`createPortal(` count is 0 in Modal.tsx, Overlay.tsx and ConfirmDialog.tsx).

**Verification:** all of it ran in the main checkout (`C:/Work/CarmensStitchAndPrintingServices`). The shared-machine preflight showed ports 5180, 5115, 7028 and 5199 free and no dev or test processes before `verify` and again before the E2E run.

- **`npm --prefix web run verify` exited 0.**
  - 108 test files and 3074 tests passed.
  - Coverage: all files 98.25% statements, 96.51% branches, 99.81% functions and 99.82% lines. Every threshold held. No threshold was changed.
  - Typecheck (all three programs), lint (`--max-warnings 0`), format, build, `build:budget`, the license gate and `notices:check` (16 packages) all passed.
- **Budgets** (no limit changed):
  - Production: public JS 126.18 KB of 150, CSS 13.01 KB of 35.
  - Dev-route (budget) build: public JS 131.57 KB of 150, admin JS 157.06 KB of 250, CSS 13.01 KB of 35.
- **E2E:** `npm --prefix web run e2e -- keyboard.spec admin-keyboard.spec showcase.spec`: 100 of 100 passed in all five projects (chromium, firefox, webkit, pixel, iphone, 20 each), with no retries and no flakes.

## Fixed Issues

### WR-01: Ctrl/Cmd+K inside any field, including the search box itself, goes to the browser and focus leaves the page

**Files modified:** `web/src/ui/navigation/Topbar.tsx`, `web/src/ui/navigation/Topbar.test.tsx`
**Commit:** dc02083 (RED), 9f52dff (GREEN)
**Status:** fixed: requires human verification (keyboard in a real browser on Windows and macOS)
**Applied fix:**

- The old "inside a field" guard was narrowed to **text entry**: a textarea, an input whose type is text, search, email, url, tel, password or number, editable content, or anything inside the textbox, searchbox, combobox and spinbutton roles. A select, a checkbox or any other non-text input now counts as outside text entry.
- Outside text entry both Ctrl+K and Cmd+K work on every platform, as before (D-41 R2-04).
- Inside text entry only the platform's **primary** combo is taken, with `preventDefault`: Cmd+K on Apple agents, Ctrl+K elsewhere. The browser therefore never gets it and focus never jumps to the address bar. Mac Ctrl+K inside text entry is left to the field (Cocoa "kill to end of line"), and so is Windows Meta+K.
- Pressed in the search box itself, the shortcut keeps focus there and selects its text, so a repeat press is ready for retyping.
- The IME, already-handled, Alt/Shift, Ctrl+Cmd and modal-open guards are unchanged. The hint ("Ctrl K" / "⌘K"), `aria-keyshortcuts="Control+K Meta+K"` and the markup are unchanged.
- **Tests:** 32 new cases (14 text-entry targets × Windows Ctrl+K and Mac Cmd+K, select and checkbox on a Mac, the search box itself) were RED. The Mac Ctrl+K kill-line cases and Windows Meta+K pin what is left alone. The Windows and Macintosh user agents are now shared constants.

### WR-02: The refused-paste flag outlives the value it describes

**Files modified:** `web/src/ui/entry/MoneyInput.tsx`, `web/src/ui/entry/MoneyInput.test.tsx`
**Commit:** 6b6b845 (RED), 9bcf1c8 (GREEN)
**Status:** fixed: requires human verification (screen reader in a real browser)
**Applied fix:**

- The boolean `refused` state became `refusedAt: string | null`, the box value at the moment a paste was refused. The refusal stands while the value is that text or its blur padding (`padMoneyOnBlur(refusedAt)`).
- When the value is anything else, the stale refusal is dropped during render with React's "adjust state when a prop changes" pattern: a conditional `setRefusedAt(null)` in the component body. No effect and no ref read was added, and the react-hooks 7 rules pass. A later return to the old value therefore cannot bring the hint back.
- A caller-set value (a form reset, a "Pay full balance" fill) now clears `aria-invalid`, the hint and the status text.
- **Blur-padding decision:** the padding of the refused value ("7" → "7.00") keeps the hint on purpose. The padding is this component's own rewrite of the same amount, not a new value, and the R2-18 behaviour from quick-261013-g6s (pinned by the unchanged test "clears the hint on the next accepted keystroke, and keeps it through a refused one and the blur") clears the hint only on the next accepted keystroke or paste.

### WR-03: A caller's `error=""` swallows the visible paste hint while the live region still announces it

**Files modified:** `web/src/ui/entry/MoneyInput.tsx`, `web/src/ui/entry/MoneyInput.test.tsx`
**Commit:** 6b6b845 (RED), 9bcf1c8 (GREEN)
**Status:** fixed
**Applied fix:**

- The caller error counts only when it is a non-empty string, matching Field's `Boolean(error)`. With `error=""` a refused paste shows the hint with `aria-invalid` and announces it.
- The always-mounted `role="status"` node (WCAG 4.1.3) announces the paste hint only when no caller error is shown, so it never says something that is not on screen.
- **Tests:** `error=""` with a refused paste, `error=""` with no refusal (the caller's hint shows), and the extended "shows the caller's error instead of the paste hint" test, which now also checks the status node is empty.

### WR-04: A read-only MoneyInput can be changed, or marked invalid, by a paste

**Files modified:** `web/src/ui/entry/MoneyInput.tsx`, `web/src/ui/entry/MoneyInput.test.tsx`
**Commit:** 6b6b845 (RED), 9bcf1c8 (GREEN)
**Status:** fixed
**Applied fix:**

- The paste handler returns first when the box is `readOnly` or `disabled`, before `preventDefault()`. The browser's own default does nothing there, the caller's value never changes, and nothing is marked invalid (threat T-261013-lgi-01).
- **Tests:** a read-only box with a user paste of "₱4,327.50" then "abc" keeps "7", never calls onChange and stays valid; `fireEvent.paste` on a read-only and on a disabled box returns true (the default is not prevented).

### WR-05: `contain: paint` makes the table frame the containing block for `position: fixed` content

**Files modified:** `web/src/ui/overlays/fixedLayerGuard.ts` (new), `web/src/ui/overlays/fixedLayerGuard.test.tsx` (new), `web/src/ui/overlays/Modal.tsx`, `web/src/ui/lists/ResponsiveTable.tsx`
**Commit:** 5f5eb04 (RED), c21ea0a (GREEN)
**Status:** fixed (with the review's second option, a guard)
**Applied fix:**

- `fixedLayerGuard.ts` exports `PaintContainmentContext` (default false) and `useFixedLayerGuard(component)`, which throws a plain-English error when it renders inside a paint-contained frame: "Modal cannot render inside a ResponsiveTable frame: the frame's paint containment (D-41 R2-02) traps position: fixed, so the scrim would cover only the table and the dialog would scroll with the rows. Keep the dialog's open state on the page and render the dialog outside the table (code review WR-05)."
- `OpenModal` calls the guard as its first statement, before the focus trap and the body scroll lock, so it throws before any side effect. ConfirmDialog and an Overlay's inline Modal are covered through it. A closed Modal mounts nothing and does not throw.
- The ResponsiveTable frame wraps its `<table>` in `<PaintContainmentContext value>`. This adds no DOM. DataTable's frame has no paint containment and SkeletonTable renders no caller content, so neither needs it.
- The guard is internal to lists and overlays and is not exported from the `@/ui/overlays` or `@/ui` barrels (`web/src/ui/index.test.ts` pins those lists).
- **Tests:** an open ConfirmDialog, a Modal, and an Overlay holding an inline Modal in a cell each throw the WR-05 error (caught by a test error boundary, and React's console reports are drained and checked to be only about it). A closed Modal in a cell renders. The supported pattern (the page holds the open state, a row's "Delete ORD-2026-0148" button sets it, the ConfirmDialog renders after the table) opens a dialog whose panel and scrim are outside the frame, puts focus on Cancel, and has no axe violations.
- **Why the portal was not taken** (the review's first option, and the brief's preferred fix): a react-dom portal to `document.body` would break the D-08 approved look, which was the brief's own fallback trigger.
  - CSPS-UI-SPEC.md §2.7 (binding, frozen) requires anything in a portal to sit inside `[data-theme]` and `.s-page`. Espresso comes from `.s-page[data-theme]`, and the Overlay region's phone sheet uses the `pg` container (`pg-phone:` variants in `overlayRegionClasses`).
  - 02-RESEARCH.md lists the body portal as an anti-pattern, 02-UI-SPEC.md says "never a portal to <body>", and plan 02-22 pinned zero portals in Modal.tsx.
  - A body portal would render admin dark-mode dialogs in Blush and drop the phone sheet, breaking the overlays parity group.
  - `position: relative` on the frame needs an owner ruling, and `<dialog>.showModal()` changes the frozen App. D.3 markup, so neither was used. The owner question is logged (below).

## Owner items added to deferred-items.md ("Owner decisions pending")

1. **WR-05 (FYI, not blocking):** a confirm or edit dialog cannot be opened from inside a list-table cell. Keep the rule, or allow in-cell dialogs through (a) a portal into the layout's `.s-page`, or (b) `position: relative` on the table frame instead of paint containment (a D-08 ruling)?

---

_Fixed: 2026-10-13T15:58:19-05:00_
_Fixer: Claude (gsd-executor, quick-261013-lgi)_
_Iteration: 1_
