---
created: 2026-10-13T14:10:03-05:00
updated: 2026-10-13T14:10:03-05:00
phase: quick-261013-ihp
plan: 01
status: complete
subsystem: order math (Csps.Domain, web lib, golden vectors), web money/data UI, parity proof, owner-review pack
tags: [D-41, R2-06, NET-WR-02, NET-IN-01, order-math, golden-vectors, parity, tdd]
requires:
  - D-41 R2-06 owner ruling (02-CONTEXT.md D-41; 999.1 DECISIONS.md "Owner answers, 2026-10-13")
provides:
  - "PRD §5.1 names end to end: subtotal (before discount) and total (Subtotal − Discount) in the oracle, the version-2 vector file, C# OrderMathResult and csps.ts Totals"
  - "Balance = Total − Paid, Profit = Total − Expenses; FullyPaid = Subtotal > 0 and Balance ≤ 0 (NET-IN-01 ruled keep), pinned on every side"
  - "OrderTotals panel and card read 'Subtotal'; note 'Profit = Subtotal − Discount − Expenses. Internal only.'"
  - "Reference-only OrderTotals and OrderCard overrides (SPEC_OVERRIDES → D-41) keep the look-equality proof equal"
  - "Owner-review pack section 'Wording changes for you to confirm (before and after)' with 6 pictures"
affects:
  - Phase 5/7 order DTOs, list columns and the PRD §16 reconciliation (must map Total = after discount)
  - web/visual parity proof (SPEC_OVERRIDES now three entries)
tech-stack:
  added: []
  patterns:
    - "Fail-closed JSON loading for the golden vectors (UnmappedMemberHandling.Disallow + RespectRequiredConstructorParameters)"
    - "Owner-review before/after pictures made by an exact-text swap page script built with JSON.stringify, failing on a no-match"
key-files:
  created:
    - web/visual/reference/fragments/OrderTotals.tsx
    - web/visual/reference/fragments/OrderCard.tsx
  modified:
    - web/scripts/golden-math.mjs
    - web/scripts/golden-math.test.ts
    - web/scripts/gen-golden-vectors.mjs
    - web/scripts/gen-golden-vectors.test.ts
    - tests/fixtures/order-math-golden-vectors.json
    - src/Csps.Domain/Orders/OrderMath.cs
    - src/Csps.Domain/Orders/OrderMathModels.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs
    - web/src/lib/csps.ts
    - web/src/lib/csps.test.ts
    - web/src/lib/csps.golden.test.ts
    - web/src/ui/money/OrderTotals.tsx
    - web/src/ui/money/money.test.tsx
    - web/src/ui/data/data.test.tsx
    - web/src/dev/scenarios/groups/data.ts
    - web/src/dev/scenarios/groups/money.ts
    - web/visual/reference/merge-kit.ts
    - web/visual/reference/merge-kit.test.ts
    - web/visual/reference/rulings.css
    - web/visual/reference/rulings.test.ts
    - web/scripts/owner-review.mjs
    - web/scripts/owner-review.test.ts
    - docs/web/parity.md
    - docs/web/owner-review.md
    - .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-dotnet.md
    - .planning/phases/02-web-foundation-design-system/deferred-items.md
    - .planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md
decisions:
  - "Only Subtotal and Total are renamed (the scope of D-41 R2-06); discount/paid/expenses and the labels 'Total Discount' / 'Total Paid' stay"
  - "No 'Total' (after discount) row was added to the panel: the ruling changes the label only (D-08); the pack asks the owner if they want one"
  - "The panel note becomes 'Profit = Subtotal − Discount − Expenses. Internal only.' so the discount is not counted twice"
  - "D-09's operationOrder text ('round the items total; …') stays word for word; 'items total' is the PRD Subtotal; vector file version 1 → 2"
metrics:
  duration: 36min
  completed: 2026-10-13
actuals:
  tokens: 48640
  tasks: 3
  commits: 8
commits: 8
plan_head_before: 8240cb2ca8abe90d99761b62581dc6c6f7962661
plan_head_after: 46e76621d268cea5bf092e6effd643aff129297d
requirements: [WEB-07, WEB-02]
---

# Quick 261013-ihp: Rename the order math to the PRD names (Subtotal / Total) Summary

*Created: 2026-10-13T14:10:03-05:00 · Updated: 2026-10-13T14:10:03-05:00*

**Owner ruling D-41 R2-06 is in place on every layer.** The server math, the browser preview, the shared golden vectors (version 2), the OrderTotals panel and card, and the showcase demo data now all use the PRD §5.1 names. **Subtotal** is the amount before discount, and **Total = Subtotal − Discount**. Every amount is the same as before. The look-equality proof is still equal in all three engines, and the owner-review pack now shows the wording change as a before/after for the owner to confirm. This closes NET-WR-02, and NET-IN-01 is closed as "ruled: keep".

## Commits

