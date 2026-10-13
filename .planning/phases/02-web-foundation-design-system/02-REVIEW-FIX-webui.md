---
phase: 02-web-foundation-design-system
lane: webui
created: 2026-10-13T09:05:00-05:00
updated: 2026-10-13T09:05:00-05:00
fixed_at: 2026-10-13T09:05:00-05:00
review_path: .planning/phases/02-web-foundation-design-system/02-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 15
skipped: 1
status: partial
---

# Phase 02: Code Review Fix Report (lane: webui)

**Fixed at:** 2026-10-13T09:05:00-05:00
**Source review:** .planning/phases/02-web-foundation-design-system/02-REVIEW.md (lane detail: 02-REVIEW-lane-webui.md)
**Iteration:** 1
**Scope:** UI-CR-01 and UI-WR-01 to UI-WR-15 only. The UI-IN-* findings and the other lanes were not touched.

**Summary:**

- Findings in scope: 16
- Fixed: 15. Two of them are fixed in part, and the rest of each is an owner question: UI-WR-07 and UI-WR-09.
- Skipped: 1. UI-WR-14 is an owner decision under D-08. It is logged in deferred-items.md and the code is unchanged.

**How the fixes were made:**

- Each behaviour fix was test-first: a failing test was added or extended, the RED run was seen, then the fix went in.
- Each finding has one commit on the main tree (branch `gsd/phase-2-web-foundation-design-system`, no worktree, as the orchestrator asked). The root-pin guard ran before every commit.
- Each fix keeps the approved look (D-08): only behaviour and attributes changed. The parity proof below shows every touched group is still EQUAL in three engines.

**Verification:** all of it ran in the **main checkout** (`C:/Work/CarmensStitchAndPrintingServices`), after the shared-machine preflight showed all ports free and no other project's processes. The numbers can be reproduced from this tree.

- **`npm --prefix web run verify` exited 0.**
  - 103 test files and 2837 tests passed. The weblib fix report's baseline was 2786.
  - Coverage: all files 98.18% statements, 96.34% branches, 99.81% functions and 99.82% lines. Every threshold held, including `src/lib/http/**` at 100%.
  - Typecheck (all three programs), lint, format, build, `build:budget`, the license gate and `notices:check` all passed.
- **Budgets:**
  - Production public JS is 130.40 KB of 150 (it was 130.10).
  - **The dev-route (budget) build is 149.99 KB of 150** (it was 149.69). The e2e build measures the same.
  - It is within the limit, so the brief's remedy was **not** applied and no limit was changed. **Headroom is now 0.01 KB**: the next change to a shared UI chunk will go over. The planned remedy applies then: build the `budget` and `e2e` modes without the parity entry, or split the `src/ui/*/index.ts` barrels.
- **Parity:** `node web/scripts/parity.mjs --grep ...`, which is what `npm run parity` runs. All rows passed in Chromium, Firefox and WebKit.
  - 194 rows passed: media, overlays, navigation, navigation-gaps, feedback, data, layouts-admin, layouts-admin-boundaries and layouts-public. The layout groups were included because they render the Toast layer, Topbar and drawer.
  - 60 more rows passed: lists, lists-states and entry. The Pagination, OtpInput and MoneyInput cases are SPEC-GAP, so they are checked by axe and the guard in their groups' rest rows.
  - Nothing differed, and no normalization or tolerance was added.
- **E2E:** `node web/scripts/e2e.mjs`, which is `npm run e2e`, in all five projects.
  - Run 1 covered showcase, keyboard, admin-keyboard, a11y-rulings and admin: 394 of 395 passed.
  - The one failure was WebKit's "Delete Order demo" timing out at 30 s under load (31.4 s while clicking). It was the known plan 02-35 flake, and it passed alone in 11.1 s.
  - As deferred-items.md asked, the next person to touch `showcase.spec.ts` was to give its tests the 120 s timeout. That was done (commit d2a0cac), and `showcase.spec.ts` then passed 30 of 30 in five projects.
  - The new UI-CR-01 E2E was RED in Chromium before the fix, with a guard CSP violation: `img-src blocked blob`. After the fix it was GREEN in all five projects.

## Fixed Issues

### UI-CR-01: ImageUploader previews use `blob:` object URLs, which the shipped CSP blocks

**Files modified:** `web/src/ui/media/ImageUploader.tsx`, `web/src/ui/media/ImageUploader.test.tsx`, `web/e2e/showcase.spec.ts`
**Commit:** 37d4205
**Status:** fixed
**Applied fix:** this is the no-CSP-change option. `SecurityHeadersMiddleware` is untouched.

