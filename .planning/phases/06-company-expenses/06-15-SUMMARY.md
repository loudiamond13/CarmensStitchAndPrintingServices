---
phase: 06-company-expenses
plan: 15
subsystem: audit-viewer
tags: [audit, expenses, categories, d-27, openapi, react, playwright, a11y, or-4]
created: "2026-10-25T15:48:00-05:00"
updated: "2026-10-25T15:48:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: the twelve audit codes and the AuditDetailFormat pairs (plans 06-01, 06-08, 06-10, 06-13); the Edit Expense modal (plan 06-14)
provides:
  - Typed change lines and an expense snapshot on every expense and category audit entry (AuditLogItem.Changes and Snapshot)
  - Done to is the payer for an expense entry; the Done to filter also finds an expense by its current, old or new payer
  - The Audit Log names the twelve codes in two new Action groups and reads them as fixed sentences, never with description or notes text
  - The OQ-13 subline and the extended @audit e2e
affects: [06-16, 06-18, 06-19]

actuals:
  tokens: 60000
  tasks: 3
  commits: 6
plan_head_before: 26a0d5ae815e985711adff80601b91303ff5757b
plan_head_after: eebb6c340fe23d1db160724bc9ef0a3ca2f0293e

tech-stack:
  added: []
  patterns:
    - "The reader parses details with a pure Application function (AuditChangeLines.For), then resolves ids in one lookup each (payers with the people already read, categories in one AsNoTracking query), so a page costs one extra query at most"
    - "Only known keys with the shape the writer gives them are read; an unknown key or a malformed value drops the line instead of passing text through"
    - "What changed renders a list when an entry has typed lines, and keeps the one-sentence text for every older event"

key-files:
  created:
    - src/Csps.Application/Audit/AuditChangeLines.cs
    - tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs
    - tests/Csps.Server.IntegrationTests/Audit/ExpenseAuditViewerTests.cs
  modified:
    - src/Csps.Application/Audit/AuditLogResponse.cs
    - src/Csps.Application/Audit/ListAuditLogHandler.cs
    - src/Csps.Application/Ports/IAuditLogReader.cs
    - src/Csps.Infrastructure/Auditing/AuditLogReader.cs
    - tests/Csps.Application.UnitTests/Audit/ListAuditLogHandlerTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - web/src/modules/admin/components/AuditDetail.tsx
    - web/src/modules/admin/components/AuditDetail.test.tsx
    - web/src/modules/admin/components/audit.recipe.ts
    - web/src/modules/admin/components/showcase/Phase5Demos.tsx
    - web/src/modules/admin/pages/AuditLogPage.test.tsx
    - web/src/modules/admin/services/auditLogService.test.ts
    - web/e2e/audit-log.spec.ts
    - docs/operations/audit-log.md

key-decisions:
  - "The server, not the browser, turns a stored detail into typed lines (option A of RESEARCH open question 2); the response keeps the raw detail field, which holds ids and fixed words only."
  - "Done to for an expense entry is the payer (the new payer for a payer change); the target filter adds a LIKE on the detail limited to company-expense.* codes, using the shared LikePattern escaping."
  - "A category added, retired, brought back or deleted shows its name (and color when added) as 'Name: {name}' and 'Color: {color}', because a deleted category's name is otherwise lost; flagged for the copy review."
  - "A payer on a Paid by line or snapshot carries the same '(former staff)' mark the Done to column uses."

requirements-completed: [CEXP-02, CEXP-05]

