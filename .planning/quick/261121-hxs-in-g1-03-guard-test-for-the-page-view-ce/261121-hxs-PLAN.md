---
created: 2026-11-21T12:59:56-06:00
updated: 2026-11-21T12:59:56-06:00
phase: quick-261121-hxs
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - tests/Csps.Server.IntegrationTests/RateLimiting/PageViewCeilingRouteTests.cs
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - src/Csps.Server/Controllers/AnalyticsController.cs
  - .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-REVIEW-DISPOSITION.md
  - .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md
autonomous: true
requirements: [ANL-06]

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Per D-138, the site-wide page view ceiling (IsPageView) and the page view action's [EndpointName] read the name from one constant, RateLimitingRegistration.PageViewEndpointName, whose value stays RecordPageView; the quoted literal appears exactly once in src/Csps.Server"
    - "Per D-138, PageViewCeilingRouteTests.ExactlyOneEndpointCarriesTheCeilingNameAndItIsThePageViewPost resolves EndpointDataSource from the test host and passes only when exactly one RouteEndpoint carries that name, its route is api/v1/analytics/page-views and its only method is POST"
    - "The guard was red first (CS0122, the constant was private) and it turns red again when the controller's name is changed (mutation check, reverted, not committed)"
    - "The ceiling's behaviour is unchanged: every AnalyticsRateLimitTests test passes, the OpenAPI snapshot (operationId RecordPageView) passes, the architecture tests pass, and the build has zero warnings"
    - "Per D-138, IN-G1-03 is recorded as fixed in 12.1-REVIEW-DISPOSITION.md with the commit and the test name (counts 9 fixed, 4 owner, 7 deferred, 20 total), and 12.1-SECURITY.md auditor note 4 says it is closed by D-138 with the test name; in both files only the updated timestamp changes in the frontmatter, apart from the disposition counts"
  artifacts:
    - path: tests/Csps.Server.IntegrationTests/RateLimiting/PageViewCeilingRouteTests.cs
      provides: "The D-138 guard: exactly one endpoint carries the name the ceiling keys on, and it is POST api/v1/analytics/page-views"
      contains: "RateLimitingRegistration.PageViewEndpointName"
    - path: src/Csps.Server/Security/RateLimitingRegistration.cs
      provides: "The shared endpoint name constant the ceiling keys on"
      contains: "public const string PageViewEndpointName"
    - path: src/Csps.Server/Controllers/AnalyticsController.cs
      provides: "The page view action named from the shared constant"
      contains: "[EndpointName(RateLimitingRegistration.PageViewEndpointName)]"
    - path: .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-REVIEW-DISPOSITION.md
      provides: "IN-G1-03 outcome fixed, with commit and test name"
      contains: "| IN-G1-03 | info | fixed |"
    - path: .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md
      provides: "Auditor note 4 closed by D-138"
      contains: "closed by D-138"
  key_links:
    - from: src/Csps.Server/Controllers/AnalyticsController.cs
      to: src/Csps.Server/Security/RateLimitingRegistration.cs
      via: "[EndpointName(RateLimitingRegistration.PageViewEndpointName)] on RecordPageView"
      pattern: "EndpointName\\(RateLimitingRegistration\\.PageViewEndpointName\\)"
    - from: src/Csps.Server/Security/RateLimitingRegistration.cs
      to: "the routed endpoint's IEndpointNameMetadata"
      via: "IsPageView compares EndpointName with PageViewEndpointName (ordinal)"
      pattern: "PageViewEndpointName,"
    - from: tests/Csps.Server.IntegrationTests/RateLimiting/PageViewCeilingRouteTests.cs
      to: "EndpointDataSource of the real host"
      via: "CspsApiFactory.ForDatabase, then GetRequiredService<EndpointDataSource>()"
      pattern: "EndpointDataSource"
---

<objective>
Close review item IN-G1-03 per owner ruling D-138 (2026-11-21, `12.1-CONTEXT.md`): the site-wide page view ceiling must not be silently switched off by renaming the endpoint name on either side.

