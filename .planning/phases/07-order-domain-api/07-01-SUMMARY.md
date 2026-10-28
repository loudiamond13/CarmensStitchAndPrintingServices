---
phase: 07-order-domain-api
plan: 01
subsystem: api
tags: [order-lists, product-types, payment-methods, order-expense-categories, ef-core, migration, audit-catalog, openapi]
created: "2026-10-28T09:42:00-05:00"
updated: "2026-10-28T09:42:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: ExpenseCategory pattern (literal seed, tone check, unique NormalizedName), AuditDetailFormat, the stamp interceptor, CspsDatabase reseed, the contract pipeline
provides:
  - GET /api/v1/product-types, /api/v1/payment-methods and /api/v1/order-expense-categories for staff, seeded with the owner's 17 starting entries
  - ProductTypes, PaymentMethods and OrderExpenseCategories tables in the one migration AddOrderLists
  - OrderListEntry domain base (rename, recolor, retire, reactivate) with ProductType, PaymentMethod and OrderExpenseCategory (protected Others)
  - 43 Phase 7 audit codes (catalog 49 to 92), their documented details and their viewer labels
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10, 07-11, 07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 28200
  tasks: 3
  commits: 6
plan_head_before: a31bec053a497be94dcb71722ceb1fd41e43647b
plan_head_after: f6b94142c3182543f6015f702a68e52baebd1cc0

tech-stack:
  added: []
  patterns:
    - "One abstract OrderListEntry with a sealed subclass and its own table per list: no discriminator, one generic EF configuration closed per table (table name, seed rows)"
    - "A single ListOrderListHandler(kind) behind three thin controllers; the handler sorts A to Z ignoring case with the protected Others last"
    - "Audit codes and their detail keys fixed in AuditActions and audit-log.md before any slice writes them"

key-files:
  created:
    - src/Csps.Domain/OrderLists/OrderListEntry.cs
    - src/Csps.Domain/OrderLists/OrderListKind.cs
    - src/Csps.Domain/OrderLists/OrderListSeed.cs
    - src/Csps.Domain/OrderLists/ProductType.cs
    - src/Csps.Domain/OrderLists/PaymentMethod.cs
    - src/Csps.Domain/OrderLists/OrderExpenseCategory.cs
    - src/Csps.Application/Ports/IOrderLists.cs
    - src/Csps.Application/OrderLists/ListOrderListHandler.cs
    - src/Csps.Application/OrderLists/OrderListItem.cs
    - src/Csps.Application/OrderLists/OrderListDescriptor.cs
    - src/Csps.Infrastructure/OrderLists/OrderListStore.cs
    - src/Csps.Infrastructure/Orders/OrdersRegistration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderListEntryConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ProductTypeConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/PaymentMethodConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderExpenseCategoryConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028141016_AddOrderLists.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028141016_AddOrderLists.Designer.cs
    - src/Csps.Server/Controllers/ProductTypesController.cs
    - src/Csps.Server/Controllers/PaymentMethodsController.cs
    - src/Csps.Server/Controllers/OrderExpenseCategoriesController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - docs/api/order-lists.md
    - tests/Csps.Domain.UnitTests/OrderLists/OrderListSeedTests.cs
    - tests/Csps.Domain.UnitTests/OrderLists/OrderListEntryTests.cs
    - tests/Csps.Application.UnitTests/OrderLists/ListOrderListHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderListsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/OrderLists/ListOrderListsEndpointTests.cs
  modified:
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Testing/CspsDatabase.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - docs/operations/audit-log.md

key-decisions:
  - "The migration is named AddOrderLists; the real file name is 20261028141016_AddOrderLists (the tool generated the timestamp). Task 1 generated it with ProductTypes only; Task 2 removed and re-added it so one migration creates all three tables. Nothing was pushed in between."
  - "The protected Others keeps the Phase 6 behaviour: renaming it to its own name is accepted and changes nothing, any other name is refused with 'The Others name can't change.'; retire and delete are refused with order-expense-categories.protected and the plan's message."
  - "Order and child audit events go in one viewer group 'Orders'; the 18 list events go in 'Order lists'. Labels for order expenses and order expense categories carry the word 'Order' so they never repeat the Phase 6 labels."
  - "Seed tones follow the plan: product types Basketball accent, Volleyball info, Moto warning, Long Sleeves mockup, Polo success, Custom Design neutral (research A5, Managers can recolor)."

patterns-established:
  - "List read routes: Staff policy, no-store, EndpointName ListX, XML docs state sort order and status values"
  - "Test reseed: CspsDatabase.ReseedOrderListsAsync puts the 17 migration rows back after every Respawn reset"

requirements-completed: [ORD-13]

