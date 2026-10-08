---
phase: 02-web-foundation-design-system
plan: 12
subsystem: ui
tags: [react, forms, spec-gap, money-input, otp, checkbox, skip-link, a11y, axe, tdd]
created: "2026-10-08T03:16:00-05:00"
updated: "2026-10-08T03:16:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "Plan 04: toCentavos/centavosToAmount in csps.ts; plan 05: verbatim CSS, overrides.css D-01/D-03 rules, the spec-gaps.css layer shell; plan 09: reconciled @/ui (Field, PasswordField, Icon)"
provides:
  - "web/src/ui/gaps/MoneyInput.tsx: MoneyInput, normalizeMoneyOnBlur, validateMoneyInput (ORD-09)"
  - "web/src/ui/gaps/OtpInput.tsx: OtpInput, validateOtp (six boxes, paste, one-time-code)"
  - "web/src/ui/gaps/Checkbox.tsx: Checkbox (label.s-check, D-03 look)"
  - "web/src/ui/gaps/SkipLink.tsx: SkipLink (A11Y-02)"
  - "web/src/ui/gaps/copy.ts: MONEY_INPUT_COPY, OTP_INPUT_COPY, SKIP_LINK_COPY"
  - "spec-gaps.css SPEC-GAP blocks: MoneyInput (text-right), OtpInput, SkipLink (+ main[tabindex=-1]:focus)"
  - "web/src/ui/PasswordField.test.tsx: WEB-06 PasswordInput behaviour pinned"
affects: [02-13, 02-14, 02-15, 02-17, 02-18, phase 4 sign-in, phase 6 expenses, phase 7/8 orders]

actuals:
  tokens: 15572       # chars/4 over git diff 74a1cb4..c8b10c9 (62286 chars)
  tasks: 2
  commits: 4
plan_head_before: 74a1cb4dc18a6b51995addc38a2cec9743b1876c
plan_head_after: c8b10c94703ee31c21f7aaeee68fa43e15dcf2f2

tech-stack:
  added: []
  patterns:
    - "SPEC-GAP primitives live in web/src/ui/gaps/, compose only existing .csp-*/.s-* classes, take their strings from gaps/copy.ts and their CSS from one /* SPEC-GAP: <name> */ block in spec-gaps.css"
    - "Stylesheet assertions for SPEC-GAP blocks go in src/styles/overrides.test.ts (node-typed); Vitest stubs CSS imports, even with ?raw, so component tests cannot read CSS"
    - "A controlled input that must reject keystrokes simply does not call onChange; React restores the previous value"
    - "Explicit props instead of a ...rest spread where the React Compiler cache should hit (Checkbox), plus an equal-props re-render test per component"

key-files:
  created:
    - web/src/ui/gaps/copy.ts
    - web/src/ui/gaps/MoneyInput.tsx
    - web/src/ui/gaps/MoneyInput.test.tsx
    - web/src/ui/gaps/OtpInput.tsx
    - web/src/ui/gaps/OtpInput.test.tsx
    - web/src/ui/gaps/Checkbox.tsx
    - web/src/ui/gaps/Checkbox.test.tsx
    - web/src/ui/gaps/SkipLink.tsx
    - web/src/ui/gaps/SkipLink.test.tsx
    - web/src/ui/PasswordField.test.tsx
  modified:
    - web/src/styles/spec-gaps.css
    - web/src/styles/overrides.test.ts

key-decisions:
  - "MoneyInput strips commas and spaces from every change (typed or pasted), then keeps it only if it matches ^\\d{0,9}(\\.\\d{0,2})?$; a typed comma or space is therefore ignored. className goes on the .csp-field wrapper and the SPEC-GAP rule .csp-field.text-right .csp-input { text-align: right } makes item-row amounts follow it"
  - "OtpInput value format: one character per box, a space for an empty box, trailing spaces dropped ('12 4'); onChange gets that string, onComplete(code) fires each time an edit leaves all six boxes filled; validateOtp accepts only ^\\d{6}$"
  - "OtpInput Backspace: a filled box clears in place; an empty box moves back and clears that box (one press per digit). Delete clears; ArrowLeft/Right, Home and End move; letters and symbols are ignored; Ctrl/Meta/Alt shortcuts and Tab pass through"
  - "OtpInput also takes a direct value write (Android 'Unidentified' keys, one-time-code autofill) through the same fill as paste, and selects a box on focus so a new digit replaces the old one"
  - "OtpInput fieldset carries .csp-field too, so the verbatim .csp-field.is-invalid .csp-control rule colours every box; each .csp-control also gets .is-invalid as the plan specified. The legend gets padding-bottom var(--space-2) because a rendered legend sits outside the flex gap"
  - "Checkbox takes explicit props (label, checked, defaultChecked, name, value, disabled, onChange(checked), required, id, className, hint, error), no rest spread; hint/error render as .csp-msg after the label with aria-describedby"
  - "SkipLink always prevents the default; with no target it does nothing, so #main never reaches the URL"

