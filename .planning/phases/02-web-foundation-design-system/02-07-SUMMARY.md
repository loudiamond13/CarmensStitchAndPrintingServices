---
phase: 02-web-foundation-design-system
plan: 07
subsystem: order-math
tags: [order-math, golden-vectors, rounding, bigint, decimal, xunit, vitest, d-09, web-07]
created: "2026-10-08T11:42:00-05:00"
updated: "2026-10-08T11:44:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "npm run verify (typecheck, strict type-aware lint, Prettier, Vitest with coverage under the console guard, build), the node/app TS program split"
provides:
  - "tests/fixtures/order-math-golden-vectors.json: 220 shared cases in 8 categories (version 1, pinned operationOrder, amounts as decimal strings, LF)"
  - "web/scripts/golden-math.mjs: BigInt exact-rational oracle (OPERATION_ORDER, computeExpected, formatCentavos)"
  - "web/scripts/gen-golden-vectors.mjs: --write | --check | --file <path>; exports VECTOR_FILE, CATEGORIES, buildCases, renderVectorFile, firstDifference"
  - "Csps.Domain.Orders.OrderMath.Compute(items, discounts, payments, expenses) -> OrderMathResult; OrderMathItem, OrderMathDiscount, DiscountKind"
  - "web/src/lib/csps.ts: App. D.1 reconciled (integer-centavo round2/discountAmount/orderTotals/formatPeso, lint-clean SPEC-DEVIATION edits), internal toCentavos/fromCentavos"
affects: [02-08, 02-10, phase-07-orders-domain, phase-08-order-screens, order-math, money-input]

actuals:
  tokens: 64400    # chars/4 over the realized diff (257,553 chars, 16 files; the 220-case vector file is most of it)
  tasks: 3
  commits: 6
plan_head_before: e3f0b18e4b6933ae5039cd8606302ee93af544c1
plan_head_after: 8afda0506ec9609ceecc66fa33bcaca2ab7aecc4

tech-stack:
  added: []
  patterns:
    - "One shared golden-vector file read by both xUnit (linked Content item copied to the test output) and Vitest (fs read from the repository root); only the generator writes it, and only with --write"
    - "Money previews in the browser are exact BigInt centavos, half away from zero; numbers are read through String(n) and turned back through exact decimal text (L-12)"
    - "Node-environment tests inside src/ that need node:fs are named *.golden.test.ts (or *.node.test.ts) and belong to tsconfig.node.json"

key-files:
  created:
    - tests/fixtures/order-math-golden-vectors.json
    - src/Csps.Domain/Orders/OrderMath.cs
    - src/Csps.Domain/Orders/OrderMathModels.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs
    - web/scripts/golden-math.mjs
    - web/scripts/golden-math.test.ts
    - web/scripts/gen-golden-vectors.mjs
    - web/scripts/gen-golden-vectors.test.ts
    - web/src/lib/csps.ts
    - web/src/lib/csps.test.ts
    - web/src/lib/csps.golden.test.ts
  modified:
    - tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj
    - web/tsconfig.app.json
    - web/tsconfig.node.json
    - web/eslint.config.mjs

key-decisions:
  - "The vector schema follows the plan (version, kind) rather than the 74621f5 analog (schemaVersion, type); quantity is a JSON integer and every amount a decimal string; each case also carries a note"
  - "The C# result record is OrderMathResult (plan name), not the analog's OrderMathTotals"
  - "csps.golden.test.ts runs in the node environment and belongs to tsconfig.node.json (src/**/*.golden.test.ts), because the app program has no node types"
  - "formatPeso formats whole pesos as a bigint with Intl (en-PH grouping) and appends the two centavo digits, so no float is formatted; NaN/Infinity show ₱0.00 and an amount that rounds to 0 centavos has no minus"
  - "Large-value vectors go up to 9,999,999,999.99 (the plan's boundary), not the analog's 999,999,999.99"

patterns-established:
  - "Generator CLIs run only when invoked directly (process.argv[1] guard), need exactly one of --write/--check, and take --file for tests"
  - "D.1/D.3 reconciliation: each lint fix is the smallest same-output edit with a // SPEC-DEVIATION: <rule> comment; no rule disabled"

requirements-completed: [WEB-07]

