---
created: 2026-10-13T13:30:40-05:00
updated: 2026-10-13T13:30:40-05:00
phase: quick-261013-ihp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
  - web/visual/reference/fragments/OrderTotals.tsx
  - web/visual/reference/fragments/OrderCard.tsx
  - web/visual/reference/merge-kit.ts
  - web/visual/reference/merge-kit.test.ts
  - web/visual/reference/rulings.css
  - web/visual/reference/rulings.test.ts
  - docs/web/parity.md
  - .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md
  - web/scripts/owner-review.mjs
  - web/scripts/owner-review.test.ts
  - docs/web/owner-review.md
  - .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-dotnet.md
  - .planning/phases/02-web-foundation-design-system/deferred-items.md
  - .planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md
autonomous: true
requirements:
  - WEB-07
  - WEB-02

estimate:
  tokens: 150000
  raw_tokens: 150000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "D-41 R2-06 / NET-WR-02: the server order math uses the PRD §5.1 names. `OrderMathResult` has `Subtotal` (the rounded sum of quantity x unit price, before discount) and `Total` (`Subtotal - Discount`, after discount). `Balance = Total - Paid` and `Profit = Total - Expenses`. Every amount equals what it was before the rename"
    - "Schema rule checked: no EF entity, configuration, migration, table, column or API DTO carries these order-math names in Phase 2 (only src/Csps.Domain/Orders uses OrderMath, and tools/openapi-gen/openapi.v1.json has no total). The rename is code-only, so no database one-way door is touched"
    - "The browser preview `orderTotals()` in web/src/lib/csps.ts returns `subtotal` and `total` with the same meanings. Both runners, xUnit OrderMathGoldenVectorTests and Vitest csps.golden.test.ts, pass every case of the regenerated shared vector file. That file is at version 2, and every `expected` holds `subtotal` and `total`. `node web/scripts/gen-golden-vectors.mjs --check` passes"
    - "NET-IN-01 is ruled keep (D-41 R2-06): `FullyPaid` is `Subtotal > 0 and Balance <= 0` in the oracle, the C# math and csps.ts. A 100%-discounted order with no payment reads 'Fully Paid', and an empty order does not. Each side has a test for this"
    - "The OrderTotals panel and the card show 'Subtotal' on the first row with the before-discount figure. The panel note reads 'Profit = Subtotal − Discount − Expenses. Internal only.' (U+2212 minus). 'Total Discount', 'Total Paid', 'Balance due' / 'Balance' + 'Fully Paid', 'Order Expenses' and 'Estimated Profit' are unchanged. The Component Showcase shows the new words, and its demo Orders table's 'Total' column shows the after-discount total (ORD-2026-0148 ₱21,327.50, ORD-2026-0151 ₱22,500.00)"
    - "The look-equality proof is equal for @reference, @money and @data in all three engines with no tolerance. Reference-only `SPEC_OVERRIDES` entries `OrderTotals → D-41` and `OrderCard → D-41` write the same words into the frozen rows and note. The difference is recorded in docs/web/parity.md §5 and §6, the rulings.css header (pinned by rulings.test.ts) and the 02-UI-SPEC.md intentional-differences list"
    - "The owner-review pack (`npm --prefix web run review` → artifacts/owner-review/index.html) has a 'Wording changes for you to confirm' section. Each case has a before picture (approved wording) and an after picture (PRD wording), plus a wording table. The pictures are under the git-ignored artifacts/owner-review/before-after/"
    - "The records are updated. 02-REVIEW-FIX-dotnet.md shows NET-WR-02 fixed by D-41 R2-06 and NET-IN-01 closed as 'ruled: keep'. The DECISIONS.md R2-06 row reads 'implemented, awaiting owner before/after review'. The deferred-items.md NET-WR-02 entry is updated"
    - "`npm --prefix web run verify` exits 0, `dotnet build Csps.slnx` has zero warnings, Csps.Domain coverage stays 100% line and branch, and no budget limit is raised"
  artifacts:
    - path: "tests/fixtures/order-math-golden-vectors.json"
      provides: "Shared golden vectors, version 2, with expected.subtotal and expected.total"
      contains: "\"subtotal\""
    - path: "src/Csps.Domain/Orders/OrderMathModels.cs"
      provides: "OrderMathResult(Subtotal, Discount, Total, Paid, Balance, Expenses, Profit, FullyPaid) with the D-41 R2-06 / NET-IN-01 XML doc"
      contains: "Subtotal"
    - path: "web/src/lib/csps.ts"
      provides: "Totals { subtotal, discount, total, paid, balance, expenses, profit, fullyPaid } and orderTotals() in PRD names"
      contains: "subtotal"
    - path: "web/src/ui/money/OrderTotals.tsx"
      provides: "First row 'Subtotal', note 'Profit = Subtotal − Discount − Expenses. Internal only.', SPEC-DEVIATION D-41 R2-06"
      contains: "Subtotal"
    - path: "web/visual/reference/fragments/OrderTotals.tsx"
      provides: "Reference-only override (SPEC_OVERRIDES OrderTotals → D-41) that renders the frozen OrderTotals unchanged and writes the D-41 R2-06 words after mount"
    - path: "web/visual/reference/fragments/OrderCard.tsx"
      provides: "Reference-only override (SPEC_OVERRIDES OrderCard → D-41) for the frozen OrderCard's internal totals block"
    - path: "web/scripts/owner-review.mjs"
      provides: "BEFORE_AFTER_CASES, planBeforeAfterShots and the before/after section of index.html"
      contains: "BEFORE_AFTER_CASES"
    - path: "docs/web/parity.md"
      provides: "§6 row for D-41 (R2-06) and the §5 override paragraph"
      contains: "R2-06"
  key_links:
    - from: "web/scripts/golden-math.mjs computeExpected"
      to: "tests/fixtures/order-math-golden-vectors.json → OrderMathGoldenVectorTests.cs and csps.golden.test.ts"
      via: "one regenerated vector file, read by both runners, with the same subtotal/total shape"
      pattern: "subtotal"
    - from: "web/src/lib/csps.ts orderTotals().subtotal"
      to: "web/src/ui/money/OrderTotals.tsx first row"
      via: "the 'Subtotal' row reads t.subtotal; t.total is the after-discount figure"
      pattern: "t.subtotal"
    - from: "web/src/ui/money/OrderTotals.tsx labels"
      to: "web/visual/reference/fragments/OrderTotals.tsx and OrderCard.tsx"
      via: "the reference writes the same words, typed from the ruling and not imported, so a wording slip fails the pixel step"
      pattern: "Subtotal"
    - from: "docs/web/parity.md §6"
      to: "web/scripts/owner-review.mjs parseDifferencesTable"
      via: "the new D-41 (R2-06) row shows in the pack's differences table"
      pattern: "R2-06"
