---
phase: 02-web-foundation-design-system
plan: 23
subsystem: ui
tags: [money, kpi-card, order-totals, peso, u-2212, d-09, parity, tailwind, wcag, tdd, web-02, ord-09, d-02, d-33]
created: "2026-10-08T20:04:00-05:00"
updated: "2026-10-08T21:11:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-07)
    provides: "csps.ts orderTotals and formatPeso with the D-09 centavo rounding (golden-vector proven)"
  - phase: 02-web-foundation-design-system (plan 02-21)
    provides: "Skeleton (--sk-w/--sk-h/--sk-r) for the KpiCard loading state; FREEZE finishes finite animations and pauses the shimmer"
  - phase: 02-web-foundation-design-system (plan 02-14)
    provides: "the live parity harness (kit, scenario groups, matrix incl. the reduced-motion pass, comparator)"
provides:
  - "web/src/ui/money: Money, KpiCard (incl. loading), OrderTotals (panel and card), exported from @/ui/money with MoneyProps, KpiCardProps, OrderTotalsProps"
  - "money.recipe.ts: cardClasses (.csp-card) and overlineClasses (.csp-overline), also exported from @/ui/money for OrderCard (02-24); money size/tone maps; KPI, delta, totals and balance looks"
  - "web/src/dev/scenarios/groups/money.ts: 13 parity scenarios (5 Money, 3 OrderTotals on ORD-2026-0148 / ORD-2026-0151, 5 KpiCard incl. loading in the reduced-motion pass); ORDER_0148 and ORDER_0151 seed data exported"
  - "DefinedTotalsNote wrapper pair (web/src/dev/previews + web/visual/reference/fragments), documented in docs/web/parity.md §5"
affects: [02-24, 02-29, 02-31, 02-34, phase-08-order-screens, dashboard, parity]

actuals:
  tokens: 14079    # chars/4 over the realized diff (56,315 chars, 10 files)
  tasks: 2
  commits: 4
plan_head_before: 2ac3d0e532bd2072e02ef2c1dd67cfba28dd41bd
plan_head_after: 171b625eafb39079ed14550f0bb591197f34932d

tech-stack:
  added: []
  patterns:
    - "Figures only formatted in components: OrderTotals reads `totals` (server figures, D-09) or csps.ts orderTotals; no money arithmetic beyond App. D.3's sign flip for display"
    - "A reference-side attribute patch in a wrapper pair when the frozen App. D.3 markup itself fails axe and the converted component fixes it with attributes only (attributes are not compared)"
    - "Keep App. D.3's text-node split where it shapes differently ({n}% is two text nodes; one joined string was 0.02px narrower)"

key-files:
  created:
    - web/src/ui/money/money.recipe.ts
    - web/src/ui/money/Money.tsx
    - web/src/ui/money/KpiCard.tsx
    - web/src/ui/money/OrderTotals.tsx
    - web/src/ui/money/money.test.tsx
    - web/src/ui/money/index.ts
    - web/src/dev/scenarios/groups/money.ts
    - web/src/dev/previews/DefinedTotalsNote.tsx
    - web/visual/reference/fragments/DefinedTotalsNote.tsx
    - .planning/phases/02-web-foundation-design-system/deferred-items.md
  modified:
    - docs/web/parity.md

key-decisions:
  - "OrderTotals keeps App. D.3's props: `totals` (the server's figures) wins over a preview of `order` (csps.ts orderTotals, D-09); the component formats only"
  - "The panel's internal-only note stays a <p> inside the <dl> and takes role=\"definition\" (SPEC-DEVIATION A11Y-01): App. D.3's bare <p> in a <dl> fails axe definition-list; attribute only, look unchanged"
  - "The frozen reference note fails axe too, so the panel scenarios sit in the DefinedTotalsNote wrapper pair: the reference side adds the same role after mount; nothing compared is changed"
  - "KpiCard's delta icon is named \"Up\" or \"Down\" (role img via Icon label, SPEC-DEVIATION A11Y-01, WCAG 1.1.1/1.4.1); App. D.3 conveyed the direction only by a hidden icon and colour"
  - "A zero KPI keeps the normal value look: App. D.3/B have no KpiCard zero state, and D-02's `.is-zero` row is the cascade tiles (already done in 02-22); dimming it would change the approved look (D-08)"
  - "The balance overline, the totals note and other component paragraphs follow the approved computed result: App. C `.s-page p { margin: 0 }` zeroes `.csp-totals-note`'s 2px top margin"