Today `RateLimitingRegistration.IsPageView` (line 156) compares the routed endpoint's `IEndpointNameMetadata.EndpointName` with a private const `PageViewEndpointName` (line 23), and `AnalyticsController.RecordPageView` sets the same name separately with a string literal in `[EndpointName(...)]` (line 33). Two copies of one value.

Purpose: one constant feeds both sides, and a fast metadata test fails if no endpoint (or more than one) carries the name the ceiling keys on, or if that endpoint is not POST `api/v1/analytics/page-views`.
Output: `PageViewCeilingRouteTests.cs` (new), the constant made public and used by the controller, IN-G1-03 recorded as fixed, auditor note 4 closed.

Note for the record: the existing behaviour test `TheSiteWideCeilingStopsThePageViewRouteAcrossAddresses` would also go red on a rename (the ceiling would stop tripping). D-138 still asks for the direct guard; it fails faster and names the cause.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-CONTEXT.md (D-138 at line 68 only)
@src/Csps.Server/Security/RateLimitingRegistration.cs
@src/Csps.Server/Controllers/AnalyticsController.cs
@tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs (lines 1 to 45: the CspsDatabase fixture, CspsApiFactory.ForDatabase and the EndpointDataSource pattern)

## Facts found while planning (checked at HEAD 375f73c0)

