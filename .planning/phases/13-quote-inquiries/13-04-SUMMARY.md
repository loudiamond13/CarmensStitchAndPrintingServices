---
phase: 13-quote-inquiries
plan: 04
subsystem: legal
tags: [privacy-policy, legal-pages, draft, quote-requests, retention]
created: "2026-11-22T16:20:00-06:00"
updated: "2026-11-22T16:20:00-06:00"
requires:
  - phase: 12-consent-analytics-legal
    provides: legal text in code, the three-copy legal facts, DRAFT notice, noindex and sitemap rules
provides:
  - Privacy Policy 1.1 draft text covering quote requests, Cloudinary photo storage, converted requests and spam photos
  - Privacy facts (1.1, 2026-11-22, approved false) equal in the fixture, Domain LegalPages and web legalPages.ts
affects: [13-25 owner approval of the Privacy Policy, 13-08 QuoteRequestRetention (6 months), form notice (D-27)]
plan_head_before: 4007cc6132a44baa4997cc37433b37b24fb7695a
plan_head_after: 2955a0daab8ec873ec0427d7fbbe55909f2c4b84
actuals:
  tokens: 6500
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns: ["Draft legal text: bump version and date, set approved false in all three copies, tests pin the draft state"]
key-files:
  created: []
  modified:
    - web/src/modules/public/legalPrivacy.ts
    - web/src/modules/public/legalPages.ts
    - tests/fixtures/legal-pages.json
    - src/Csps.Domain/Content/LegalPages.cs
    - tests/Csps.Domain.UnitTests/Content/LegalPagesTests.cs
    - web/src/test/legal-pages.node.test.ts
    - web/src/test/legal-content.node.test.ts
    - web/src/modules/public/pages/LegalPages.test.tsx
    - web/src/modules/public/pages/PrivacyPolicyPage.test.tsx
    - web/src/modules/public/components/LegalPage.test.tsx
    - tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs
    - tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs
key-decisions:
  - "Privacy Policy is a draft at version 1.1 dated 2026-11-22 until the owner approves it in plan 13-25 (D-28, Phase 12 D-14)"
  - "Retention rows follow the daily cleanup in the same plain style as the UI-SPEC L2 rows (D-34)"
requirements-completed: [INQ-08]
coverage:
  - id: D1
    description: "Privacy facts are version 1.1, 2026-11-22, approved false in the fixture, Domain LegalPages and web legalPages.ts, and the Privacy page shows the DRAFT notice"
    requirement: INQ-08
    verification:
      - kind: unit
        ref: "web/src/test/legal-pages.node.test.ts#keeps the Privacy Policy a draft at version 1.1"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/LegalPagesTests.cs#ThePrivacyPolicyIsVersionOnePointOneAndStillADraft"
        status: pass
      - kind: unit
        ref: "web/src/modules/public/pages/LegalPages.test.tsx#is a DRAFT at version 1.1"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs + SeoEndpointTests.cs (noindex on /privacy, /privacy out of sitemap.xml)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The policy text covers quote request fields, purpose, Cloudinary photos and the three L2 retention rows, with no promise beyond the site"
    requirement: INQ-08
    verification:
      - kind: unit
        ref: "web/src/test/legal-content.node.test.ts#the Privacy Policy covers quote requests"
        status: pass
      - kind: unit
        ref: "web/src/modules/public/pages/PrivacyPolicyPage.test.tsx"
        status: pass
    human_judgment: true
    rationale: "The wording is a plain-English draft. The owner reads and approves it in plan 13-25; no test can judge that it says what the owner wants."
duration: 23min
completed: 2026-11-22
status: complete
---

# Phase 13 Plan 04: Privacy Policy draft 1.1 Summary

**The Privacy Policy now tells visitors what a quote request collects, why, who stores the photos and how long each kind is kept, and it is back to DRAFT 1.1 (noindex, out of the sitemap) until the owner approves it.**

## Performance

- **Duration:** about 23 min (start time was not recorded at the first step; estimated from the first test run and commit times)
- **Completed:** 2026-11-22T16:15:00-06:00
- **Tasks:** 2 of 2
- **Files modified:** 12 (no files created)

## Accomplishments

- Task 1 (tracer): Privacy is version 1.1, last updated 2026-11-22, approved false in `tests/fixtures/legal-pages.json`, `LegalPages.cs` and `legalPages.ts`. The Privacy page shows the DRAFT notice, the head carries noindex, and `/privacy` is gone from `sitemap.xml`. Terms and Accessibility are unchanged.
- Task 2: "What we collect" names every form field (name, team, mobile number, email, product, quantity, message) and photos. "Why we use it" has a Quote requests entry (only to reply and prepare a quote). "Who else handles it" says Cloudinary also stores the quote request photos. "How long we keep it" has the three UI-SPEC L2 rows word for word. The older page count and staff log rows now say "Deleted about 3 years after the day they count." and "Deleted about 8 months after it is recorded." No sentence says "monthly cleanup". The held `PRIVACY_QUOTE_REQUEST_LINES` export is removed.
- The 6 months in the Privacy row match the 6 months in the D-27 form notice and the plan 13-08 retention value.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|------------|--------------|
| 1 | 6244ec4b `test(13-04): add failing tests for Privacy Policy draft 1.1` | 2d67e99b `feat(13-04): Privacy Policy is a draft at version 1.1` |
| 2 | 0fe44aee `test(13-04): add failing tests for quote request text in the Privacy Policy` | 2955a0da `feat(13-04): Privacy Policy covers quote requests and the daily cleanup` |

RED evidence (semantic assessment: each target test ran and failed on the planned assertion, not on a load or syntax error):