- Each picked or dropped file is now read with `FileReader.readAsDataURL`, and the thumbnail `src` is a `data:` URL, which the strict `img-src 'self' data: https://res.cloudinary.com` already allows. Nothing is created with `URL.createObjectURL`, so there is nothing to revoke.
- The read is asynchronous, so:
  - files still being read count against `max`;
  - previews are appended to the latest list, which keeps any image added or removed during the read;
  - a file that cannot be read is left out;
  - nothing changes after unmount;
  - every preview gets a unique id.
- `onFiles` is still called right away with the picked files.
- **Tests:**
  - The unit tests prove the `data:` src and that `createObjectURL` is never called. They also cover the in-flight count, edits made during the read, a read error and unmount.
  - The new E2E "a picked image previews under the strict CSP" uploads a 1×1 PNG into the showcase uploader under the real host CSP. It checks that the image decodes (`naturalWidth` 1) and that the guard reports no CSP violation.
- **Note for Phase 9 (IMG-01):** a `data:` URL holds the whole file in memory as text, about 1.33 times its size. With 12 images of 10 MB that is roughly 160 MB of strings. The upload phase may want to downscale previews.

### UI-WR-01: Esc closes every open overlay at once (Modal, ConfirmDialog, MobileNavDrawer)

**Files modified:** `web/src/ui/overlays/Modal.tsx`, `web/src/ui/overlays/Modal.test.tsx`, `web/src/ui/overlays/index.ts`, `web/src/ui/navigation/MobileNavDrawer.tsx`, `web/src/ui/navigation/MobileNavDrawer.test.tsx`
**Commit:** 04fc20c (it builds on the UI-WR-02 trap stack)
**Status:** fixed
**Applied fix:**

- Esc is now handled only by the overlay whose focus trap is on top of the stack. The new `isTopFocusTrap(root)` is exported from `@/ui/overlays`.
- It acts only when `!event.defaultPrevented`, and the overlay that closes calls `preventDefault()`.
- **Tests:** an edit Modal with a confirm opened over it needs one Esc to close the confirm only, and the form keeps its input; a second Esc closes the edit Modal. An Esc that is already handled is ignored. A dialog over the open phone drawer closes first, then the drawer.

### UI-WR-02: useFocusTrap has no trap stack, so two active traps fight over focus

**Files modified:** `web/src/ui/overlays/useFocusTrap.ts`, `web/src/ui/overlays/useFocusTrap.test.tsx`
**Commit:** 591e3e3
**Status:** fixed: requires human verification (focus logic; please confirm with a keyboard and a screen reader in a real browser)
**Applied fix:**

- Active traps now form a module-level stack, and a trap joins the stack *before* it moves focus.
- Only the top trap acts on Tab and on `focusin` outside its root.
- When the top trap ends:
  - focus returns to its trigger;
  - if that leaves focus outside the trap now on top, or the trigger is gone, focus moves into that trap.
- A trap that ends while another is above it leaves focus alone.
- **Tests:** they use sibling traps, as in the drawer-plus-dialog case: the newest trap takes and keeps focus, the Tab wrap stays inside the top trap, focus goes back to the trigger in the trap below, focus moves into the trap below when the trigger is gone, and a lower trap that ends first leaves the top one alone.

### UI-WR-03: Persistent toasts cannot be reached by keyboard while a Modal or drawer is open

**Files modified:** `web/src/ui/overlays/useFocusTrap.ts`, `web/src/ui/overlays/useFocusTrap.test.tsx`
**Commit:** 5c0d89f
**Status:** fixed: requires human verification (focus logic)
**Applied fix:**

- The trap treats the toast layer (`[data-ui="s-toast-layer"]` outside the trap) as the one region focus may visit:
  - Tab goes from the dialog's last element to the first toast control;
  - Tab from the last toast control goes back to the dialog's first element;
  - Shift+Tab goes the other way;
  - focus on a toast is never pulled back.
- With no toast, or an inert layer, the wrap is unchanged, so the existing keyboard E2E ("Tab stays in the dialog") still holds.
- **Not changed:** `aria-modal="true"` still hides the toast from a screen reader's virtual cursor. Keyboard and focus reach it, and the live region still announces it.

### UI-WR-04: Toasts are live regions nested inside a live region, so they are announced twice

**Files modified:** `web/src/ui/feedback/Toast.tsx`, `web/src/ui/feedback/ToastProvider.tsx`, `web/src/ui/feedback/ToastProvider.test.tsx`, `web/src/ui/feedback/feedback.test.tsx`, `web/src/app/admin/AdminLayout.test.tsx`, `web/e2e/keyboard.spec.ts`, `web/e2e/admin-keyboard.spec.ts`, `.planning/phases/02-web-foundation-design-system/deferred-items.md`
**Commit:** 3ce113d
**Status:** fixed (with an owner FYI)
**Applied fix:**