patterns-established:
  - "Screens show money with `<Money amount={n} size? tone?/>`, totals with `<OrderTotals totals={serverTotals}/>` for saved orders, and `<OrderTotals order={draft}/>` only for live previews"
  - "OrderCard (02-24) imports OrderTotals (variant=\"card\"), cardClasses and overlineClasses from @/ui/money"
  - "Dashboard (layout plans) context looks `.s-kpis .csp-kpi` padding, hidden icon on phones and the 24px value at ≤420px are not in money.recipe.ts; the layout plan adds them through a data-ui marker"

requirements-completed: [WEB-02, ORD-09]

coverage:
  - id: D1
    description: "Money renders formatPeso text (\"₱12,450.00\", negatives \"−₱732.50\" with U+2212) in tabular figures with the sm/md/lg sizes and the success/warning/danger/muted tones, equal to the approved Money in both themes at 390/1440 in Chromium, Firefox and WebKit"
    requirement: "ORD-09"
    verification:
      - kind: unit
        ref: "web/src/ui/money/money.test.tsx (Money, 7 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @money (18 passed: chromium 10, firefox 4, webkit 4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "OrderTotals for ORD-2026-0148 (Total ₱22,450.00, Discount −₱1,122.50, Paid −₱12,000.00, Balance due ₱9,327.50, Expenses ₱6,065.00, Profit ₱15,262.50) and ORD-2026-0151 (Fully Paid) from csps.ts orderTotals, server totals winning, equal to the approved panel and card at 320/390/820/1440 in Chromium and 390/1440 in Firefox and WebKit, axe clean"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/money/money.test.tsx (OrderTotals, 13 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @money"
        status: pass
    human_judgment: false
  - id: D3
    description: "KpiCard (icon tile, overline label, peso or count value, delta chip up/down with a named direction, hint) and its loading state (aria-busy, 70% × 36 skeleton, shimmer stopped under reduced motion) equal to the approved design in both themes at 390/1440 in three engines; a zero figure has no opacity (D-02)"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/money/money.test.tsx (KpiCard, 12 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @money (incl. the @motion row for kpi-loading)"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0; class gate finds no opacity token in src/ui/money)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Screen-reader reading of the totals list (incl. the note as a definition) and the KPI delta direction (NVDA/VoiceOver)"
    verification: []
    human_judgment: true
    rationale: "jsdom and axe check roles and names, not what a real screen reader announces; A11Y-05 covers the manual passes"

duration: 30min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 23: Money, KpiCard and OrderTotals Summary

**Money, KpiCard and OrderTotals are converted to utilities and equal to the approved design in Chromium, Firefox and WebKit, in both themes. OrderTotals shows the spec §12.2 figures for ORD-2026-0148 (balance due ₱9,327.50) and ORD-2026-0151 (Fully Paid). Its figures come from the server's totals or from csps.ts `orderTotals` with the D-09 centavo rounding, and no component does money arithmetic. Negatives read "−₱732.50" with U+2212. The KpiCard loading state shows the 70% × 36 skeleton, and the shimmer stops under reduced motion.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-10-09T00:32:19Z
- **Completed:** 2026-10-09T01:02:39Z
- **Tasks:** 2 of 2
- **Files:** 11 (10 created, 1 modified)

## Accomplishments

- **Money.** One span with `formatPeso` text and tabular figures. The sizes (`sm` 14px, `md`, `lg` 40px display) and tones (success, warning, danger, muted) are complete literals keyed by typed unions.
- **OrderTotals.**
  - It keeps the App. D.3 markup: the Total / Total Discount / Total Paid list (discount and paid shown as negatives), then the balance block, then in the panel the dashed list of Order Expenses and Estimated Profit with the internal-only note.
  - Due: warning-soft ground, "Balance due" and the big figure (28px card, 40px panel). Fully paid: success-soft, "Balance", the check icon (18px card, 22px panel) and "Fully Paid". A negative profit is red.
  - `totals` (the server's figures) wins over a preview of `order` (D-09).
- **KpiCard.** The card, the overline label, the 32px icon tile with an 18px icon, the display value at `clamp(26px, 15cqi, 40px)` on its own inline-size container, and the foot with the delta chip and the label or hint. While `loading`, the card is `aria-busy` and shows the skeleton instead of the value and the foot.
- **Scenarios (money group, 13 cases).**
  - `money-positive`, `money-negative`, `money-lg-success`, `money-sm-muted`, `money-warning`.
  - `order-totals-0148`, `order-totals-0151` (panel) and `order-totals-card-0148`, at every width.
  - `kpi-income`, `kpi-expenses-delta-down`, `kpi-active-orders`, `kpi-zero`, `kpi-loading` (reduced-motion pass), at 390 and 1440.

## Task Commits

1. **Task 1 (tracer): ORD-2026-0148's totals panel matches the approved design with server-matching figures.**
   - RED `36234df`: 18 of 23 failed against inert stubs (`RED_EVIDENCE_OK`, `money.test.tsx`).
   - GREEN `2df9a26`: 24 of 24 passed. The first Chromium run compared every look as equal but failed axe on the reference page (deviation 2). After the fix, Chromium `@money` passed 8 of 8.
   - A throw-away mutation proved the comparison is live. It set the panel balance to 39px, the note to `--ink-muted` and the md Money to 700. The run reported pixel and box differences in every affected row. It was reverted.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit (24 of 24, then Chromium 8 of 8) before expanding.
2. **Task 2: KpiCard including the loading state, in all three engines.**
   - RED `8a670a8`: 11 of 38 failed against an inert stub (`RED_EVIDENCE_OK`, `money.test.tsx`).
   - GREEN `171b625`: 38 of 38 passed. The first Chromium run found a 0.02px width difference in the delta chip (deviation 4). After the fix, Chromium passed 10 of 10 and all three engines passed 18 of 18. `verify` exited 0.

**Plan metadata:** recorded in the docs(02-23) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/money/money.recipe.ts`: the App. B `.csp-card`, `.csp-overline`, `.csp-money*`, `.csp-kpi*`, `.csp-delta*`, `.csp-totals*` and `.csp-balance*` looks
- `web/src/ui/money/Money.tsx`, `KpiCard.tsx`, `OrderTotals.tsx`: the converted components
- `web/src/ui/money/money.test.tsx` (38 tests): Money, OrderTotals, KpiCard and the scenario set
- `web/src/ui/money/index.ts`: the barrel (components, prop types, `cardClasses`, `overlineClasses`, the size/tone/variant types)
- `web/src/dev/scenarios/groups/money.ts`: 13 parity scenarios and the ORD-2026-0148 / ORD-2026-0151 seed data
- `web/src/dev/previews/DefinedTotalsNote.tsx` and `web/visual/reference/fragments/DefinedTotalsNote.tsx`: the wrapper pair
- `docs/web/parity.md`: §5 describes the new wrapper pair
- `.planning/phases/02-web-foundation-design-system/deferred-items.md`: the forms flake (see Issues)

## Decisions Made

See `key-decisions` in the frontmatter. Later plans need these most:

- **02-24 (OrderCard).** Use `<OrderTotals totals={t} variant="card" />`, `cardClasses` and `overlineClasses` from `@/ui/money`. The `.csp-order-status .csp-badge` context look still belongs to 02-24.
- **Layouts (dashboard).** The App. C `.s-kpis` context rules (16px or 16/20px padding, the icon hidden on phones, the 24px value at ≤420px) are not in the recipe. The plan that builds the dashboard grid adds them through a `data-ui` marker.
- **Phase 8 (order screens).** Pass the server's `totals` once a save returns. Use `order` only for the live preview while a form is being edited (D-09).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The totals note made the `<dl>` invalid**
- **Found during:** Task 1 (design, then the axe check)
- **Issue:** App. D.3 puts `<p className="csp-totals-note">` straight inside the internal `<dl>`. axe reports `definition-list` (WCAG 1.3.1), and A11Y-01 requires zero violations.
- **Fix:** The paragraph keeps its place, element and look, and takes `role="definition"`. It defines how the Estimated Profit above it is worked out. Marked `SPEC-DEVIATION: A11Y-01`.
- **Files modified:** `web/src/ui/money/OrderTotals.tsx`
- **Committed in:** `2df9a26`

**2. [Rule 3 - Blocking] The frozen reference panel failed axe**
- **Found during:** Task 1 (first Chromium parity run)
- **Issue:** Every computed style, box and pixel was equal, but the parity suite runs axe on both pages. The frozen App. D.3 panel has the same `definition-list` violation, so all 8 rows failed on the reference side.
- **Fix:** I added the `DefinedTotalsNote` wrapper pair, following the TabsWithPanel and OpenedDialog precedent. It is one plain `<div>` on both sides. On the reference side, it gives the frozen note `role="definition"` after mount. The implementation side does nothing, because the converted panel renders that attribute itself. Attributes are not compared, so no look, element or text changes and no tolerance or normalization is added. The card variant has no note and is not wrapped. The pair is documented in parity.md §5.
- **Files modified:** `web/src/dev/previews/DefinedTotalsNote.tsx`, `web/visual/reference/fragments/DefinedTotalsNote.tsx`, `web/src/dev/scenarios/groups/money.ts`, `docs/web/parity.md` (the last two were not in the plan's file list)
- **Committed in:** `2df9a26`

**3. [Rule 2 - Missing critical] The KPI delta direction was not available to screen readers**
- **Found during:** Task 2 (the plan's "delta with an accessible direction")
- **Issue:** App. D.3 shows a rise or fall only by a hidden icon and its colour. A screen reader heard "12%" for both (WCAG 1.1.1, 1.4.1).
- **Fix:** The 14px trend icon gets `label="Up"` or `"Down"` (role img). This changes attributes only, so the look is the same. Marked `SPEC-DEVIATION: A11Y-01`.
- **Committed in:** `171b625`

**4. [Rule 1 - Bug] The delta chip was 0.02px narrower**
- **Found during:** Task 2 (first Chromium run of kpi-income and kpi-expenses-delta-down)
- **Issue:** I wrote the percentage as one string (`` `${n}%` ``). App. D.3 renders `{Math.abs(delta)}%` as two text nodes, and Chromium shaped the joined run 0.02px narrower (44px against 43.98px). That moved the label beside it.
- **Fix:** The percentage is rendered as App. D.3 renders it, with a comment that says why.
- **Committed in:** `171b625`

### Plan-text adjustments

- **No `text-ink-subtle` on the KPI zero state.** The plan's Task 2 behavior asks for it, but App. B/D.3 have no KpiCard zero state. D-02's `.is-zero` row is the ConfirmDialog cascade tiles, which 02-22 already did. Dimming a ₱0.00 KPI would change the approved look, which needs an owner decision (D-08). So `kpi-zero` renders the normal value look and is proven equal to the approved design. The test asserts that the figure keeps the value look and that the card has no opacity token, which is what D-02 requires. The must-have truth ("`.is-zero` dimming uses colour only") holds, because no opacity is used anywhere.
- **Extra cases.** `money-lg-success`, `money-sm-muted`, `money-warning`, `order-totals-card-0148` and `kpi-active-orders` cover the remaining sizes, tones, the card variant and the count path. `kpi-expenses-delta-down` uses −47%: spec §12.3 gives September's ₱71,904.20 "for the KPI" against October's ₱38,226.95.

---

**Total deviations:** 4 auto-fixed (2 Rule 2, 1 Rule 3, 1 Rule 1), plus 2 documented plan-text adjustments.
**Impact on plan:** Every must-have truth is proven by unit tests and by the three-engine parity run, including the reduced-motion pass. No look, element or text changed beyond the intentional-differences list. The two A11Y-01 fixes are attributes only, like the Tabs and Modal ARIA fixes. No tolerance or normalization was added.

## Issues Encountered

- **Forms parity flake (out of scope, logged in `deferred-items.md`).** The Chromium regression of every group gave 100 passed and 1 failed: `field-multiline`, light 1440 focus-visible, 5 pixels. A rerun of `@forms` failed `field-hint` in the same row, also 5 pixels. All the differing pixels are anti-aliased corner pixels at x 1437–1439, the right edge of the 1440px viewport, and computed styles and boxes were equal. The same rows then passed with `--repeat-each 3` (6 of 6), and a third full `@forms` run passed 16 of 16. This plan touched nothing in the forms group.
- **Shell tooling.** As 02-21 found, a Python heredoc with an apostrophe broke Git Bash quoting. The edit script was written to the scratchpad and run from there.

## TDD Gate Compliance

- Task 1: RED `36234df` comes before GREEN `2df9a26` (`RED_EVIDENCE_OK`, `src/ui/money/money.test.tsx`).
- Task 2: RED `8a670a8` comes before GREEN `171b625` (`RED_EVIDENCE_OK`, `src/ui/money/money.test.tsx`).
- The scenario-declaration tests and the two axe tests passed at RED, because the scenario data was committed with the stubs and an empty stub has nothing for axe to report. They pin that data.
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved. `package.json` and `package-lock.json` are unchanged.

## Look Gate (D-08 conditional checkpoint)

It did not fire. Parity found one look difference, the 0.02px chip width, and it was an implementation error, fixed in the implementation. The plan's "zero state uses `text-ink-subtle`" would have been a look change, so it was not made (see Plan-text adjustments). The owner may still rule on dimming a zero KPI if they want it.

## Threat Flags

None.
- **T-02-55** is mitigated. The components only format figures from the caller's `totals` or from csps.ts `orderTotals`. `grep -cE "\* 100|/ 100" OrderTotals.tsx` is 0. A test proves the 7.5%-of-₱17.00 preview reads −₱1.28 and that server totals win.
- **T-02-SC:** no installs.

No endpoint, auth path or file access was added.

## Verification

- `npm --prefix web run test -- --run src/ui/money`: 1 file, 38 of 38 passed. `src/ui/money` is at 100% statements, branches, functions and lines (not listed in the coverage table).
- Preflight before every parity run showed all four ports free and no other project's processes. Then:
  - `npm --prefix web run parity -- --grep @money --project chromium`: 10 passed (incl. the `@motion` row).
  - `npm --prefix web run parity -- --grep @money`: **18 passed** (Chromium 10, Firefox 4, WebKit 4) in 1.3 min.
  - Regression: `--grep "@parity|@reference" --project chromium` gave 100 passed and 1 failed (the forms flake above). The `@forms` group then passed 16 of 16 on its own.
- `npm --prefix web run verify` exited 0. It ran typecheck (3 programs), lint, format, 67 files with 1749 tests, coverage at 99.09 / 98.1 / 100 / 99.92, the build, the license gate and notices.
- Acceptance greps:
  - `orderTotals` in OrderTotals.tsx: 4 (at least 1 required).
  - `\* 100|/ 100` in OrderTotals.tsx: 0.
  - The class gate (`node web/scripts/class-gate.mjs`) exits 0, with no opacity token in `src/ui/money`.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Imports.** `Money`, `KpiCard` and `OrderTotals` come from `@/ui/money`, plus `cardClasses` and `overlineClasses`.
- **02-34** (barrel export list) finds Money, KpiCard and OrderTotals under their App. D.3 names.
- **Phase 14 (A11Y-05).** Confirm with NVDA and VoiceOver how the totals list, its note and the KPI delta direction are read (coverage D4).

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 10 created files and the 1 modified file exist on disk.
- Commits `36234df`, `2df9a26`, `8a670a8` and `171b625` are on `gsd/phase-2-web-foundation-design-system`.

## Follow-up: owner ruling D-39

On 2026-10-08 the owner ruled in chat: "Make KPI card showing zero look dimmed." This replaces the plan-text adjustment above that kept `kpi-zero` in the normal look.

- **What dims.** Only the value. A KpiCard whose figure reads as zero gets `text-ink-subtle` (`--ink-subtle`) on its value, through `kpiZeroValueClasses` in `money.recipe.ts`. The label, icon tile, hint and delta chip keep their looks, and no opacity is used. This mirrors D-02's `.is-zero` cascade rule (`li.is-zero span`), which dims only the tile's count and leaves its label alone.
- **What counts as zero.** A number the card shows as zero:
  - a money figure that rounds to 0 centavos (`round2(value) === 0`, so 0, −0 and 0.004 all show "₱0.00" and dim);
  - a count (`money={false}`) of exactly 0.
  A text value is shown as given and never dims, even "0".
- **Contrast.** On the card's `--surface` the dimmed figure measures 5.78:1 (light) and 6.19:1 (dark). The value is 26–40px bold, so the large-text minimum of 3:1 applies, and it would also pass the 4.5:1 normal-text bar.
- **Reference side.**
  - The rulings layer got a D-39 group: `.csp-kpi-value[data-zero] { color: var(--ink-subtle); }`.
  - A CSS-only rule can't tell a zero figure, because App. D.3's markup has no hook for it. So `kpi-zero` sits in a new `DimmedZeroKpi` wrapper pair (`web/src/dev/previews/` + `web/visual/reference/fragments/`), following the `DefinedTotalsNote` precedent.
  - On the reference side, the wrapper sets `data-zero` on the frozen `.csp-kpi-value` after mount when the KpiCard child's `value` is the number 0. The implementation side does nothing.
  - Attributes are not compared, so the colour, boxes and pixels are still compared in full. No tolerance, normalization or intentional-differences registry entry was needed.
  - The guide is updated: `docs/web/parity.md` §5 describes the pair and §6 has the D-39 row.
- **Class gate / OPACITY_ALLOW.** Neither needed a change, because the dim is colour only. `node web/scripts/class-gate.mjs` exits 0.
- **Commits.**
  - RED `c65918a` (test): 7 of 50 money tests and 2 of 30 rulings tests failed on assertions. `RED_EVIDENCE_OK` for both `src/ui/money/money.test.tsx` and `visual/reference/rulings.test.ts`.
  - GREEN `eb1817d` (fix): KpiCard and the recipe, rulings.css D-39, the `DimmedZeroKpi` pair, the `kpi-zero` scenario and parity.md.
  - Docs `5f37dbc`: D-39 in 02-CONTEXT.md, plus the D-02, zero-one-many, intentional-differences and reference-layer rows in 02-UI-SPEC.md.
- **Tests.**
  - `src/ui/money` has 50 tests, all passing: the `kpi-zero` look with no opacity, a 10-row zero/non-zero table, a re-render case (same props, then a non-zero figure, then a zero count), and the wrapper pair. Coverage stays at 100% statements, branches, functions and lines.
  - `rulings.test.ts`: 30 of 30.
  - `npm --prefix web run verify` exited 0: 69 files, 1814 tests, coverage 99.16 / 98.27 / 100 / 99.93.
- **Parity.** Preflight was clear before each run.
  - Chromium `@money`: 10 of 10.
  - All three engines `@money`: **18 passed** (Chromium 10, Firefox 4, WebKit 4) in 1.4 min.
  - A throw-away mutation proved the comparison is live. It renamed the rule's selector so the reference stayed undimmed, and `kpi-zero` then failed in Chromium light 390: `color` reference rgb(59, 31, 28) against implementation rgb(122, 82, 72), and 1,009 pixels differed. It was reverted before the commit.
