---
phase: 01-hosting-verification-backend-foundation
plan: 12
subsystem: infra
tags: [fnd-13, hosting, smarterasp, hostprobe, doc-lint, d-28]

requires:
  - phase: 01-04
    provides: "Csps.slnx layout rules (SolutionLayoutTests), BuildConfigTests, RepoRoot helper in Csps.ArchitectureTests"
  - phase: 01-07
    provides: "ForwardedHeadersTests guard (forwarded headers stay off in src/ until the proxy topology is proven)"
provides:
  - "D-28 owner decision recorded: option-a (2026-10-07), a separate throwaway probe site plus owner-run SELECT-only queries"
  - "tools/Csps.HostProbe: key-protected GET /probe (503 without a 32+ char key, 401 empty body without a match, host facts JSON otherwise)"
  - ".planning/HOSTING-RECORD.md: owner checklist A-D in plain words and a 30-row Facts table, all Unverified until plan 01-13"
  - "HostingRecordTests: doc-lint for the Facts table shape, statuses, the D-28 line and secret patterns"
affects: [01-13 hosting checks and compat-level re-pin, phase 3 first deploy (forwarded headers, runtime, no staging), phase 4 email sender (SPF/DKIM/DMARC), phase 17 cutover]

actuals:
  tokens: 8800
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Throwaway host probes live under tools/, carry no package references, are listed in Csps.slnx and are never referenced by src/"
    - "Probe access: key from configuration only, SHA-256 of both values compared with CryptographicOperations.FixedTimeEquals, closed (503) when the key is missing or under 32 characters"
    - "Owner-filled planning records are doc-linted by an ArchitectureTests class that parses the markdown table and rejects secret patterns, with every detector self-checked against a sample"

key-files:
  created:
    - tools/Csps.HostProbe/Csps.HostProbe.csproj
    - tools/Csps.HostProbe/Program.cs
    - tools/Csps.HostProbe/HostFacts.cs
    - tools/Csps.HostProbe/ProbeKey.cs
    - tools/Csps.HostProbe/appsettings.json
    - tools/Csps.HostProbe/README.md
    - tools/Csps.HostProbe/packages.lock.json
    - .planning/HOSTING-RECORD.md
    - tests/Csps.ArchitectureTests/HostingRecordTests.cs
  modified:
    - Csps.slnx

key-decisions:
  - "D-28 decision: option-a (2026-10-07). The owner creates one temporary probe site next to the live site (never inside it), opens the probe once, pastes the result and deletes the site, and runs the six SELECT-only queries in the control panel's query tool"
  - "The probe reports logsWritable as {writable, folderExisted, error}; it creates {contentRoot}/logs only if needed and removes it again when it created it and left it empty"
  - "Check failures report the exception type name only, never its message, so no path or host detail beyond the listed facts leaks"
  - "The probe key goes only into the published artifacts/hostprobe/appsettings.json (gitignored), never the tools/ copy, chat or git; README uses curl.exe because curl is an alias in Windows PowerShell"
  - "Facts table has 30 rows (the 12 required FND-13 facts plus the other control-panel, SQL and probe facts and Sender domain); every row starts Unverified with '-'"

patterns-established:
  - "Owner-run host checks: decision first, look-only steps, a separate throwaway site for anything that must run on the host, results pasted back and recorded as Verified/Unverified/N/A with a date"

requirements-completed: [FND-13]

