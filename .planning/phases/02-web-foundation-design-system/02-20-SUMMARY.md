---
phase: 02-web-foundation-design-system
plan: 20
subsystem: ui
tags: [forms, field, password, select, tailwind, d-33, d-01, d-02, fyi-01, parity, wcag, aria-invalid, aria-describedby, tdd, web-02, web-06, perf-03]
created: "2026-10-08T18:16:00-05:00"
updated: "2026-10-08T18:16:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-14)
    provides: "the live parity harness, kit discovery by export name, the scenario groups and wrapper-pair hooks"
  - phase: 02-web-foundation-design-system (plan 02-18)
    provides: "Icon (triangle-alert, eye, eye-off, chevron-down) and the wrapper-pair convention"
  - phase: 02-web-foundation-design-system (plan 02-07)
    provides: "passwordStrength and StrengthScore in web/src/lib/csps.ts"
provides:
  - "web/src/ui/forms/field.recipe.ts: fieldClasses, labelClasses, requiredClasses, fieldControlClasses, fieldInputClasses({ multiline, prefix, suffix, select }), prefixClasses, suffixButtonClasses, selectChevronClasses, selectOptionClasses, messageClasses({ error }), strengthClasses, strengthBarsClasses, strengthBarClasses(score, on), strengthLabelClasses(score)"
  - "Field (Input/TextArea), PasswordField (WEB-06 PasswordInput), Select (+ FieldProps, PasswordFieldProps, SelectOption, SelectProps) from @/ui/forms"
  - "Region looks through data-ui markers: data-ui=\"s-toolbar\" (field flex basis, 12/16 muted label, 40px 14px box, 16px on phones) and data-ui=\"s-item\" (40px 14px box, 16px on phones)"
  - "forms parity group (17 cases) and the RevealPassword dev-only wrapper pair"
affects: [02-21, 02-22, 02-23, 02-24, 02-25, 02-28, 02-30, moneyinput, otpinput, filterbar, searchbox, phase-4-login, phase-8-order-form]

actuals:
  tokens: 20200    # chars/4 over the realized diff (80,705 chars, 13 files)
  tasks: 2
  commits: 4
plan_head_before: 294497e746d6fe9b92a885c42708d2168fecaa74
plan_head_after: a49fa1fa20445d73fca7b72b71fc97134614199b

tech-stack:
  added: []
  patterns:
    - "Context looks from data-ui markers (in-data-[ui=s-toolbar]:, in-data-[ui=s-item]:) with pg-phone: stacked for D-01; a node test reads the compiled CSS to prove the rule order (16px, then region 14px, then phone 16px)"
    - "Invalid look keyed off the box's own aria-invalid via has-aria-invalid: on the control box"
    - "Recipe options as booleans, never string literals (every string in a *.recipe.ts is a class token)"
    - "Score-keyed recipe maps (satisfies Record<StrengthScore, string>) for the strength bars and label"

key-files:
  created:
    - web/src/ui/forms/field.recipe.ts
    - web/src/ui/forms/field.recipe.node.test.ts
    - web/src/ui/forms/Field.tsx
    - web/src/ui/forms/Field.test.tsx
    - web/src/ui/forms/PasswordField.tsx
    - web/src/ui/forms/PasswordField.test.tsx
    - web/src/ui/forms/Select.tsx
    - web/src/ui/forms/Select.test.tsx
    - web/src/ui/forms/index.ts
    - web/src/dev/scenarios/groups/forms.ts
    - web/src/dev/previews/RevealPassword.tsx
    - web/visual/reference/fragments/RevealPassword.tsx
  modified:
    - docs/web/parity.md