patterns-established:
  - "Each SPEC-GAP component test covers the UI consideration 'empty, forms' (label, hint, required ' *', no aria-invalid before the caller passes an error) and runs expectNoAxeViolations in both the empty and error states"

requirements-completed: [WEB-06, ORD-09, PERF-03, A11Y-02]

coverage:
  - id: D1
    description: "MoneyInput: type text, inputmode decimal, autocomplete off, ₱ prefix; 9 integer digits and 2 decimals on typing and paste, grouping stripped, minus and letters ignored; blur padding; validateMoneyInput copy; toCentavos of the emitted string is exact"
    requirement: ORD-09
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/MoneyInput.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#MoneyInput: a caller text-right right-aligns the amount (item rows, App. E.9)"
        status: pass
    human_judgment: false
  - id: D2
    description: "OtpInput: fieldset/legend markup, six numeric one-digit boxes, one-time-code on box 1, keyboard movement, paste fill from the focused box, onComplete only at 6 digits, validateOtp copy, error state on every box, zero axe violations"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/OtpInput.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#OtpInput: a borderless fieldset with six 44-56px centred tabular boxes, 8px apart and 4px at 420px or less"
        status: pass
    human_judgment: false
  - id: D3
    description: "Checkbox: label.s-check around a native checkbox named by its label, toggled by click and Space, required/hint/error, zero axe violations"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/Checkbox.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "SkipLink: 'Skip to main content' with the primary md button classes, first focusable, focuses #main with no hash in the URL; hidden until :focus-visible then fixed top-left"
    requirement: A11Y-02
    verification:
      - kind: unit
        ref: "web/src/ui/gaps/SkipLink.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#SkipLink: hidden with the .csp-sr technique until :focus-visible, then fixed top-left above the page"
        status: pass
    human_judgment: false
  - id: D5
    description: "PasswordField (the WEB-06 PasswordInput): Show/Hide password toggle, Weak/Fair/Good/Strong, the empty hint, hint and error states with axe"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/PasswordField.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "Text-entry boxes stay at 16px or more on phones and SPEC-GAP CSS sets no type (PERF-03)"
    requirement: PERF-03
    verification:
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#keeps every text-entry box at 16px or more on phones: .csp-input is 16px and only D-01 touches the size"
        status: pass
      - kind: unit
        ref: "web/src/styles/overrides.test.ts#sets no font size, weight or line height: SPEC-GAP type comes from the reused spec classes"
        status: pass
    human_judgment: false
  - id: D7
    description: "How the new primitives look in a browser (OtpInput box row and legend spacing at 320/390 px, the skip link on focus, the checkbox, MoneyInput in item rows)"
    verification: []
    human_judgment: true
    rationale: "jsdom has no layout. The showcase (plan 14/15) renders these in Blush and Espresso for the D-23 owner screenshots and the Playwright overflow and focus checks."

duration: 24min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 12: SPEC-GAP Form Primitives (MoneyInput, OtpInput, Checkbox, SkipLink) Summary

*Created: 2026-10-08T03:16:00-05:00 · Updated: 2026-10-08T03:16:00-05:00*

**Four SPEC-GAP form primitives now exist under `web/src/ui/gaps/`:**

- **MoneyInput** keeps a valid 2-decimal amount on the decimal keypad and converts only through `toCentavos`.
- **OtpInput** has six code boxes with paste and `one-time-code` autofill.
- **Checkbox** is a native checkbox in `label.s-check`, with the D-03 look.
- **SkipLink** focuses `#main` without changing the URL.

Their strings live in one copy module and their styles in three token-only `spec-gaps.css` blocks. 104 unit tests cover the components and PasswordField, all with zero axe violations.

## Performance

- **Duration:** 24 min
- **Started:** 2026-10-08T07:51:04Z
- **Completed:** 2026-10-08T08:15:33Z
- **Tasks:** 2 of 2
- **Files modified:** 12 (10 created, 2 modified)