---

<objective>
Implement owner ruling **D-41 / R2-06** (owner, 2026-10-13; `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md` D-41 "Order math (R2-06)", `.planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md` "Owner answers, 2026-10-13"). The ruling: follow the PRD order-math names everywhere. **Subtotal** is the amount before discount, and **Total** is the amount after discount. Use PRD §5.1 exactly: `Subtotal = Σ item.LineTotal`, `Total = Subtotal − DiscountAmount`, `Balance = Total − TotalPaid`. The ORD-07 display labels are "Subtotal" and "Total". A 100%-discounted, unpaid order keeps reading **"Fully Paid"** (NET-IN-01 closes as "ruled: keep"). This closes code-review warning **NET-WR-02**.

Purpose: Core Value. Staff must see correct, server-computed totals. Before Phase 5/7 build DTOs, list columns and the PRD §16 reconciliation on these names, "Total" must mean the after-discount amount on the server, in the browser preview, in the shared golden vectors and on every screen.

Output: three TDD tasks.
1. Tracer: the rename end to end. It goes from the exact-rational oracle through the regenerated vector file and both runners to the C# and TS math, and on to the OrderTotals panel and its consumers. This cannot be split without a red intermediate commit, because changing what `Totals.total` means immediately changes what the panel shows.
2. The look-equality proof: reference-only overrides plus the intentional-difference records (D-41 R2-06).
3. The owner's before/after of the panel wording in the owner-review pack, plus the review/decision records and a full verify.

Scope decisions, made at Claude's discretion and recorded so the executor does not revisit them:
- Only Subtotal and Total are renamed, because that is what D-41 R2-06 defines. The other PRD §5.1 names (`DiscountAmount`, `TotalPaid`, `TotalOrderExpenses`) are not part of the ruling. The code keeps `discount`/`paid`/`expenses`, and the approved labels "Total Discount" / "Total Paid" stay. Note this for the Phase 7 DTO work in the SUMMARY.
- The panel gets no new "Total" (after discount) row. The ruling changes the panel **label**, and adding a row would be a new element with no ruling (D-08). The pack's before/after section says so in plain words, so the owner can ask for one.
- The note "Profit = Total − Discount − Expenses." would be wrong under the PRD names, because the discount would count twice. It becomes "Profit = Subtotal − Discount − Expenses. Internal only.", which is the smallest wording change that keeps the meaning. It appears in the before/after.
- The pinned `operationOrder` text ("round the items total; …") is D-09's own wording (02-CONTEXT.md D-09), so it stays. "Items total" describes the PRD Subtotal, and the comments say so. The vector file `version` goes from 1 to 2 because the `expected` shape changes.
- Schema rule: no order table, EF entity, migration or API DTO exists in Phase 2 (verified with grep: OrderMath lives only in src/Csps.Domain/Orders, and tools/openapi-gen/openapi.v1.json has no "total"). This is a code-only rename, and no column is renamed.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@.planning/phases/02-web-foundation-design-system/02-CONTEXT.md
@.planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md
@.planning/quick/261013-g6s-implement-d-41-approved-phase-2-fixes-r2/261013-g6s-SUMMARY.md
@docs/web/parity.md