coverage:
  - id: D1
    description: "One shared 220-case golden-vector file (8 categories incl. every section 12.2 seed order) passes identically in xUnit OrderMath and Vitest orderTotals"
    requirement: WEB-07
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs (MatchesVector x220, PinsTheOperationOrder, HasAtLeast200CasesWithUniqueIds, CoversTheCategory x8)"
        status: pass
      - kind: unit
        ref: "web/src/lib/csps.golden.test.ts (231 tests: every case, operation order, >= 200 unique ids, 8 categories, spec-formula proof)"
        status: pass
    human_judgment: false
  - id: D2
    description: "7.5% of 17.00 previews 1.28 (half away from zero, integer centavos); the unmodified spec round2 fails 54 of 220 vectors (37 midpoints), asserted by a test"
    requirement: WEB-07
    verification:
      - kind: unit
        ref: "web/src/lib/csps.golden.test.ts#catches the unmodified spec round2 on at least one midpoint vector (Pitfall 13)"
        status: pass
      - kind: unit
        ref: "web/src/lib/csps.test.ts#round2 (D-09), discountAmount (D-09)"
        status: pass
    human_judgment: false
  - id: D3
    description: "node web/scripts/gen-golden-vectors.mjs --check exits 0 on the committed file and 1 on drift; the generator and both suites only read the committed file"
    requirement: WEB-07
    verification:
      - kind: unit
        ref: "web/scripts/gen-golden-vectors.test.ts (12 tests incl. CLI --check on the committed file without writing it, drift on a temp copy, --write repair)"
        status: pass
      - kind: unit
        ref: "web/scripts/golden-math.test.ts (25 hand-worked oracle cases)"
        status: pass
      - kind: other
        ref: "node web/scripts/gen-golden-vectors.mjs --check (exit 0, 220 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "App. D.2 passes unchanged against the reconciled csps.ts; formatPeso goes through centavos; csps.ts lint-clean with no eslint-disable"
    requirement: WEB-07
    verification:
      - kind: unit
        ref: "web/src/lib/csps.test.ts (43 tests: the 7 App. D.2 tests plus D-09 and characterization cases)"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0; coverage 100% statements/lines, 98.8% branches)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Csps.Domain stays at 100% line and branch coverage with OrderMath added"
    verification:
      - kind: other
        ref: "tools/scripts/Invoke-CoverageGate.ps1 (Csps.Domain line 100% 320/320, branch 100% 140/140)"
        status: pass
    human_judgment: false
  - id: D6
    description: "csps.ts documents its totals as previews; screens must show the server's figures once a save returns (prohibition, Phase 8 wires the screens)"
    verification: []
    human_judgment: true
    rationale: "A judgment prohibition: no screen exists yet; the header comment is in place and Phase 8 must honour it"

duration: 14min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 07: Shared Centavo-Exact Order Math Summary

**The browser's order preview and the server's `OrderMath` now agree to the centavo on 220 shared golden vectors. Both use integer centavos rounded half away from zero, so 7.5% of ₱17.00 is ₱1.28 on both sides. A test shows the spec's `Math.round(n * 100) / 100` gets 54 of the vectors wrong. A `--check` drift mode keeps the vector file honest.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-08T16:28:24Z
- **Completed:** 2026-10-08T16:42:08Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- `Csps.Domain.Orders.OrderMath.Compute` is the authoritative order math. It rounds the items total, rounds each discount, sums the discounts and rounds the sum, then subtracts. It uses `MidpointRounding.AwayFromZero`, the literal `100m` and null guards. Domain stays at 100% line and branch coverage.
- `tests/fixtures/order-math-golden-vectors.json` holds 220 cases: midpoint 39, ord-fixture 8 (every §12.2 seed order), percent-100 6, zero-items 6, multi-discount 30, negative-balance 6, large-value 12 (up to ₱9,999,999,999.99) and seeded-random 113. xUnit (`MatchesVector`, 220 cases) and Vitest (`orderTotals`, 220 cases) both pass every case, and both assert the same operation-order text and category list.
- `golden-math.mjs` is an exact BigInt oracle that shares no code with either implementation. `gen-golden-vectors.mjs` writes only with `--write`. `--check` exits 1 on any drift and names the first differing line. Nothing runs on import.
- In `csps.ts`, `round2`, `discountAmount`, `orderTotals` and `formatPeso` work in exact centavos and keep D.1's signatures. Every lint finding is fixed with a same-output `// SPEC-DEVIATION` edit, with no rule disabled. App. D.2 passes unchanged, and the header says these figures are previews and the server is authoritative.
- `npm --prefix web run verify` exits 0, and the full Domain suite passes (393 tests).

## Task Commits

1. **Task 1 (tracer): 7.5% of ₱17.00 previews ₱1.28 in xUnit and Vitest from one shared file**
   - RED `732df22` (test): 3-case vector file, an inert `OrderMath.Compute`, and App. D.1 verbatim. RED evidence: `RED_EVIDENCE_OK` for `Csps.Domain.UnitTests.Orders.OrderMathGoldenVectorTests` and `src/lib/csps.golden.test.ts` (the spec round2 gave 1.27).
   - GREEN `55ea013` (feat): OrderMath plus centavo math in csps.ts.
   - Tracer gate (interactive, end-of-phase, automated-only verify): both verify commands were re-run after the commit and passed, then the work expanded.
