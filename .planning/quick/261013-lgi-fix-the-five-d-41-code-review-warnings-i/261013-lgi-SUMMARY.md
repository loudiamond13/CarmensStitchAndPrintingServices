---
created: 2026-10-13T15:59:03-05:00
updated: 2026-10-13T15:59:03-05:00
phase: quick-261013-lgi
plan: 01
subsystem: web-ui
status: complete
tags: [d41, code-review, a11y, keyboard, money-input, overlays, tdd]
requires:
  - 02-REVIEW-d41.md (WR-01..WR-05)
  - D-41 rulings R2-02, R2-04, R2-18 (02-CONTEXT.md)
provides:
  - Topbar Ctrl/Cmd+K handled inside text entry (platform primary combo), search text selected on repeat
  - MoneyInput refusal tied to the refused value; empty error counts as none; read-only/disabled paste ignored
  - PaintContainmentContext + useFixedLayerGuard (open Modal/ConfirmDialog refuses to render in a ResponsiveTable frame)
  - 02-REVIEW-FIX-d41.md and the WR-05 owner FYI in deferred-items.md
affects:
  - web/src/ui/navigation/Topbar.tsx
  - web/src/ui/entry/MoneyInput.tsx
  - web/src/ui/overlays/Modal.tsx
  - web/src/ui/lists/ResponsiveTable.tsx
tech-stack:
  added: []
  patterns:
    - React "adjust state when a prop changes" (conditional set-state during render) instead of an effect
    - Runtime invariant via context + throwing hook, proven by component tests (no portal)
key-files:
  created:
    - web/src/ui/overlays/fixedLayerGuard.ts
    - web/src/ui/overlays/fixedLayerGuard.test.tsx
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-d41.md
  modified:
    - web/src/ui/navigation/Topbar.tsx
    - web/src/ui/navigation/Topbar.test.tsx
    - web/src/ui/entry/MoneyInput.tsx
    - web/src/ui/entry/MoneyInput.test.tsx
    - web/src/ui/overlays/Modal.tsx
    - web/src/ui/lists/ResponsiveTable.tsx
    - .planning/phases/02-web-foundation-design-system/deferred-items.md
decisions:
  - "WR-01: inside text entry only the platform's primary combo (Cmd+K on Apple, Ctrl+K elsewhere) is taken; Mac Ctrl+K stays the Cocoa kill-line; select/checkbox are not text entry"
  - "WR-02: the refused-paste hint survives only the blur padding of the refused value; any other value clears it, and a later return to the old value does not bring it back"
  - "WR-05: guard instead of a body portal, because a portal would break spec 2.7 / D-08 (Espresso theme and pg-phone sheet); owner FYI logged"
metrics:
  duration: ~21 min
  completed: 2026-10-13
actuals:
  tokens: 15000
  tasks: 3
  commits: 6
plan_head_before: 6c00e7d4897911c07e1d82149db208278b94a77b
plan_head_after: c21ea0ab0a684c36002298e6728fc4698a83b33d
---

# Quick 261013-lgi: Fix the five D-41 code-review warnings (WR-01..WR-05) Summary

*Created: 2026-10-13T15:59:03-05:00 · Updated: 2026-10-13T15:59:03-05:00*

Ctrl/Cmd+K now works inside text fields with only Mac Ctrl+K left as the kill-line. The MoneyInput paste hint is tied to the value it refused, an empty `error` counts as none, and read-only boxes ignore a paste. An open dialog now refuses to render inside the paint-contained list-table frame, which is a guard and not a portal. All D-41 rulings (R2-02, R2-04, R2-18) are kept.

## Commits (RED → GREEN per task)

| Task | Finding | RED | GREEN |
|------|---------|-----|-------|
| 1 | WR-01 Topbar shortcut inside text entry | dc02083 | 9f52dff |
| 2 | WR-02, WR-03, WR-04 MoneyInput | 6b6b845 | 9bcf1c8 |
| 3 | WR-05 fixed-layer guard | 5f5eb04 | c21ea0a |

The RED runs were seen before each fix: 32 failing Topbar cases, 8 failing MoneyInput cases and 4 failing guard cases.

