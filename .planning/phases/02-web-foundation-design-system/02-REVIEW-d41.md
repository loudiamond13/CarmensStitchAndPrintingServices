---
phase: 02-web-foundation-design-system
scope: quick tasks 261013-g6s (D-41 R2-01/02/03/04/12/17/18) and 261013-ihp (D-41 R2-06), b3204f9..7fd5d8b
created: 2026-10-13T14:19:59-05:00
updated: 2026-10-13T14:19:59-05:00
reviewed: 2026-10-13T19:19:59Z
depth: standard
files_reviewed: 51
files_reviewed_list:
  - docs/web/owner-review.md
  - docs/web/parity.md
  - src/Csps.Domain/Orders/OrderMath.cs
  - src/Csps.Domain/Orders/OrderMathModels.cs
  - tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs
  - tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs
  - tests/fixtures/order-math-golden-vectors.json
  - web/e2e/admin.spec.ts
  - web/e2e/responsive.spec.ts
  - web/e2e/showcase.spec.ts
  - web/scripts/gen-golden-vectors.mjs
  - web/scripts/gen-golden-vectors.test.ts
  - web/scripts/golden-math.mjs
  - web/scripts/golden-math.test.ts
  - web/scripts/owner-review.mjs
  - web/scripts/owner-review.test.ts
  - web/src/app/public/PublicLayout.test.tsx
  - web/src/app/public/SiteFooter.tsx
  - web/src/dev/scenarios/groups/data.ts
  - web/src/dev/scenarios/groups/layouts-admin-boundaries.ts
  - web/src/dev/scenarios/groups/lists.ts
  - web/src/dev/scenarios/groups/money.ts
  - web/src/lib/csps.golden.test.ts
  - web/src/lib/csps.test.ts
  - web/src/lib/csps.ts
  - web/src/ui/data/data.test.tsx
  - web/src/ui/entry/MoneyInput.test.tsx
  - web/src/ui/entry/MoneyInput.tsx
  - web/src/ui/lists/FilterBar.test.tsx
  - web/src/ui/lists/lists.recipe.node.test.ts
  - web/src/ui/lists/lists.recipe.ts
  - web/src/ui/lists/search-focus-contrast.node.test.ts
  - web/src/ui/money/OrderTotals.tsx
  - web/src/ui/money/money.test.tsx
  - web/src/ui/navigation/Sidebar.test.tsx
  - web/src/ui/navigation/Sidebar.tsx
  - web/src/ui/navigation/Topbar.test.tsx
  - web/src/ui/navigation/Topbar.tsx
  - web/src/ui/navigation/navigation.recipe.ts
  - web/visual/compare.test.ts
  - web/visual/intentional-differences.ts
  - web/visual/lists-overflow.spec.ts
  - web/visual/navigation-overflow.spec.ts
  - web/visual/reference/fragments/AdminShell.tsx
  - web/visual/reference/fragments/OrderCard.tsx
  - web/visual/reference/fragments/OrderTotals.tsx
  - web/visual/reference/fragments/Topbar.tsx
  - web/visual/reference/merge-kit.test.ts
  - web/visual/reference/merge-kit.ts
  - web/visual/reference/rulings.css
  - web/visual/reference/rulings.test.ts
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 2: Code Review Report (D-41 quick tasks 261013-g6s and 261013-ihp)

*Created: 2026-10-13T14:19:59-05:00 · Updated: 2026-10-13T14:19:59-05:00*

**Reviewed:** 2026-10-13T14:19:59-05:00
**Depth:** standard
**Files Reviewed:** 51 (`git diff b3204f9..7fd5d8b -- . ':!.planning'`)
**Status:** issues_found

## Summary

I reviewed the full diff of both quick tasks against the D-41 rulings in `02-CONTEXT.md`. The ruled behavior itself is not flagged. That covers Subtotal/Total naming, Fully Paid as `Subtotal > 0 && Balance <= 0`, Ctrl/Cmd+K replacing "/", `contain: paint`, `min-w-0`, the border-only list-search ring, `aria-expanded`, the footer h2s and the refused-paste hint.