- The always-mounted layer stays the polite live region (owner ruling D-31 O-5) and is now the *only* one.
- `Toast` gains `announce` (default true, which keeps the App. D.3 role), and `ToastProvider` renders its toasts with `announce={false}`, so they carry no role.
- Tests and the two keyboard E2E specs now find provider toasts by their text.
- **Consequence:** danger toasts are now read once and politely, not assertively. The UI-SPEC's per-tone roles and the O-5 layer cannot both hold without the double reading. This is logged as an FYI under "Owner decisions pending" in deferred-items.md. Making danger interrupt would need a second region, which changes the markup of the stack.

### UI-WR-05: Toast timers stay paused forever after a Dismiss click while other toasts remain; focus is lost

**Files modified:** `web/src/ui/feedback/ToastProvider.tsx`, `web/src/ui/feedback/ToastProvider.test.tsx`
**Commit:** 69d2d14
**Status:** fixed: requires human verification (focus and timer logic)
**Applied fix:**

- The layer remembers where focus was before it entered the stack.
- A Dismiss pressed with focus inside the stack hands focus back there, before the toast goes. If that element is gone, focus goes to the next toast's Dismiss.
- After every change to the stack, the "focus inside" flag is read again from `document.activeElement`, and the clock is synced. The old event flag is no longer trusted.
- **Tests:** focus returns to the trigger and the clock runs again; focus moves to the next toast when there is nowhere to return to; the clock runs again when the screen closes a focused toast.

### UI-WR-06: ConfirmDialog does not handle a synchronous throw from `onConfirm`

**Files modified:** `web/src/ui/overlays/ConfirmDialog.tsx`, `web/src/ui/overlays/ConfirmDialog.test.tsx`
**Commit:** 7407bbb
**Status:** fixed
**Applied fix:**

- `onConfirm` runs inside `try`/`catch`. A synchronous throw goes through the same failure path as a rejection: the `describeHttpError` copy is shown, never the error text, the dialog stays open, and Delete takes focus for a retry.
- **Test:** the first call throws a TypeError. The test checks for the "Something went wrong…" line, that the error text is not shown, and that the dialog stays open and the second call is made.

### UI-WR-07: The global "/" single-character shortcut fails WCAG 2.1.4

**Files modified:** `web/src/ui/navigation/Topbar.tsx`, `web/src/ui/navigation/Topbar.test.tsx`, `.planning/phases/02-web-foundation-design-system/deferred-items.md`
**Commit:** 112c89b
**Status:** fixed in part (no visible change); the rest is an owner question
**Applied fix:**

- "/" is now ignored:
  - with Ctrl, Cmd or Alt held;
  - during an IME composition;
  - when another handler already took the key;
  - inside fields, editable content and `role` textbox, searchbox, combobox and spinbutton widgets;
  - while any `[aria-modal="true"]` dialog or the drawer is open.
- Shift+"/" still works, because some keyboard layouts need Shift for "/".
- **Owner question:** a way to turn the shortcut off, or to need a modifier, is what fully meets 2.1.4. Either changes what the user sees: the "/" hint, or a new setting. It is logged under "Owner decisions pending" in deferred-items.md with options (a), (b) and (c). The review recommends (b), a switch that keeps the approved look.

### UI-WR-08: OtpInput's `maxLength={1}` truncates the one-time-code autofill it advertises

**Files modified:** `web/src/ui/entry/OtpInput.tsx`, `web/src/ui/entry/OtpInput.test.tsx`
**Commit:** c20e67b
**Status:** fixed
**Applied fix:**

- The first box (the one with `autocomplete="one-time-code"`) no longer has a `maxlength`. Boxes 2 to 6 keep `maxLength=1`.
- The change handler already keeps only digits and spreads them over the boxes. The existing native-value test proves the six-digit fill.
- It is recorded as a SPEC-DEVIATION, because the UI-SPEC says every box has `maxLength=1`. It changes an attribute only.

### UI-WR-09: MoneyInput silently drops a pasted amount in the app's own `₱` format

**Files modified:** `web/src/ui/entry/MoneyInput.tsx`, `web/src/ui/entry/MoneyInput.test.tsx`, `.planning/phases/02-web-foundation-design-system/deferred-items.md`
**Commit:** 978f7df
**Status:** fixed in part; the rest is an owner question
**Applied fix:**

- One leading "₱" or "PHP" (any case), and the spaces around it, are removed before `normalizePastedMoney`. So "₱4,327.50" pastes as "4327.50".
- These are still rejected: "₱-5", "₱−5", "-₱5", "₱₱100" and "100₱".
- `lib/format.ts` is unchanged (weblib lane), and the old test that pinned the bug ("rejects ₱100") was replaced.
- **Owner question:** whether a refused paste should show the existing amount hint. It is a new visible state, and the UI-SPEC says such a paste is ignored. It is logged in deferred-items.md.

