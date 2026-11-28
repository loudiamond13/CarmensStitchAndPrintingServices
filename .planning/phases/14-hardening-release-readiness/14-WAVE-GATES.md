---
phase: "14"
created: "2026-11-28T03:01:45-06:00"
updated: "2026-11-28T03:01:45-06:00"
---

# Phase 14: Wave gate results

The end-of-wave gate runs `dotnet test --solution Csps.slnx` (CSPS_TEST_SQL=localdb, after the preflight) and `npm --prefix web run verify`.

## Wave 1 (plans 14-01 to 14-09, 14-11)

**First run (HEAD 6d6799bf):** 2 failures.

- `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus`: Admin `POST /api/testing/site-content` got 500, a `DbUpdateConcurrencyException` in `TestingSiteContentSeeder.ResetAsync`. Re-run alone 3 times: 599 of 599 passed each time. **Recorded as a load flake** (full-suite parallel load only; the test-only content seeder races under load). Not caused by wave 1, which did not touch the seeder.
- `web/scripts/license-policy.test.ts`: "No packages found in this path". Cause: the worktree had no `tools/openapi-gen/node_modules`. Restored with `npm ci --prefix tools/openapi-gen --ignore-scripts` (as `ci.yml` does; no package change). Re-run alone 3 times: 64 of 64 passed each time. **Environment gap, not a flake.**

**Code review:** `14-REVIEW.md`, 0 blockers, 5 warnings, 6 info. All 11 fixed (`14-REVIEW-FIX.md`, commits 39ab60e4 to 5fafe4ec).

**Second run after the fixes (HEAD 0dbd4b3f):** green.

- .NET: 11,094 total, 11,092 passed, 0 failed, 2 skipped.
- Web verify: exit 0. 459 test files, 12,262 tests passed. Budget, license gate (0 problems) and notices check passed.
- Wave-post gates: schema drift none, codebase drift skipped (no structure doc), UI safety gate no block.

## Flake log

| Test | Seen | Alone | Outcome |
|------|------|-------|---------|
| `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` | wave 1 gate, full suite | 3 of 3 pass | Load flake, recorded; watch in later gates. If it repeats, give it to plan 14-18 or a gap plan |
