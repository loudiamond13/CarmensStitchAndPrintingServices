---
created: "2026-10-07T16:36:33-05:00"
updated: "2026-10-07T16:36:33-05:00"
phase: 01-hosting-verification-backend-foundation
plan: 13
subsystem: infra
tags: [fnd-13, fnd-12, hosting, smarterasp, sql-server, compat-level, spf, dmarc, d-33]

requires:
  - phase: 01-12
    provides: "HOSTING-RECORD.md checklist and Facts table, HostingRecordTests doc-lint, D-28 option-a decision"
  - phase: 01-04
    provides: "SqlCompatibility.Level (provisional 160) and MigrationScriptTests (idempotent script applied twice at the pinned level and 170)"
provides:
  - "Filled FND-13 hosting record: 20 facts Verified 2026-10-07 from the owner's pasted results, 11 Unverified with a one-line reason each"
  - "D-33 owner decision: target production database is SQL Server 2025; compat pin stays 160 provisional, re-pin to 170 once the 2025 database exists and its level is verified"
  - "Consequences for later phases: app-pool env vars for secrets, Web Deploy, probe facts deferred to the Phase 3 first deploy, SPF -all + DMARC p=reject email rules for Phase 4, 2025 move timed to cutover"
affects: [phase 3 first deploy (runtime patch, in-process, proxy topology, logs, tz/culture, PFX load), phase 4 email sender (SmarterASP mail servers, aligned DKIM, Gmail D2 check), phases 15-17 legacy restore and SQL Server 2025 move, compat re-pin to 170]

actuals:
  tokens: 3807
  tasks: 2
  commits: 1
plan_head_before: dce6f99adac7ed1a3b7fa572310b5aeb5f13c6f1
plan_head_after: efc471d46451d4fd0d439d9a7baa30916abcf9c9

tech-stack:
  added: []
  patterns:
    - "Owner-pasted host facts are transcribed verbatim (trimmed), dated, and masked (account prefix as db_…_csptailoringdb); anything not seen stays Unverified with its reason in the Result cell"
    - "A Facts row that mixes two evidence sources is split so each status is honest (SPF/DMARC DNS records Verified; the Gmail pass check is its own Unverified row)"

key-files:
  created:
    - .planning/phases/01-hosting-verification-backend-foundation/01-13-SUMMARY.md
  modified:
    - .planning/HOSTING-RECORD.md
    - .planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md

key-decisions:
  - "D-33 (owner, 2026-10-07): the target production database is SQL Server 2025; the owner plans to replace the current SQL Server 2022 database hosting and restore the live data onto 2025, during cutover (Phases 15-17), after a fresh backup and after asking SmarterASP.NET about cost, availability and an in-place upgrade or temporary second DB (Basic allows 1 DB)"
  - "SqlCompatibility.Level stays 160 (provisional): the B3 model row was not returned (Unverified) and the target is 2025; 160 is valid on 2022 and 2025; re-pin to 170 only after the 2025 database exists and its level is verified"
  - "B5 IsDbOwner 1 and B6 CONTROL/full DDL confirm the app login is db_owner, so the trigger-based append-only audit lock (D-25/D-32) was the right design"
  - "SPF ends in -all and DMARC is p=reject on cspstailoring.com: Phase 4 mail must go through SmarterASP.NET's mail servers (include:_spf.site4now.net) with aligned DKIM; any other sender is merged into the one SPF record"
  - "Probe (section C) not possible on the Basic plan (no free extra site): runtime patch, in-process hosting, proxy topology, logs folder, Asia/Manila + en-PH, PFX EphemeralKeySet and memory are verified on the Phase 3 first deploy instead"

patterns-established:
  - "Host facts that cannot be probed before go-live are carried as Unverified with a named verification point (the first real deploy), never inferred"

requirements-completed: [FND-13, FND-12]

