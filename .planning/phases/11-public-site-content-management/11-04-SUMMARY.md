---
phase: 11-public-site-content-management
plan: 04
subsystem: domain
tags: [phone, e164, tel-link, validation, tdd, shared-fixture]
created: "2026-11-11T19:55:00-05:00"
updated: "2026-11-11T19:55:00-05:00"

requires: []
provides:
  - "PhilippinePhone (Csps.Domain.Content): TryParse, E164, Display, IsMobile, InvalidMessage, MaxInputLength"
  - "tests/fixtures/philippine-phone-cases.json: shared accept and refuse cases for .NET and web tests"
affects: [11-07, 11-09, 11-12]

actuals:
  tokens: 2900
  tasks: 2
  commits: 4

plan_head_before: 24e4cef7ec03832dbb2b7fd29c27fa1abbe989bf
plan_head_after: 03142d9e358d6c9bd9e299ff3eca2f4782293e5e

tech-stack:
  added: []
  patterns:
    - "Shared JSON case file linked into the .NET test project and read by both stacks (same as password-policy-cases.json)"
    - "Value type built only from parsed digits, so no typed character can reach a tel: value"

key-files:
  created:
    - src/Csps.Domain/Content/PhilippinePhone.cs
    - tests/Csps.Domain.UnitTests/Content/PhilippinePhoneTests.cs
    - tests/fixtures/philippine-phone-cases.json
  modified:
    - tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj

key-decisions:
  - "Round brackets are stripped but square brackets are not, so '(02) 8123 4567' is accepted and the placeholder '[0917 000 0000]' is refused"
  - "A 10-digit national number starting 09 is refused: 09 means mobile, and a mobile needs 11 digits"
  - "Equality is the record's own: one E164 property, so spacing and 0 versus +63 compare equal"

requirements-completed: [PUB-06, CONT-01]

coverage:
  - id: D1
    description: "A mobile number such as 0917 123 4567 parses to +639171234567 and displays as typed"
    requirement: "PUB-06"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/PhilippinePhoneTests.cs#TryParseGivesTheE164AndDisplayOfTheSharedCase"
        status: pass
    human_judgment: false
  - id: D2
    description: "Landlines (Metro Manila 02 8123 4567, other 088 123 4567) and every +63 form parse and display per UI-SPEC"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/PhilippinePhoneTests.cs#TryParseGivesTheE164AndDisplayOfTheSharedCase"
        status: pass
    human_judgment: false
  - id: D3
    description: "Placeholders, letters, wrong digit counts, foreign numbers and over-long text are refused"
    requirement: "PUB-06"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/PhilippinePhoneTests.cs#TryParseRefusesTheSharedCase"
        status: pass
    human_judgment: false
  - id: D4
    description: "The E.164 value holds only a plus sign and digits (T-11-08)"
    requirement: "PUB-06"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/PhilippinePhoneTests.cs#TheE164HoldsOnlyAPlusAndDigits"
        status: pass
    human_judgment: false
  - id: D5
    description: "The shared case file exists for the web zod test in plan 11-12"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/PhilippinePhoneTests.cs#TheSharedFileHoldsAnAcceptedNumberOfEveryShape"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 04: Philippine phone numbers Summary

**One tested `PhilippinePhone` value type turns what a Manager types into an E.164 `tel:` value and a readable number, and a shared JSON case list lets the web zod schema in plan 11-12 be tested against the same cases.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-11-11T19:36:00-05:00
- **Completed:** 2026-11-11T19:55:00-05:00
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `PhilippinePhone.TryParse` accepts a mobile (`09` plus 9 digits, or `+639` plus 9) and a landline (`0` plus 9 digits, or `+63` plus 9), after dropping spaces, dashes, dots and round brackets. The E.164 text is built only from parsed digits (`+639171234567`).
- `Display` gives mobile `0917 123 4567`, Metro Manila landline `02 8123 4567`, other landline `088 123 4567`. Parsing the display form gives the same number back.
- Everything else is refused: empty and blank text, the placeholder `[0917 000 0000]`, one digit short or long, `+1` numbers, letters, a stray or doubled `+`, `+63 0...`, Arabic-Indic digits, and text over 32 characters. `InvalidMessage` carries the approved wording.
- Two inputs that differ only in spacing or in `0` versus `+63` compare equal (record equality on `E164`), ready for the "This number is already listed." rule.
- `tests/fixtures/philippine-phone-cases.json` holds 12 accept cases and 20 refuse cases, with the 32 and 33 character edges. The .NET test reads it through a linked copy; the web test in 11-12 can read the same file.

## RED / GREEN evidence

RED evidence is quoted from the real `dotnet test` (Microsoft.Testing.Platform) output. The `gsd check tdd-red-evidence` classifier does not read this report format, so the semantic assessment below stands as the RED record.

**Task 1 RED** (`119abf35`): `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*PhilippinePhoneTests"` exited 2 with 2 of 2 failed.
`PhilippinePhone.TryParse("0917 123 4567", out var phone) should be True but was False`.
Semantic assessment: both target tests executed, built against a compile-only stub that always returns false, and failed on the planned assertion. Not a build, discovery or fixture fault.

**Task 1 GREEN** (`d4731902`): 2 of 2 passed.

**Task 2 RED** (`22d8e7bc`): exit 2, 18 of 67 failed. All 18 are landline accept cases (`(02) 8123 4567`, `02-8123-4567`, `+63 2 8123 4567`, `088 123 4567`, `+63 88 123 4567`) failing on `TryParse(...) should be True but was False`, in `TryParseGivesTheE164AndDisplayOfTheSharedCase`, `TheE164HoldsOnlyAPlusAndDigits`, `ParsingTheDisplayFormGivesTheSameNumber`, `ALandlineIsNotMobile` and the equality theory. The 49 mobile, refuse and constant tests already passed, as expected, because Task 1 only handled mobiles.
Semantic assessment: the failures are the planned landline behavior, for the intended reason.