coverage:
  - id: D1
    description: "Staff read the six product types from GET /api/v1/product-types, A to Z, active, with tones"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/ListOrderListsEndpointTests.cs#AManagerReadsTheSixProductTypes"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/ListOrderListsEndpointTests.cs#AnAdminReadsTheSixProductTypes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Staff read payment methods and order expense categories (Others last); a retired entry is still listed as retired"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/ListOrderListsEndpointTests.cs#ARetiredPaymentMethodIsStillListedWithStatusRetired"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/OrderLists/ListOrderListHandlerTests.cs#EntriesAreSortedAToZIgnoringCaseWithOthersLastAndRetiredOnesKept"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three tables with unique NormalizedName, tone CHECK, rowversion, no discriminator and 17 seed rows in one migration; the test reset puts them back"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderListsMigrationTests.cs"
        status: pass
      - kind: integration
        ref: "dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class *MigrationScriptTests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Domain entry rules: create, rename, recolor, retire, reactivate; only the order expense Others is protected"
    requirement: ORD-13
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/OrderLists/OrderListEntryTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "Anonymous calls to the three list routes get 401; both roles get 200"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix rows for the three GETs)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Phase 7 audit catalog: 43 codes (49 to 92), documented details, and a viewer label and group for each"
    requirement: ORD-13
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs#ThePhaseSevenCodesComeAfterThePhaseSixCodesInThisOrder"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/auditCopy.test.ts"
        status: pass
    human_judgment: true
    rationale: "The plain-English viewer labels and the documented detail formats are wording the owner may want to review; no test judges wording quality."

duration: 36min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 01: Order lists and the Phase 7 audit catalog Summary

**Staff can read the three Manager-editable order lists (6 product types, 5 payment methods, 6 order expense categories with a protected Others) from three Staff-only routes backed by one migration, and all 43 Phase 7 audit event names, details and viewer labels now exist before any slice writes them.**

## Performance

- **Duration:** about 36 min
- **Started:** 2026-10-28T13:57:21Z
- **Completed:** 2026-10-28T14:33:00Z
- **Tasks:** 3 of 3
- **Files changed:** 41 (about 28,000 tokens of hand-written diff, chars/4, generated files left out)

## Accomplishments

- Task 1 (tracer): `OrderListEntry` base lifted from `ExpenseCategory`, `ProductType`, the literal `OrderListSeed`, a generic `OrderListEntryConfiguration<T>`, `OrderListStore`, `ListOrderListHandler`, `ProductTypesController`, the matrix row, the refreshed contract and `CspsDatabase.ReseedOrderListsAsync`, proven end to end by `GET /api/v1/product-types`.
- Task 2: `PaymentMethod` and `OrderExpenseCategory` (Others protected), their seeds and configurations, two more controllers, one regenerated `AddOrderLists` migration with all three tables and 17 seed rows, matrix rows, `docs/api/order-lists.md`.
- Task 3: 43 `AuditActions` constants appended to `All` in the documented order, the `Orders` and `Order lists` groups with a unique plain label per code in `auditCopy.ts`, and a "Phase 7 orders and order lists" section in `docs/operations/audit-log.md` listing every target and detail key.

## Migration

`src/Csps.Infrastructure/Persistence/Migrations/20261028141016_AddOrderLists.cs`. Up: three `CreateTable` calls (columns, PK, `CK_<Table>_Tone`, two NO ACTION foreign keys to `AspNetUsers`), seventeen `InsertData` rows, and per table three indexes (`IX_<Table>_CreatedById`, unique `IX_<Table>_NormalizedName`, `IX_<Table>_UpdatedById`). Down: three `DropTable` calls. No trigger, no JSON column, no drop of existing data.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | d0a64fc2 `test(07-01): staff read the seeded product types (RED)` | cdcfdb08 `feat(07-01): staff read the seeded product types (D-18)` |
| 2 | de0b16a2 `test(07-01): payment methods and order expense categories (RED)` | 8d0218e1 `feat(07-01): payment methods and order expense categories (D-16, D-17)` |
| 3 | 1c647b0e `test(07-01): Phase 7 audit catalog (RED)` | f6b94142 `feat(07-01): Phase 7 audit catalog (D-31)` |

- **Task 1 RED:** three tests in `ListOrderListsEndpointTests`; run: 3 failed, each on `response.StatusCode` expected `OK`/`Unauthorized` but was `NotFound`. Semantic assessment: valid, the target tests ran and failed on the planned status assertion because the route did not exist.
- **Task 2 RED:** the Domain tests failed to build (CS0246 `OrderExpenseCategory` not found, and the missing seed members), which is a compile-time RED for new types, the usual shape in C#. The runtime half was valid: `OrderListsMigrationTests` 5 failed on the missing tables, and 5 of 8 endpoint tests failed on `NotFound` (the retired-payment-method case failed earlier, on the SQL update of the missing table). `RED_EVIDENCE_OK` was not run through `gsd_run check tdd-red-evidence` (that classifier reads TAP/JUnit/Surefire reports, and this runner's MTP output is none of those); the failing output was inspected by hand.
- **Task 3 RED:** 45 of 79 `AuditActionsTests` failed (count 49 not 92, missing constants via reflection) and 5 `auditCopy.test.ts` tests failed (groups, labels). Valid assertion failures.
- REFACTOR: none needed.

