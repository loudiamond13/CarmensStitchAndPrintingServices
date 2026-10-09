---
phase: 02-web-foundation-design-system
plan: 27
subsystem: ui
tags: [entry, money-input, otp-input, checkbox, skip-link, spec-gap, d-03, d-33, ord-09, a11y-02, perf-03, tailwind, parity, axe, csp, tdd]
created: "2026-10-08T23:04:00-05:00"
updated: "2026-10-08T23:04:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-08)
    provides: "isMoneyText, normalizePastedMoney, padMoneyOnBlur, moneyTextToCentavos in web/src/lib/format.ts"
  - phase: 02-web-foundation-design-system (plan 02-17)
    provides: "buttonClasses (the primary md look SkipLink reuses), the parity harness settle and timeout rules"
  - phase: 02-web-foundation-design-system (plan 02-20)
    provides: "Field and the shared field recipe (fieldClasses, labelClasses, requiredClasses, fieldControlClasses, fieldInputClasses, messageClasses)"
provides:
  - "@/ui/entry: MoneyInput + MoneyInputProps + moneyInputError, OtpInput + OtpInputProps + otpInputError, Checkbox + CheckboxProps, SkipLink + SkipLinkProps, ENTRY_COPY"
  - "web/src/ui/entry/entry.recipe.ts: moneyAlignRightClasses, otp* looks, check* looks (D-03), skipLinkClasses"
  - "entry scenario group (9 cases, all parity: false) and the dev-only FocusedSkipLink wrapper"
affects: [02-29, 02-31, 02-35, 02-36, showcase, phase-4-sign-in, phase-6-company-expenses, phase-8-order-form]

actuals:
  tokens: 18700    # chars/4 over the realized diff (74,650 chars, 13 files)
  tasks: 2
  commits: 4
plan_head_before: dc48b1b0e2b14e2ef1e885c8cf17c4329c00c027
plan_head_after: ff8bb9696f1c339b867e730dd56eaef91a45c6c8

tech-stack:
  added: []
  patterns:
    - "SPEC-GAP primitives compose the shared recipes and add only their own few looks in an entry.recipe.ts"
    - "A look that must switch on a state the element itself has (SkipLink hidden until :focus-visible) is the shared constant's tokens under a not-focus-visible: variant, pinned by a test that derives them from the constant"
    - "Checkbox tick as an aria-hidden peer-checked sibling sharing the input's grid cell (no absolute positioning)"
    - "Implementation-only parity cases that need a state the harness cannot drive use a dev-only preview with no reference fragment"

key-files:
  created:
    - web/src/ui/entry/copy.ts
    - web/src/ui/entry/entry.recipe.ts
    - web/src/ui/entry/MoneyInput.tsx
    - web/src/ui/entry/MoneyInput.test.tsx
    - web/src/ui/entry/OtpInput.tsx
    - web/src/ui/entry/OtpInput.test.tsx
    - web/src/ui/entry/Checkbox.tsx
    - web/src/ui/entry/SkipLink.tsx
    - web/src/ui/entry/entry.test.tsx
    - web/src/ui/entry/index.ts
    - web/src/dev/scenarios/groups/entry.ts
    - web/src/dev/previews/FocusedSkipLink.tsx
  modified:
    - docs/web/parity.md

key-decisions:
  - "Checkbox tick stays the planned peer-checked aria-hidden sibling span (A12): a scratch three-engine check found it pixel-identical (0 differing pixels in a 24x24 clip) to the 74621f5 input:checked::before tick in Chromium, Firefox and WebKit, both themes, and a 1px shift of the reference gave 55-58 differing pixels, so checked:before: was not needed"
  - "SkipLink hides with srOnlyClasses' tokens under not-focus-visible: (plus not-focus-visible:p-0 and border-0 so the button box really is 1px), because a shared constant cannot be put under a variant at run time; the test derives the expected tokens from srOnlyClasses"
  - "MoneyInput filters keystrokes in onChange (the controlled value puts the box back), not a beforeinput listener; a paste goes in at the caret or over the selection after normalizePastedMoney and is ignored if the result breaks the pattern"
  - "MoneyInput align=\"right\" reaches the box through Field's wrapper with [&_input]:text-right, as the reference's .csp-field.text-right .csp-input did; Field gets no new prop"
  - "OtpInput Backspace in an empty box moves back AND clears that box (the 74621f5 reference behaviour, D-37)"
  - "moneyInputError and otpInputError are exported next to the components so screens map values to the Copywriting strings in one place"

patterns-established:
  - "Entry primitives: value stays text; the caller validates on submit (moneyInputError / otpInputError) and passes `error`, which sets aria-invalid and the message"