## Accomplishments

- **MoneyInput (ORD-09, Task 1, tracer).** It is `Field` with `prefix="₱"`, `type="text"`, `inputMode="decimal"` and `autoComplete="off"`.
  - A change is kept only if it still matches `^\d{0,9}(\.\d{0,2})?$` after commas and spaces are stripped. So a 10th integer digit, a 3rd decimal, a minus sign or a letter is ignored. A paste of "1,250.50", "1 250.50" or a no-break-space variant becomes "1250.50", and a paste of "12.345" leaves the value as it was.
  - `normalizeMoneyOnBlur` pads "5000" → "5000.00", "5." → "5.00" and ".5" → "0.50". "." and "" become empty.
  - `validateMoneyInput` returns the UI-SPEC copy.
  - The test converts the emitted string with `toCentavos` and gets 125050n.
- **OtpInput (WEB-06, T-02-34).**
  - **Markup:** a borderless `fieldset.csp-field.csp-otp` with a `.csp-label` legend and six `.csp-control > input.csp-input` boxes. Each box has `inputmode="numeric"`, `pattern="[0-9]*"`, `maxlength="1"` and the name "Digit i of 6". Only box 1 has `autocomplete="one-time-code"`.
  - **Keys:** typing advances, Backspace moves back from an empty box, and the arrows, Home and End move between boxes. Non-digits are ignored.
  - **Paste:** it fills from the focused box and focuses the next empty box, or the last one. Paste is always allowed.
  - **Completion:** `onComplete` fires only once all six boxes are filled. `validateOtp` returns "Enter all 6 digits." for 1-5 digits.
  - **Error state:** `.is-invalid` goes on every box, and every input gets `aria-invalid`.
- **Checkbox (WEB-06, D-03).** A `label.s-check` wraps a native checkbox, so the label text is the accessible name and a click on the label toggles it. It supports a required marker, a hint and a caller error. Its look is the existing D-03 rule in overrides.css.
- **SkipLink (A11Y-02).** It is an anchor with `csp-btn csp-btn-primary csp-btn-md csp-skip-link` and the text "Skip to main content", and it is the first focusable element. Activating it focuses the target and prevents the default, so `window.location.hash` stays empty.
- **PasswordField (WEB-06 PasswordInput).** New tests pin the existing behaviour: the "Show password"/"Hide password" toggle and input type, Weak/Fair/Good/Strong for sample passwords, the empty hint "Use 8+ characters with a number and a symbol", and the hint and error states with axe.
- **spec-gaps.css.** Three blocks, each opening with `/* SPEC-GAP: <name> */`, inside `@layer components`, with tokens only and no type values:
  - **MoneyInput:** `.csp-field.text-right .csp-input` right-aligns item-row amounts.
  - **OtpInput:** boxes are `flex: 1 1 0`, 44-56px wide, centred and tabular, with gap `--space-2`, or `--space-1` inside `@container pg (max-width: 420px)`.
  - **SkipLink:** hidden with the `.csp-sr` technique (padding and border dropped) until `:focus-visible`, then `position: fixed` at `--space-2`/`--space-2` with `z-index: var(--z-toast)`. The block also holds `main[tabindex='-1']:focus { outline: none; }`.
- **CSS tests in overrides.test.ts.** They assert each block's rules sit inside their own block. They also check that spec-gaps.css never sets `font`, `font-size`, `font-weight` or `line-height`, and that text-entry boxes stay at 16px or more on phones (PERF-03).

## Task Commits

1. **Task 1: Tracer, MoneyInput**
   - `8ad0826` test: failing MoneyInput tests, the SPEC-GAP CSS tests, copy.ts and a RED placeholder (RED)
   - `626459e` feat: MoneyInput, normalizeMoneyOnBlur, validateMoneyInput, the SPEC-GAP MoneyInput block (GREEN)
2. **Task 2: OtpInput, Checkbox, SkipLink and PasswordField tests**
   - `6e1fb95` test: failing OtpInput, Checkbox and SkipLink tests, PasswordField characterization tests, the OtpInput/SkipLink CSS tests, copy and RED placeholders (RED)
   - `c8b10c9` feat: OtpInput, Checkbox, SkipLink and the OtpInput/SkipLink spec-gaps.css blocks (GREEN)