## Verification Evidence

- `dotnet build -warnaserror`: 0 warnings, 0 errors.
- `dotnet test` Domain 797 passed; Application 1235 passed; Architecture 241 passed; Infrastructure.IntegrationTests 606 passed (includes `OrderListsMigrationTests` 8, `MigrationScriptTests` 6, `TriggerInventoryTests` 2); Server.IntegrationTests `*ListOrderListsEndpointTests` 8 passed, `*Authorization*` 249 passed, `*OpenApiSnapshotTests` 10 passed.
- Full Server.IntegrationTests run: 1335 total, 1 failed (`ExpenseListTimingTests`, see Issues).
- `Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1256/1256) branch 100% (484/484); Csps.Application line 98.3% (3834/3899), branch 94.4% (not gated). PASS.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Web: `npm run lint` (max-warnings 0) clean; `npm run typecheck` clean; `src/modules/admin` 68 files, 1684 tests passed (includes `auditCopy.test.ts` 29 and `no-long-dash.node.test.ts`); prettier check clean on the two audit files.
- gitleaks on every staged change: no leaks. No real server names, emails or local paths in the staged diffs.
- Acceptance criteria re-run: product-types controller route 1; matrix has the three GET rows; `ReseedOrderListsAsync` 2; `ListProductTypes` in the contract 1; `Cheque` in the seed 1; one `*_AddOrderLists.cs`; `CK_` in the configuration 1; payment and order-expense matrix rows 2; `order-lists.md` has `created:`; `AuditActions.All.Count.ShouldBe(92)` 1; `order-payment.receiver-changed` in `auditCopy.ts` 1; `order.permanently-deleted` in `audit-log.md` 1; no en or em dash in `auditCopy.ts` (checked with a Python scan because the grep -P form is unsupported in this shell's locale).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Phase 6 order test counted the whole catalog**
- **Found during:** Task 3 GREEN
- **Issue:** `ThePhaseSixCodesComeAfterThePhaseFiveCodes` asserted `All.Skip(37)` equals the 12 Phase 6 codes. With 43 more codes appended, it failed.
- **Fix:** `Skip(37).Take(12)`.
- **Files modified:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`
- **Commit:** f6b94142

**2. [Rule 3 - Blocking] The RED for Task 2 could not avoid a compile error in the Domain tests**
- **Found during:** Task 2 RED
- **Issue:** the new Domain and Application tests name types that do not exist yet. To keep a failing-assertion RED where possible, the migration and endpoint tests use raw SQL and HTTP only, so those fail at runtime. The Domain tests are a compile-time RED.
- **Fix:** none needed beyond the design above; documented under TDD Gate Compliance.

**Total deviations:** 2 auto-fixed (1 bug in a dependent test, 1 blocking RED-shape note). **Impact:** none on scope.

## Issues Encountered

- `ExpenseListTimingTests` ("five years, last page, size 100") failed in the full Server run and again alone: p95 350.3 ms against the 300 ms limit (default window p95 131.4 ms, category 4.8 ms, search 147.3 ms). The test reads the company expense list, which this plan does not touch. Phase 6 plan 06-10 and D-76 already record the same slow-machine failure. Not hidden, not changed; logged in `.planning/phases/07-order-domain-api/deferred-items.md`.
- A bash heredoc containing an apostrophe failed to parse twice in this shell; all files were written with the Write tool or from a script file instead. No effect on the result.

## Deferred Issues

- The `ExpenseListTimingTests` machine-speed failure above (pre-existing, owner ruling D-76 stands).

## Known Stubs

None.

## Threat Flags

None. The only new surface is three read-only GET routes under `Policies.Staff` (T-07-01 mitigated, matrix rows assert 401 for anonymous); seeds are literal (T-07-02, `MigrationScriptTests` passes); the audit catalog and detail formats are fixed and counted before any slice writes them (T-07-03).

## Authentication Gates

None.

## Next Phase Readiness

Ready for plan 07-02. Items, payments and order expenses can now reference `ProductTypes`, `PaymentMethods` and `OrderExpenseCategories` by foreign key, and every later slice can write the documented audit codes.

## Self-Check: PASSED

Created files exist (checked with `[ -f ]`), all six task commits are ancestors of HEAD, and the acceptance criteria above were re-run after the last commit.