coverage:
  - id: D1
    description: "D-28 owner decision (option-a, 2026-10-07) recorded at the top of .planning/HOSTING-RECORD.md"
    requirement: "FND-13"
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/HostingRecordTests.cs#RecordsTheD28Decision"
        status: pass
    human_judgment: false
  - id: D2
    description: "tools/Csps.HostProbe answers GET /probe with 503 (no or short key), 401 empty body (missing or wrong key) or the host facts JSON (valid key), always no-store"
    requirement: "FND-13"
    verification:
      - kind: manual_procedural
        ref: "local smoke on http://localhost:5115: keyless 401 (Content-Length 0), wrong key 401, 40-char key 200 JSON with frameworkDescription '.NET 10.0.12', too-short key 503, other route 404"
        status: pass
      - kind: other
        ref: "dotnet build Csps.slnx -tl:off (0 warnings)"
        status: pass
      - kind: unit
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class \"*SolutionLayoutTests\" (5 passed)"
        status: pass
    human_judgment: true
    rationale: "The probe is a throwaway tool verified by a one-off local smoke run, not an automated test; its real value (the host's facts) only appears when the owner runs it on the separate site in plan 01-13."
  - id: D3
    description: ".planning/HOSTING-RECORD.md owner checklist (A control panel, B six SELECT-only queries, C separate probe site with delete and key-secrecy steps, D SPF/DKIM/DMARC last with the merge rule) and the Facts table"
    requirement: "FND-13"
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/HostingRecordTests.cs#HasFactsTableWithRequiredRows"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/HostingRecordTests.cs#StatusesAreValid"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/HostingRecordTests.cs#ContainsNoSecrets"
        status: pass
    human_judgment: true
    rationale: "Whether the plain-words checklist is clear enough for the owner to follow safely is a human judgment; the tests only enforce the table shape and the absence of secrets."

duration: 10min
completed: 2026-10-07
status: complete
commits: 4
plan_head_before: 6c993da5e600e7dafa786d0820bde1f0ffb50b83
plan_head_after: 380d8dbf9f8b8b90856c8741b9a22ff8abb0dc98
---

# Phase 1 Plan 12: FND-13 Hosting Verification Prep Summary

**The owner chose option-a for D-28 (2026-10-07). This plan adds a key-protected throwaway `tools/Csps.HostProbe` (fixed-time SHA-256 key check, 503/401 with empty bodies) that reports runtime, in-process, proxy-header, zone/culture, EphemeralKeySet PFX and memory facts. It also adds `.planning/HOSTING-RECORD.md`, a plain-words owner checklist with six SELECT-only queries and a 30-row Facts table, enforced by HostingRecordTests.**

## Performance