coverage:
  - id: D1
    description: "HOSTING-RECORD.md Facts table filled from the owner's results: every row Verified with result and date, or Unverified with a reason; no secrets; account prefix masked"
    requirement: "FND-13"
    verification:
      - kind: unit
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class \"*HostingRecordTests\""
        status: pass
    human_judgment: true
    rationale: "The doc-lint proves shape, statuses and absence of secrets; whether each transcribed value faithfully matches what the owner pasted is a human comparison"
  - id: D2
    description: "Compatibility level kept at provisional 160 per D-33, with the idempotent migration script applied twice at 160 and 170"
    requirement: "FND-12"
    verification:
      - kind: integration
        ref: "CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class \"*MigrationScriptTests\""
        status: pass
      - kind: other
        ref: "dotnet build Csps.slnx -tl:off (0 Warning(s))"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-33 (SQL Server 2025 target, no re-pin now) recorded in 01-CONTEXT.md and in the HOSTING-RECORD consequences"
    verification: []
    human_judgment: true
    rationale: "Recording an owner decision faithfully is a judgment check, not something a test asserts"

duration: 4min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 13: Hosting Verification Record Summary

**SmarterASP.NET facts transcribed from the owner's checks: the host runs SQL Server 2022 (16.0.x, Web Edition) on the .NET Basic plan (1 DB, 1000 MB, no scheduler, no staging), and the app login is db_owner. The owner chose SQL Server 2025 as the target (D-33), so the compat pin stays at a provisional 160, proven at 160 and 170.**

## Performance