Binding rules for every task (from CLAUDE.md, .claude/CLAUDE.md and the user's memory):
- TDD. Write the failing test first, run it and see it fail, then commit RED (`test(quick-261013-ihp): …`). Implement and see it pass, then commit GREEN (`fix(quick-261013-ihp): …`). Docs-only commits are `docs(quick-261013-ihp): …`. Refactor only on green.
- Zero warnings everywhere: dotnet build and analyzers, ESLint `--max-warnings 0`, typecheck (three programs), Prettier, tests, the browser console and axe.
- Money stays server-computed (D-09). Components only format figures, and the browser math is a golden-vector-proven preview.
- Never edit `CSPS-UI-SPEC.md`, `.planning/design/` or anything under `web/visual/.reference-src/`. They are the frozen, SHA-256-pinned approved design. Never commit `.planning/design/`, `_local/` or `artifacts/`.
- Before ANY Playwright run (`npm --prefix web run parity`, `npm --prefix web run e2e`, `npm --prefix web run review`) and before the coverage gate, run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`. If a port is in use by another project, or TheBETSLLC test processes are listed, WAIT and retry. Never kill another project's process. Never set machine- or user-level environment variables. Set any variable (for example `CSPS_TEST_SQL=localdb`) per process only.
- No npx downloads, no new packages and no budget changes. Use only the project's npm scripts and `node` on project scripts. If `build:budget` fails, stop and report it as a blocker.
- Every .md file you edit keeps its own timestamp format, either YAML `created:`/`updated:` front matter or the italic `*Created: … · Updated: …*` line. Bump **Updated** to the real edit time with the America/Chicago offset (`-05:00` in October). Get the time from PowerShell `Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"`, because Git Bash `date` reports UTC here. A new .md file gets both Created and Updated, and that includes the SUMMARY.
- Code-level deviation records are inline `SPEC-DEVIATION:` comments, as the existing code does. The project's difference records are docs/web/parity.md §6 (read by `web/scripts/owner-review.mjs`), the rulings.css header and the 02-UI-SPEC.md intentional-differences list.
- Do not edit `.planning/STATE.md`. The /gsd-quick orchestrator records the task there.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): Subtotal / Total end to end, from the oracle and shared vectors through C# and TS to the OrderTotals panel (D-41 R2-06, NET-WR-02, NET-IN-01)</name>
  <files>web/scripts/golden-math.mjs, web/scripts/golden-math.test.ts, web/scripts/gen-golden-vectors.mjs, web/scripts/gen-golden-vectors.test.ts, tests/fixtures/order-math-golden-vectors.json, src/Csps.Domain/Orders/OrderMath.cs, src/Csps.Domain/Orders/OrderMathModels.cs, tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs, tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs, web/src/lib/csps.ts, web/src/lib/csps.test.ts, web/src/lib/csps.golden.test.ts, web/src/ui/money/OrderTotals.tsx, web/src/ui/money/money.test.tsx, web/src/ui/data/data.test.tsx, web/src/dev/scenarios/groups/data.ts, web/src/dev/scenarios/groups/money.ts</files>
  <read_first>
    - CSPS-PRD.md lines 160-185 (§5.1 computed values: Subtotal, DiscountAmount, Total, TotalPaid, Balance) and line 256 (ORD-07 labels)
    - .planning/phases/02-web-foundation-design-system/02-REVIEW.md "NET-WR-02" and "NET-IN-01" (around lines 368-408)
    - web/scripts/golden-math.mjs (computeExpected, the VectorExpected typedef, OPERATION_ORDER)
    - web/scripts/gen-golden-vectors.mjs (the `version: 1` writer near line 500, case notes that use the word "total", wholePesoTotals / centavoTotals)
    - web/scripts/golden-math.test.ts and web/scripts/gen-golden-vectors.test.ts (the expected-shape and version pins)
    - src/Csps.Domain/Orders/OrderMath.cs and OrderMathModels.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs and OrderMathGoldenVectorTests.cs (VectorExpected record, Format, Load with JsonSerializerOptions.Web)
    - web/src/lib/csps.ts lines 90-110 (Totals), 180-195 (SPEC-DEVIATION round2 note), 255-295 (discountAmount, orderTotals)
    - web/src/lib/csps.test.ts and web/src/lib/csps.golden.test.ts
    - web/src/ui/money/OrderTotals.tsx and web/src/ui/money/money.test.tsx (rows near 170, 216, 234, 271-289, 320, 337, 557 ZERO_TOTALS)
    - web/src/ui/data/data.test.tsx (card rows near 99-130, the table-figures test near 545)
    - web/src/dev/scenarios/groups/data.ts (header comment, TABLE_ROWS) and money.ts (header comment)
  </read_first>
  <behavior>
    - Oracle (golden-math.test.ts): computeExpected returns `subtotal` (the rounded items total) and `total` (`subtotal − discount`), with balance = total − paid and profit = total − expenses. For example, spec §12.2 ORD-2026-0148 gives subtotal 22450.00, discount 1122.50, total 21327.50 and balance 9327.50. 3 x 17.00 with 100% off and no payment gives subtotal 51.00, total 0.00, balance 0.00 and fullyPaid true. An empty order gives fullyPaid false.
    - Generator (gen-golden-vectors.test.ts): the written file has `version: 2`, the unchanged D-09 operationOrder text, and every case's `expected` keys in this order: subtotal, discount, total, paid, balance, expenses, profit, fullyPaid.
    - C# (OrderMathTests.cs): `OrderMathResult` exposes Subtotal and Total. An empty order equals `new OrderMathResult(0m, 0m, 0m, 0m, 0m, 0m, 0m, FullyPaid: false)` (8 values). The test now named `AHundredPercentDiscountEqualsTheSubtotalAndTheBalanceIsMinusPaid` checks that Discount equals Subtotal and that Total is 0. A new test, `AHundredPercentDiscountWithNoPaymentIsFullyPaid` (NET-IN-01 ruled keep), checks FullyPaid true with Balance 0. A test proves Total = Subtotal − Discount for a mixed fixed + percentage case.
    - C# golden (OrderMathGoldenVectorTests.cs): version 2, VectorExpected has Subtotal and Total, and deserialization fails closed. A missing or unknown member is an error: use a copy of JsonSerializerOptions.Web with `UnmappedMemberHandling = Disallow` and `RespectRequiredConstructorParameters = true`.
    - TS (csps.test.ts, csps.golden.test.ts): orderTotals returns `{ subtotal, discount, total, paid, balance, expenses, profit, fullyPaid }`, and a 100%-discounted unpaid order is fullyPaid. The golden runner pins version 2, and its `expected` type and `asExpected` carry subtotal and total. The unmodified-spec `specOrderTotals` Pitfall-13 guard keeps working.
    - UI (money.test.tsx, data.test.tsx): the panel and card first row reads ['Subtotal', '₱22,450.00'] for ORD-2026-0148. The panel note reads `Profit = Subtotal ${MINUS} Discount ${MINUS} Expenses. Internal only.`. A preview of a 100%-discounted order with no payment shows "Fully Paid". Server `totals` objects in the tests carry `subtotal`. The demo table-figures test compares each row's `total` with orderTotals' after-discount `total`.
  </behavior>
  <action>
    RED first. Update every test listed in `<behavior>` (per D-41 R2-06). Then run the Vitest paths and the Domain tests and see them fail. The C# test project must fail to compile or fail on the 8-value result, and the Vitest runs must fail on the missing `subtotal`. Commit RED.

    GREEN, in this order:
    (1) Oracle, web/scripts/golden-math.mjs. Rename the local `total` to `subtotal` and add `total = subtotal − discount`. Return the keys in the order subtotal, discount, total, paid, balance, expenses, profit, fullyPaid. Keep `fullyPaid` as subtotal > 0 and balance <= 0, which is the D-41 R2-06 / NET-IN-01 "keep" ruling: a 100%-discounted unpaid order is fully paid. Update the VectorExpected typedef. Add one comment line saying that D-09's "items total" is the PRD §5.1 Subtotal. OPERATION_ORDER stays word for word, because it is D-09's wording.
    (2) Generator, web/scripts/gen-golden-vectors.mjs. Write `version: 2`. Reword the case notes so that the bare word "total" never means the before-discount amount. Check each note against its own numbers: before discount is "subtotal" and after discount is "total". D-09's phrase "items total" may stay. Optionally rename wholePesoTotals / centavoTotals to …Subtotals. Then run `node web/scripts/gen-golden-vectors.mjs --write` to regenerate tests/fixtures/order-math-golden-vectors.json. Never hand-edit that file.
    (3) C# Domain. In OrderMathModels.cs make `OrderMathResult(decimal Subtotal, decimal Discount, decimal Total, decimal Paid, decimal Balance, decimal Expenses, decimal Profit, bool FullyPaid)`, with an XML doc for every parameter that cites PRD §5.1. The FullyPaid doc must state the owner ruling D-41 R2-06 (NET-IN-01, ruled keep): true when the subtotal is above zero and the balance is zero or less, so a fully discounted order with no payment reads fully paid and an empty order does not. In OrderMath.cs compute subtotal, discount (a percentage applies to the rounded subtotal; rename the `itemsTotal` parameter of DiscountAmount to `subtotal`), total = subtotal − discount, balance = total − paid and profit = total − expenseTotal. Update the summary and remarks to the PRD names. Keep Csps.Domain at 100% line and branch.
    (4) Browser math, web/src/lib/csps.ts. Give `Totals` the fields `subtotal`, discount, `total`, paid, balance, expenses, profit and fullyPaid, with a `SPEC-DEVIATION: D-41 R2-06 (owner, 2026-10-13)` comment: App. D.1's `total` was the before-discount amount, and the PRD names are now used. orderTotals computes the same way as the C# side. Update its doc block to "Subtotal = Σ qty × unit price · Discount = Σ discounts · Total = Subtotal − Discount · Paid … · Balance = Total − Paid · Profit = Total − Expenses · Fully paid = Subtotal > 0 and Balance ≤ 0". Rename discountAmount's `itemsTotal` parameter to `subtotal`; its behaviour and name stay the same. Also fix the existing round2 SPEC-DEVIATION note, which says orderTotals keeps D.1's "return shapes": the shape now differs by D-41 R2-06.
    (5) Panel, web/src/ui/money/OrderTotals.tsx. The first row becomes the label "Subtotal" with `t.subtotal`. The internal note text becomes "Profit = Subtotal − Discount − Expenses. Internal only." with U+2212 minus signs. Every other label, element, class and order stays as it is. Add a `SPEC-DEVIATION: D-41 R2-06 (owner, 2026-10-13)` comment: App. D.3 labels the before-discount figure "Total" and its note says "Profit = Total − Discount − Expenses.", and both follow the PRD names now. Update the file's header comment, which lists the rows.
    (6) Demo data, web/src/dev/scenarios/groups/data.ts. TABLE_ROWS `total` now holds the PRD Total (after discount) under the unchanged "Total" column: ORD-2026-0148 21327.5, ORD-2026-0151 22500, and the others unchanged because they have no discount. Update the header comment and the TABLE_ROWS doc to "Total = Subtotal − Discount (PRD §5.1, D-41 R2-06); Balance = Total − Paid". In money.ts, update only the header comment wording where it names the figures.
    Run the verify commands. All of them must be green with zero warnings. Commit GREEN.

    Between this task and Task 2, the @money and @data parity rows are expected to differ, because the implementation says "Subtotal" and the frozen reference says "Total". Task 2 fixes that, and parity is not part of verify.
  </action>
  <verify>
    <automated>node web/scripts/gen-golden-vectors.mjs --check</automated>
    <automated>npm --prefix web run test -- --run src/lib src/ui/money src/ui/data src/dev scripts/golden-math scripts/gen-golden-vectors</automated>
    <automated>dotnet test --project tests/Csps.Domain.UnitTests</automated>
    <automated>dotnet build Csps.slnx -tl:off --no-incremental</automated>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1</automated>
    <automated>node -e "const f=require('./tests/fixtures/order-math-golden-vectors.json');const bad=f.cases.filter(c=>!('subtotal' in c.expected)||!('total' in c.expected));process.exit(f.version===2&&f.cases.length===220&&bad.length===0?0:1)"</automated>
  </verify>
  <done>Every vector case has expected.subtotal and expected.total, the file is at version 2, and `--check` passes. xUnit (Domain) and Vitest (lib, money, data, dev, golden scripts) are green. Csps.Domain is at 100% line and branch, and the solution builds with 0 warnings. The OrderTotals first row reads "Subtotal" and the note reads "Profit = Subtotal − Discount − Expenses. Internal only.". A 100%-discounted unpaid order is fully paid in the oracle, C# and TS. RED and GREEN commits exist.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The look-equality proof stays equal: reference-only OrderTotals / OrderCard overrides write the D-41 R2-06 words, plus the intentional-difference records</name>
  <files>web/visual/reference/fragments/OrderTotals.tsx, web/visual/reference/fragments/OrderCard.tsx, web/visual/reference/merge-kit.ts, web/visual/reference/merge-kit.test.ts, web/visual/reference/rulings.css, web/visual/reference/rulings.test.ts, docs/web/parity.md, .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md</files>
  <precondition>web/visual/.reference-src/ui/index.tsx exists (the git-ignored frozen extraction). If it is missing, run `node web/visual/reference/extract-spec.mjs`, which writes only when the SHA-256 pin matches.</precondition>
  <read_first>
    - web/visual/reference/fragments/Topbar.tsx (the D-41 R2-04 SPEC_OVERRIDES pattern: frozen component through import.meta.glob, rendered unchanged with no wrapper, text rewritten after mount)
    - web/visual/reference/fragments/WalkInOrderCard.tsx and DefinedTotalsNote.tsx (the D-40 text-only pattern; they wrap kit OrderCard / OrderTotals, which become the overrides)
    - web/visual/.reference-src/ui/index.tsx lines 386-445 (frozen OrderTotals: `.csp-totals-row` > dt, `.csp-totals-note`; frozen OrderCard renders the frozen OrderTotals internally)
    - web/visual/reference/merge-kit.ts and merge-kit.test.ts (SPEC_OVERRIDES pin, the real-fragments describe block)
    - web/visual/reference/rulings.css header (the D-40 and D-41 R2-04 "no rule here" bullets) and rulings.test.ts (the D-40 no-rule-group test near line 119)
    - docs/web/parity.md §5 (the Topbar override paragraph near line 144) and §6 (the table near lines 149-171)
    - .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md intentional-differences rows near lines 232-252
  </read_first>
  <behavior>
    - merge-kit.test.ts: SPEC_OVERRIDES equals exactly [['Topbar','D-41'], ['OrderTotals','D-41'], ['OrderCard','D-41']] in that order. The real-fragments block reads OrderTotals and OrderCard as both frozen and fragment names. Merging without the overrides throws and names each of Topbar, OrderTotals and OrderCard. Shadowing any other frozen name still throws.
    - rulings.test.ts: there is no rule group whose comment starts with 'D-41 R2-06', and the header contains 'D-41 R2-06', 'OrderTotals', 'OrderCard' and '"Subtotal"'. This mirrors the D-40 test.
    - Parity (Playwright, the real proof): before the overrides, @money order-totals-* and @data order-card-* fail on the first-row text (and the panel note). After them, they are equal in Chromium, Firefox and WebKit with no tolerance.
  </behavior>
  <action>
    RED first. Update merge-kit.test.ts and rulings.test.ts as in `<behavior>`, run them and see them fail. Run preflight, then parity for `@money|@data`, and record the expected failures (the Task 1 state) as RED evidence. Commit the RED tests.

    GREEN (per D-41 R2-06, using the D-41 R2-04 Topbar override pattern rather than a new wrapper pair). An override reaches every place the frozen totals render, including the frozen OrderCard's internal OrderTotals and the existing DefinedTotalsNote / WalkInOrderCard wrappers, and it keeps every DOM path the approved one, so STRUCTURAL_EXCEPTIONS does not change.
    - Create web/visual/reference/fragments/OrderTotals.tsx. Load the frozen OrderTotals exactly as Topbar.tsx loads the frozen Topbar, throwing the same "run extract-spec" error if it is missing. Export a camelCase helper `writePrdTotalsWording(root)`. Within `root` it changes every `.csp-totals-row > dt` whose text is exactly "Total" to "Subtotal", and every `.csp-totals-note` whose text is exactly "Profit = Total − Discount − Expenses. Internal only." to "Profit = Subtotal − Discount − Expenses. Internal only." (U+2212). It is idempotent and touches nothing else, so "Total Discount" and "Total Paid" stay. Type the words in the file from the ruling. Do not import them from the app, so that a wording slip on either side fails the pixel step (as D-40 did). Export `OrderTotals(props)`: it renders the frozen component with the same props and no wrapper element, and calls the helper on `document` in a useEffect with no dependency list, as Topbar does. Write a header comment in the Topbar.tsx style that cites D-41 R2-06.
    - Create web/visual/reference/fragments/OrderCard.tsx the same way for the frozen OrderCard, importing the helper from ./OrderTotals. The frozen OrderCard draws the frozen OrderTotals internally, which the OrderTotals override cannot reach.
    - merge-kit.ts: SPEC_OVERRIDES becomes a Map with Topbar, OrderTotals and OrderCard, each mapped to 'D-41'. Extend its doc list with one bullet each: R2-06, the overrides render the pinned frozen component unchanged and only write the PRD wording after mount.
    - rulings.css header: add a bullet after the D-41 R2-04 bullet saying that D-41 R2-06 (owner, 2026-10-13) has no rule here, because it changes text, not a look ("Subtotal" and the profit note). The reference-only OrderTotals and OrderCard overrides write the words after mount.
    - docs/web/parity.md §5: after the Topbar paragraph, add a paragraph on the two R2-06 overrides, and change "holds exactly `Topbar → D-41`" to the three entries. §6: add the row "OrderTotals first row reads "Subtotal" (the amount before discount) and the panel note reads "Profit = Subtotal − Discount − Expenses. Internal only." (App. D.3: "Total" and "Profit = Total − Discount − Expenses.") | D-41 (R2-06) | Text only: the reference-only `OrderTotals` and `OrderCard` overrides (`SPEC_OVERRIDES`, D-41) write the same words into the frozen rows and note, so equal (no CSS rule)". Keep the cells free of pipe characters, because owner-review's parseDifferencesTable reads this table. Bump Updated.
    - 02-UI-SPEC.md intentional-differences list: add the matching D-41 R2-06 row after the R2-04 row, in the same style ("Text only: the reference-only OrderTotals and OrderCard overrides (SPEC_OVERRIDES) write the same words → equal"). Also add the plain fact that a 100%-discounted unpaid order still reads "Fully Paid" (D-41 R2-06, NET-IN-01 ruled keep). Bump Updated.
    Run the unit tests, then preflight, then parity and the showcase e2e. A remaining parity difference must be fixed in the override, never with a tolerance: TOLERANCE_OVERRIDES stays empty (T-02-39). Commit GREEN, with the docs in a `docs(quick-261013-ihp): …` commit.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run visual/reference visual/compare</automated>
    <automated>npm --prefix web run parity -- --grep "@reference|@money|@data"</automated>
    <automated>npm --prefix web run e2e -- showcase.spec</automated>
    <automated>npm --prefix web run typecheck</automated>
  </verify>
  <done>SPEC_OVERRIDES is exactly Topbar, OrderTotals and OrderCard → D-41, and both pins pass. Parity for @reference, @money and @data passes in all three engines with TOLERANCE_OVERRIDES empty. The showcase e2e passes with no console errors or axe violations. The D-41 (R2-06) difference is in docs/web/parity.md §6, the rulings.css header and the 02-UI-SPEC.md list.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Owner-review before/after of the panel wording, the review and decision records, and the final verify</name>
  <files>web/scripts/owner-review.mjs, web/scripts/owner-review.test.ts, docs/web/owner-review.md, .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-dotnet.md, .planning/phases/02-web-foundation-design-system/deferred-items.md, .planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md</files>
  <read_first>
    - web/scripts/owner-review.mjs: typedefs (lines 37-64), planReview's capture step, SPEC_GAP_CASES / planSpecGapShots (around 551-600), captureSpecGap (around 823-880, string page scripts and SETTLE), captureShots, renderIndex / specGapSection / paritySection, writeReport
    - web/scripts/owner-review.test.ts: the planReview capture-step expectations (near lines 76 and 205), the SPEC_GAP_CASES and renderIndex describe blocks
    - docs/web/owner-review.md §1 and §2
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-FIX-dotnet.md (Skipped Issues → NET-WR-02) and 02-REVIEW-FIX-webui.md lines 151-182 and 256-260 (the g6s "Status: fixed … quick-261013-g6s" and "Closed:" pattern)
    - .planning/phases/02-web-foundation-design-system/deferred-items.md NET-WR-02 entry (around line 157)
    - DECISIONS.md section B R2-06, R2-29 and the "Owner answers, 2026-10-13" table row R2-06
  </read_first>
  <behavior>
    - BEFORE_AFTER_CASES (exported and frozen) holds exactly three cases, each { id, label, decision: 'D-41 (R2-06)', swaps: [{ before, after }] }:
      - 'order-totals-0148', labelled in plain words as the Order Detail totals panel. Swaps: Total → Subtotal, and the profit note from the "Total" form to the "Subtotal" form (U+2212).
      - 'order-totals-card-0148', the order card's totals block. Swap: Total → Subtotal.
      - 'data-table-orders', the demo Orders table whose Total column now shows the amount after discount. Swaps: ₱22,450.00 → ₱21,327.50 and ₱23,000.00 → ₱22,500.00.
      Every id is a scenario id in the shared scenario list, every label is plain words, and no swap has before equal to after.
    - planBeforeAfterShots() gives two shots per case (before and after), Blush, 1440 px, with files `before-after/{id}-{before|after}.png`.
    - planReview's capture step carries `beforeAfter: planBeforeAfterShots()`.
    - renderIndex({ …, beforeAfter }) renders, before the SPEC-GAP section, a section titled "Wording changes for you to confirm (before and after)". It has a plain-words note naming D-41 R2-06: Subtotal is before discount and Total is after; only the words change; a fully discounted order with no payment still reads "Fully Paid"; and the panel has no row for the Total after discount, as in the approved design, so the owner can say if they want one. It has a wording table (Place | Before | After) built from the swaps, and per case the before and after pictures side by side with escaped alt text. With no shots there is no section, and the page still has no script.
    - The before-swap page script is built from the swaps through JSON.stringify (never by concatenating raw text). Capture fails with a clear error naming the case when any swap matches no text node, so an outdated case can never produce identical before and after pictures.
  </behavior>
  <action>
    RED first. Add the owner-review.test.ts tests from `<behavior>`, run them and see them fail, then commit RED.

    GREEN in web/scripts/owner-review.mjs (per D-41 R2-06 and D-08, where a visible wording change goes to the owner as a before/after):
    - Add the typedefs BeforeAfterCase / BeforeAfterShot. Add BEFORE_AFTER_CASES, planBeforeAfterShots and a `beforeAfterScript(swaps)` builder. The builder returns a string page script, as the existing scripts do, because the node TS program has no DOM lib. The script walks the text nodes inside the `[data-case]` frame, replaces each node whose value is exactly `after` with `before`, and returns the count for each swap.
    - Add captureBeforeAfter(browser, origin, shots, problems). It opens /dev/components through openReviewPage, with the showcase target in that shot's theme and width. For each case it finds the single `[data-case=id]` frame and scrolls it into view. It runs SETTLE and saves the after picture. Then it runs the swap script, throws if any count is 0, runs SETTLE again and saves the before picture. Every path goes through assertWritable. Call it from captureShots after captureSpecGap, clear and recreate the `before-after` folder with the other folders, and return `beforeAfter` in the CaptureResult.
    - Thread `beforeAfter` through CaptureStep, CaptureResult, writeReport and renderIndex, and add beforeAfterSection, styled like specGapSection with REPORT_CSS classes. Update the file's header steps list.
    - docs/web/owner-review.md: in §1 (the screenshots row) and §2, describe the new "Wording changes for you to confirm" section and what the owner decides (approve the new wording, or say what to change). Bump Updated.

    Records (docs commit):
    - 02-REVIEW-FIX-dotnet.md: under NET-WR-02 add "**Status:** fixed by D-41 R2-06 (owner, 2026-10-13), quick-261013-ihp". Name the commits and say that the PRD names are used in C#, TS and the vectors, the panel reads "Subtotal", and the panel wording is awaiting the owner's before/after review. Add a short "Info findings closed by owner ruling" note: NET-IN-01 ruled keep (D-41 R2-06), recorded in the FullyPaid XML doc. Keep the iteration-1 counts in the front matter, as the webui report did for UI-WR-07 and UI-WR-09. Bump `updated`.
    - deferred-items.md NET-WR-02 entry: set the status to "resolved (D-41 R2-06, quick-261013-ihp): implemented; panel wording awaiting owner before/after review in artifacts/owner-review/index.html". Bump the timestamp.
    - DECISIONS.md: change the R2-06 row status to "resolved → implemented (quick-261013-ihp), awaiting owner before/after review (`npm --prefix web run review` → artifacts/owner-review/index.html, 'Wording changes for you to confirm'); NET-IN-01 closed, ruled: keep". Add an *Update (quick-261013-ihp, 2026-10-13)* line under R2-29 saying NET-WR-02 (R2-06) is closed. Bump the timestamp.

    Then run preflight and the owner-review pack (`npm --prefix web run review`). It rebuilds the e2e bundle if needed, runs the guarded CSPS_E2E seed, starts the 5199 host and captures everything including the new before/after pictures. Check the output, then run the full verify and the .NET format check. Commit GREEN and the docs commit. Never commit artifacts/.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run scripts/owner-review</automated>
    <automated>npm --prefix web run review</automated>
    <automated>node -e "const fs=require('fs');const d='artifacts/owner-review/before-after';const n=fs.readdirSync(d).filter(f=>f.endsWith('.png')).length;const h=fs.readFileSync('artifacts/owner-review/index.html','utf8');process.exit(n===6&&h.includes('Wording changes for you to confirm')&&h.includes('Subtotal')&&h.includes('R2-06')?0:1)"</automated>
    <automated>git check-ignore -q artifacts/owner-review/before-after/order-totals-0148-before.png</automated>
    <automated>npm --prefix web run verify</automated>
    <automated>dotnet format Csps.slnx --verify-no-changes</automated>
    <human-check>Owner (later, not blocking this task): open artifacts/owner-review/index.html, go to "Wording changes for you to confirm", and approve "Subtotal" and the profit note wording or say what to change. The DECISIONS.md R2-06 row stays "awaiting owner before/after review" until then.</human-check>
  </verify>
  <done>The pack's index.html has the before/after section with 6 pictures (3 cases, before and after) under the git-ignored artifacts/owner-review/before-after/, and the differences table shows the D-41 (R2-06) row. The owner-review tests pass. `npm --prefix web run verify` exits 0 with coverage thresholds holding and no budget raised, and `dotnet format --verify-no-changes` is clean. NET-WR-02 is closed in 02-REVIEW-FIX-dotnet.md, NET-IN-01 is "ruled: keep", and the DECISIONS.md and deferred-items.md entries are updated with bumped timestamps.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser preview ↔ server math | csps.ts `orderTotals` previews what Csps.Domain `OrderMath` saves. The shared golden-vector file is the contract between them (D-09). |
