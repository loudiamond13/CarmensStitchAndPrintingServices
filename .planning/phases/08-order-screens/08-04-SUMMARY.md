---
phase: 08-order-screens
plan: 04
subsystem: ui
tags: [react, tanstack-query, msw, vitest, a11y, tdd, order-lists]
created: "2026-10-29T17:50:00-05:00"
updated: "2026-10-29T17:50:00-05:00"

requires:
  - phase: 07-order-api
    provides: "/product-types, /payment-methods and /order-expense-categories routes and generated OrderListItem types"
  - phase: 06-expenses
    provides: "ExpenseCategorySelect, expenseCategoriesService and useExpenseCategoriesQuery"
provides:
  - "productTypesService, paymentMethodsService, orderExpenseCategoriesService: list, get, create, update, retire, reactivate, remove"
  - "productTypesKey / useProductTypesQuery, paymentMethodsKey / usePaymentMethodsQuery, orderExpenseCategoriesKey / useOrderExpenseCategoriesQuery"
  - "ListEntrySelect: picker and filter modes for product-types, payment-methods, order-expense-categories and expense-categories"
  - "ORDER_LISTS_COPY: placeholders, loading names, load-failed lines and the retired suffix"
affects: [08-order-list-filter, 08-settings-lists, 08-order-form, 08-money-windows]

actuals:
  tokens: 13200
  tasks: 3
  commits: 6
plan_head_before: 038a4d817b6d6d17c41ffcb6795f10efa29f083e
plan_head_after: 00b0678b073adfe717f5713ff0648decab5ea7fd

tech-stack:
  added: []
  patterns:
    - "One select component driven by a list config map (query hook, copy, field name) instead of one component per list"
    - "Old components become thin wrappers that map their props, so older tests stay unchanged"

key-files:
  created:
    - web/src/modules/admin/services/productTypesService.ts
    - web/src/modules/admin/services/paymentMethodsService.ts
    - web/src/modules/admin/services/orderExpenseCategoriesService.ts
    - web/src/modules/admin/hooks/useProductTypesQuery.ts
    - web/src/modules/admin/hooks/usePaymentMethodsQuery.ts
    - web/src/modules/admin/hooks/useOrderExpenseCategoriesQuery.ts
    - web/src/modules/admin/components/ListEntrySelect.tsx
    - web/src/modules/admin/orderListsCopy.ts
  modified:
    - web/src/modules/admin/components/ExpenseCategorySelect.tsx

key-decisions:
  - "The create body type omits version (the server ignores it on an add); the update body keeps it"
  - "ListEntrySelect picks the list's query hook from a config map keyed by the list prop; eslint react-hooks and tsc accept it because the prop never changes for a mounted select"
  - "The company expense category copy in ORDER_LISTS_COPY points at EXPENSES_COPY, so the Phase 6 wording has one source"
  - "Payment method filter wording (All methods) and the Loading methods line are SPEC-GAP, flagged in orderListsCopy.ts for owner review"

patterns-established:
  - "Picker field name defaults per list (productTypeId, paymentMethodId, categoryId) and can be replaced with the name prop"

requirements-completed: [ORD-02, ORD-07]

duration: 20min
completed: 2026-10-29
status: complete

coverage:
  - id: D1
    description: "Three services call /product-types, /payment-methods and /order-expense-categories for list, get, create (Idempotency-Key), update (version), retire and reactivate (Idempotency-Key) and remove"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/services/productTypesService.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/paymentMethodsService.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/orderExpenseCategoriesService.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "ListEntrySelect picker lists active entries plus the record's own retired entry as '{name} (retired)'; filter lists every entry with retired ones labelled"
    requirement: "ORD-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ListEntrySelect.test.tsx#ListEntrySelect product types, picker mode"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/ListEntrySelect.test.tsx#ListEntrySelect product types, filter mode"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-list placeholders and disabled loading names; axe finds no violations"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ListEntrySelect.test.tsx#ListEntrySelect $list, picker mode"
        status: pass
    human_judgment: true
    rationale: "The payment method and category filter wording is SPEC-GAP; the owner reviews it"
  - id: D4
    description: "ExpenseCategorySelect is a thin wrapper over ListEntrySelect and every Phase 6 expense test passes unchanged"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseCategorySelect.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 04: The three order lists in pickers Summary

**Three order list services and query hooks (product types, payment methods, order expense categories) and one ListEntrySelect for picker and filter use across all four lists, with Phase 6's ExpenseCategorySelect reduced to a wrapper.**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-10-29T17:47:36-05:00
- **Tasks:** 3
- **Files modified:** 13 (8 new source files, 1 changed source file, 4 test files)

## Accomplishments