requirements-completed: [WEB-06, ORD-09, A11Y-02, PERF-03]

coverage:
  - id: D1
    description: "MoneyInput: ₱-prefixed Field, type text, inputMode decimal, autocomplete off; 9th integer digit kept and 10th ignored, 2nd decimal kept and 3rd ignored, minus (ASCII and U+2212) and non-ASCII digits rejected, paste strips commas and spaces, blur pads ('5000' → '5000.00', empty stays empty), no grouping while editing, pasted '12,450.5' → '12450.50' → 1245050 centavos, Copywriting errors, align right, 16px text, axe clean"
    requirement: "ORD-09"
    verification:
      - kind: unit
        ref: "web/src/ui/entry/MoneyInput.test.tsx (41 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "OtpInput: fieldset + label-look legend, six numeric one-digit boxes named 'Digit i of 6', first box with one-time-code autocomplete, typing advances, Backspace/Delete/arrows/Home/End, paste and direct-input fill from the focused box, ASCII digits only, onComplete once when all six are filled, 'Enter all 6 digits.' on a 4-digit submit with every box invalid, axe clean"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/entry/OtpInput.test.tsx (27 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Checkbox: label text is the accessible name and toggles the native box; D-03 look (20×20, 2px --ink border, --surface-2, --accent when checked) and an aria-hidden 10×5px --on-accent tick equal to the 74621f5 reference geometry in three engines"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/entry/entry.test.tsx#Checkbox (10 tests)"
        status: pass
      - kind: other
        ref: "scratch tick-geometry check: 0 differing pixels vs the 74621f5 ::before tick, chromium/firefox/webkit × light/dark; mutation (1px) caught"
        status: pass
    human_judgment: false
  - id: D4
    description: "SkipLink: 'Skip to main content', primary md button look, visually hidden until keyboard focus then fixed top-left at --z-toast, first Tab stop, Enter or click focuses #main and the URL never gains #main"
    requirement: "A11Y-02"
    verification:
      - kind: unit
        ref: "web/src/ui/entry/entry.test.tsx#SkipLink (7 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every entry scenario (9, parity: false) loads with zero axe and CSP/console findings in Chromium, Firefox and WebKit"
    requirement: "PERF-03"
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @entry (16 passed)"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0: 77 files, 2000 tests, coverage 99.01/97.85/100/99.9)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The SPEC-GAP entry primitives look right to the owner (no reference exists to compare against)"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC: SPEC-GAP primitives are reviewed by the owner in the D-23 screenshots; no approved design exists to compare them with automatically"

duration: 19min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 27: Entry Primitives (MoneyInput, OtpInput, Checkbox, SkipLink) Summary

**Four SPEC-GAP entry primitives built in utilities on the shared recipes:**
- **MoneyInput** keeps exactly what staff type: ASCII digits, up to 9 integer digits and 2 decimals. It cleans pasted grouping and pads to 2 decimals on blur, so a pasted "12,450.5" becomes "12450.50", which is exactly 1245050 centavos.
- **OtpInput** is six keyboard- and paste-friendly code boxes.
- **Checkbox** has the D-03 tick, pixel-identical to the reference geometry in all three engines.
- **SkipLink** focuses `#main` without touching the URL.

**All nine entry scenarios pass axe and the CSP guard in Chromium, Firefox and WebKit.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-09T03:43:44Z
- **Completed:** 2026-10-09T04:02:48Z
- **Tasks:** 2 of 2
- **Files modified:** 13 (12 created, 1 modified)

## Accomplishments

- **MoneyInput (ORD-09).** Field with the ₱ prefix, `type="text"`, `inputMode="decimal"`, `autoComplete="off"`.
  - Keystrokes are filtered through `isMoneyText`. Pastes go through `normalizePastedMoney` and land at the caret or over the selection. Blur goes through `padMoneyOnBlur`.
  - `moneyInputError(value, { required })` returns the Copywriting strings.
  - `align="right"` serves item rows. The text is 16px with tabular figures.
- **OtpInput (WEB-06, A11Y-02).**
  - A borderless fieldset whose legend uses the label recipe.
  - Six field-control boxes: `flex-[1_1_0] min-w-11 max-w-14`, gap 8px, and 4px when the page is 420px or narrower.
  - Each digit input is 16px, centred, with tabular figures. `autocomplete="one-time-code"` is on the first box only.
  - Digit keys advance. Backspace, Delete, ←/→, Home and End work. Pasted or directly written digits fill from the focused box. Only ASCII digits count.
  - `onComplete` fires when all six boxes are filled. `otpInputError` returns "Enter all 6 digits.".