**Tracer gate (Task 1):** the run is interactive, the mode is `end-of-phase`, and the `<verify>` is automated-only. So `npm --prefix web run test -- --run src/ui/gaps/MoneyInput.test.tsx` was re-run against the committed code: 44 passed, exit 0. Expansion then continued with no checkpoint.

## TDD Gate Compliance (RED evidence)

| Cycle | RED run | Failing target (assertion) | Checker |
|---|---|---|---|
| T1 MoneyInput | `npm --prefix web run test -- --run src/ui/gaps/MoneyInput.test.tsx src/styles/overrides.test.ts`, exit 1, 29 of 69 failed | `expect(element).toHaveAttribute("type", "text")`, `toHaveValue("1250.50")` (the placeholder passed every change through), `expected null to be 125050n`, normalizeMoneyOnBlur and validateMoneyInput copy; the text-right CSS rule missing | RED_EVIDENCE_OK (`p12/t1-red.json`) |
| T2 OtpInput | `npm --prefix web run test -- --run src/ui/gaps src/ui/PasswordField.test.tsx src/styles/overrides.test.ts`, exit 1, 47 of 131 failed | Every OtpInput case: bare uncontrolled inputs with no attributes or handlers, and validateOtp returned null | RED_EVIDENCE_OK (`p12/t2-red-otp.json`) |
| T2 Checkbox | same run | The placeholder names the box "Checkbox" and wires no state | RED_EVIDENCE_OK (`p12/t2-red-checkbox.json`) |
| T2 SkipLink | same run | The placeholder link reads "Skip", has no classes and no handler | RED_EVIDENCE_OK (`p12/t2-red-skiplink.json`) |

Each `test(02-12)` commit comes before its `feat(02-12)` commit. **The PasswordField tests passed in RED, and that is expected.** They are characterization tests of the existing App. D.3 component, which plan 09 reconciled and proved DOM-equal to the frozen reference. The plan asks only to prove it, and no implementation was written for it. In the same way, the two "16px / no SPEC-GAP type" CSS tests characterize existing CSS and passed in RED.

## Files Created/Modified

- `web/src/ui/gaps/copy.ts`: the MoneyInput, OtpInput and SkipLink strings. Checkbox has no copy of its own, because the caller passes the label. Plan 13 adds the data-primitive strings.
- `web/src/ui/gaps/MoneyInput.tsx` (+ test): `MoneyInput`, `normalizeMoneyOnBlur`, `validateMoneyInput`.
- `web/src/ui/gaps/OtpInput.tsx` (+ test): `OtpInput`, `validateOtp`.
- `web/src/ui/gaps/Checkbox.tsx` (+ test): `Checkbox`.
- `web/src/ui/gaps/SkipLink.tsx` (+ test): `SkipLink` (`targetId` defaults to `main`).
- `web/src/ui/PasswordField.test.tsx`: the WEB-06 PasswordInput tests.
- `web/src/styles/spec-gaps.css`: the SPEC-GAP MoneyInput, OtpInput and SkipLink blocks.
- `web/src/styles/overrides.test.ts`: the `spec-gaps.css SPEC-GAP primitives` describe block and its block-aware rule helper.

## Decisions Made

See `key-decisions` in the frontmatter. These are behaviour and SPEC-GAP layout details inside the UI-SPEC contract. None of them changes verbatim spec markup or uses a deferred owner ruling (D-31/D-32, O-1..O-8, the icon swaps), so no D-08 stop was needed. The visual result, such as the OtpInput legend spacing and the box row at 320px, goes to the owner in the D-23 showcase screenshots (plans 14/15).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The CSS assertions moved to `src/styles/overrides.test.ts`**
- **Found during:** Task 1 (RED)
- **Issue:** Vitest stubs CSS imports, so `import css from '@/styles/spec-gaps.css?raw'` gave `''` and the component test could not read the stylesheet. The app tsconfig has no Node types for `fs`.
- **Fix:** The SPEC-GAP block checks (no type values, 16px boxes, text-right, OtpInput sizes and gaps, SkipLink hiding and position) are in the existing node-typed stylesheet test. It now has a helper that also proves each rule sits in its own `/* SPEC-GAP: <name> */` block. That file is not in the plan's `files_modified` list.
- **Files modified:** web/src/styles/overrides.test.ts
- **Committed in:** 8ad0826, 6e1fb95, c8b10c9