- Each list has a service with the full call set. Create, retire and reactivate send an Idempotency-Key; update sends the row version and no key; remove sends neither (T-08-06, SEC-06, SEC-07). Tests assert URL, method, headers and body.
- `ListEntrySelect` serves product types, payment methods, order expense categories and company expense categories. Picker mode shows only active entries plus the record's own retired entry as "{name} (retired)" (UIC-44). Filter mode shows all entries with retired ones labelled (D-32). While the list loads it is disabled with "Loading product types…" and the like (UIC-15).
- `ExpenseCategorySelect` keeps its props and renders `ListEntrySelect list="expense-categories"`. Its own test, the expense modal test and the Expenses page test pass unchanged.

## Task Commits

1. **Task 1: product type picker end to end (tracer)**
   - RED `70690ed8` (test)
   - GREEN `3fd374fb` (feat)
2. **Task 2: payment methods and order expense categories**
   - RED `a7ebdf6c` (test)
   - GREEN `74d79d8b` (feat)
3. **Task 3: company expense category picker on ListEntrySelect**
   - RED `8cbc7312` (test)
   - GREEN `00b0678b` (feat)

No refactor commits were needed.

## TDD Gate Compliance

All three tasks have a `test(08-04)` commit before their `feat(08-04)` commit.

- **RED, Task 1:** the skeleton service throws "not built" and the skeleton select renders no options, so the targets ran and failed on the planned behaviour (8 service tests and 5 select tests failed; the axe test passed on the skeleton). `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the target "lists only active entries under Choose a product type", using the JUnit report. Semantic assessment: the target executed and failed because the select listed no entries.
- **RED, Task 2:** 24 of 34 tests failed (16 service tests with "not built", 8 select tests with a missing list config); the 4 product type filter tests already passed because Task 1 built filter mode, so they act as regression guards. `RED_EVIDENCE_OK` for the target "Choose a method".
- **RED, Task 3:** 4 new tests failed with `TypeError: Cannot read properties of undefined (reading 'useEntries')` because the expense-categories list was not in the config map.
- The vitest TAP reporter could not be classified (its failure text carries an HTML dump, which the classifier reads as non-TAP data), so the JUnit reporter was used for the classifier record.

## Verification

- Targeted: `ListEntrySelect.test.tsx`, the three service tests, `ExpenseCategorySelect.test.tsx`, `ExpenseModal.test.tsx`, `ExpensesPage.test.tsx`: 182 tests passed in the final run of the Task 3 set.
- Full web suite: `Test Files 206 passed (206)`, `Tests 6156 passed (6156)`.
- `npm --prefix web run lint` (eslint, max-warnings 0): exit 0, no output.
- `npm --prefix web run typecheck`: exit 0.
- Acceptance greps: `'/product-types'`, `'/payment-methods'` and `'/order-expense-categories'` each appear twice in their service; no `fetch(` in the services; `ListEntrySelect` appears 4 times in `ExpenseCategorySelect.tsx`; `git diff` shows no change to `ExpenseCategorySelect.test.tsx`.
- gitleaks on every staged change: no leaks.
- Not run: the coverage thresholds (web at least 90 percent) were not measured in this plan.

## Decisions Made

- The create body type is `Omit<OrderListEntryRequest, 'version'>`, because the server ignores a version on an add. Update keeps `version`.
- `ListEntrySelect` reads its query hook from a config map keyed by the `list` prop. Lint and tsc accept this; the prop does not change for a mounted select.
- The company expense category entry in `ORDER_LISTS_COPY` reads `EXPENSES_COPY`, so Phase 6 words have one source.

## Deviations from Plan

None - plan executed exactly as written.

Two small notes, neither a deviation: the plan lists no shared fixtures file, so the order list fixtures live inside the test files; and the spec names only the product type filter, so the payment method and category filter wording ("All methods", "Loading methods…") is new SPEC-GAP wording.

## Known Stubs

None. The red-step skeletons were replaced in each green commit.

## Issues Encountered

- The vitest TAP output could not be classified by `check tdd-red-evidence` (see TDD Gate Compliance); JUnit output was used instead.
- `preflight.ps1` fails when passed a backslash path through Git Bash; the forward-slash path works.

## Threat Flags

None. No new endpoint, auth path or schema; the services only call routes Phase 7 built.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The order list filter (08-09), the order form (08-13), the item, payment and expense windows (08-14 to 08-16) and the Settings tabs (08-08) can import `ListEntrySelect`, the three services and the query keys.
- The Settings tabs will need `invalidateQueries` on `productTypesKey`, `paymentMethodsKey` and `orderExpenseCategoriesKey` after a write.
- The owner should review the SPEC-GAP wording in `web/src/modules/admin/orderListsCopy.ts`.

## Self-Check: PASSED

- All 13 files named in the key-files and tests exist on disk.
- Commits `70690ed8`, `3fd374fb`, `a7ebdf6c`, `74d79d8b`, `8cbc7312` and `00b0678b` are ancestors of HEAD.

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*
