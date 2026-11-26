---
created: 2026-11-25T23:47:00-06:00
updated: 2026-11-25T23:47:00-06:00
phase: quick-261125-w4m
plan: 01
subsystem: public-legal-pages
tags: [privacy-policy, D-45, legal, sitemap, seo]
status: complete
requirements: [INQ-08]
key-files:
  modified:
    - web/src/modules/public/legalPrivacy.ts
    - web/src/modules/public/legalPages.ts
    - src/Csps.Domain/Content/LegalPages.cs
    - tests/fixtures/legal-pages.json
    - web/src/test/legal-content.node.test.ts
    - web/src/test/legal-pages.node.test.ts
    - web/src/modules/public/pages/PrivacyPolicyPage.test.tsx
    - web/src/modules/public/pages/LegalPages.test.tsx
    - tests/Csps.Domain.UnitTests/Content/LegalPagesTests.cs
    - tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs
    - .planning/phases/999.9-owner-items-parked-during-phase-13-execution/DECISIONS.md
    - .planning/phases/13-quote-inquiries/13-VERIFICATION.md
actuals:
  tokens: 20000
  tasks: 3
  commits: 3
plan_head_before: df0c92059c55a6f97551c992f70cc46f5f4f9e4b
plan_head_after: 366b4dcb86bdc47caa9f579e25c0475d477806a9
---

# Quick 261125-w4m: Apply D-45, approve Privacy Policy 1.1

*Created: 2026-11-25T23:47:00-06:00 · Updated: 2026-11-25T23:47:00-06:00*

The Privacy Policy now ends "How long we keep it" with the approved stray photo sentence, and Privacy Policy 1.1 is approved (last updated 2026-11-25) in all three copies of the facts. `/privacy` shows no DRAFT notice, and the server stops sending noindex and lists it in sitemap.xml.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | be04e909 | feat: add the rare stray photo sentence to the Privacy Policy (D-45) |
| 2 | 321898a4 | feat: approve Privacy Policy 1.1 so it leaves draft, drops noindex and returns to the sitemap (D-45) |
| 3 | 366b4dcb | docs: record D-45 as applied (P13-BL-27 done, W1 resolved) |

RED and GREEN for each task went into one commit, so every commit stays green.

## Evidence

Preflight was run before each test run. Ports 5180, 5115 and 7028 were held by this project's own Vite and API, 5199 was free, no TheBETSLLC test processes were listed, and LocalDB was unreachable.

### Task 1 (sentence)

- RED: `npm --prefix web run test -- --run src/test/legal-content.node.test.ts src/modules/public/pages/PrivacyPolicyPage.test.tsx` gave `Tests 2 failed | 53 passed (55)`, exit 1.
  - `legal-content.node.test.ts`: `AssertionError: expected { kind: 'dl', …(1) } to deeply equal { kind: 'p', …(1) }`.
  - `PrivacyPolicyPage.test.tsx`: `TestingLibraryElementError: Unable to find an element with the text: Rarely, a photo that finishes uploading ...`.
- GREEN: the same two files plus `src/test/no-long-dash.node.test.ts` gave `Test Files 3 passed (3)`, `Tests 56 passed (56)`, exit 0.
- The sentence appears once each in `legalPrivacy.ts`, `legal-content.node.test.ts` and `PrivacyPolicyPage.test.tsx` (baseline 0 each). `copy.ts` is unchanged.

### Task 2 (approval flip)