**Money math: no defects found.**
- `OrderMath.Compute` (C#), `orderTotals` (TS, BigInt centavos) and `computeExpected` (golden generator) use the same operation order, the same rounding and the same FullyPaid predicate.
- I checked all 220 golden vectors with a separate script:
  - `subtotal − discount = total`, `total − paid = balance` and `total − expenses = profit` hold everywhere.
  - `fullyPaid === (subtotal > 0 && balance <= 0)` holds everywhere.
  - Every amount is formatted `-?\d+\.\d\d`.
  - 16 cases change their fullyPaid value against a `Total > 0` rule. That difference is the intended effect of the NET-IN-01 "keep" ruling.
- The C# record grew from 7 to 8 positional parameters, so a stale positional call fails to compile instead of shifting silently. The vector reader now fails closed (`UnmappedMemberHandling.Disallow`, `RespectRequiredConstructorParameters`).
- The demo table rows (0148 → 21,327.50, 0151 → 22,500.00) match `orderTotals(...).total`. The other demo rows have no discount, so their Total is unchanged.

**Security (CWE-79/94/22):** no injection found.
- The reference overrides write fixed literals through `textContent`.
- `beforeAfterSection` escapes every interpolated value.
- `beforeAfterScript` passes its data through `JSON.stringify`.
- Every write goes through `assertWritable`, and the file names come from constants.

**`contain: paint` and focus rings:** this adds no new clipping. The frame already had `overflow-x: auto`, which makes the y axis `auto` as well and clips at the padding box. The frame's own outline (it is a focusable `role="region"`) is not clipped by its own paint containment. The real side effect is the containing block for `position: fixed` content (WR-05).

**Test run:** `npm --prefix web run test` passed on MoneyInput, Topbar, csps, csps.golden and owner-review (5 files, 449 tests).

## Warnings

### WR-01: Ctrl/Cmd+K inside any field, including the search box itself, goes to the browser and focus leaves the page

**File:** `web/src/ui/navigation/Topbar.tsx:58-72` (guard), `:143` (`aria-keyshortcuts`)

**Issue:** `isSearchShortcut` still applies the UI-WR-07 "inside a field" guard, which was written for a bare printable "/". With a modifier shortcut, nothing gets typed, so the guard no longer protects anything. It only stops `preventDefault`, and the browser's own Ctrl+K / Cmd+K then runs:
- Chrome and Edge on Windows/Linux: "search from the address bar" (focus jumps to the omnibox).
- Firefox: focuses the web search or address bar, Cmd+K on macOS too.

Failure scenarios:
- A staff member typing in any order form field presses the advertised "Ctrl K" and lands in the browser address bar.
- The input that declares `aria-keyshortcuts="Control+K Meta+K"` is itself an `INPUT` (`FIELD_TAGS`). Pressing the shortcut while the search box has focus throws focus out of the page, which is the opposite of what the attribute announces.
- The guard also matches non-text inputs (checkbox, radio, range: every `INPUT`).

The only legitimate in-field conflict is macOS Cocoa's Ctrl+K "kill to end of line" in text fields.

**Fix:** Inside text entry, still handle the platform's primary combo, and leave only Mac Ctrl+K to the field. When the target is the search input, keep focus and select its text:
```ts
const apple = APPLE_AGENT.test(navigator.userAgent);
const primary = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
if (inField && !primary) return false; // Mac Ctrl+K stays the field's kill-line
// in the handler: event.preventDefault(); input.focus(); input.select();
```
Update the Topbar tests "leaves Ctrl+K alone inside a %s" to match.

### WR-02: The refused-paste flag outlives the value it describes: a valid or reset field stays `aria-invalid` with an error

**File:** `web/src/ui/entry/MoneyInput.tsx:83-84, 101-107, 116-117`

**Issue:** `refused` is cleared only by an accepted keystroke or an accepted paste in this component. It is not cleared:
- by the blur padding (pinned by the test "keeps it through … the blur": `7` → `7.00` keeps `aria-invalid="true"`),
- by any change of `value` from outside: a form `reset()`, a programmatic set, a "balance due" auto-fill button, or a row reused after saving.

Failure scenario: the user pastes "abc" (hint shown), then clicks a "Pay full balance" button that sets `value="4327.50"`, or the form is reset after saving. The field now holds a valid or empty value but shows "Enter an amount like 1250.50…" in the error look with `aria-invalid="true"`. This contradicts Field's contract ("nothing is invalid until the caller passes an `error`"). A screen reader user who tabs back hears "invalid entry" on a correct amount. A submit handler that focuses the first `[aria-invalid="true"]` lands on it.

**Fix:** Tie the refusal to the value it refused. Any later value, whether typed, padded or set by the caller, then clears it automatically:
```ts
const [refusedAt, setRefusedAt] = useState<string | null>(null);
const refused = refusedAt !== null && refusedAt === value;
// refused paste: setRefusedAt(value); accepted change/paste: setRefusedAt(null)
```
If the hint must survive the blur padding, also compare against `padMoneyOnBlur(refusedAt)`.

### WR-03: A caller's `error=""` swallows the visible paste hint while the live region still announces it

**File:** `web/src/ui/entry/MoneyInput.tsx:116-117, 522-524` (diff), i.e. `const shownError = error ?? pasteHint;`

**Issue:**
- Field treats an empty string as "no error" (`Boolean(error)`).
- MoneyInput's `??` treats `""` as a caller error that "wins".

A caller that writes `error={fieldState.error?.message ?? ''}` or `error={submitted ? msg : ''}` (both common RHF/form patterns) breaks the R2-18 behavior: a refused paste shows nothing and sets no `aria-invalid`. Meanwhile the always-mounted `role="status"` still announces the hint, because it renders `pasteHint` regardless of `shownError`. Sighted users get no feedback, and screen-reader users hear a message that is not on screen. The same mismatch exists when a non-empty caller error wins: the status region announces the amount hint while the visible message and `aria-describedby` say something else.

**Fix:** `const shownError = error !== undefined && error !== '' ? error : pasteHint;` Then decide whether the status region should announce `shownError` (what is on screen) or the refusal. Either way, pin it with a test that uses `error=""`.

### WR-04: A read-only MoneyInput can be changed, or marked invalid, by a paste

**File:** `web/src/ui/entry/MoneyInput.tsx:94-107`

**Issue:** `readOnly` passes through `...rest` to the input. Browsers still dispatch `paste` to a focused read-only text input, where the default action does nothing. The handler, though, calls `event.preventDefault()` and then `onChange(next)` for an accepted paste, so the caller's state changes on a field the caller marked read-only. Since R2-18, a refused paste also flips the read-only field to `aria-invalid` with an error. The accepted-paste path predates this diff, but the rewrite kept it and added the refused path.

Failure scenario: a locked or paid order shows an amount as a read-only MoneyInput. Pasting into it changes the amount.

**Fix:** At the top of `paste`: `if (event.currentTarget.readOnly || event.currentTarget.disabled) return;`, placed before `preventDefault()`. Add a test with `readOnly`.

### WR-05: `contain: paint` makes the table frame the containing block for `position: fixed` content: in-row dialogs and toasts get trapped and clipped

**File:** `web/src/ui/lists/lists.recipe.ts:551` (`tableWrapClasses`, `contain-paint`), used by `ResponsiveTable.tsx:196`, `DataTable.tsx:86` and `SkeletonTable.tsx:44`

**Issue:** Paint containment, like `transform`, makes the element the containing block for fixed-position descendants, and clips them to its padding box.
- The project has no portals (no `createPortal` in `web/src`).
- `Overlay`, `Modal` and `ConfirmDialog` render in place with `fixed inset-0` (`overlays.recipe.ts:29, 34`).
- `ResponsiveTable` renders arbitrary `column.cell(row)` content inside the contained frame.

Failure scenario: the first row action that keeps its own `ConfirmDialog` or `Modal` state inside a cell (the Phase 3+ "Delete order" or "Delete user" pattern) renders its scrim and dialog inside the 680px sideways-scrolling table frame. The scrim covers only the table, the dialog is clipped and scrolls with the rows, and the rest of the page stays clickable. The focus trap then holds focus in a dialog the user may not even see. The same applies to any fixed tooltip, popover or toast placed in a cell. The owner ruled the `contain: paint` mechanism itself, so this is not a defect yet, but nothing guards the side effect.

**Fix:** Do one of these:
- Portal `Overlay`, `Modal` and `ConfirmDialog` (and fixed popovers) to `document.body`, or open them with `<dialog>.showModal()` (top layer, which escapes containment).
- Add a test or lint rule that forbids rendering an overlay inside a `tableWrapClasses` frame.

For the owner: `position: relative` on the frame would also contain the hidden "Actions" text (absolute positioning only) without trapping fixed descendants. It would need a D-08 ruling, because the frozen reference would also need the same rule.

## Info

### IN-01: A second refused paste is not announced again

**File:** `web/src/ui/entry/MoneyInput.tsx:105-107, 522-524`

**Issue:** `setRefused(true)` when the flag is already `true` changes nothing in the DOM, so the polite status region stays silent for the second and later refused pastes. This matters most after a blur-and-return, when the earlier announcement is long gone.

**Fix:** Clear the region, then set it on the next frame, or append a zero-width toggle so the text node changes on every refusal.

### IN-02: `beforeAfterSection` ignores the `decision` field and hard-codes the R2-06 prose

**File:** `web/scripts/owner-review.mjs:371-381` (diff: the note), `:359` (caption "After (the PRD wording)"), `BeforeAfterShot.decision` (never read)

**Issue:** `BEFORE_AFTER_CASES` is generic (each case carries `decision`), but the section's note, the money-specific wording and the "PRD wording" caption are fixed text. A future non-R2-06 case would be shown to the owner under the wrong explanation, and the owner approves from this page (D-08).

**Fix:** Render `decision` per case and move the explanation into the case data, or assert in a test that every case's `decision` is `D-41 (R2-06)`.

### IN-03: The case-id selector is escaped in one place only

**File:** `web/scripts/owner-review.mjs:487` (diff: `id.replaceAll('"', '\\"')`, backslashes not escaped) and `:569` (`page.locator(\`[data-case="${id}"]\`)`, not escaped at all)

**Issue:** The ids are constants today, so this is not exploitable. Still, the page script and the locator build the same selector two different ways, and neither handles `\`.

**Fix:** Use one helper, `[data-case=${JSON.stringify(id)}]`, which gives a valid CSS string because CSS and JSON escape `"` and `\` the same way, or `CSS.escape` in the page.

### IN-04: "Fully Paid" hides a negative balance (credit) that R2-07 says must be shown

**File:** `web/src/ui/money/OrderTotals.tsx:45-46`; the rule is in `src/Csps.Domain/Orders/OrderMath.cs:70` and `web/src/lib/csps.ts:410`

**Issue:** With `Subtotal > 0`, a discount above the subtotal or an overpayment gives `Balance < 0` and `fullyPaid = true`. The panel then shows "Fully Paid" instead of the figure. D-41 R2-07 (same ruling set) says such an order "shows the negative balance as credit / refund due". This is not in these tasks' scope, but the R2-06 change touched the exact predicate.

**Fix:** Track it for the phase that builds R2-07: a third balance state ("Credit" or "Refund due", with the absolute figure) when `balance < 0`.

### IN-05: The new list-search focus ring disappears in forced-colors mode

**File:** `web/src/ui/lists/lists.recipe.ts:571, 581` (`focus-within:border-focus` on the box, `[outline:none]` on the input); the same pattern is in `navigation.recipe.ts:160, 168`

**Issue:** In Windows High Contrast, author border colors are replaced and box-shadows dropped. With the outline removed, keyboard focus in the search box has no visible indicator there. The project has no `forced-colors` handling anywhere.

**Fix:** Use `[outline:2px_solid_transparent]` instead of `[outline:none]` (forced-colors mode paints the transparent outline in a system color), or add `forced-colors:focus-within:outline`.

### IN-06: The sidebar toggle states its state twice and names no controlled element

**File:** `web/src/ui/navigation/Sidebar.tsx:109-112`

**Issue:** The name changes ("Expand" / "Collapse sidebar") and `aria-expanded` now changes too, so screen readers say "Collapse sidebar, expanded". The ARIA APG disclosure pattern keeps a stable name when `aria-expanded` is used. There is also no `aria-controls`. The owner ruled only "add aria-expanded" (R2-12), so this is a polish note, not a defect.

**Fix:** Optionally use a stable name ("Sidebar") with `aria-expanded` and `aria-controls={navId}`, after an owner check because the spoken name would change.

---

_Reviewed: 2026-10-13T14:19:59-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