2. **Task 2: at least 200 vectors, the drift check, and proof the spec formula is wrong**
   - RED `ebdb18b` (test): oracle, generator, golden and xUnit tests against inert modules. RED evidence: `RED_EVIDENCE_OK` for all three Vitest files and the xUnit class.
   - GREEN `54908a7` (feat): the oracle, the generator and the 220-case file (`--write`).
3. **Task 3: App. D.1 reconciled under the strict gates, with App. D.2 passing unchanged**
   - RED `39e92d3` (test): D.2 verbatim plus the D-09 formatPeso cases. RED evidence: `RED_EVIDENCE_OK` for `src/lib/csps.test.ts` (formatPeso(-0.001) gave "−₱0.00" and formatPeso(Infinity) gave "₱∞").
   - GREEN `8afda05` (feat): lint-clean csps.ts and formatPeso through centavos.

**Plan metadata:** in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `tests/fixtures/order-math-golden-vectors.json`: the shared vectors (generated, LF)
- `src/Csps.Domain/Orders/OrderMath.cs`, `OrderMathModels.cs`: server math and its records (`OrderMathItem`, `OrderMathDiscount`, `DiscountKind`, `OrderMathResult`)
- `tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs`: the vector theory, operation order, count and category checks
- `tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs`: null guards, empty order, percentage of a zero total, 0% and 100%, overpayment, rounding each discount before the sum, and values up to 9,999,999,999.99
- `tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj`: links the shared file as `Fixtures\order-math-golden-vectors.json` (PreserveNewest)
- `web/scripts/golden-math.mjs` / `.test.ts`: the exact oracle and its hand-worked cases
- `web/scripts/gen-golden-vectors.mjs` / `.test.ts`: the generator, the drift check and their tests
- `web/src/lib/csps.ts`: App. D.1 reconciled
- `web/src/lib/csps.test.ts`: App. D.2 plus the D-09 and characterization cases
- `web/src/lib/csps.golden.test.ts`: the golden suite and the spec-formula proof
- `web/tsconfig.app.json`, `web/tsconfig.node.json`, `web/eslint.config.mjs` (comment only): `src/**/*.golden.test.ts` moves into the node program

## Decisions Made

See `key-decisions` in the frontmatter. The main one: the golden test reads the file with `node:fs`, as the plan's key link says, so it runs in the node environment and its program is `tsconfig.node.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The golden test could not typecheck in the app program**
- **Found during:** Task 1 (RED)
- **Issue:** `src/**` belongs to `tsconfig.app.json`, which has only `vite/client` types, so `import { readFileSync } from 'node:fs'` in `src/lib/csps.golden.test.ts` would fail typecheck and type-aware lint.
- **Fix:** `tsconfig.node.json` now includes `src/**/*.golden.test.ts` and `tsconfig.app.json` excludes it, the same way `*.node.test.ts` already works. The file name stays as the plan wrote it, so the plan's `--run src/lib/csps.golden.test.ts` filters still match.
- **Files modified:** `web/tsconfig.app.json`, `web/tsconfig.node.json`, `web/eslint.config.mjs` (comment)
- **Committed in:** `732df22`

**2. [Rule 1 - Bug] The generator in the analog wrote the vector file when imported**
- **Found during:** Task 2
- **Issue:** The 74621f5 generator ran its CLI at module load and wrote the file when run with no flag. A test that imports it would rewrite the committed file, which breaks the "suites only read" rule (WEB-07 concurrency edge).
- **Fix:** The CLI runs only when the script is invoked directly, needs exactly one of `--write`/`--check`, and tests write only to temp files through `--file`. A test checks that `--check` leaves the committed file's mtime unchanged.
- **Committed in:** `ebdb18b`, `54908a7`

**3. [Rule 1 - Bug] `firstDifference` reported a phantom empty line**
- **Found during:** Task 2 (GREEN)
- **Issue:** Splitting on `\n` left an empty last element, so a shorter file showed `found ""` instead of "the end of the file".
- **Fix:** The trailing newline is dropped before splitting, and a difference only in the final newline gets its own message. Two assertions were added to the existing test.
- **Committed in:** `54908a7`