- `src/Csps.Server/Csps.Server.csproj` has no `InternalsVisibleTo`, so the test cannot see an `internal` member. `RateLimitedCode` on the same class is already `public const`; follow that precedent (Claude's discretion: public, because adding `InternalsVisibleTo` would open every Server internal to the tests).
- `Directory.Build.props` sets `GenerateDocumentationFile` for `src/` plus `TreatWarningsAsErrors`, so a new public member without `/// <summary>` fails the build (CS1591).
- `AnalyticsController.cs` already has `using Csps.Server.Security;`.
- Test project global usings include Xunit and Shouldly (`tests/Directory.Build.props`). `EndpointDataSource`, `RouteEndpoint`, `IEndpointNameMetadata` and `IHttpMethodMetadata` live in `Microsoft.AspNetCore.Routing`.
- The endpoint name is also the OpenAPI operationId (`tools/openapi-gen/openapi.v1.json` line 8474, `web/src/types/api.generated.ts`). The value must stay `RecordPageView`; `OpenApiSnapshotTests` guards it. Neither generated file may change.
- `web/src/test/cookie-inventory.node.test.ts` reads every C# file in the Security folder but only for `csps_` cookie names, so this change does not affect it.
- Baselines at HEAD, so every gate below is real:
  - quoted literal `"RecordPageView"` in `src/Csps.Server` C# files (bin and obj excluded): 2 lines (RateLimitingRegistration.cs:23, AnalyticsController.cs:33). Target 1.
  - `public const string PageViewEndpointName` in RateLimitingRegistration.cs: 0. Target 1.
  - `EndpointName(RateLimitingRegistration.PageViewEndpointName)` in AnalyticsController.cs: 0. Target 1.
  - `PageViewCeilingRouteTests.cs`: absent.
  - 12.1-REVIEW-DISPOSITION.md: the IN-G1-03 row's Outcome is deferred (line 23); frontmatter `counts: { fixed: 8, owner: 4, deferred: 8, total: 20 }` matches the 20 rows; `D-138` count 0; `created: 2026-11-19T09:10:00-06:00`.
  - 12.1-SECURITY.md: note 4 is line 89 and calls the item open; `closed by D-138` count 0; `created: 2026-11-21T11:20:00-06:00`; `threats_open: 0`, `status: verified`.
- Out of scope, leave untouched: `12.1-VERIFICATION.md` line 199, `12.1-REVIEW.md`, `12.1-REVIEW-G1.md` (point-in-time records), SECURITY notes 1 to 3, its threat register, its audit trail, `threats_open` and `status`, and `12.1-CONTEXT.md` (D-138 is already recorded).

## Owner rules for this executor (subagents do not see CLAUDE.md or memory otherwise)

- **Test-driven:** write the failing test first, run it and quote the failure (RED), then make the change and quote it green. Zero warnings in build, analyzers, format and tests.
- **Evidence before done:** quote each command's result tail and exit code. If a test fails, re-run it alone before calling it flaky, and record any flake in the SUMMARY. Never claim a pass you did not see.
- **Scope:** no new or bumped package, no inline SQL (no `SqlQuery`, `FromSql`, `ExecuteSql`, no SQL strings), no migration, no trigger, no schema change. Do not change the constant's value, `IsPageView`, the limiter chain or any limit. Anything beyond this plan goes to the SUMMARY as an owner question with 2 to 3 options, the recommendation first with a one-line reason. Never self-approve.
- **Shared machine:** TheBETSLLC (`C:\Work\TheBETSLLC`) runs on this machine. Before each integration test run, run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`, quote it, and wait if a port is in use by another project or TheBETSLLC's test processes are listed.
  - Never touch `C:\Work\TheBETSLLC`, its ports (5173, 5023, 5099), its databases (`BetsLLC_*`) or its processes. Never kill a process you did not start.
  - Set `CSPS_TEST_SQL=localdb` per process only: in Git Bash put `CSPS_TEST_SQL=localdb` in front of the one `dotnet test` command; in PowerShell use `$env:CSPS_TEST_SQL='localdb'; dotnet test ...` in the same command line. Never set it, or any other variable, at User or Machine level.
  - If LocalDB looks stopped, `sqllocaldb start MSSQLLocalDB` is allowed. Never stop, delete or recreate the instance (TheBETSLLC shares it).
  - No dev server, no Playwright, no e2e run.
- **No stdin reads:** never run a bare `cat > file`, `read` or an interactive prompt. Use the Write or Edit tool. Leave no background shell running.
- **Comments (OR-2):** minimal and concise, saying what the code does, no history narration. No em dash or en dash in code, comments or docs; use a colon, a period or "to".
- **Commits:** stage by path, never `git add -A` or `git add .`. Before each commit:
  - run `gitleaks git --staged --redact --no-banner --config .gitleaks.toml`;
  - scan the staged diff for server or database names, connection strings, real emails, machine names and local `C:/Users/<name>` paths, and mask any you find.
  - Conventional Commits with scope `261121-hxs`, plain English, each message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Stay on branch `gsd/phase-12-consent-analytics-legal`. Do not push, open a PR, merge or deploy.
  - Do not commit the PLAN, SUMMARY or STATE (the orchestrator does).
- **Markdown:** every markdown file you create or edit carries created and updated timestamps (ISO 8601 with offset). Get the time with `powershell -NoProfile -Command "Get-Date -Format yyyy-MM-ddTHH:mm:sszzz"`. On an edit change only the `updated:` value, never `created:`. The SUMMARY gets `created:` and `updated:` in its frontmatter.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: One shared endpoint name for the page view ceiling and its route, guarded by a red-first test (D-138)</name>
  <files>tests/Csps.Server.IntegrationTests/RateLimiting/PageViewCeilingRouteTests.cs, src/Csps.Server/Security/RateLimitingRegistration.cs, src/Csps.Server/Controllers/AnalyticsController.cs</files>
  <read_first>src/Csps.Server/Security/RateLimitingRegistration.cs (lines 14 to 27 and 140 to 160), src/Csps.Server/Controllers/AnalyticsController.cs (lines 1 to 44), tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs (lines 1 to 45)</read_first>
  <behavior>
    - Exactly one RouteEndpoint in the real host's EndpointDataSource has IEndpointNameMetadata.EndpointName equal (ordinal) to RateLimitingRegistration.PageViewEndpointName.
    - That endpoint's RoutePattern.RawText is api/v1/analytics/page-views and its IHttpMethodMetadata lists POST and nothing else.
    - The test reads the name only through the constant, so before the constant is public it does not compile (RED, CS0122).
    - Changing the controller's endpoint name away from the constant makes the test fail (mutation check).
  </behavior>
  <action>
    1. RED (per D-138). Create `tests/Csps.Server.IntegrationTests/RateLimiting/PageViewCeilingRouteTests.cs` in namespace `Csps.Server.IntegrationTests.RateLimiting`: `public sealed class PageViewCeilingRouteTests(CspsDatabase database) : IClassFixture<CspsDatabase>` with a one-line `/// <summary>` such as "D-138, IN-G1-03: the site-wide page view ceiling keys on an endpoint name, so exactly one endpoint, the page view POST, must carry it." Usings: `Csps.Server.Security`, `Csps.Testing`, `Microsoft.AspNetCore.Routing`, `Microsoft.Extensions.DependencyInjection`. One `[Fact]` named `ExactlyOneEndpointCarriesTheCeilingNameAndItIsThePageViewPost`, async: build the host with `await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);` (same pattern as `OnlyThePageViewRuleRemainsForAnalytics`), take `factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()`, keep those whose `Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName` equals `RateLimitingRegistration.PageViewEndpointName` with `string.Equals(..., StringComparison.Ordinal)` (the comparison `IsPageView` uses), and call `ShouldHaveSingleItem` with a custom message that says the site-wide ceiling keys on this name. On that endpoint assert `RoutePattern.RawText.ShouldBe("api/v1/analytics/page-views")` and `Metadata.GetMetadata<IHttpMethodMetadata>().ShouldNotBeNull().HttpMethods.ShouldHaveSingleItem().ShouldBe("POST")`. Never write the endpoint name as a string literal in the test. Run `dotnet build tests/Csps.Server.IntegrationTests` and quote the CS0122 error ("inaccessible due to its protection level") on `RateLimitingRegistration.PageViewEndpointName`.
    2. GREEN (per D-138). In `RateLimitingRegistration.cs` change the `PageViewEndpointName` constant's access modifier from private to public and move it directly below `RateLimitedCode`, with the summary "The endpoint name the site-wide page view ceiling keys on. The page view action takes its name from it." Keep its value, `IsPageView` and everything else unchanged. Public, not internal: Csps.Server has no InternalsVisibleTo and `RateLimitedCode` is the public precedent on this class. In `AnalyticsController.cs` replace the string literal argument of `[EndpointName(...)]` on `RecordPageView` with `RateLimitingRegistration.PageViewEndpointName`. No other line in either file changes. Run preflight, then the new class (see verify); quote it green.
    3. Mutation check, not committed. Temporarily set the controller's argument to the literal `"RecordPageViewRenamed"`, run only the new class and quote the failure (the single-item assertion with your message). Restore the constant with Edit and confirm `git diff -- src/Csps.Server/Controllers/AnalyticsController.cs` shows only the one-line change from step 2.
    4. Gates: run preflight, then the new class, `*AnalyticsRateLimitTests` (the ceiling tests), `*OpenApiSnapshotTests` (operationId unchanged), the architecture tests, `dotnet build Csps.slnx -warnaserror` and `dotnet format Csps.slnx --verify-no-changes --no-restore`; all green, zero warnings, tails quoted. Confirm `git status --porcelain -- tools/openapi-gen web/src/types` prints nothing.
    5. Commit the three files by path, after gitleaks and the manual scan: `fix(261121-hxs): the page view ceiling and its route share one endpoint name, with a guard test (D-138)`. Record the short hash for Task 2.
  </action>
  <verify>
    <automated>dotnet build tests/Csps.Server.IntegrationTests 2>&1 | grep -c "CS0122"   # RED before step 2: at least 1</automated>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199</automated>
    <automated>CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PageViewCeilingRouteTests"</automated>
    <automated>CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AnalyticsRateLimitTests"</automated>
    <automated>CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"</automated>
    <automated>dotnet test --project tests/Csps.ArchitectureTests</automated>
    <automated>dotnet build Csps.slnx -warnaserror</automated>
    <automated>dotnet format Csps.slnx --verify-no-changes --no-restore</automated>
    <automated>grep -rn --include=*.cs --exclude-dir=bin --exclude-dir=obj '"RecordPageView"' src/Csps.Server | wc -l   # 1 (baseline 2), and that line is in RateLimitingRegistration.cs</automated>
    <automated>grep -c "public const string PageViewEndpointName" src/Csps.Server/Security/RateLimitingRegistration.cs   # 1 (baseline 0)</automated>
    <automated>grep -cF "EndpointName(RateLimitingRegistration.PageViewEndpointName)" src/Csps.Server/Controllers/AnalyticsController.cs   # 1 (baseline 0)</automated>
    <automated>git status --porcelain -- tools/openapi-gen web/src/types   # empty</automated>
  </verify>
  <done>The RED build error and the mutation-check failure are quoted. The new test, all AnalyticsRateLimitTests, OpenApiSnapshotTests and the architecture tests pass; the solution builds with zero warnings and format is clean. The name lives in one constant used by both the ceiling and the controller. One code commit exists (three files, staged by path, gitleaks clean), and its short hash is noted.</done>
</task>

<task type="auto">
  <name>Task 2: Record IN-G1-03 as fixed and close auditor note 4 (D-138)</name>
  <files>.planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-REVIEW-DISPOSITION.md, .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md</files>
  <read_first>12.1-REVIEW-DISPOSITION.md (lines 1 to 23), 12.1-SECURITY.md (lines 1 to 11 and 84 to 90)</read_first>
  <action>
    1. Get the time with the Get-Date command from the owner rules.
    2. `12.1-REVIEW-DISPOSITION.md`: set `updated:` to the new time (leave `created:`); change `counts` to fixed 9, owner 4, deferred 7, total 20. In the IN-G1-03 row keep the Finding and Severity cells, change the Outcome cell from deferred to fixed, and make the Detail: "`<hash>` (D-138): the ceiling and the page view action read one constant, `RateLimitingRegistration.PageViewEndpointName`. `PageViewCeilingRouteTests.ExactlyOneEndpointCarriesTheCeilingNameAndItIsThePageViewPost` fails if no endpoint, or more than one, carries it." Use Task 1's short hash. No other row changes.
    3. `12.1-SECURITY.md`: set `updated:` to the new time (leave `created:` and every other frontmatter key). Rewrite note 4 only, so its bold lead reads "Review item IN-G1-03 (from verification, not a registered threat): closed by D-138." followed by: "The site-wide ceiling is keyed on the endpoint name `RecordPageView`. The ceiling and the page view action now read it from one constant, and `PageViewCeilingRouteTests.ExactlyOneEndpointCarriesTheCeilingNameAndItIsThePageViewPost` fails if no endpoint carries it (`<hash>`)." Notes 1 to 3, the register and the audit trail stay as they are.
    4. Commit the two docs by path, after gitleaks and the manual scan: `docs(261121-hxs): record IN-G1-03 as fixed and close auditor note 4 (D-138)`.
  </action>
  <verify>
    <automated>grep -cF "| IN-G1-03 | info | fixed |" .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-REVIEW-DISPOSITION.md   # 1 (baseline 0)</automated>
    <automated>grep -cF "counts: { fixed: 9, owner: 4, deferred: 7, total: 20 }" .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-REVIEW-DISPOSITION.md   # 1 (baseline 0)</automated>
    <automated>grep -c "ExactlyOneEndpointCarriesTheCeilingNameAndItIsThePageViewPost" .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-REVIEW-DISPOSITION.md .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md   # 1 each (baseline 0)</automated>
    <automated>grep -c "closed by D-138" .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md   # 1 (baseline 0)</automated>
    <automated>grep -c "Open review item IN-G1-03" .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md   # 0 (baseline 1)</automated>
    <automated>grep -c "^created: 2026-11-19T09:10:00-06:00" .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-REVIEW-DISPOSITION.md; grep -c "^created: 2026-11-21T11:20:00-06:00" .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md   # invariant: 1 each, already 1 at HEAD</automated>
    <automated>git show --stat --format=%h DOCS_SHA   # replace DOCS_SHA with the docs commit's own hash: only the two docs</automated>
  </verify>
  <done>The IN-G1-03 row reads fixed with the code commit hash and the test name, the counts read 9, 4, 7, 20, note 4 says closed by D-138 with the test name, only `updated:` moved in each frontmatter (plus the disposition counts), and one docs commit exists (two files, staged by path, gitleaks clean).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| internet to POST /api/v1/analytics/page-views | Anonymous page view beacons; the site-wide ceiling protects the database from a many-address flood |
| working tree to public git history | The repo is public; commits must not carry secrets or machine details |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-hxs-01 | Denial of service | `RateLimitingRegistration.IsPageView` and `AnalyticsController.RecordPageView` | medium | mitigate | One public constant feeds both sides; `PageViewCeilingRouteTests` fails if no endpoint, or more than one, carries it, or if it is not POST api/v1/analytics/page-views (D-138, IN-G1-03). |
| T-hxs-02 | Denial of service | Limiter chain (D-74 order, 600 and 120 a minute) | medium | mitigate | No change to the value, `IsPageView`, the chain or any limit; all `AnalyticsRateLimitTests` must pass. |
| T-hxs-03 | Information disclosure | The constant made public | low | accept | The endpoint name is not a secret; it is already the route's OpenAPI operationId. It is visible only to code that references the server assembly. |
| T-hxs-04 | Information disclosure | The two commits | low | mitigate | gitleaks on each staged diff plus a manual scan for server names, emails, machine names and local user paths; files staged by path. |
| T-hxs-SC | Tampering | npm/NuGet installs | high | mitigate | No package is added or bumped in this plan; `Directory.Packages.props`, `packages.lock.json` files and `web/package*.json` must not appear in either commit. |
</threat_model>

<verification>
- Every verify command in Tasks 1 and 2 passes, with output tails and exit codes quoted in the SUMMARY.
- RED evidence (CS0122) and the mutation-check failure are quoted in the SUMMARY.
- `git show --stat CODE_SHA DOCS_SHA` (the two recorded hashes) shows the three code files and the two docs, on `gsd/phase-12-consent-analytics-legal`, nothing pushed.

## Multi-source coverage audit

| Source | Item | Covered by |
|--------|------|------------|
| GOAL | Close IN-G1-03: a rename cannot turn the ceiling off without a red test | Task 1 |
| REQ | ANL-06 page view limits (the site-wide ceiling stays on the page view route) | Task 1 steps 2 and 4 |
| CONTEXT | D-138 guard test keyed on the ceiling's name | Task 1 steps 1 to 3 |
| CONTEXT | D-138 closes auditor note 4 | Task 2 step 3 |
| CONTEXT | Review disposition row for IN-G1-03 (deferred to fixed, commit, test name) | Task 2 step 2 |
| CONTEXT | Owner rules: TDD, zero warnings, minimal comments, no dashes, no inline SQL, no packages, stage by path, gitleaks, no stdin, preflight, per-process CSPS_TEST_SQL, shared machine, commit trailer, no push | Owner rules block, every task's verify |
| RESEARCH | None for a quick task | n/a |
</verification>

<success_criteria>
- The ceiling and the page view action read the endpoint name from one constant, and a test that compiles only against that constant proves exactly one endpoint, POST api/v1/analytics/page-views, carries it.
- The ceiling's behaviour, the OpenAPI operationId and the architecture rules are unchanged; build and format are clean with zero warnings.
- IN-G1-03 is recorded as fixed and auditor note 4 is closed by D-138, each naming the test and the commit.
</success_criteria>

<output>
Create `.planning/quick/261121-hxs-in-g1-03-guard-test-for-the-page-view-ce/261121-hxs-SUMMARY.md` when done
</output>