coverage:
  - id: D1
    description: "A Manager reads an expense edit as 'Amount: ₱1,200.00 to ₱1,250.00' and 'Description changed', with the payer as Done to, and no description or notes text is in any response field (D-27, 05 D-40)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/ExpenseAuditViewerTests.cs#AnAmountEditReadsAsAChangeLineAndAnAddedExpenseAsASnapshotBothDoneToThePayer"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/auditCopy.test.ts, web/src/modules/admin/components/AuditDetail.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every expense and category event has a plain label, group, change lines and snapshot; a gone category reads 'a deleted category' and a deleted payer reads as former staff (UI-SPEC A1)"
    requirement: CEXP-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/ExpenseAuditViewerTests.cs (6 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/AuditLogPage.test.tsx (A1 expense and category entries, groups, subline)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Done to filter finds an expense entry by its old or new payer; a Manager can list everything that touched one person's money (CEXP-05)"
    requirement: CEXP-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/ExpenseAuditViewerTests.cs#APayerChangeNamesBothPeopleAndTheDoneToFilterFindsTheOldPayerToo"
        status: pass
      - kind: e2e
        ref: "web/e2e/audit-log.spec.ts @audit (a Manager edits an expense amount and payer; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The wording of the new lines, the snapshot line on deleted and restored entries and the category name and color lines reads well to the owner"
    verification: []
    human_judgment: true
    rationale: "New SPEC-GAP copy for the owner's wording review (05 D-48); tests prove what is said, not that it is the right words"

duration: 50min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 15: Expense and Category Audit Viewer Summary

**Expense and category events in the Audit Log now read as money and dates ("Amount: ₱1,200.00 to ₱1,250.00", "Paid by: Ana to Bea"), with the payer as Done to and a Done to filter that finds an expense by its old or new payer, and no description or notes text ever on screen.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-10-25T19:53:31Z
- **Completed:** 2026-10-25T20:44:00Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files changed:** 20 (3 created)

## Accomplishments

- **Server lines (tracer):** `AuditChangeLines.For` reads the stored detail of the twelve codes with `AuditDetailFormat.Parse` into typed lines (`amount`, `date`, `category`, `payer`, `description`, `notes`, `name`, `tone`) and a snapshot. Each value must have the writer's shape (decimal, `yyyy-MM-dd`, dashed GUID) or the line is dropped, and a `fields=` list keeps only `description` and `notes` as names. `AuditLogReader` resolves payers with the people lookup it already ran and category names with one extra `AsNoTracking` query; a category that is gone gives a null name, a deleted payer gives `formerStaff`.
- **Done to (D-27, CEXP-05):** an expense entry's Done to is the payer (the new payer for a payer change); a category entry has none. The target filter adds `EF.Functions.Like(detail, LikePattern.Contains(id), LikePattern.EscapeCharacter)` for codes starting with `company-expense.`, so the old payer finds the payer change and the original add.
- **Web:** two Action groups ("Company expenses", "Expense categories") with the twelve UI-SPEC labels, `describeAuditChange` and `describeAuditSnapshot` for the fixed sentences, `AuditDetail` rendering a list when an entry has typed lines (older events keep their one sentence), and the OQ-13 subline.
- **Proof and docs:** the extended `@audit` e2e edits an amount and a payer in the 06-14 Edit modal, finds "Expense payer changed" by Action and the old payer, finds "Expense changed" with the amount line by the new payer, and checks no description or notes text is on the page. `docs/operations/audit-log.md` "Viewing the log" documents the lines, the snapshot, Done to and the payer match.

## Task Commits

1. **Task 1: Tracer, an expense edit reads as an amount line with the payer as Done to (D-27)**
   - RED `fdf9731` (test)
   - GREEN `878f3a3` (feat)
2. **Task 2: Every expense and category event, and Done to by payer (D-27, CEXP-05, OQ-13)**
   - RED `f887d10` (test)
   - GREEN `8e11473` (feat)
3. **Task 3: The audit trail of an expense edit proved end to end and documented (D-27)**
   - test `fc06fd1`
   - docs GREEN `eebb6c3` (feat)

**Plan metadata:** the `docs(06-15)` commits that follow this file.

### TDD gate compliance

RED then GREEN commit pairs exist for all three tasks; no REFACTOR commits were needed. The `gsd_run check tdd-red-evidence` classifier reads JUnit and the exact xUnit MTP report was not captured, so the evidence is the quoted run and a semantic assessment.

- **Task 1 RED:** `AuditChangeLinesTests` `total: 21, failed: 14, succeeded: 7` (the 7 are the "nothing to read" cases that the stub satisfies); each failure was `Shouldly.ShouldAssertException` on an empty result where lines were expected. `ExpenseAuditViewerTests` failed with `Sequence contains no matching element` for the entry whose Done to is the payer (Done to was empty). Web: `7 failed | 22 passed`, `TypeError: describeAuditChange is not a function`, and `Error: No value for What changed`. Semantic assessment: every failure names the planned missing behavior. The RED commit carries a stub `AuditChangeLines` (empty results) so the tests compile and fail on assertions rather than on a missing type.
- **Task 2 RED:** `ExpenseAuditViewerTests` `total: 6, failed: 1, succeeded: 5`: the failing case is `ExpenseActions(aboutOld)` expected `[payer-changed, added]` but empty, which is the Done to payer match. The web run failed one case (the old subline). The other new cases passed at once because Task 1 already built the line mapping and the groups; they are kept as characterization tests. Semantic assessment: the two failures are the two behaviors Task 2 adds.
- **Task 3 RED:** the `@audit` e2e (25 of 25 across five projects) and the 12-code handler theory passed on first run, because Tasks 1 and 2 had already built the behavior. They are characterization tests; there was nothing left for them to fail on.

## Verification evidence

- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*AuditChangeLinesTests"`: `total: 21 failed: 0 succeeded: 21`.
- Whole `tests/Csps.Application.UnitTests`: `total: 1222 failed: 0`; `tests/Csps.ArchitectureTests`: `total: 239 failed: 0`; whole `tests/Csps.Server.IntegrationTests`: `total: 1304 failed: 0 succeeded: 1304` (includes `ExpenseAuditViewerTests` 6, `AuditLogEndpointTests` 19, `OpenApiSnapshotTests` 10, the authorization matrix and the trigger inventory).
- `ListAuditLogHandlerTests`: `total: 74 failed: 0` (12 new theory cases plus the pass-through case).
- OpenAPI: `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for that one command, re-run `Passed 10/10`, then `npm --prefix tools/openapi-gen run generate` and `run check`: `Generated API types match tools/openapi-gen/openapi.v1.json.`
- `npm --prefix web run e2e -- --grep @audit`: `25 passed (4.1m)` (chromium, pixel, firefox, webkit, iphone; the new test ran in all five).
- `npm --prefix web run verify` exited 0: typecheck (three programs), `eslint . --max-warnings 0`, `prettier --check .`, `Test Files 196 passed (196)` / `Tests 5736 passed (5736)`, `Statements : 95.72%`, `Branches : 90.94%`, both builds with the bundle budgets, `License gate passed.`, `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`
- `dotnet format --verify-no-changes --include` on the four new or changed C# files: no output (clean).
- Acceptance: `AuditDetailFormat.Parse` in AuditChangeLines.cs 4; `company-expense.changed` in auditCopy.ts 1; `AuditChangeLine` in api.generated.ts 2; `Expense categories` in auditCopy.ts 1; `staff account and expense change` in auditCopy.ts 1; `LikePattern` in AuditLogReader.cs 2; `Expense payer changed` in audit-log.spec.ts 5; `Description changed` in audit-log.md 1.
- Shared machine: the preflight showed ports 5180, 5115, 7028 and 5199 free and no other project's test process before the e2e run; only `CSPS_Test_*` and `CSPS_E2E` databases were used; no background shell was left running.

## Decisions Made

- The server parses and resolves, so the browser never sees a category id or a raw pair, and tests assert the response carries no description or notes text.
- Done to for an expense entry is `TargetUser(...) ?? payerId`: category and user entries keep their old rule untouched.
- A payer on a line or snapshot gets the same "(former staff)" mark as the Done to column, so a deleted payer is not mistaken for current staff.
- The raw `detail` field stays in the response for these codes (ids and fixed words only); the web simply never renders it for them.

## Deviations from Plan

### Auto-fixed Issues

None. Two small adjustments, neither a rule deviation:

- `ListAuditLogHandlerTests` existing helper and one pass-through assertion were updated in the Task 1 GREEN commit (not RED), because `AuditLogEntryView` and `AuditLogItem` gained required members and the test file would not compile otherwise.
- The e2e subline check in `audit-log.spec.ts` was changed in the Task 2 GREEN commit with the new subline, so the existing test kept passing.

### Plan wording notes

- The plan lists `AuditLogPage.tsx` as modified, but the page needed no change: its subline comes from `AUDIT_COPY`, its Action select is built from `AUDIT_ACTIONS`, and Done to already renders `doneTo`.
- The plan lists `ListAuditLogHandler.cs` as modified for the mapping only: it passes `Changes` and `Snapshot` through. The reader does the parsing.

**Total deviations:** 0 auto-fixed, 0 checkpoints.
**Impact on plan:** None.

## Issues Encountered

- Python is not installed here, so the first scripted edit failed before changing anything; the edits were made with the Edit tool instead.
- CA1859 asked for a concrete `List<>` parameter on a private helper; fixed before the first green run.

## Known Stubs

None.

## Threat Flags

None. T-06-48 (personal text reaching the screen) is mitigated: the reader emits typed lines for known keys only, the web renders fixed sentences, and the integration, unit and e2e tests assert that no description or notes text appears. T-06-49 (LIKE injection) is mitigated: the target is a dashed GUID checked by the existing validator, and `LikePattern.Contains` escapes it. T-06-50 (audit table changes) is mitigated: no schema change, no new column, no trigger; the reader is read only and the trigger inventory test passes in the full integration run. T-06-SC: no package was installed.

## User Setup Required

None.

## Owner items

- New SPEC-GAP copy for the 05 D-48 wording review (the backlog item "Phase 6 copy review" already covers it, no new entry): the snapshot line on deleted and restored entries; "Name: {name}" and "Color: {color}" on category added, retired, back in use and deleted entries (the UI-SPEC only gives the renamed and recolored forms); and the "(former staff)" mark after a payer's name on Paid by lines and snapshots.
- The backlog item "Phase 6 audit viewer for expense events (06-RESEARCH open question 2)" is built as option A and still waits for the owner's confirmation.

## Next Phase Readiness

- Plan 06-16 builds the delete screens and can read the delete audit entries through the same viewer; the snapshot already covers deleted, restored and permanently deleted.
- Plan 06-18 and 06-19 (visual review) can look at the What changed list in both themes and on a 320 px phone; the e2e already checks axe and the expanded detail on phones for the older entries.
- No blockers.

## Self-Check: PASSED

All created files exist on disk; the six task commits (`fdf9731`, `878f3a3`, `f887d10`, `8e11473`, `fc06fd1`, `eebb6c3`) are ancestors of HEAD; the full integration, unit, architecture and `npm --prefix web run verify` runs passed; `@audit` e2e passed 25 of 25.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