- **Duration:** about 10 min (this continuation run, after the owner's decision)
- **Started:** 2026-10-07T16:09:21Z
- **Completed:** 2026-10-07T16:19:24Z
- **Tasks:** 3 (Task 1, the decision, came from the owner; Tasks 2 and 3 were executed)
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments

- **D-28 recorded.** The first content line of the hosting record reads `D-28 decision: option-a (2026-10-07)`, followed by a one-line plain-words summary.
- **HostProbe (tracer).** `GET /probe` is the only route.
  - Without `HostProbe:Key` (or with a key under 32 characters) it returns `503`.
  - Without a matching `X-Probe-Key` it returns `401` with `Content-Length: 0`.
  - With the right key it returns JSON with `frameworkDescription`, `environmentVersion`, `is64BitProcess`, `processName`, `inProcess` (w3wp), `currentDirectory`, `contentRootPath`, `logsWritable`, `remoteIpAddress`, the raw `X-Forwarded-For` / `X-Forwarded-Proto` / `X-Real-IP` / `CF-Connecting-IP`, `isHttps`, `manilaZone`, `enPhCulture` (`₱12,450.00`), `ephemeralPfxRoundTrip` (RSA-2048 self-signed, PFX with a random password, `X509CertificateLoader.LoadPkcs12` + `EphemeralKeySet`, RSA-OAEP-SHA256 round trip), `totalAvailableMemoryBytes` and `checkedAtUtc` (`TimeProvider.System`).
  - Every response is `Cache-Control: no-store`, and Kestrel's Server header is off.
  - It has no package references, is never referenced by `src/`, and the README gives the owner's eight steps.
- **Hosting record and checklist.** It has a status legend and five safety rules, then four sections:
  - A: nine control-panel screens.
  - B: six copy-paste SELECT-only queries, with a bold note that no trigger probe runs on the live database.
  - C: the probe on a new, separate site. The key stays out of chat and git, the owner's IP is masked, and the site is deleted and checked afterwards.
  - D: SPF/DKIM/DMARC last, merging into the single existing `v=spf1` record and never disturbing the live site.

  After those come the Facts table (30 rows, all `Unverified` / `-`) and "Consequences for later phases".
- **HostingRecordTests (4).** They check the Facts table's columns and its 12 required rows, valid statuses (a Verified row needs a real result and a valid yyyy-MM-dd date), the absence of secrets (each detector is self-checked against a sample), and the D-28 line.

## Task Commits

1. **Task 1: Owner decides what may be checked (D-28)**: `db700d6` (docs). Records option-a at the top of the hosting record.
2. **Task 2: Tracer, the key-protected HostProbe**: `f12ae53` (feat)
3. **Task 3: HOSTING-RECORD.md checklist and Facts table with doc-lint (TDD)**:
   - RED `ad0f687` (test)
   - GREEN `380d8db` (feat)
   - No refactor was needed.

## Tracer Smoke (Task 2, local only)

Preflight was clean, with ports 5115/7028/5180/5199 free and no TheBETSLLC processes. The probe ran with `dotnet run --project tools/Csps.HostProbe --no-build -- --urls http://localhost:5115 --contentRoot <abs path> --HostProbe:Key=<40-char random value>`. The key was set only for that process and lives only in the session scratchpad.

| Check | Result |
|-------|--------|
| Plan verify command (keyless 401, then keyed body contains `"frameworkDescription"`) | exit 0 |
| Keyless request | `401 Unauthorized`, `Content-Length: 0`, `Cache-Control: no-store` |
| Wrong 40-char key | `401` |
| Valid key | `200`, `application/json`, `frameworkDescription: ".NET 10.0.12"`, `processName: "Csps.HostProbe"`, `inProcess: false`, `manilaZone.found: true` (`08:00:00`), `enPhCulture.currency12450: "₱12,450.00"`, `ephemeralPfxRoundTrip.ok: true`, `logsWritable.writable: true` |
| Raw header pass-through (`X-Forwarded-For: 198.51.100.7` sent) | reported verbatim as `xForwardedFor`, `remoteIpAddress` stayed `::1` |
| Second run with a too-short key | `503` with and without the header, empty body |
| Unmapped route `/` | `404` |
| Temporary `{contentRoot}/logs` folder | created and removed again (not left in the repo) |

Both probe processes (PIDs 19904 and 4688, each confirmed as `Csps.HostProbe.exe` before stopping) were stopped. Afterwards port 5115 was free and no HostProbe process remained. Nothing connected to any remote host, and nothing was published or deployed.

## TDD Gate Compliance (Task 3)

- **RED:** `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HostingRecordTests" --report-xunit-junit` exited 2. Of the 4 tests, 2 failed.
  - `HasFactsTableWithRequiredRows` and `StatusesAreValid` failed on the assertion `start should be greater than or equal to 0 but was -1`, with the message ".planning/HOSTING-RECORD.md has no '## Facts' section."
  - `RecordsTheD28Decision` passed at RED by design: Task 1 had already recorded the decision, as the continuation instructions required.
  - `ContainsNoSecrets` passed at RED by design, because it guards an absence.
  - The JUnit record (target `Csps.ArchitectureTests.HostingRecordTests.HasFactsTableWithRequiredRows`) was checked with `gsd check tdd-red-evidence`, which returned `RED_EVIDENCE_OK` (reason `target_test_failed`).
- **GREEN:** after the record was written, 4/4 passed.
- **Mutation check:** one row was set to `Verified` with result `-` and date `2026-13-01`, and another got status `Maybe`. `StatusesAreValid` reported all three problems. The record was then restored byte for byte (`cmp`).
- The gate commits are present in order: `test(01-12)` `ad0f687`, then `feat(01-12)` `380d8db`.

## Files Created/Modified

- `tools/Csps.HostProbe/Csps.HostProbe.csproj`: Web SDK project with no package references, and a comment saying it is never part of the site deploy.
- `tools/Csps.HostProbe/Program.cs`: maps only `GET /probe`, applying the 503/401/200 rules with no-store.
- `tools/Csps.HostProbe/ProbeKey.cs`: `IsConfigured` (32+ characters, not blank) and `Matches` (SHA-256 + `FixedTimeEquals`).
- `tools/Csps.HostProbe/HostFacts.cs`: the facts record and `Collect(HttpContext, IHostEnvironment, TimeProvider)`, where each check catches its own failure.
- `tools/Csps.HostProbe/appsettings.json`: `HostProbe:Key` empty, and warning-level logging.
- `tools/Csps.HostProbe/README.md`: the owner's eight plain-words steps for option-a.
- `tools/Csps.HostProbe/packages.lock.json`: lock file. It holds only the global BannedApiAnalyzers.
- `Csps.slnx`: lists the probe under `/tools/`.
- `.planning/HOSTING-RECORD.md`: the D-28 line, legend, safety rules, sections A-D, Facts table and consequences.
- `tests/Csps.ArchitectureTests/HostingRecordTests.cs`: the four doc-lint tests.

## Decisions Made

See `key-decisions` in the frontmatter. In short:

- The D-28 option-a wording is recorded verbatim with its date.
- The probe reports exception type names only.
- The key lives only in the gitignored published copy.
- The README uses `curl.exe` with `-w "\nHTTP %{http_code}\n"`, so the owner sees the status code even for empty 401/503 bodies.
- B5 asks the owner to paste only `IsDbOwner`, not the database user name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The first local probe start failed on a relative content root**
- **Found during:** Task 2 (local smoke).
- **Issue:** running the built DLL with `--contentRoot tools/Csps.HostProbe` resolved that path against the bin folder (`DirectoryNotFoundException`), so the process exited before listening.
- **Fix:** started it the way the plan describes (`dotnet run --project tools/Csps.HostProbe --no-build`), with an absolute `--contentRoot`. No code change was needed.
- **Verification:** the probe listened on 5115 and every smoke check above passed.
- **Committed in:** not applicable (test procedure only).

### Minor additions within the plan's scope

- `HostFacts.LogsWritable` is an object (`writable`, `folderExisted`, `error`) instead of a bare boolean. It shows whether the folder had to be created, which matters for D-21 log files on IIS.
- `HostingRecordTests.ContainsNoSecrets` first proves that each secret detector matches a known sample, so a broken regex cannot pass silently. The X-Probe-Key detector ignores angle-bracket placeholders such as `<your-probe-key>`.
- The Facts table has 30 rows instead of only the 12 required ones, as the plan's action asks: one row per control-panel, SQL and probe fact, plus Sender domain.

---

**Total deviations:** 1 auto-fixed (1 blocking, in the test procedure only).
**Impact on plan:** none on scope. The fix was only to how the local smoke run was started.

## Issues Encountered

None beyond the deviation above.

## Known Stubs

None that block the plan's goal. Two placeholders are intentional by design:
- `tools/Csps.HostProbe/appsettings.json` keeps `HostProbe:Key` empty so no key reaches git. The probe stays closed (503) until a key is configured.
- Every Facts row in `.planning/HOSTING-RECORD.md` is `Unverified` with Result and Date set to `-`. Plan 01-13 fills these from the owner's pasted results.

## User Setup Required

This plan's only `user_setup` item (the D-28 decision on where the probe may run and whether read-only SQL may run) is complete: option-a, 2026-10-07. The owner's run steps are in `.planning/HOSTING-RECORD.md` (sections A-D) and `tools/Csps.HostProbe/README.md`, and they are carried out in plan 01-13. No separate USER-SETUP.md was generated, because it would duplicate that checklist.

## Next Phase Readiness

- Plan 01-13 is ready to run once 01-10 is also done. The owner works through A, B and C (and D once the domain is known), and Claude fills the Facts table. If `model`'s level is Verified, Claude re-pins `SqlCompatibility.Level`.
- Phase 3 must not turn on forwarded headers until "Client IP / proxy topology" is Verified.
- FND-13 is shared with plan 01-13, so the requirement should only read Complete after 01-13's SUMMARY exists (the shared-ID gate).

## Self-Check: PASSED

- All 9 created files and the modified `Csps.slnx` exist on disk.
- Commits `db700d6`, `f12ae53`, `ad0f687` and `380d8db` are in `git log`.
- All acceptance criteria re-run PASS:
  - The FixedTimeEquals and EphemeralKeySet greps match.
  - The project is listed in the slnx, and no `src/*.csproj` references HostProbe.
  - SolutionLayoutTests 5/5.
  - HostingRecordTests 4/4.
  - The D-28, SELECT @@VERSION and merge greps match.
- Plan verification: `dotnet build Csps.slnx -tl:off` gave 0 warnings and 0 errors, and `dotnet test --project tests/Csps.ArchitectureTests` passed 76/76.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*