### UI-WR-10: ImageUploader exceeds `max` when the list is already over the limit

**Files modified:** `web/src/ui/media/ImageUploader.tsx`, `web/src/ui/media/ImageUploader.test.tsx`
**Commit:** 2cc4508
**Status:** fixed
**Applied fix:**

- The room left is now `Math.max(0, max - list - reading)`.
- **Test:** a controlled 3-image list with `max={2}` adds nothing: `onFiles` and `onChange` are never called.

### UI-WR-11: ImageUploader cannot re-pick a file that was just removed

**Files modified:** `web/src/ui/media/ImageUploader.tsx`, `web/src/ui/media/ImageUploader.test.tsx`
**Commit:** 35eff8d
**Status:** fixed
**Applied fix:**

- The hidden file input's value is set to `''` after each pick, once `addFiles` has copied the files.
- **Test:** a spy on the input's value setter checks that it is cleared after each of two picks of the same file.

### UI-WR-12: OrderCard hides the order status and image count from assistive technology

**Files modified:** `web/src/ui/data/OrderCard.tsx`, `web/src/ui/data/data.test.tsx`
**Commit:** 92b0c93
**Status:** fixed
**Applied fix:**

- The cover button's name now includes the status and, when the count chip shows, the image count: "View order ORD-2026-0148, In Production, 4 images". An unknown status uses its raw text, as StatusBadge does.
- The View and Edit buttons are named "View order {number}" and "Edit order {number}", like Delete. The visible word comes first (WCAG 2.5.3).
- This changes attributes only. The data parity rows are EQUAL.

### UI-WR-13: IncomeExpenseChart keys month groups by the short month name

**Files modified:** `web/src/ui/data/IncomeExpenseChart.tsx`, `web/src/ui/data/IncomeExpenseChart.test.tsx`
**Commit:** 8f22f9d
**Status:** fixed
**Applied fix:**

- The key is now `${index}-${label ?? month}`. The bars are positional.
- **Test:** 13 months that repeat "Oct", with and without labels, render 13 groups. The test caught the duplicate-key console error before the fix.

### UI-WR-15: Pagination drops keyboard focus when it disables the focused button

**Files modified:** `web/src/ui/lists/Pagination.tsx`, `web/src/ui/lists/Pagination.test.tsx`
**Commit:** 9428b3a
**Status:** fixed: requires human verification (focus logic)
**Applied fix:**

- The ends stay natively `disabled`. Switching to `aria-disabled` was not done, because it could change the look.
- After a page change from the bar, focus is checked again in an effect once the new page has rendered. Focus counts as lost when it is on the body, on a disconnected element, or on a button the change disabled. Then it goes to the focus target, else to the first enabled button of the bar.
- The synchronous focus of the target is kept.
- `focusTargetId` stays optional. Making it required, as the review suggested, would change the API, so it was left.
- **Tests:** Next onto the last page moves focus to Previous; Previous onto the first page moves it to Next; an enabled button keeps focus; a re-created heading gets focus.

## Skipped Issues

### UI-WR-14: OrderTotals shows an overpaid order as "Fully Paid" and hides the negative balance

**File:** `web/src/ui/money/OrderTotals.tsx:41, 58-66`
**Reason:** this is an owner decision (D-08). The display is the approved App. D.3 / App. E look, and showing the overpayment changes visible text and colour. The orchestrator's instructions name this finding as one to log, not change. It is logged under "Owner decisions pending" in deferred-items.md, with the before and after and the question (commit e7c56f8). The server math already returns the negative balance, so only the display needs to change once the owner decides.
**Original issue:** when `fullyPaid` is true (`balance <= 0`), the block shows only "Fully Paid" with a check and never shows `t.balance`. An overpaid order therefore looks the same as one paid exactly, and the amount to refund or credit is not visible.

## Other changes

- **d2a0cac** `test(02): give the showcase E2E journeys the 120 s timeout`. The plan 02-35 flake entry in deferred-items.md said the next person to touch `showcase.spec.ts` should add this timeout. The flake showed again in this run. The entry is now marked resolved. No tolerance was added.

## Owner items added to deferred-items.md ("Owner decisions pending")

1. **UI-WR-04 (FYI):** danger toasts are now read politely, once.
2. **UI-WR-07:** a way to turn off the "/" shortcut, or to need a modifier (WCAG 2.1.4).
3. **UI-WR-09:** whether a refused money paste should show the amount hint.
4. **UI-WR-14:** an overpaid order shows only "Fully Paid".

---

_Fixed: 2026-10-13T09:05:00-05:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