Docs (02-REVIEW-FIX-d41.md, deferred-items.md, this SUMMARY) are left **uncommitted** for the orchestrator, as instructed. That overrides the plan's own `docs(quick-261013-lgi)` commit step.

## Verification

- Preflight ran before `verify` and again before E2E. Ports 5180/5115/7028/5199 were free, and no dev or test processes were running.
- `npm --prefix web run verify` exited 0:
  - 108 test files and 3074 tests passed.
  - Coverage (all files): 98.25% statements, 96.51% branches, 99.81% functions, 99.82% lines. Every threshold held.
  - Typecheck, lint (`--max-warnings 0`), format, build, build:budget, license gate and notices (16 packages) passed.
- Budgets, with no limit changed:
  - Production: public JS 126.18 / 150 KB, CSS 13.01 / 35 KB.
  - Budget build: public JS 131.57 / 150 KB, admin JS 157.06 / 250 KB, CSS 13.01 / 35 KB.
- `npm --prefix web run e2e -- keyboard.spec admin-keyboard.spec showcase.spec`: 100/100 passed across chromium, firefox, webkit, pixel and iphone (20 each), with no retries.
- `git diff 6c00e7d..HEAD` on `lists.recipe.ts`, `overlays.recipe.ts`, `web/visual` and `web/src/dev` is empty, so parity was not re-run, as the plan says.
- The `createPortal(` count is 0 in Modal.tsx, Overlay.tsx and ConfirmDialog.tsx.

## WR-05 decision: guard, not portal

A react-dom portal to `document.body` was rejected for these reasons:
- CSPS-UI-SPEC.md §2.7 (frozen) requires portalled content inside `[data-theme]` and `.s-page`.
- Espresso comes from `.s-page[data-theme]`, and the Overlay phone sheet uses the `pg` container (`pg-phone:` in `overlayRegionClasses`).
- 02-RESEARCH.md calls the body portal an anti-pattern, 02-UI-SPEC.md says "never a portal to <body>", and plan 02-22 pinned zero portals.

So `OpenModal` calls `useFixedLayerGuard('Modal')` first, and the ResponsiveTable frame provides `PaintContainmentContext` (no DOM). Row actions keep the dialog's state on the page. A test proves that pattern: the dialog and its scrim are outside the frame, focus lands on Cancel, and axe is clean. The owner FYI was added to deferred-items.md with two options: a `.s-page` portal, or `position: relative` instead of paint containment.

## Deviations from Plan

1. **[Orchestrator instruction] The docs commit was not made.** The plan's Task 3 asks for a `docs(quick-261013-lgi)` commit of 02-REVIEW-FIX-d41.md and deferred-items.md. The orchestrator said to leave them uncommitted, so they are uncommitted.
2. **[Rule 3 - Blocking] The RED stub was made lint-clean.** The first stub (`void component;`, then an empty body) failed `no-meaningless-void-operator`, `no-unused-vars` and `no-empty-function`, so the RED commit was blocked. The committed stub reads the context and returns a string, so it never throws. The GREEN version replaced it.
3. **WR-05 tests use a test error boundary.** The plan allows this option. It checks the throw deterministically under React 19 + RTL, and `collectConsole()` checks the console reports.

No other deviations. No packages were installed.

## Known Stubs

None. The RED stub in fixedLayerGuard.ts was replaced in c21ea0a.

## Notes

- `Modal.tsx` coverage shows lines 55 and 86-90 uncovered. Those are the existing `open = true` default branch and the effect's `overlay === null` early return, moved down 3 lines by the new guard call and comment. They are not new code paths.
- WR-01 and WR-02 should get a human check in a real browser: the keyboard on Windows and macOS (Cocoa kill-line), and a screen reader on the MoneyInput live region.
- STATE.md and ROADMAP.md were not edited. The orchestrator owns the quick-task bookkeeping.

## Self-Check: PASSED

- FOUND: web/src/ui/overlays/fixedLayerGuard.ts, web/src/ui/overlays/fixedLayerGuard.test.tsx, .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-d41.md
- FOUND commits: dc02083, 9f52dff, 6b6b845, 9bcf1c8, 5f5eb04, c21ea0a