**2. [Rule 2 - Missing critical] OtpInput and Checkbox got `required`, hint and error support**
- **Found during:** Task 2
- **Issue:** The truth "An unfilled MoneyInput, OtpInput or Checkbox … marks required fields with ' *', and shows no error or aria-invalid until the caller passes an error" needs these props. The plan's prop sketch did not list them for Checkbox, and did not list `required` for OtpInput.
- **Fix:** The legend or label carries a `span.csp-req` " *" marked `aria-hidden`, so it stays out of the accessible name, and the native `required` attribute is set. The hint or error goes in `.csp-msg` / `.csp-msg-error` with `aria-describedby`, and `aria-invalid` is set only with an error.
- **Committed in:** c8b10c9

**3. [Rule 2 - Missing critical] OtpInput accepts direct value writes and selects a box on focus**
- **Found during:** Task 2
- **Issue:** The plan says keys are handled through `event.key`. Android virtual keyboards report `key: "Unidentified"`, and one-time-code autofill writes the value without key events. With `maxLength=1`, a filled box would also refuse a new digit.
- **Fix:** `onChange` sends any digits written directly through the same fill as paste, and clears the box when its value is erased. Focus selects the box contents. Tests cover both.
- **Committed in:** c8b10c9

**4. [Plan wording] Checkbox props are explicit, and `onChange` reports the boolean**
- **Issue:** A `...rest` spread kept the React Compiler cache from ever hitting (Checkbox branch coverage was 83.7%).
- **Fix:** The props are explicit: label, checked, defaultChecked, name, value, disabled, onChange(checked), required, id, className, hint and error. Equal-props re-render tests were added for all four components. `ui/gaps` is at 97.83% statements, 96.01% branches, and 100% functions and lines.
- **Committed in:** c8b10c9

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical), plus 1 plan-wording adjustment.
**Impact on plan:** No new package, no verbatim CSS or spec file was edited, no overrides.css rule was added, and no owner ruling was assumed.

## Issues Encountered

- React Compiler memo branches on components that spread `...rest` (MoneyInput, which passes input attributes through to Field) can never hit the cache. MoneyInput keeps the spread because callers need `placeholder`, `name`, `disabled` and the rest. It is at 93.02% branches, above the 90% gate.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 13 (data primitives) can add its strings to `gaps/copy.ts` and its blocks to `spec-gaps.css` with the same test helper.
- The layouts (plan 14/15) should render `<SkipLink />` first and `<main id="main" tabIndex={-1}>`. The showcase should show MoneyInput, OtpInput, Checkbox and PasswordField in both themes.
- Still blocked: 02-11 and its dependents wait on D-BL-03 (the owner rulings). This plan used none of them.
- The license gate still exits 1 on exactly the 5 D-BL-01 dev-tree packages. No new failures and no exceptions were added.

## Verification

- `npm --prefix web run test -- --run src/ui/gaps/MoneyInput.test.tsx`: 44 passed, exit 0 (Task 1 verify and tracer re-run).
- `npm --prefix web run test -- --run src/ui/gaps src/ui/PasswordField.test.tsx`: 5 files, 104 passed, exit 0 (Task 2 and plan verification).
- `npm --prefix web run verify`: exit 0. Typecheck, lint (0 warnings), Prettier, 38 files and 1139 tests, then the build with no warnings. Coverage is 97.78% statements, 95.05% branches, 100% functions and 99.77% lines, with lib/http, lib/url-state, lib/query and lib/forms still at 100%.
- Acceptance greps: `grep -c "inputMode=\"decimal\"\|inputMode: 'decimal'" web/src/ui/gaps/MoneyInput.tsx` = 1. `grep -c "SPEC-GAP: OtpInput\|SPEC-GAP: SkipLink" web/src/styles/spec-gaps.css` = 2. The overrides no-hex test passes.
- `npm --prefix web run e2e -- --grep "@smoke|@fixture"` (after preflight): 25 passed.
- `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`: 839/839 passed, 0 warnings.
- `node web/scripts/license-gate.mjs`: exit 1 on exactly the 5 known D-BL-01 packages (expected).
- No dev server or background process is left running. The final preflight shows the ports free and no processes.

## Self-Check: PASSED

- All 10 created files and 2 modified files exist on disk.
- Commits 8ad0826, 626459e, 6e1fb95 and c8b10c9 exist, and `git rev-list --count 74a1cb4..c8b10c9` = 4.
- No stubs remain: there is no "RED placeholder", TODO or FIXME in `web/src/ui/gaps` or spec-gaps.css.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*