**4. [Rule 1 - Bug] formatPeso cannot format a decimal string under the TS lib**
- **Found during:** Task 3 (GREEN)
- **Issue:** `Intl.NumberFormat.format(string)` works at runtime, but TS 6's ES2023 lib only types `number | bigint`.
- **Fix:** formatPeso groups the whole pesos as a `bigint` and appends the two centavo digits. The D.2 output is unchanged.
- **Committed in:** `8afda05`

### Plan-text adjustments (no behaviour impact)

- **RED for Task 3 is not formatPeso(1.005).** The plan expected `formatPeso(1.005)` to fail on D.1. On Node 24, ICU formats the shortest decimal text "1.005" and rounds it half-expand to "₱1.01", so it already passes. The real assertion failures that made Task 3 RED were `formatPeso(-0.001)` ("−₱0.00") and `formatPeso(Infinity)` ("₱∞"). Through centavos both now read "₱0.00". The 1.005 case stays as a regression test.
- **App. D.2 is Prettier-wrapped.** `format:check` is part of verify, so the D.2 block keeps the same tokens and assertions but Prettier's line breaks. A comment in the file says so.
- **D-09 changes two D.1 edge outputs, both on purpose:** formatPeso of NaN/±Infinity reads ₱0.00 (D.1 showed ₱∞ for Infinity), and an amount that rounds to 0 centavos has no minus. Both are marked `SPEC-DEVIATION: D-09` in the code.
- **Task 2 OrderMathTests passed at RED.** OrderMath was already built in Task 1, so they serve as regression proofs. The Task 2 RED target for .NET was `OrderMathGoldenVectorTests` (`HasAtLeast200CasesWithUniqueIds` and 5 categories failed on the 3-case file).

---

**Total deviations:** 4 auto-fixed (1 Rule 3, 3 Rule 1), plus 4 documented plan-text adjustments.
**Impact on plan:** Every must-have holds. No package was added or changed, and no rule was disabled.

## Issues Encountered

- An XML comment in the csproj can't contain `--`, so the comment says "with the write flag" instead of `--write`.
- One web branch is uncovered: the `?? ''` after `MONTHS[x.getMonth()]` in formatDate. `noUncheckedIndexedAccess` requires it, but it can never run. Web coverage is 100% statements/lines and 98.8% branches (threshold 90%).

## Known Stubs

None.

## Notes for Later Plans

- **02-08 (formatBusinessDate) / ORD-09 MoneyInput:** csps.ts has internal `toCentavos(value)` / `fromCentavos(centavos)` / `centavosText(centavos)` helpers, which are not exported. If MoneyInput needs text-to-centavos parsing (the analog's `toCentavos(text): bigint | null` with a `^\d{0,9}(\.\d{0,2})?$` rule), add it as a new export with its own tests. Don't widen the internal helper's signature.
- **Any new test under `src/` that needs `node:fs`:** name it `*.node.test.ts` or `*.golden.test.ts` and give it a `// @vitest-environment node` header.
- **Regenerating vectors:** `node web/scripts/gen-golden-vectors.mjs --write`, then commit. `gen-golden-vectors.test.ts` runs the `--check` logic and the CLI inside every `npm run verify`.
- **Phase 7/8:** `OrderMath.Compute` takes plain lists. The order aggregate maps its lines, discounts, payments and expenses into `OrderMathItem` / `OrderMathDiscount` / `decimal`. Screens show server figures once a save returns (D-09 prohibition).

## TDD Gate Compliance

- Task 1: RED `732df22` comes before GREEN `55ea013` (`RED_EVIDENCE_OK` for .NET and Vitest).
- Task 2: RED `ebdb18b` comes before GREEN `54908a7` (`RED_EVIDENCE_OK` for 3 Vitest files and the xUnit class).
- Task 3: RED `39e92d3` comes before GREEN `8afda05` (`RED_EVIDENCE_OK` for `src/lib/csps.test.ts`).
- No refactor commits were needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved, and `package.json` / `package-lock.json` / `Directory.Packages.props` are unchanged.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- WEB-07 is met. The order-math contract is pinned on both sides and guarded by the drift check.
- Ready for the next Phase 2 plan.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 12 created files and 4 modified files exist on disk.
- Commits `732df22`, `55ea013`, `ebdb18b`, `54908a7`, `39e92d3` and `8afda05` are on `gsd/phase-2-web-foundation-design-system`.
- Acceptance criteria re-run: `MidpointRounding.AwayFromZero` = 1, `const decimal` = 0, `SPEC-DEVIATION: D-09` ≥ 1 (4), node vector-count check exits 0 (220 unique), `--check` exits 0, `eslint-disable` in csps.ts = 0, `npm --prefix web run verify` exits 0, the coverage gate passes (Domain 100%/100%), and `dotnet test --project tests/Csps.Domain.UnitTests` passes (393).