key-decisions:
  - "The region looks use the data-ui marker (in-data-[ui=s-toolbar|s-item]:), as the plan says, not the UI-SPEC's alternative `density` prop; FilterBar (02-30) and the order form only add the marker"
  - "App. B `outline: none` is transcribed as [outline:none], not outline-none: the shorthand also resets the width and colour the global :focus-visible sets, and Chromium reports them even with style none"
  - "The invalid border is has-aria-invalid:border-danger! (important): the unfocused-hover rule (:hover:not(:focus-within)) is (0,3,0), the same as the spec's .is-invalid rule, and the invalid look must win as in the spec"
  - "Hover is hover:not-focus-within: so the focus look beats hover when both apply, as the spec cascade does (Tailwind emits hover after focus-within)"
  - "A multiline box keeps height auto inside a toolbar or item row (the spec's .is-multiline rule has the higher specificity); only the 14px/16px text applies there"
  - "The spec has no disabled field look; none was added (D-08). A disabled box looks like an enabled one, as approved"
  - "Select's error message keeps App. D.3's look with no icon; only the id and aria-describedby were added"

patterns-established:
  - "Form controls compose fieldClasses + labelClasses + fieldControlClasses + fieldInputClasses(...) + messageClasses(...); MoneyInput and OtpInput reuse them"
  - "A component state with no prop (the revealed password) is reached in parity through a same-named wrapper pair that performs the user action once after mount"

requirements-completed: [WEB-02, WEB-06, A11Y-04, PERF-03]