- RED, web: `legal-pages.node.test.ts` and `LegalPages.test.tsx` gave `Tests 2 failed | 25 passed (27)`. The first failed on `expected { version: '1.1', …(2) } to deeply equal { version: '1.1', …(2) }`, the second on `expected [ <p …(1)></p> ] to have a length of +0 but got 1` (the DRAFT notice).
- RED, Domain: `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*LegalPagesTests"` failed 1 of 12: `LegalPages.Privacy.LastUpdated should be 11/25/2026 but was 11/22/2026`.
- RED, Server: `dotnet test --project tests/Csps.Server.IntegrationTests --artifacts-path artifacts/quick-261125-w4m --filter-class "*SeoEndpointTests"` failed 4 of 20. They included `SitemapListsThePublicPagesAndTheApprovedLegalPagesInRouteOrder` (no `/privacy` listed) and `ALegalPageTakesTheContentDateWhenTheContentChangedLater` (6 URLs, expected 7). `WhenTheContentCannotBeReadTheSitemapIsStillSentWithoutDates` (count 6) was the third. The fourth failure scrolled out of the captured output; the plan expects it to be `ALegalPageWhoseTextChangedAfterTheContentHasItsOwnDate`.
- GREEN:
  - web: `Test Files 2 passed (2)`, `Tests 27 passed (27)`, exit 0.
  - `*LegalPagesTests` (Domain): `total: 12, failed: 0, succeeded: 12`.
  - `*SeoEndpointTests` (Server): `total: 20, failed: 0, succeeded: 20`.
  - The six legal web test files (`legal-pages.node`, `legal-content.node`, `no-long-dash.node`, `LegalPages`, `PrivacyPolicyPage`, `LegalPage` component): `Test Files 6 passed (6)`, `Tests 101 passed (101)`, exit 0.
- `npm --prefix web run typecheck`: exit 0. `lint` (`--max-warnings 0`): exit 0. `format:check`: "All matched files use Prettier code style!", exit 0. `build:budget`: built, exit 0.
- `dotnet build Csps.slnx -warnaserror --artifacts-path artifacts/quick-261125-w4m`: `Build succeeded. 0 Warning(s) 0 Error(s)`. This build also compiles `ShellHeadTests`.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output. The plan's `--no-restore` form failed here with `CS0246` errors in `tools/Csps.LegacyFitCheck` (unrelated types missing), because the fresh worktree has no restored or built project references in the normal obj folders. Without `--no-restore` it passes. This is a worktree setup effect, not a code problem.
- All acceptance greps hit their targets. `git diff --quiet 0657ed0f -- web/src/modules/public/copy.ts src/Csps.Server` exits 0 (unchanged).

Artifacts-path form that worked: `dotnet test --project tests/Csps.Server.IntegrationTests --artifacts-path artifacts/quick-261125-w4m --filter-class "*SeoEndpointTests"`. The fallback was not needed.

### Task 3 (planning docs)

All the doc greps hit their targets: "Applied in quick 261125-w4m" 1, "Still to do: add the stray-photo sentence" 0, the DECISIONS created stamp unchanged, `| W1 | **Resolved` 1, the three old W1 phrases 0, and the VERIFICATION created stamp unchanged. Only the updated stamp moved in each file.

## Not run here

- `ShellHeadTests` (including the `/privacy` robots row that now expects no robots meta): not run here, LocalDB unreachable (class fixture `CspsDatabase`). It compiled in the artifacts build. CI and the merge gate run it.
- The full .NET and web suites, Playwright, e2e, parity and Lighthouse: not run, by instruction.

## Deviations from Plan

None. The plan was executed as written. Two tooling notes, neither a code change:

- `dotnet format --no-restore` fails in a fresh worktree (see above), so it was run without `--no-restore`.
- The plan says "stay on branch `gsd/phase-13-quote-inquiries`". The commits are on the worktree branch `worktree-agent-a1957133fe050bbd7`, as the orchestrator set up.

## Local effect

Vite on 5180 picks up the page change live. The API on 5115 keeps serving the old server-side facts (noindex meta, no `/privacy` in sitemap.xml) until the owner restarts it. It was not restarted.

## Owner questions

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema change. `src/Csps.Server` is unchanged.

## Self-Check: PASSED

Commits be04e909, 321898a4 and 366b4dcb are on the branch. All 13 planned files changed and no other file did. No package files changed.