- **Duration:** 4 min (this continuation; Task 1 was the owner's own control-panel and DNS checks)
- **Started:** 2026-10-07T21:33:42Z
- **Completed:** 2026-10-07T21:36:33Z
- **Tasks:** 2 (Task 1 owner action, Task 2 transcription)
- **Files modified:** 2 (plus this SUMMARY)

## Accomplishments

- **Facts table filled.** These are Verified 2026-10-07:
  - Control panel (A1-A9): plan ".NET Basic"; 1 DB allowed and 1 in use; 1000 MB quota; .NET 10; the legacy site and DB are in this account; settings come from app-pool environment variables and web.config; Web Deploy (and FTP) available; no scheduler; no staging.
  - Database (B1, B2, B4-B6): SQL Server 2022 RTM-CUxx 16.0.x Web Edition; server collation SQL_Latin1_General_CP1_CI_AS; 16.0 MB allocated; IsDbOwner 1; db_owner-level permissions.
  - Live database row from B3: `db_…_csptailoringdb` at compat 150, RCSI off, SIMPLE recovery.
  - Sender domain `cspstailoring.com`, with its SPF and DMARC DNS records.
- **Unverified, each with its reason:**
  - The B3 `model` row, which was not returned.
  - All 9 probe facts. The probe was not possible because the plan allows no extra site; they get verified on the Phase 3 first deploy.
  - DKIM and the Gmail SPF/DKIM/DMARC pass check (D2), which have not been provided yet.
- **D-33 recorded** in 01-CONTEXT.md and in the HOSTING-RECORD consequences:
  - The target is SQL Server 2025, moved during cutover after a fresh backup.
  - The 1-DB limit and the risk to the live site are noted.
  - Still open: SmarterASP.NET's cost and availability for 2025.
- **Compat pin stays at 160 (provisional).** `src/Csps.Infrastructure/Persistence/SqlCompatibility.cs` is unchanged (`Level = 160`). The idempotent script is re-proven at 160 and 170.
- **Consequences for later phases written:**
  - Secrets go into app-pool environment variables.
  - Deploys use Web Deploy.
  - Forwarded headers stay off until the proxy topology is Verified.
  - SPF `-all` and DMARC `p=reject` mean Phase 4 must send through SmarterASP.NET's mail servers with aligned DKIM.
  - db_owner confirms the trigger-based audit lock.

## Task Commits

1. **Task 1: Owner runs the approved checks and pastes the results.** Human action, no commit. The results were pasted in chat on 2026-10-07.
2. **Task 2: Transcribe the facts, keep the provisional pin, re-prove the script.** `efc471d` (docs)

**Plan metadata:** recorded in the final docs commit (SUMMARY, STATE, ROADMAP, REQUIREMENTS)

## Files Created/Modified

- `.planning/HOSTING-RECORD.md`: filled Facts table, results note, section C marked not run, sender domain named, consequences rewritten (D-33, email, Phase 3 items), timestamp line.
- `.planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md`: D-33 added, deferred items updated (domain known, 2025 move), timestamp line.

## Decisions Made

- **D-33 (owner): SQL Server 2025 is the production target, and there is no re-pin now.**
  - 160 stays because the `model` level is Unverified and 160 is valid on both 2022 and 2025.
  - Re-pin to 170 after the 2025 database exists and is verified.
  - The CI SQL Server 2025 container already matches the target.
- **SPF and DMARC are recorded as Verified from the DNS records (D1).** The Gmail pass check (D2) gets its own Unverified row, so no status claims more than what was observed.
- **The B6 permission list is recorded as a summary** (db_owner-level: CONTROL plus all DDL/DML) instead of 100+ lines, per the orchestrator's instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Status legend contradicted the plan's "Unverified rows carry a reason" rule**
- **Found during:** Task 2
- **Issue:** The legend said Unverified rows keep Result "-", but the plan's acceptance criteria require a reason in the Result cell.
- **Fix:** The legend now says the Result column holds the reason and Date stays "-".
- **Files modified:** .planning/HOSTING-RECORD.md
- **Verification:** HostingRecordTests pass (4/4).
- **Committed in:** efc471d

**2. [Rule 2 - Correctness] Added the row "SPF / DKIM / DMARC pass in Gmail"**
- **Found during:** Task 2
- **Issue:** The SPF and DMARC rows covered both D1 (the DNS record) and D2 (the Gmail result). Only D1 was supplied, so a single status would either overclaim or hide a verified record.
- **Fix:** The SPF and DMARC rows now cite D1 only and are Verified. DKIM and a new Gmail-pass row are Unverified with the reason.
- **Files modified:** .planning/HOSTING-RECORD.md
- **Verification:** HostingRecordTests pass (the required SPF, DKIM and DMARC rows are still present).
- **Committed in:** efc471d

---

**Total deviations:** 2 auto-fixed (1 bug, 1 correctness)
**Impact on plan:** Both keep the record honest under D-09. No scope creep. No code changed.

## Issues Encountered

- None blocking. The probe could not run, because the Basic plan allows no free extra site. Its facts move to the Phase 3 first deploy, as the orchestrator instructed.

## User Setup Required

None. Optional follow-ups for the owner:
- Paste the Gmail "Show original" SPF/DKIM/DMARC result lines (D2) before Phase 4.
- Ask SmarterASP.NET whether SQL Server 2025 is offered on the plan, at what cost, and whether an in-place upgrade or a temporary second DB is possible.

## Next Phase Readiness

- This is the last plan of Phase 1 (13 of 13), so the phase is ready for verification.
- **FND-13 and FND-12 are marked complete on the plan's own terms** (Unverified facts recorded with reasons; the compat pin explicitly provisional). The verifier should still note what is open:
  - The probe facts and the Gmail check are Unverified.
  - FND-12's "at the host's compatibility level" is met only provisionally (160, valid on 2022 and 2025) until the 2025 database exists.
- **Phase 3 must verify on the first deploy:** the runtime patch, in-process hosting, the logs folder, proxy topology, Asia/Manila and en-PH, and the PFX load.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- FOUND: .planning/HOSTING-RECORD.md (filled Facts table, D-33 consequences)
- FOUND: .planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md (D-33)
- FOUND: commit efc471d
- PASS: HostingRecordTests 4/4, MigrationScriptTests 6/6 (160 and 170), `dotnet build Csps.slnx -tl:off` 0 Warning(s), `Level = 160` unchanged