coverage:
  - id: D1
    description: "Field (label, hint, error with 14px triangle-alert, required ' *', multiline textarea, ₱ prefix, disabled) is computed-style-, box- and pixel-equal to the approved field in Blush and Espresso at 320/390/820/1440, at rest, hover and focus-visible (focus-within ring), in Chromium, Firefox and WebKit"
    requirement: "WEB-02"
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @forms (32 passed: chromium 16, firefox 8, webkit 8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Field assistive-technology wiring: label for/id, aria-describedby to the hint or error, aria-invalid only with an error, nothing invalid before an error is passed, aria-hidden ' *' and prefix, native passthrough, axe clean"
    requirement: "A11Y-04"
    verification:
      - kind: unit
        ref: "web/src/ui/forms/Field.test.tsx (22 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-01 and D-02 FYI-01 in the shared recipe: region boxes 14px, 16px on phone pages, the plain box 16px everywhere, no maximum-scale/user-scalable, placeholder in --ink-muted with no opacity; compiled rule order proven; focus beats hover and invalid beats both"
    requirement: "PERF-03"
    verification:
      - kind: unit
        ref: "web/src/ui/forms/field.recipe.node.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PasswordField (WEB-06 PasswordInput): Show password / Hide password toggle with aria-pressed and type switch, Weak/Fair/Good/Strong meter from passwordStrength with toned bars, the empty hint copy, hint/error wiring, autocomplete passthrough, axe clean; equal to the approved look (empty, four strengths, revealed, error) in three engines"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/forms/PasswordField.test.tsx (22 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @forms (password-* cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Select: native select with string and object options, placeholder, chevron overlay, label/hint/error wiring, disabled, Tab-reachable; equal to the approved select (default at every width, error, disabled) in three engines"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/forms/Select.test.tsx (17 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @forms (select-* cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The toolbar and item-row looks (and D-01 on phones) render correctly inside a real FilterBar and order-form row"
    verification:
      - kind: unit
        ref: "web/src/ui/forms/field.recipe.node.test.ts (compiled CSS order) and Field.test.tsx (region classes)"
        status: pass
    human_judgment: true
    rationale: "No parity case renders a field inside .s-toolbar/.s-item here (those regions are 02-30 and Phase 8); the computed look in a real region is proven by 02-30's toolbar fragment comparison"

duration: 30min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 20: Form Controls (Field, PasswordField, Select) on One Shared Field Recipe Summary

**Field, PasswordField (the WEB-06 PasswordInput) and Select now share one field recipe. They are equal to the approved design in Chromium, Firefox and WebKit, in Blush and Espresso, at rest, on hover and with keyboard focus. Errors are wired for assistive technology (aria-invalid plus aria-describedby). Inside `data-ui="s-toolbar"` or `data-ui="s-item"` regions the box takes the 40px/14px look, and on phone pages its text is 16px (D-01). The placeholder renders at full opacity (D-02 FYI-01).**

## Performance

- **Duration:** 30 min
- **Started:** 2026-10-08T22:45:45Z
- **Completed:** 2026-10-08T23:16:00Z
- **Tasks:** 2 of 2
- **Files modified:** 13 (12 created, 1 modified)

## Accomplishments

- **Shared recipe (`field.recipe.ts`).** It holds every App. B forms rule plus the App. C toolbar and item-row control rules as utilities.
  - `fieldInputClasses({ multiline, prefix, suffix, select })` builds the box from disjoint axes: the base, the height, the start padding and the end padding.
  - The region looks use `in-data-[ui=s-toolbar]:` and `in-data-[ui=s-item]:`. The D-01 phone size is `pg-phone:in-data-[ui=…]:text-[16px]`.
  - The invalid look is `has-aria-invalid:` on the control box, keyed off the box's own `aria-invalid`.
  - The strength tones are score-keyed maps.
- **Field.** It keeps the App. D.3 props API and markup. The label, `aria-hidden` " *" and `aria-hidden` prefix come first, then the input or textarea, then one message: the error with a 14px triangle-alert, or else the hint. The box gets `aria-describedby` and, with an error only, `aria-invalid`.
- **PasswordField.** It keeps the App. D.3 copy and behaviour:
  - "Show password" / "Hide password" with `aria-pressed`, and an 18px eye / eye-off icon.
  - The meter has four `aria-hidden` bars and a polite label, which reads "Use 8+ characters with a number and a symbol" while the box is empty.
- **Select.** A native select with the chevron overlay and an optional empty-value placeholder option. Options use the `--surface-3` look.
- **Scenarios (forms group, 17 cases).** Seven Field cases (all responsive), seven password cases and three select cases.
  - The `password-visible` case uses the new `RevealPassword` wrapper pair, which presses the toggle once after mount on both sides.

## Task Commits

1. **Task 1 (tracer): Field and the shared recipe.**
   - RED `541e9b9`:
     - `Field.test.tsx`: 16 of 19 failed against an inert stub (`RED_EVIDENCE_OK`).
     - `field.recipe.node.test.ts`: 7 of 7 failed against an empty recipe (`RED_EVIDENCE_OK`).
   - GREEN `be186e2`:
     - The first Chromium run failed on two real differences, which are now fixed: the focus-visible outline width and colour, and the hover on an invalid field (deviations 1 and 2).
     - After the fixes, Chromium `@forms` passed 16/16.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit (26/26, then Chromium 16/16) before expanding.
2. **Task 2: PasswordField and Select.**
   - RED `d77f81b`:
     - `PasswordField.test.tsx`: 20 of 22 failed (`RED_EVIDENCE_OK`).
     - `Select.test.tsx`: 15 of 17 failed (`RED_EVIDENCE_OK`).
   - GREEN `a49fa1f`:
     - Chromium `@forms` passed 16/16 on the first run.
     - A throw-away mutation was caught as computed-style and pixel differences, then reverted. It made two changes: the wrapper focuses the toggle instead of pressing it, and the Fair tone is set to info.
     - Repeat check: the rest rows passed 12/12 (repeat-each 3).
     - Three engines: 32/32.
     - `verify` exited 0.

**Plan metadata:** recorded in the docs(02-20) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/forms/field.recipe.ts`: the shared field, label, control, box, prefix, suffix button, chevron, option, message and strength looks
- `web/src/ui/forms/field.recipe.node.test.ts` (7 tests): the class gate, D-01 and FYI-01 tokens, and the compiled rule order
- `web/src/ui/forms/Field.tsx` and `Field.test.tsx` (22 tests)
- `web/src/ui/forms/PasswordField.tsx` and `PasswordField.test.tsx` (22 tests)
- `web/src/ui/forms/Select.tsx` and `Select.test.tsx` (17 tests)
- `web/src/ui/forms/index.ts`: Field, PasswordField, Select, their types, and `fieldControlClasses`, `fieldInputClasses`, `labelClasses`, `messageClasses`
- `web/src/dev/scenarios/groups/forms.ts`: 17 parity scenarios
- `web/src/dev/previews/RevealPassword.tsx` and `web/visual/reference/fragments/RevealPassword.tsx`: the wrapper pair
- `docs/web/parity.md`: the RevealPassword pair (section 5)

## Decisions Made

See `key-decisions` in the frontmatter. Later plans need these most:

- **02-30 (FilterBar/SearchBox).** Mark the toolbar `data-ui="s-toolbar"`; Field and Select then take the toolbar look and D-01 on their own. Two App. C rules are not in the field recipe and belong to the toolbar:
  - `.s-toolbar > :first-child { flex: 1 1 100% !important }` on tablets.
  - `.s-toolbar .s-search { flex: 1 1 260px }`.

  The SearchBox and topbar search inputs need their own D-01 `pg-phone:text-[16px]`.
- **MoneyInput / OtpInput.** Compose `fieldClasses`, `labelClasses`, `fieldControlClasses`, `fieldInputClasses({ prefix: true })` and `messageClasses`, and wire `aria-invalid`/`aria-describedby` the same way.
- **Server field errors (02-16).** Pass `error={fieldErrors.X}`. Field sets `aria-invalid`, which `focusFirstInvalid(form)` finds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The focus-visible outline differed from the spec**
- **Found during:** Task 1 (first Chromium parity run)
- **Issue:** App. B's `outline: none` is a shorthand, so it also resets the outline width (medium, 3px) and colour (currentcolor). `outline-none` sets only the style, so the box kept the global `:focus-visible` 2px `--focus` values. Chromium reported the difference in the focus-visible rows.
- **Fix:** `[outline:none]`, the exact shorthand.
- **Files modified:** web/src/ui/forms/field.recipe.ts, Field.test.tsx
- **Committed in:** `be186e2`

**2. [Rule 1 - Bug] Hovering an invalid field showed the hover border instead of the danger border**
- **Found during:** Task 1 (first Chromium parity run, `field-error` hover)
- **Issue:** `hover:not-focus-within:` compiles to `:hover:not(:focus-within)`, which is (0,3,0). That beats `:has([aria-invalid="true"])` at (0,2,0). The spec's `.csp-field.is-invalid .csp-control` (0,3,0) beats hover.
- **Fix:** `has-aria-invalid:border-danger!`, the important suffix for a real cascade fight (research row 30). It is pinned by a node test that reads the compiled CSS.
- **Committed in:** `be186e2`

**3. [Rule 3 - Blocking] Recipe option values cannot be strings**
- **Found during:** Task 1 (GREEN)
- **Issue:** A default of `end = 'plain'` in the recipe was read by the class gate as a class token ("`plain` compiles to no CSS").
- **Fix:** The options are booleans (`suffix`, `select`). The type stays in the interface.
- **Committed in:** `be186e2`

**4. [Rule 2 - Missing critical] Accessibility fixes in App. D.3 PasswordField and Select (SPEC-DEVIATION A11Y-01)**
- **Found during:** Task 2
- **Issue:**
  - App. D.3 PasswordField always gave the box the generated id, then spread `id` and `className` onto the box. A caller id therefore left the label pointing nowhere, and a caller className replaced the box look.
  - App. D.3 Select gave its message no id and the select no `aria-describedby`, so the hint and the error were never announced.
- **Fix:**
  - A caller id names the box, and the label follows it.
  - `className` is layout glue on the field.
  - Select's message gets `{id}-msg` and the select names it.
  - No element, text or look changed, and attributes are not compared.
- **Committed in:** `a49fa1f`

**5. [Rule 2 - Missing critical] A compiled-CSS test for the D-01 cascade**
- **Found during:** Task 1 (design)
- **Issue:** jsdom cannot evaluate container queries, and no parity case renders a field inside a toolbar. The order of the 16px, 14px and phone 16px rules was therefore unverified.
- **Fix:** `field.recipe.node.test.ts` (not in the plan's file list) compiles the recipe through the class gate's `buildCss`. It asserts the rule order for the box size, the height, the toolbar field basis and the control border, and that the phone rule sits inside `@container pg (max-width: 767px)`.
- **Committed in:** `541e9b9`, `be186e2`

**6. [Rule 2 - Missing critical] Extra scenarios and the RevealPassword wrapper pair**
- **Found during:** Task 2
- **Issue:**
  - App. D.3 has no prop for the revealed state, so `password-visible` cannot be reached with plain props.
  - The invalid look of PasswordField and Select was not in the plan's case list.
- **Fix:**
  - The `RevealPassword` pair, the same click on both sides. A mutation proved the comparison sees it.
  - Added `password-error` and `select-error`.
  - Documented the pair in parity.md section 5.
- **Committed in:** `d77f81b`, `a49fa1f`

---

**Total deviations:** 6 auto-fixed (2 Rule 1, 1 Rule 3, 3 Rule 2)
**Impact on plan:** Every must-have truth is proven by unit tests, by the compiled-CSS test and by the three-engine parity run. No look, element or text changed beyond the intentional-differences list. No tolerance or normalization was added.

## Issues Encountered

- **Coverage ceiling from the passthrough (L-13).** `ui/forms` is at 93.71% statements and 89.4% branches. Every uncovered branch is a React Compiler cache-hit branch for a part that depends on the `{...rest}` object, which is new on every render: the props destructuring, the control box and the field root.
  - These branches cannot be reached while the native-attribute passthrough stays. That passthrough is UI-SPEC: "Field, Select and PasswordField accept all native input props".
  - Equal-props re-render tests pin that the output is identical.
  - The global thresholds still pass: 99.1% statements, 97.7% branches, 100% functions, 99.89% lines.
- `user-event` does not run a native select's arrow keys in jsdom. The keyboard test therefore checks that Tab reaches the select and then chooses with `selectOptions`. Real-browser keyboard behaviour is native.

## TDD Gate Compliance

- Task 1: RED `541e9b9` comes before GREEN `be186e2` (`RED_EVIDENCE_OK` for `Field.test.tsx` and `field.recipe.node.test.ts`).
- Task 2: RED `d77f81b` comes before GREEN `a49fa1f` (`RED_EVIDENCE_OK` for `PasswordField.test.tsx` and `Select.test.tsx`).
- The scenario-declaration tests passed at RED, because the scenario data was committed with the stubs. They pin that data.
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved.

## Look Gate (D-08 conditional checkpoint)

It did not fire. The two first-run differences were implementation errors against the approved look, and they were fixed in the implementation. No look, element, text or ARIA structure changed beyond the intentional-differences list (D-01, D-02 FYI-01). No tolerance was added.

## Threat Flags

None. T-02-50 is mitigated:
- The reveal toggle is explicit (`aria-pressed`, tested).
- `autocomplete` passes through (tested).
- No value is logged.

T-02-SC: no installs. No endpoint, auth path or file access was added.

## Verification

- `npm --prefix web run test -- --run src/ui/forms`: 4 files, 68/68 passed.
- Preflight showed all four ports free and no other project's processes. Then:
  - `npm --prefix web run parity -- --grep @forms --project chromium`: 16 passed.
  - `npm --prefix web run parity -- --grep @forms`: **32 passed** (Chromium 16, Firefox 8, WebKit 8) in 3.9 min.
- Regression: `--grep "@reference|@selftest" --project chromium` passed 3.
- `npm --prefix web run verify` exited 0. It ran typecheck (3 programs), lint, format, 60 files with 1572 tests, coverage at 99.1 / 97.7 / 100 / 99.89, the build, the license gate and notices.
- Acceptance greps:
  - `pg-phone:in-data-\[ui=s-toolbar\]:text-\[16px\]` in field.recipe.ts: 1.
  - `placeholder:opacity` in field.recipe.ts: 0.
  - "Show password" in PasswordField.tsx: 1.
  - "Hide password" in PasswordField.tsx: 1.
- `node web/scripts/class-gate.mjs`: exit 0.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Imports.** `Field`, `PasswordField` and `Select` come from `@/ui/forms`, together with the shared recipes for MoneyInput and OtpInput.
- **02-30 must prove the toolbar context against the App. E.7 fragment.** That run is the first computed-style check of the region looks and of D-01 in a real region.
- **Phase 4 hand-off (UI-SPEC).** Check the empty-meter hint against the PRD §8.4 NIST policy before sign-in ships.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 12 created files and the 1 modified file exist on disk.
- Commits `541e9b9`, `be186e2`, `d77f81b` and `a49fa1f` are on `gsd/phase-2-web-foundation-design-system`.
