---
phase: 04-identity-authentication
plan: 04
subsystem: auth
tags: [password-policy, domain, zod-mirror, golden-cases, auth-11, auth-09, d-11, d-15]
status: complete
created: "2026-10-14T20:40:00-05:00"
updated: "2026-10-14T20:40:00-05:00"

requires: ["04-01"]
provides:
  - "Csps.Domain.Identity.PasswordPolicy: Normalize (NFC), Length (code points), CheckComposition (D-21 mode), Check (full mode with the D-15 personal-information rule), MessageFor"
  - "PasswordRuleFailure enum and PersonalInfo record"
  - "web/src/utils/passwordRules.ts: PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, passwordLength, checkPasswordComposition, checkPassword, PASSWORD_RULE_MESSAGES"
  - "tests/fixtures/password-policy-cases.json: 39 shared cases and the message table, read by xUnit and Vitest"
  - "REQUIREMENTS.md AUTH-11 / AUTH-09 and ROADMAP Phase 4 criterion 4 amended to the owner's rule"
affects: [04-17, 04-26, 04-27, 04-28, 04-29, 04-30, 04-31, Phase 5 temporary passwords]

requirements-completed: []

actuals:
  tokens: 6830
  tasks: 3
  commits: 5
plan_head_before: 87f1d776aa226729e53f53c5c2947d99fe137fb9
plan_head_after: e6a87835381c5ee48abb9b313541db81a27ab84c

tech-stack:
  added: []
  patterns:
    - "One committed JSON case file linked into the xUnit project and read by Vitest, same as the order-math golden vectors"
    - "Rules reported in one fixed order; the first failing rule's message is shown"

key-files:
  created:
    - src/Csps.Domain/Identity/PasswordPolicy.cs
    - src/Csps.Domain/Identity/PasswordRuleFailure.cs
    - src/Csps.Domain/Identity/PersonalInfo.cs
    - tests/Csps.Domain.UnitTests/Identity/PasswordPolicyTests.cs
    - tests/fixtures/password-policy-cases.json
    - web/src/utils/passwordRules.ts
    - web/src/utils/passwordRules.golden.test.ts
  modified:
    - tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "Number is Unicode Nd, symbol is P* or S*, control is Cc; a space is none of them, so eight spaces pass the length rule and fail with 'Add at least one number.'"
  - "An email without '@' is used whole as the personal-information part; an empty local part is ignored"
  - "The control-character message is SPEC-GAP wording marked in code for the owner's OQ-7 review"
---

# Phase 4 Plan 4: Owner Password Rule Summary

The owner's password rule (D-11, D-15) now exists once in the Domain and once in the browser, and both give the same verdict and the same words on all 39 shared cases. AUTH-11 and the Phase 4 roadmap criterion now say what the code enforces.

## What was built

- `PasswordPolicy` (Domain): 8 to 64 code points of the NFC form, at least one number, at least one symbol, no control characters, and in full mode no email local part, first name or last name (parts under 3 characters ignored). Composition mode (`CheckComposition`) skips the personal-information rule for Phase 5's Manager-set temporary password (D-21).
- `passwordRules.ts`: the browser mirror over `normalize('NFC')`, `Array.from` code points and Unicode property escapes, with `PASSWORD_RULE_MESSAGES` for the zod schemas of plans 04-26 to 04-31.
- `password-policy-cases.json`: 22 composition and 17 full-mode cases (39 in all), plus the seven-message table. xUnit and Vitest both iterate the whole array.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 | Tracer: shared case file decides length and composition in the Domain and the browser (D-11) | 6b5e6d6 (RED), 04658f2 |
| 2 | Personal-information rule (D-15), full-mode ordering, one message table | b9b7a08 (RED), c1da8b1 |
| 3 | Record the AUTH-11 amendment in REQUIREMENTS.md and ROADMAP.md | e6a8783 |

## RED / GREEN evidence

- Task 1 RED: the Domain test project failed to build (`Csps.Domain.Identity` and `PasswordRuleFailure` missing) and Vitest failed to import `./passwordRules`. GREEN: 28 xUnit tests and 25 Vitest tests passed.
- Task 2 RED: the Domain project failed to build (`PersonalInfo`, `Check` missing) and 18 Vitest cases failed (`checkPassword is not a function`, no `PASSWORD_RULE_MESSAGES`). GREEN: 50 xUnit tests and 45 Vitest tests passed.

## Verification

- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*PasswordPolicyTests"`: 50 passed. The build has 0 warnings and 0 errors.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): Csps.Domain 100% line (448/448) and 100% branch (202/202), PASS.
- Web: lint with `--max-warnings 0`, typecheck, and `test:coverage` (114 files, 3184 tests) all pass; overall coverage 98.28% statements. `no-long-dash` and layout tests pass.
- Acceptance greps: `password-policy-cases.json` appears once in the csproj, `NormalizationForm.FormC` once in `PasswordPolicy.cs`, the personal-information message once in `passwordRules.ts`, 16 `"mode": "full"` lines in the fixture, and "12–128" no longer appears in REQUIREMENTS.md.

## Deviations from Plan

None - plan executed as written. Two small notes:

- `@typescript-eslint/no-misused-spread` rejects `[...string]`, so code points are counted with `Array.from(string)`, which gives the same result.
- The shared fixture is written one case per line with ASCII-only `\u` escapes, so editors and formatters cannot normalize the composed and decomposed e-acute cases.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema change. T-04-10 (weak passwords) and T-04-11 (client and server drift) are mitigated by the policy and the shared case file. Breach checks follow in plan 04-17.

## Deferred

- A lone UTF-16 surrogate would make .NET `Normalize` throw, but JSON request bodies cannot carry one (System.Text.Json refuses it), so the API never reaches that case. Not handled here.
- Full case mapping (web `toUpperCase`) versus simple mapping (.NET ordinal ignore-case) can differ for letters such as the German sharp s in a name; the server decides, and the comment in `passwordRules.ts` says so.

## Self-Check: PASSED

- Found: all seven created files and the three modified files.
- Found: commits 6b5e6d6, 04658f2, b9b7a08, c1da8b1, e6a8783 (ancestors of HEAD).