| # | Task | Commit | Type | What |
|---|------|--------|------|------|
| 1 | 1 (tracer) | c985508 | test (RED) | Failing tests: oracle, generator, C#, TS, panel/card, demo table expect `subtotal` / `total`; version 2; fail-closed xUnit loader; 100%-discounted unpaid order is fully paid |
| 2 | 1 (tracer) | 38db727 | fix (GREEN) | PRD names end to end; vectors regenerated (`--write`); panel "Subtotal" and new note; demo table Total after discount |
| 3 | 2 | 5f467d5 | test (RED) | SPEC_OVERRIDES pinned to Topbar, OrderTotals and OrderCard; rulings.css header pin for R2-06 |
| 4 | 2 | 78a26ca | fix (GREEN) | Reference-only OrderTotals and OrderCard overrides; merge-kit and rulings.css header |
| 5 | 2 | 63e3a21 | docs | parity.md §5 and §6 row; 02-UI-SPEC.md intentional-differences row |
| 6 | 3 | 32015bc | test (RED) | Owner-review before/after tests |
| 7 | 3 | 69a48f3 | feat (GREEN) | BEFORE_AFTER_CASES, planBeforeAfterShots, captureBeforeAfter, the index section; owner-review.md guide |
| 8 | 3 | 46e7662 | docs | REVIEW-FIX-dotnet (NET-WR-02 fixed, NET-IN-01 ruled keep), deferred-items, DECISIONS |

## What changed

- **Oracle and vectors.** `computeExpected` returns `subtotal, discount, total, paid, balance, expenses, profit, fullyPaid` in that order. `total = subtotal − discount`, `balance = total − paid` and `profit = total − expenses`. The vector file was regenerated with `--write` (never hand-edited). It is at `version: 2` with 220 cases, and every `expected` has `subtotal` and `total`.
- **C#.** `OrderMathResult(Subtotal, Discount, Total, Paid, Balance, Expenses, Profit, FullyPaid)`. Each parameter has an XML doc citing PRD §5.1. The FullyPaid doc states the D-41 R2-06 / NET-IN-01 "keep" rule. `DiscountAmount`'s parameter is now `subtotal`. New tests: `TheTotalIsTheSubtotalMinusTheDiscount`, `AHundredPercentDiscountWithNoPaymentIsFullyPaid`, and the renamed `AHundredPercentDiscountEqualsTheSubtotalAndTheBalanceIsMinusPaid`. The xUnit loader uses a copy of `JsonSerializerOptions.Web` with `UnmappedMemberHandling = Disallow` and `RespectRequiredConstructorParameters = true`.
- **TS.** `Totals` gained `subtotal`, with a `SPEC-DEVIATION: D-41 R2-06` comment. `orderTotals` computes the same way as C#. `discountAmount`'s parameter is now `subtotal`. The round2 SPEC-DEVIATION note no longer claims D.1's return shape for orderTotals. The Pitfall-13 `specOrderTotals` guard still catches the unmodified D.1 rounding.
- **UI.** The OrderTotals first row reads "Subtotal" (`t.subtotal`). The note reads "Profit = Subtotal − Discount − Expenses. Internal only." (U+2212). A SPEC-DEVIATION comment is in the header. Nothing else changed: no row was added, and every element, class and order is the same.
- **Demo data.** In TABLE_ROWS, the "Total" column now shows the PRD Total: ORD-2026-0148 ₱21,327.50 and ORD-2026-0151 ₱22,500.00. The other rows have no discount and are unchanged.

### Reworded vector notes

Before discount is now "subtotal" everywhere. D-09's "items total" stays where it is used.
- midpoint-021..032: "…% of centavo **total** X" → "…% of centavo **subtotal** X" (and in the generator, `wholePesoTotals` / `centavoTotals` → `…Subtotals`, plus the "total/percent pairs" comment → "subtotal/percent pairs")
- ord-2026-0151: "23,000 - 500 - 22,500 = 0, fully paid" → "subtotal 23,000 - discount 500 = total 22,500; - paid 22,500 = 0, fully paid"
- percent-100-001: "discount equals total" → "discount equals subtotal, total 0, fully paid"
- percent-100-006: "discount above the total" → "discount above the subtotal"
- negative-balance-001: "a fixed discount above the total" → "…above the subtotal"
- negative-balance-003: "paid the full total despite a 2.5% discount" → "paid the full subtotal despite a 2.5% discount"
- negative-balance-004: "above a 1.00 total" → "above a 1.00 subtotal"
- negative-balance-006: "above a 40.00 total" → "above a 40.00 subtotal"
- large-value-012: "paid twice the largest total" → "paid twice the largest items total"
- Kept: negative-balance-005 "three payments above the total". It has no discount, so the PRD Total equals the subtotal there and the word is correct.

## Measured values