- **Checkbox (D-03).**
  - An `.s-check` label wraps the native box, so the label text is its name.
  - The box is `appearance-none size-5 border-2 border-ink rounded-xs bg-surface-2 checked:bg-accent` and keeps the 2px focus ring.
  - The tick is an `aria-hidden` sibling span (10×5px, 2px bottom and left `--on-accent` borders, `-mt-[3px]`, `-rotate-45`) in the same grid cell, shown by `peer-checked:block`.
  - Hint and error are wired with `aria-describedby` and `aria-invalid`.
- **SkipLink (A11Y-02).**
  - `buttonClasses({ variant: 'primary', size: 'md' })`, with the `.csp-sr` tokens under `not-focus-visible:`.
  - With keyboard focus it is fixed at top 8px and left 8px, at `z-(--z-toast)`.
  - Activating it calls `preventDefault()` and focuses `#main`.
- **Entry scenario group.** Nine cases, all `parity: false`: `money-input-empty|filled|error|right`, `otp-empty|error`, `checkbox-unchecked|checked` and `skip-link-focused`. The last one goes through the dev-only `FocusedSkipLink` wrapper.

## Task Commits

1. **Task 1 (tracer): MoneyInput**
   - RED `85c1b62`: 31 of 40 tests failed against an inert stub (`RED_EVIDENCE_OK`, target `src/ui/entry/MoneyInput.test.tsx`).
   - GREEN `0beb96c`: 41/41 passed.
   - Tracer gate: the run is interactive (`auto_advance` false), the mode is `end-of-phase`, and the verify is automated only. I re-ran the verify after the GREEN commit (41/41 passed) and then started Task 2. No checkpoint was needed.
2. **Task 2: OtpInput, Checkbox and SkipLink**
   - RED `f54a9c3`:
     - `OtpInput.test.tsx`: 25 of 27 failed (`RED_EVIDENCE_OK`).
     - `entry.test.tsx`: 14 of 20 failed (`RED_EVIDENCE_OK`).
   - GREEN `ff8bb96`:
     - 88/88 entry tests passed.
     - parity `@entry`: 16 passed in three engines.
     - The tick geometry check passed.
     - `verify` exited 0.

**Plan metadata:** recorded in the docs(02-27) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/entry/copy.ts`: `ENTRY_COPY` (money, otp, skipLink strings)
- `web/src/ui/entry/entry.recipe.ts`: the only new looks (money align, OTP row, box and digit, the `.s-check` label, the D-03 box and tick, SkipLink visibility)
- `web/src/ui/entry/MoneyInput.tsx`, `OtpInput.tsx`, `Checkbox.tsx`, `SkipLink.tsx`, `index.ts`
- `web/src/ui/entry/MoneyInput.test.tsx` (41), `OtpInput.test.tsx` (27), `entry.test.tsx` (20)
- `web/src/dev/scenarios/groups/entry.ts`: 9 implementation-only scenarios
- `web/src/dev/previews/FocusedSkipLink.tsx`: focuses the skip link after mount and renders the `main#main` target
- `docs/web/parity.md`: the FocusedSkipLink wrapper (§5)

## Decisions Made

See `key-decisions` in the frontmatter. These matter most to later plans:

- **Layouts (02-29 / 02-31):** render `<SkipLink />` as the first focusable element and `<main id="main" tabIndex={-1}>`. `base.css` already removes the focus outline from `main[tabindex="-1"]`.
- **Sign-in (Phase 4):** `<OtpInput onChange={setCode} onComplete={...} error={submitted ? otpInputError(code) ?? undefined : undefined} />`. Phase 4 owns the final copy. The current copy is the showcase example.
- **Money forms (Phase 6/8):** keep the field's value as text. On submit, call `moneyInputError(value, { required })`, and only when that returns null call `moneyTextToCentavos(value)`. Item rows pass `align="right"`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A recipe file for the new looks (`entry.recipe.ts`)**
- **Found during:** Task 1
- **Issue:** The plan's file list has no recipe module. Class strings must be complete `tw()` literals that the class gate and lint can read.
- **Fix:** Added `web/src/ui/entry/entry.recipe.ts`. It holds only class lists.
- **Committed in:** `85c1b62`, `ff8bb96`

**2. [Rule 3 - Blocking] SkipLink hiding cannot reuse the `srOnlyClasses` string as-is**
- **Found during:** Task 2
- **Issue:** The look has to switch with the link's own `:focus-visible`. A shared constant cannot be prefixed with a variant at run time (Tailwind would generate no CSS for it). Applied without a variant, `h-px` and `w-px` would fight the button's `h-11` and padding.
- **Fix:** `skipLinkClasses` holds the same `.csp-sr` tokens under `not-focus-visible:`, plus `p-0` and `border-0` as the reference rule had. The test builds the expected tokens from `srOnlyClasses`, so a change to the shared constant fails the test.
- **Committed in:** `f54a9c3` (test), `ff8bb96`