| look-equality proof | Reference-only overrides change what the frozen approved design shows. A loose override could hide a real difference. |
| owner-review pack | Local screenshots of the dev showcase. The "before" picture is made by a text swap on the page. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261013ihp-01 | Tampering (integrity) | OrderMathResult / Totals field meaning | high | mitigate | Both runners read one regenerated file (version 2) whose `expected` holds subtotal and total. The xUnit loader disallows unmapped members and requires constructor parameters, so a missing or renamed field fails. Vitest `toEqual` fails on a missing key. `gen-golden-vectors.mjs --check` runs in verify. |
| T-261013ihp-02 | Tampering (business rule drift) | FullyPaid for a 100%-discounted unpaid order | medium | mitigate | The rule `Subtotal > 0 and Balance <= 0` (D-41 R2-06, NET-IN-01 ruled keep) is pinned by unit tests in the oracle, C# and TS, by percent-100 vector cases, and by a UI test showing "Fully Paid". |
| T-261013ihp-03 | Tampering (proof integrity) | SPEC_OVERRIDES OrderTotals / OrderCard | medium | mitigate | merge-kit.test pins the exact three entries. The overrides render the frozen components unchanged with no wrapper and rewrite only exact-match strings typed from the ruling, not imported. TOLERANCE_OVERRIDES stays empty. |
| T-261013ihp-04 | Spoofing (misleading evidence) | owner-review before pictures | low | mitigate | The swap script is built with JSON.stringify from constant swaps. Capture throws if any swap matches nothing. The pack writes only through assertWritable into the git-ignored artifacts/owner-review/ and uses no network. |
| T-261013ihp-05 | Information disclosure | owner-review pack output | low | accept | Only dev demo data (spec §12.2 seed orders) is shown. The output is git-ignored and local only. The existing guards (git check-ignore refusal, assertWritable) are unchanged. |
| T-261013ihp-SC | Tampering | npm/pip/cargo installs | high | accept | This plan installs no package and changes no manifest or lockfile. The package-legitimacy gate does not apply. |
</threat_model>