- Task 1: `LegalPagesTests.ThePrivacyPolicyIsVersionOnePointOneAndStillADraft` failed with `LegalPages.Privacy.Version should be "1.1" but was "1.0"`. `legal-pages.node.test.ts > keeps the Privacy Policy a draft at version 1.1` failed with received `{ version: '1.0', lastUpdated: '2026-11-21', approved: true }`. `LegalPages.test.tsx > is a DRAFT at version 1.1` failed because the DRAFT notice was absent.
- Task 2: 11 tests failed, each on the planned assertion (missing rows, "monthly cleanup" still present, no quote line in "What we collect", `PRIVACY_QUOTE_REQUEST_LINES` still exported, five handlers and five collect items expected). The "promises no more than the site does" check was already green at RED; it is a guard, not a feature, and stays as a regression check.

The tests were run with vitest and `dotnet test` directly; `gsd_run check tdd-red-evidence` was not run. No REFACTOR commit was needed.

## Verification Evidence

- `npm --prefix web run test -- --run src/test/legal-content.node.test.ts src/test/legal-pages.node.test.ts src/test/no-long-dash.node.test.ts src/modules/public/pages/PrivacyPolicyPage.test.tsx src/modules/public/pages/LegalPages.test.tsx src/modules/public/components/LegalPage.test.tsx`: Test Files 6 passed, Tests 99 passed.
- `npm --prefix web run test -- --run src/test/legal-pages.node.test.ts src/modules/public/pages/LegalPages.test.tsx`: 2 files, 27 tests passed.
- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*LegalPagesTests"`: total 12, succeeded 12.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SeoEndpointTests" --filter-class "*ShellHeadTests"`: total 91, succeeded 91.
- `npm --prefix web run typecheck`: exit 0, no output.
- `eslint --max-warnings 0` on the seven touched web files: exit 0.
- Acceptance: `grep -c "version: '1.1'" web/src/modules/public/legalPages.ts` is 1 (baseline 0); `grep -c "Deleted 6 months after we receive them." .../legalPrivacy.ts` is 1 (baseline 0); `grep -c "monthly cleanup" .../legalPrivacy.ts` is 0 (baseline 3).
- gitleaks `protect --staged` ran before each of the 4 commits: no leaks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests pinned the old Privacy facts and text**
- **Found during:** Tasks 1 and 2
- **Issue:** Files outside the plan's `files_modified` pinned Privacy 1.0 or the old retention words, so they would fail after the change: `PrivacyPolicyPage.test.tsx` (old retention rows, four collect items, "nothing about quote requests" check), `LegalPage.test.tsx` (an "approved privacy" meta that assumed version 1.0), and the server tests `ShellHeadTests.cs` (privacy robots expectation) and `SeoEndpointTests.cs` (sitemap locs and lastmod list).
- **Fix:** Updated their expected values to the 1.1 draft and the new text. `LegalPage.test.tsx` now sets its own version 1.0 so it does not depend on the Privacy facts.
- **Files modified:** `web/src/modules/public/pages/PrivacyPolicyPage.test.tsx`, `web/src/modules/public/components/LegalPage.test.tsx`, `tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs`, `tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs`
- **Commits:** 6244ec4b, 2d67e99b, 0fe44aee

**2. [Rule 3 - Blocking] Worktree had no `web/node_modules`**
- **Issue:** The worktree is a fresh checkout, so vitest, tsc and eslint could not run.
- **Fix:** `npm ci` in `web/` from the existing lockfile (583 packages, no package added or bumped, no lockfile change). `node_modules` is git-ignored.

**3. [Plan text vs system instruction] Commit trailer**
- The plan's executor rules name `Co-Authored-By: Claude Opus 5.5`. The commits carry `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, which is the model that actually wrote them and the attribution line given for this run.

**Total deviations:** 3 (2 auto-fixed blocking, 1 attribution note). **Impact:** none on scope; all extra edits are tests that had to follow the new facts.

### Flake recorded

`LegalPages.test.tsx > the old Cookie Policy address (D-72)` failed once in a six-file run (`document.title` was still "Privacy Policy · CSPS" when "Page Not Found · CSPS" was expected). It passed when re-run alone (20 of 20) and in a full re-run of the same six files (99 of 99). The machine was busy with other executors. The test waits for the h1 and then reads the title straight away, so a slow route load can race it. Not changed here; worth a `waitFor` on the title if it recurs.

## Decisions Made

- The email-sender entry now also says it delivers "the alert our staff get about a quote request", and the Cloudinary entry says it stores the quote request photos. The staff alert email carries the visitor's name, team, phone, product and the start of the message (UI-SPEC R2 email), so leaving it out would understate what happens. This is draft wording for the owner to confirm in plan 13-25.
- The three quote rows sit right after the Orders row in "How long we keep it", so retention for orders and quote requests reads together.

## Known Stubs

None.

## Threat Flags

None. The change is text and flags only; no new endpoint, auth path or schema.

## Issues Encountered

None that block. The wording is a draft and stays `approved: false` until plan 13-25.

## Next Phase Readiness

Plan 13-25 (owner approval) must flip `approved` to true in all three copies and update the pinned literals in `legal-pages.node.test.ts`, `LegalPagesTests.cs`, `LegalPages.test.tsx`, `ShellHeadTests.cs` and `SeoEndpointTests.cs` (the sitemap locs and lastmod list) at the same time. The form notice (D-27) and `QuoteRequestRetention` (13-08) must keep saying 6 months.

## Self-Check: PASSED

- Files exist: `web/src/modules/public/legalPrivacy.ts`, `web/src/modules/public/legalPages.ts`, `tests/fixtures/legal-pages.json`, `src/Csps.Domain/Content/LegalPages.cs`, and the eight touched test files.
- Commits exist on the branch: 6244ec4b, 2d67e99b, 0fe44aee, 2955a0da.