**3. [Rule 2 - Missing critical] The `FocusedSkipLink` dev-only preview**
- **Found during:** Task 2
- **Issue:** A hidden skip link cannot show its focused look in a `parity: false` case, because the harness never drives states there. The scenario also needs a real `#main` target.
- **Fix:** A preview that focuses the link once after mount and renders `main#main`. It is documented in parity.md §5. There is no reference fragment, because SPEC-GAP has no reference.
- **Committed in:** `f54a9c3`, `ff8bb96`

**4. [Rule 2 - Missing critical] Validation helpers `moneyInputError` and `otpInputError`**
- **Found during:** Task 1 and Task 2
- **Issue:** The must-haves need the Copywriting errors for an empty or invalid amount and for a partial code. The components only display an error the caller passes.
- **Fix:** Both helpers are exported next to the components.
- **Committed in:** `0beb96c`, `ff8bb96`

### Plan-text adjustments (no behaviour impact)

- MoneyInput filters keystrokes in `onChange` (the controlled value resets the box). There is no separate `beforeinput` listener; the result is the same.
- The D-33 tick proof was a scratch Playwright script, so the repo gained no extra spec file. It compared the 24×24 area around the checked box with a page carrying the verbatim 74621f5 `input:checked::before` rules, at the same coordinates and with the same token colours. The result was 0 differing pixels in all 6 engine/theme runs. A 1px mutation was caught (55–58 pixels).

---

**Total deviations:** 4 auto-fixed (2 Rule 3, 2 Rule 2), plus 2 plan-text adjustments.
**Impact on plan:** Every must-have is proven by unit tests, the three-engine parity run and the tick check. No package changed, no lint rule was disabled, and no tolerance was added.

## Issues Encountered

- Coverage: MoneyInput has two React Compiler cache branches from the `{...rest}` passthrough, and OtpInput has two. These are unreachable (L-13). The global coverage is 99.01 / 97.85 / 100 / 99.9.
- In jsdom, a skip link without `preventDefault` puts `#main` in `location.hash`, and the hash persists across the tests in a file. The RED stub showed this. GREEN never sets the hash, and the tests assert that.

## TDD Gate Compliance

- Task 1: RED `85c1b62`, then GREEN `0beb96c` (`RED_EVIDENCE_OK`, `src/ui/entry/MoneyInput.test.tsx`).
- Task 2: RED `f54a9c3`, then GREEN `ff8bb96` (`RED_EVIDENCE_OK` for `src/ui/entry/OtpInput.test.tsx` and `src/ui/entry/entry.test.tsx`).
- The scenario data was committed with the stubs. No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

The gate did not fire. No package was installed, upgraded or re-resolved.

## Threat Mitigations

- **T-02-60 (CWE-20):** MONEY_TEXT allow-list, ASCII digits only, and exact centavo conversion through `moneyTextToCentavos`. Tests reject the minus sign, U+2212, full-width digits and Arabic-Indic digits.
- **T-02-61:** `autocomplete="one-time-code"` is on the first box only (tested). Paste is allowed. Codes are never logged.
- **T-02-SC:** No installs.

## Known Stubs

None. The "Page content" paragraph in the dev-only `FocusedSkipLink` preview is intentional scenario content and is never shipped.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- `@/ui/entry` is ready for the layouts (SkipLink), the showcase (all nine cases), sign-in (OtpInput, Checkbox) and the money forms (MoneyInput).
- `requirements.ready-ids` reports only ORD-09 as ready. WEB-06, A11Y-02 and PERF-03 are also declared by unfinished sibling plans, so only ORD-09 is ticked in REQUIREMENTS.md.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 12 created files and 1 modified file exist on disk.
- Commits `85c1b62`, `0beb96c`, `f54a9c3` and `ff8bb96` are on `gsd/phase-2-web-foundation-design-system`.
- Acceptance checks:
  - `grep -c "SPEC-GAP" MoneyInput.tsx` = 1 (at least 1 required).
  - `grep -c 'inputMode="decimal"' MoneyInput.tsx` = 1.
  - `grep -c "one-time-code" OtpInput.tsx` = 1.
  - `grep -c "Skip to main content" copy.ts` = 1.
- Verification:
  - `npm --prefix web run test -- --run src/ui/entry`: 88/88.
  - `npm --prefix web run parity -- --grep @entry`: 16 passed, after a preflight that showed every port free.
  - `npm --prefix web run verify`: exit 0.