**Task 2 GREEN** (`03142d9e`): 67 of 67 passed.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- `tools/scripts/Invoke-CoverageGate.ps1`: Domain 1390 passed, Application 2561 passed.
  `Csps.Domain       line 100% (2926/2926) (rule >= 100%)  branch 100% (1278/1278) (rule >= 100%)  PASS`
  `Csps.Application  line 98.1% (9088/9257) (rule >= 95% )  branch 95.7% (3112/3251) (rule not gated)  PASS`
- Cobertura: `<class name="Csps.Domain.Content.PhilippinePhone" ... line-rate="1" branch-rate="1">`, so PhilippinePhone is at 100% line and 100% branch.

## Tracer gate

Task 1 is `type="tracer"`. Auto mode is off and `human_verify_mode` is `end-of-phase` with an automated-only `<verify>`, so the verify command was re-run (2 of 2 passed) and execution continued to Task 2. No checkpoint was needed.

## Task Commits

1. **Task 1: mobile number parses to its tel: form** - `119abf35` (test, RED), `d4731902` (feat, GREEN)
2. **Task 2: landlines, +63 forms and refused shapes** - `22d8e7bc` (test, RED), `03142d9e` (feat, GREEN)

No REFACTOR commit: the GREEN code was already split into small members and the tests stayed green.

## Files Created/Modified

- `src/Csps.Domain/Content/PhilippinePhone.cs` - sealed record: `TryParse`, `E164`, `Display`, `IsMobile`, `InvalidMessage`, `MaxInputLength`
- `tests/Csps.Domain.UnitTests/Content/PhilippinePhoneTests.cs` - theories over the shared accept and refuse lists, plus equality, digits-only E.164, display round trip and file-edge checks
- `tests/fixtures/philippine-phone-cases.json` - the shared case list `{ "accept": [{ input, e164, display }], "refuse": [...] }`
- `tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj` - links the fixture into the test output, as the password cases are

## Decisions Made

- **Square brackets are not stripped.** The plan text says brackets are removed, but it also requires `[0917 000 0000]` to be refused and `(02) 8123 4567` to be accepted. Both hold only if round brackets are dropped and square brackets are not. Square brackets mark a placeholder (RESEARCH P-3), so they stay and the number is refused. Plan 11-12 must strip `(` and `)` only.
- **10-digit `09...` is refused.** `09` is the mobile prefix and a mobile has 11 digits, so `091 123 4567` is neither shape.
- **Tab, newline and other white space count as spaces** (`char.IsWhiteSpace`). Only digits and a leading `+` reach `E164`, so this cannot leak anything into a `tel:` value. Plan 11-12 should match with `\s`.
- **Only ASCII digits are accepted** (`char.IsAsciiDigit`), so non-ASCII digit characters are refused.
- **A leading `+` followed by spaces is accepted** (`"+ 63 917 123 4567"`), because separators are ignored everywhere. Not in the case list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Linked the shared fixture into the test project**
- **Found during:** Task 1
- **Issue:** The test reads the fixture from the output folder, as the password cases do, but `Csps.Domain.UnitTests.csproj` was not in the plan's `files_modified`. Without the link the file is not copied and the theory cannot load it.
- **Fix:** Added a `Content` item with `CopyToOutputDirectory`, next to the password-policy one.
- **Files modified:** `tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj`
- **Commit:** `119abf35`

**2. [Rule 3 - Blocking] Compile-only stub in the Task 1 RED commit**
- **Found during:** Task 1 RED
- **Issue:** Without a `PhilippinePhone` type the test project does not build, and a build error is not a valid RED.
- **Fix:** The RED commit carries a stub whose `TryParse` always returns false, so the tests fail on the assertion. The real code replaced it in the GREEN commit.
- **Files modified:** `src/Csps.Domain/Content/PhilippinePhone.cs`
- **Commit:** `119abf35`

**Total deviations:** 2 auto-fixed (both Rule 3). **Impact:** none on behavior or scope.

## Authentication Gates

None.

## Known Stubs

None. The Task 1 stub was replaced in the same plan.

## Threat Flags

None. No new endpoint, auth path or file access. T-11-08 is mitigated: the E.164 text is built from parsed digits only, and a test checks every accepted number against `^\+[0-9]+$`. T-11-SC: no package added or bumped.

## Notes for later plans

- 11-07 and 11-09 should call `PhilippinePhone.TryParse` and compare numbers by `E164` for the duplicate rule. `SiteSettings.ContactPhoneMaxLength` is 32, the same as `MaxInputLength`.
- 11-12 should read `tests/fixtures/philippine-phone-cases.json`, check the length first (32), then the shape. The file name is already allowlist-safe for gitleaks (phone numbers only, made-up test values).
- The fixture uses only made-up test numbers (`0917 123 4567`, `02 8123 4567`, `088 123 4567`).

## Self-Check: PASSED

- FOUND: `src/Csps.Domain/Content/PhilippinePhone.cs`, `tests/Csps.Domain.UnitTests/Content/PhilippinePhoneTests.cs`, `tests/fixtures/philippine-phone-cases.json`
- FOUND commits: `119abf35`, `d4731902`, `22d8e7bc`, `03142d9e` (all reachable from HEAD)
- Acceptance criteria re-run: `public static bool TryParse` count 1; `philippine-phone-cases.json` in the test file count 2; `[0917 000 0000]` or `+63281234567` in the fixture count 4 (both present).
- Plan verification: PhilippinePhoneTests 67 of 67 green, Domain coverage 100% line and branch, `dotnet format` clean.