- **Golden vectors:** `node web/scripts/gen-golden-vectors.mjs --check` reports that the file matches the oracle (220 cases). The shape check (`version === 2`, 220 cases, `subtotal` and `total` in every case) exits 0.
- **dotnet:** `dotnet test --project tests/Csps.Domain.UnitTests` passed 399 of 399. `dotnet build Csps.slnx -tl:off --no-incremental` has 0 warnings and 0 errors. `dotnet format Csps.slnx --verify-no-changes` exits 0.
- **Coverage gate** (`Invoke-CoverageGate.ps1`, `CSPS_TEST_SQL=localdb` set for that process only): Csps.Domain line 100% (335/335) and branch 100% (142/142), PASS. Csps.Application line 100% (38/38), PASS.
- **Parity, RED evidence** (`@money|@data`, before the overrides): 40 failed and 2 passed. The failures were order-totals-* and order-card-* (the dt width and the pixels).
- **Parity, GREEN** (`@reference|@money|@data`): 48 passed and 0 failed (Chromium 20, Firefox 14, WebKit 14). TOLERANCE_OVERRIDES stays empty.
- **Showcase e2e** (`npm --prefix web run e2e -- showcase.spec`): 30 passed.
- **Owner-review pack** (`npm --prefix web run review`) exits 0. It wrote 6 PNGs under `artifacts/owner-review/before-after/`, and `index.html` has the section and the `D-41 (R2-06)` row in the differences table. The pages logged no errors. `git check-ignore` confirms the pictures are ignored. I looked at the pictures: before shows "Total" and the Total note, after shows "Subtotal" and the Subtotal note, and the table's after picture shows ₱21,327.50 and ₱22,500.00.
- **`npm --prefix web run verify`** exits 0. Vitest: 107 files and 3020 tests passed. Coverage: statements 98.21%, branches 96.45%, functions 99.81%, lines 99.82%, all thresholds held. Production build: public JS 126.18 KB and CSS 13.01 KB. `build:budget`: public JS 131.58 KB / 150, admin JS 156.72 KB / 250 and CSS 13.01 KB / 35, all ok and no limit raised. The license gate and notices check both passed.
- Preflight ran before every Playwright run and before the coverage gate. All four ports were free each time, and no process was stopped.

## Deviations from Plan

### Auto-adjusted

**1. [Rule 3 - Blocking] `beforeAfterScript(id, swaps)` instead of `beforeAfterScript(swaps)`**
- **Found during:** Task 3
- **Issue:** the page script has to find the one `[data-case]` frame. A string script cannot take a Playwright argument here, because `page.evaluate` with a string evaluates an expression.
- **Fix:** the case id goes into the script as JSON, next to the swaps. A small exported `assertSwapsApplied(id, swaps, counts)` throws a clear error naming the case when the frame is missing or a swap matches nothing. Both are unit-tested: the script runs in a `node:vm` context against a fake text-node tree, because the node TS program has no DOM.
- **Commits:** 32015bc, 69a48f3

**2. [Rule 3 - Blocking] The "ids are scenario ids" test reads the group sources**
- **Issue:** importing `src/dev/scenarios` into the node-program test would pull `import.meta.glob` (vite/client types) into `tsconfig.node.json`.
- **Fix:** the test checks that each id is declared as `…Case('<id>'` in `src/dev/scenarios/groups/*.ts`. The real run also fails if the showcase has no single frame for an id.

No other deviations. The plan's scope decisions were followed as written.

## Notes for later phases

- **Phase 5/7 DTOs:** the PRD names `DiscountAmount`, `TotalPaid` and `TotalOrderExpenses` were **not** renamed, because they are outside R2-06. The code keeps `Discount` / `Paid` / `Expenses`, and the labels "Total Discount" / "Total Paid" are unchanged. The order DTOs, list columns (ORD-01 "Total") and the PRD §16 reconciliation should follow PRD §5.1. `Total` is always the after-discount amount.
- **02-UAT.md test 6** ("Order math naming decision") is now the owner's before/after review. The owner chose (a). Confirming the wording happens in `artifacts/owner-review/index.html` → "Wording changes for you to confirm".
- The DECISIONS.md R2-06 row stays "awaiting owner before/after review" until the owner approves the wording or asks for a change, for example a "Total" (after discount) row.

## Owner decisions

None new. Nothing outside D-41 R2-06 needed a decision, so no item was added to DECISIONS.md. The only open owner action is the before/after confirmation that R2-06 itself asks for.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change was added. The owner-review pack writes only through `assertWritable` into the git-ignored `artifacts/owner-review/`.

## TDD Gate Compliance

All three tasks committed RED before GREEN: c985508 → 38db727, 5f467d5 → 78a26ca (with parity RED evidence: 40 failed), and 32015bc → 69a48f3. The RED runs failed for the expected reasons: missing `subtotal`, version 1, the C# compile errors on `Subtotal` and the 8-value result, the missing overrides, and the missing exports.

## Self-Check: PASSED