<verification>
- `node web/scripts/gen-golden-vectors.mjs --check` passes, and the vector file is at version 2 with subtotal and total in every case.
- `dotnet test --project tests/Csps.Domain.UnitTests` is green. The coverage gate keeps Csps.Domain at 100% line and branch. `dotnet build Csps.slnx -tl:off --no-incremental` has 0 warnings. `dotnet format Csps.slnx --verify-no-changes` is clean.
- Parity `@reference|@money|@data` passes in Chromium, Firefox and WebKit with no tolerance.
- `npm --prefix web run e2e -- showcase.spec` passes.
- `npm --prefix web run review` produces the before/after section and 6 pictures.
- `npm --prefix web run verify` exits 0. That covers typecheck, lint, format, coverage thresholds, build, build:budget, license and notices.
- Preflight ran before every Playwright run and before the coverage gate. Nothing was killed.
</verification>

<success_criteria>
- D-41 R2-06 is implemented across every layer: C# Domain, the oracle and vectors, both runners, csps.ts, OrderTotals, and the showcase and its demo data.
- Subtotal is before discount and Total is after discount, following PRD §5.1 exactly. Every figure is numerically unchanged except the demo table's "Total" column, which now correctly shows the after-discount total.
- A 100%-discounted unpaid order still reads "Fully Paid". NET-IN-01 is closed as "ruled: keep" and NET-WR-02 is closed.
- The parity proof is equal, with the difference recorded in docs/web/parity.md §6, the rulings.css header and the 02-UI-SPEC.md list.
- The owner has a before/after of the panel wording in the local owner-review pack, and DECISIONS.md R2-06 reads "implemented, awaiting owner before/after review".
- No DB column, migration or DTO was touched, because none exists. No dependency was added and no budget was raised.
</success_criteria>

<output>
Create `.planning/quick/261013-ihp-rename-order-math-to-prd-names-subtotal-/261013-ihp-SUMMARY.md` when done. It needs Created/Updated timestamps with the America/Chicago offset, and it should include:
- the commits table
- the measured values: parity totals per engine, the vitest and coverage figures, the dotnet test count and Domain coverage, and the bundle sizes from verify
- the list of reworded vector notes
- a "Notes for later phases" item: the PRD names `DiscountAmount`, `TotalPaid` and `TotalOrderExpenses` were not renamed (outside R2-06), and the Phase 7 DTOs should follow PRD §5.1
- a note that 02-UAT.md test 6 (order-math naming) now reads as the owner's before/after review
</output>
