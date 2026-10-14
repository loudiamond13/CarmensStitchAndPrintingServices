---
created: 2026-10-14T09:35:33-05:00
updated: 2026-10-14T09:35:33-05:00
phase: quick-261014-ctx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedOptionsTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlBackendTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Csps.Infrastructure.IntegrationTests.csproj
  - tests/Csps.Testing/SqlServerInstance.cs
  - tests/Csps.Testing/SqlBackend.cs
  - tests/Csps.Testing/CspsApiFactory.cs
  - src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs
  - src/Csps.Infrastructure/Seeding/DevSeedTargetCheck.cs
  - src/Csps.Infrastructure/Seeding/DevSeedOptions.cs
  - src/Csps.Infrastructure/Persistence/CspsDesignTimeDbContextFactory.cs
  - src/Csps.Server/appsettings.Development.json
  - tools/Csps.DevSeed/Program.cs
  - tools/scripts/Initialize-LocalDb.ps1
  - tools/scripts/Remove-StaleTestDatabases.ps1
  - tools/scripts/Invoke-CoverageGate.ps1
  - docs/development.md
  - docs/web/e2e.md
  - web/playwright.config.ts
  - web/scripts/e2e.mjs
  - web/scripts/owner-review.mjs
  - web/scripts/owner-review.test.ts
  - web/src/** (every file: moved by git mv per the Path Map, imports rewritten)
  - web/src/App.tsx
  - web/src/main.tsx
  - web/src/core/api/apiClient.ts
  - web/src/core/api/errors.ts
  - web/src/modules/admin/services/siteSettingsService.ts
  - web/src/modules/admin/services/siteSettingsService.test.ts
  - web/src/test/source-layout.node.test.ts
  - web/src/test/no-long-dash.node.test.ts
  - web/src/test/lint-rules.node.test.ts
  - web/src/test/eslint-config.node.test.ts
  - web/eslint.config.mjs
  - web/vitest.config.ts
  - web/.prettierrc.json
  - web/scripts/budget.ts
  - web/scripts/budget.test.ts
  - web/scripts/class-gate.mjs
  - web/scripts/class-gate.config.mjs
  - web/scripts/tailwind-classes.test.ts
  - web/scripts/font-metrics.mjs
  - web/scripts/font-metrics.test.ts
  - web/scripts/golden-math.mjs
  - web/scripts/golden-math.test.ts
  - web/scripts/vite-budget-plugin.ts
  - web/scripts/vite-budget-plugin.test.ts
  - web/scripts/vite-route-preload-plugin.ts
  - web/scripts/vite-route-preload-plugin.test.ts
  - web/scripts/vite-preload-font-plugin.test.ts
  - web/visual/icon-mask.test.ts
  - web/visual/intentional-differences.ts
  - web/visual/reference/main.tsx
  - web/visual/reference/rulings.css
  - web/visual/reference/rulings.test.ts
  - web/visual/reference/fragments/OrderCard.tsx
  - web/visual/reference/fragments/OrderTotals.tsx
  - web/visual/reference/fragments/Overlay.tsx
  - web/visual/reference/fragments/Topbar.tsx
  - web/visual/reference/fragments/PublicShell.tsx
  - CLAUDE.md
  - .claude/CLAUDE.md
  - CSPS-PRD.md
  - .planning/PROJECT.md
  - .planning/REQUIREMENTS.md
  - docs/web/api.md
  - docs/web/budgets.md
  - docs/web/parity.md
  - docs/web/styling.md
  - docs/web/url-state.md
  - docs/web/release-gates.md
  - docs/dependencies.json
  - .planning/phases/04-identity-authentication/04-RESEARCH.md
  - .planning/phases/04-identity-authentication/04-UI-SPEC.md
  - .planning/phases/04-identity-authentication/04-CONTEXT.md
autonomous: true
requirements:
  - FND-04
  - FND-11
  - WEB-02
  - WEB-03
  - WEB-04
  - QUAL-02
  - QUAL-03

estimate:
  tokens: 280000
  raw_tokens: 280000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - 'OR-1: the dev seed default, the EF design-time factory, appsettings.Development.json, the test SQL fixture, the E2E/owner-review web configs and both LocalDB scripts target (localdb)\MSSQLLocalDB with CSPS_* databases, and `dotnet run --project tools/Csps.DevSeed` migrates and seeds CSPS_Dev there and exits 0'
    - 'OR-1: DevSeedTargetGuard allows only CSPS_Dev/CSPS_E2E, only on (localdb)\MSSQLLocalDB (any letter case) or a loopback container (127.0.0.1|localhost,<1-65535>); it refuses the retired CSPS instance, every other server, and every BetsLLC_* (or any other) database on the shared instance, with reasons that never echo the connection string'
    - 'OR-1: Remove-StaleTestDatabases.ps1 talks to (localdb)\MSSQLLocalDB and still drops only names matching ^CSPS_Test_[0-9a-f-]{36}$ (length 46, case-sensitive) older than the cutoff; its -WhatIf run never lists a BetsLLC_* database'
    - 'OR-6: web/src matches the owner tree (assets, components, hooks, types, utils, ui, lib, core/{api,routes}, layouts/{PublicLayout,AdminLayout}.tsx, modules/{public,admin}/{components,hooks,services,pages}, App.tsx, main.tsx; plus dev/ and test/), enforced by web/src/test/source-layout.node.test.ts, and the moved files keep their git history (renames)'
    - 'OR-5: endpoint calls live in per-module service files (siteSettingsService under modules/admin/services); ESLint rejects the HTTP transport outside src/core/api, rejects apiClient outside src/core/api and src/modules/*/services, and rejects fetch/XMLHttpRequest outside src/core/api/http'
    - 'Pure move: no runtime behaviour changes in Task 2; `npm --prefix web run verify` passes with zero warnings, the 100% coverage gate is keyed to src/core/api/**, and the production build still refuses admin and dev modules under their new paths'
    - 'OR-4: no U+2012..U+2015, U+2E3A, U+2E3B, U+FE31, U+FE32 or U+FE58 dash anywhere in web/src (guard test), with the replacement copy consistent across tests, the parity fragment and the Phase 4 UI-SPEC'
    - 'OR-1..OR-6 are recorded in CLAUDE.md, .claude/CLAUDE.md (Conventions, coverage, stack), CSPS-PRD.md §9/§15/§17, PROJECT.md, REQUIREMENTS.md, docs/web, and the Phase 4 RESEARCH/UI-SPEC/CONTEXT use the new paths; every edited .md has a refreshed updated timestamp'
  artifacts:
    - path: src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs
      provides: 'Server allow-list ((localdb)\MSSQLLocalDB or loopback container) checked before the CSPS_Dev/CSPS_E2E name allow-list'
      contains: '(localdb)\MSSQLLocalDB'
    - path: tests/Csps.Testing/SqlServerInstance.cs
      provides: 'LocalDB master connection for the test fixture on the default instance'
      contains: 'Server=(localdb)\MSSQLLocalDB;Database=master'
    - path: tools/scripts/Remove-StaleTestDatabases.ps1
      provides: 'Stale CSPS_Test_<guid> cleanup on the shared default instance'
      contains: '^CSPS_Test_[0-9a-f-]{36}$'
    - path: web/src/test/source-layout.node.test.ts
      provides: 'Owner web/src layout guard (OR-6)'
    - path: web/src/App.tsx
      provides: 'Root component: font and CSS baselines plus RouterProvider'
      contains: 'RouterProvider'
    - path: web/src/core/api/apiClient.ts
      provides: 'The one shared HTTP client instance for module services'
      contains: 'apiClient'
    - path: web/src/core/api/errors.ts
      provides: 'HttpError, isHttpError, HttpErrorKind for screens and hooks'
      contains: 'isHttpError'
    - path: web/src/modules/admin/services/siteSettingsService.ts
      provides: 'GET /api/v1/site-settings as a module service'
      contains: '/site-settings'
    - path: web/eslint.config.mjs
      provides: 'WEB-04 rules re-keyed to core/api and module services; D-33 CSS exception re-keyed to App.tsx'
      contains: 'src/modules/*/services/**'
    - path: web/vitest.config.ts
      provides: '100% coverage gate on the HTTP layer'
      contains: 'src/core/api/**'
    - path: web/scripts/budget.ts
      provides: 'Route module ids and dev-only prefixes under the new layout'
      contains: 'src/modules/admin/'
    - path: web/src/test/no-long-dash.node.test.ts
      provides: 'OR-4 guard over every file in web/src'
    - path: .claude/CLAUDE.md
      provides: 'Conventions block with OR-2..OR-6 and the layout tree'
      contains: 'modules/'
  key_links:
    - from: src/Csps.Infrastructure/Seeding/DevSeedOptions.cs
      to: src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs
      via: 'DefaultConnectionString must pass DevSeedTargetGuard.Check'
      pattern: 'MSSQLLocalDB'
    - from: tests/Csps.Testing/SqlServerInstance.cs
      to: tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs
      via: 'AllowsTheServerTheTestFixtureUses'
      pattern: 'LocalDbMasterConnectionString'
    - from: web/src/main.tsx
      to: web/src/App.tsx
      via: 'createRoot(...).render(<StrictMode><App /></StrictMode>)'
      pattern: "from '@/App'"
    - from: web/src/App.tsx
      to: web/src/core/routes/router.tsx
      via: 'RouterProvider router={router}'
      pattern: '@/core/routes/router'
    - from: web/src/modules/admin/services/siteSettingsService.ts
      to: web/src/core/api/apiClient.ts
      via: 'createSiteSettingsService(apiClient)'
      pattern: '@/core/api/apiClient'
    - from: web/scripts/budget.ts
      to: web/src/layouts/PublicLayout.tsx
      via: 'PUBLIC_ROUTE drives the route preload plugin and the public JS budget'
      pattern: 'src/layouts/PublicLayout.tsx'
    - from: web/eslint.config.mjs
      to: web/src/test/lint-rules.node.test.ts
      via: 'architectureRules export, proven rule by rule'
      pattern: 'architectureRules'
---

# Quick 261014-ctx: Adopt the owner's 2026-10-14 conventions before Phase 4 planning

<!-- planner-discipline-allow: (localdb)\CSPS -->
<!-- planner-discipline-allow: lib/http -->
<!-- planner-discipline-allow: lib/api.ts -->
<!-- planner-discipline-allow: src/features/ -->
<!-- planner-discipline-allow: web/src/app/ -->
<!-- planner-discipline-allow: src/styles/ -->

<objective>
Adopt the owner's standing rules of 2026-10-14 (they override older text in CLAUDE.md, .claude/CLAUDE.md, the PRD and docs), so Phase 4 is planned against the new conventions.

Owner rules, referenced below as OR-n:

| ID | Rule | Covered by |
|----|------|-----------|
| OR-1 | Local SQL uses the default `(localdb)\MSSQLLocalDB` instance with separate `CSPS_*` databases (`CSPS_Dev`, `CSPS_E2E`, `CSPS_Test_<guid>`, `CSPS_Legacy_Restore`). The dedicated CSPS instance is retired. Never create, reset, restore over or drop a `BetsLLC_*` database (TheBETSLLC now shares the instance, so database-name guards matter more). Automated cleanup may drop only `^CSPS_Test_[0-9a-f-]{36}$`. | Task 1 (code, tests, scripts, docs), Task 3 (CLAUDE.md, PROJECT.md, Phase 4 docs) |
| OR-2 | Comments are minimal, concise and on point: enough for the owner to understand the code in review. | All tasks (new and edited code); Task 3 records it |
| OR-3 | Client-side validation first: every rule the backend validates is also checked client-side (zod) before the request is sent. | Task 3 records it (no form posts to a validated endpoint exists yet; Phase 4 is the first) |
| OR-4 | No em dash (U+2014) or other long dash in the client: code, copy and comments in web/src. | Task 3 (guard test + replacements + UI-SPEC copy) |
| OR-5 | API calls are not in one file: per-module service files in `modules/{public,admin}/services/`; the shared HTTP client and interceptors in `core/api/`. | Task 2 (split + ESLint), Task 3 (docs) |
| OR-6 | The owner's web/src layout, with existing code moved into it now. | Task 2 (history-preserving moves + guard test), Task 3 (docs) |

Purpose: Phase 4 planning starts next. Its RESEARCH and UI-SPEC still point at the old layout, the single api.ts and the CSPS LocalDB instance.
Output: the LocalDB switch (tested), the restructured web/src (history kept), the dash guard, and updated rules and docs.

Task order is fixed: Task 1 is independent; Task 3 edits files at the paths Task 2 creates. Task 2 is a pure move with no visible behaviour change. Task 3 holds the copy changes for OR-4, because those do change visible text.

Rules for the executor (subagents do not see the user's memory):
- **Timestamps:** every .md created or edited carries `created:`/`updated:` (ISO 8601 with offset, for example `2026-10-14T10:05:00-05:00`). Files with YAML frontmatter: set `updated:` and leave `created:` alone. Files with a `*Created: … · Updated: …*` line: change only the Updated part. Files with neither: add the line under the title, using the file's first git commit time for Created (the last line printed by `git log --diff-filter=A --format=%aI -- <file>`).
- **Shared machine (CLAUDE.md):** before any full test run, dev-seed run or build, run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`. If TheBETSLLC is running tests, wait; never stop its processes. Set `CSPS_TEST_SQL` per process only. Never touch a `BetsLLC_*` database.
- **No package changes.** Nothing is added, removed or bumped (package.json, package-lock.json, Directory.Packages.props, csproj PackageReference).
- **OR-2 applies to everything you write here.** Keep new comments to one or two lines, and do not add history narration.
- **Owner items:** if something needs an owner ruling, do not decide it yourself. Record it in the SUMMARY under "Owner follow-ups" and keep going with the rest.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs
@tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs
@tests/Csps.Testing/SqlServerInstance.cs
@tools/scripts/Remove-StaleTestDatabases.ps1
@tools/scripts/Initialize-LocalDb.ps1
@web/eslint.config.mjs
@web/vitest.config.ts
@web/scripts/budget.ts
@web/src/lib/api.ts
@web/src/main.tsx
@web/src/app/router.tsx
@web/src/app/admin/routes.tsx
@docs/web/api.md
</context>

<path_map>
## Path Map (Task 2). All paths are under `web/src/`.

| Old | New | Note |
|-----|-----|------|
| `app/Root.tsx` | `core/routes/Root.tsx` | Root route (QueryClientProvider + Outlet). Name and export unchanged |
| `app/router.tsx` | `core/routes/router.tsx` | |
| `app/lazyRoute.ts` | `core/routes/lazyRoute.ts` | |
| `app/ErrorBoundary.tsx`, `app/ErrorBoundary.test.tsx` | `core/routes/` (same names) | |
| `app/ShellFallback.tsx` | `core/routes/ShellFallback.tsx` | |
| `app/public/PublicLayout.tsx`, `.test.tsx` | `layouts/PublicLayout.tsx`, `.test.tsx` | |
| `app/public/PublicPlaceholderPage.tsx`, `.test.tsx` | `modules/public/pages/` (same names) | |
| `app/public/SiteFooter.tsx` | `modules/public/components/SiteFooter.tsx` | |
| `app/public/siteContact.ts` | `modules/public/components/siteContact.ts` | |
| `app/admin/AdminLayout.tsx`, `.test.tsx` | `layouts/AdminLayout.tsx`, `.test.tsx` | |
| `app/admin/AdminPreviewPage.tsx` | `modules/admin/pages/AdminPreviewPage.tsx` | |
| `app/admin/TabBar.tsx`, `app/admin/admin.recipe.ts` | `modules/admin/components/` (same names) | |
| `app/admin/copy.ts`, `sections.ts`, `theme.ts`, `theme.test.ts`, `routes.tsx` | `modules/admin/` (same names) | Module-wide files sit at the module root |
| `lib/http/*` (HttpError.ts, HttpError.test.ts, httpClient.ts, httpClient.test.ts, httpClient.resilience.test.ts, httpClient.transport.test.ts) | `core/api/http/*` | The transport, private to core/api |
| `lib/api.ts` | `core/api/apiClient.ts` | Then reduced (Task 2 step C) |
| `lib/api.test.ts` | `modules/admin/services/siteSettingsService.test.ts` | Then converted (Task 2 step C) |
| `lib/csps.ts`, `lib/csps.test.ts`, `lib/csps.golden.test.ts` | `utils/` (same names) | The golden test's fixture URL keeps its depth (`../../../tests/fixtures/...`) |
| `lib/format.ts`, `lib/format.test.ts` | `utils/` (same names) | |
| `lib/errors/describeHttpError.ts`, `.test.ts` | `utils/describeHttpError.ts`, `.test.ts` | |
| `lib/query/useDebouncedValue.ts`, `useDebouncedValue.test.tsx` | `hooks/` (same names) | A global reusable hook |
| `lib/forms/**`, the rest of `lib/query/**`, `lib/url-state/**` | unchanged | Third-party wrappers / infra helpers |
| `styles/app.css`, `styles/base.css`, `styles/stylesheet-contract.node.test.ts` | `ui/` (same names) | Theme |
| `ui/tw.ts` | `ui/tw.ts` | Stays: the class-string marker belongs with the theme. `@/ui/tw` imports do not change |
| every other `ui/**` file (16 area folders, `index.ts`, `index.test.ts`) | `components/**` | Same relative structure |
| `vite-env.d.ts` | `types/vite-env.d.ts` | |
| `main.tsx`, `dev/**`, `test/**`, `types/**` | unchanged | dev/ (D-20 dev-only) and test/ (harness) stay outside the owner tree |
| (new) | `App.tsx`, `core/api/errors.ts`, `modules/admin/services/siteSettingsService.ts`, `test/source-layout.node.test.ts` | |
| (new, empty folders) | `.gitkeep` in `assets/`, `modules/public/hooks/`, `modules/public/services/`, `modules/admin/hooks/` | Keeps the owner's skeleton on a fresh clone |

**Do not edit:** `CSPS-UI-SPEC.md` (frozen; appendix pinned by `web/visual/reference/spec-appendix.sha256`), `web/visual/reference/extract-spec.mjs` and `extract-spec.test.ts` (their `src/...` strings are UI-SPEC appendix headings), `web/visual/.reference-src/**` (generated), and historical references on lines that cite commit `74621f5`.
</path_map>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Switch local SQL to (localdb)\MSSQLLocalDB with CSPS_* databases (OR-1), end to end through the dev seed</name>
  <files>tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs, tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedOptionsTests.cs, tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlBackendTests.cs, src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs, src/Csps.Infrastructure/Seeding/DevSeedTargetCheck.cs, src/Csps.Infrastructure/Seeding/DevSeedOptions.cs, src/Csps.Infrastructure/Persistence/CspsDesignTimeDbContextFactory.cs, src/Csps.Server/appsettings.Development.json, tests/Csps.Testing/SqlServerInstance.cs, tests/Csps.Testing/SqlBackend.cs, tests/Csps.Testing/CspsApiFactory.cs, tests/Csps.Infrastructure.IntegrationTests/Csps.Infrastructure.IntegrationTests.csproj, tools/Csps.DevSeed/Program.cs, tools/scripts/Initialize-LocalDb.ps1, tools/scripts/Remove-StaleTestDatabases.ps1, web/playwright.config.ts, web/scripts/e2e.mjs, web/scripts/owner-review.mjs, web/scripts/owner-review.test.ts, docs/development.md, docs/web/e2e.md</files>
  <precondition>`sqllocaldb info MSSQLLocalDB` reports Version 17.x, the SQL Server 2025 LocalDB (checked at planning time: 17.0.4025.3). If not, stop and record an owner follow-up. Never delete or recreate MSSQLLocalDB, because TheBETSLLC's databases live there.</precondition>
  <behavior>
    - DevSeedTargetGuard.Check allows CSPS_Dev and CSPS_E2E, in any letter case, on `(localdb)\MSSQLLocalDB` (any case, for example `Data Source=(LocalDB)\mssqllocaldb`) and on `127.0.0.1,<port>` / `localhost,<port>`.
    - It refuses the retired instance (`Server=(localdb)\CSPS;Database=CSPS_Dev`, `Data Source=(LocalDB)\csps;Initial Catalog=CSPS_E2E`), and the reason contains `(localdb)\MSSQLLocalDB`.
    - On `(localdb)\MSSQLLocalDB` it refuses BetsLLC_Dev, BetsLLC_E2E, BetsLLC_Test_0f8fad5b-d9cb-469f-a165-70867728950e, betsllc_dev, CSPS_Dev2, CSPS_De, CSPS_Dev_, CSPS_Test_<guid>, CSPS_Legacy_Restore and master.
    - It refuses `(localdb)\.\MSSQLLocalDB`, `(localdb)\MSSQLLocalDB2`, the LOCALDB# named pipe, tcp:, named instances, `.`, `(local)`, port-less loopback and hosted servers. Every server reason contains `(localdb)\MSSQLLocalDB` and never contains the data source, user or password.
    - The missing-catalog, unparseable, AttachDBFilename and Failover Partner refusals and their reason texts do not change. Their test cases now use the MSSQLLocalDB server, so each one still reaches the branch it targets.
    - DevSeedOptions with no arguments gives `Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true`, with DataSource `(localdb)\MSSQLLocalDB`.
    - SqlServerInstance.LocalDbMasterConnectionString contains `(localdb)\MSSQLLocalDB;` and not `(localdb)\CSPS` (case-insensitive).
    - Tracer, end to end: `dotnet run --project tools/Csps.DevSeed -- --connection "Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true"` exits 2 (refused) before the change and 0 (migrated and seeded) after it.
  </behavior>
  <action>
Implements OR-1. Comments follow OR-2.

A. Preflight (CLAUDE.md shared-machine rule), then run `sqllocaldb info MSSQLLocalDB` to check the precondition.

B. RED, unit level. Edit the tests before any code:
- DevSeedTargetGuardTests.cs:
  - Switch every allowed and refused case that used the CSPS instance as its server to `(localdb)\MSSQLLocalDB`.
  - Change the allowed `(LocalDB)\csps` case to `(LocalDB)\mssqllocaldb`.
  - Replace `RefusesTheSharedMssqlLocalDbInstance` with `RefusesTheRetiredCspsLocalDbInstance` (the two retired-instance cases in the behavior list; the reason contains `(localdb)\MSSQLLocalDB`).
  - Add the theory `RefusesTheOtherProjectsDatabasesOnTheSharedInstance` (the BetsLLC_* cases plus betsllc_dev on MSSQLLocalDB; the reason contains "is not CSPS_Dev or CSPS_E2E").
  - In `RefusesEveryServerOutsideTheAllowList`, replace the `(localdb)\.\CSPS` and `(localdb)\CSPS2` cases with `(localdb)\.\MSSQLLocalDB` and `(localdb)\MSSQLLocalDB2`, and assert the reason contains `(localdb)\MSSQLLocalDB`.
  - Update the class summary in one or two lines.
- DevSeedOptionsTests.cs: change the expected default string and DataSource (lines 15 and 35) to MSSQLLocalDB.
- SqlBackendTests.cs: rename `LocalDbTargetsTheDedicatedInstanceOnly` to `LocalDbTargetsTheDefaultInstance`. It asserts the string contains `(localdb)\MSSQLLocalDB;` and does not contain `(localdb)\CSPS` (Case.Insensitive).
- Run `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DevSeedTargetGuardTests" --filter-class "*DevSeedOptionsTests" --filter-class "*SqlBackendTests"` and confirm the new cases fail. Commit the red tests.

C. RED, end to end (the tracer). Run `dotnet run --project tools/Csps.DevSeed -- --connection "Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true"`. Expect exit 2: the old guard refuses before any connection opens.

D. GREEN.
- DevSeedTargetGuard.cs: the single allowed LocalDB instance becomes `(localdb)\MSSQLLocalDB`. Rename the constant to `LocalDbInstance`, with a one-line comment: the default instance, shared with TheBETSLLC, so the database-name allow-list is what keeps BetsLLC_* out of reach. New ServerRefusal text: "The dev seed runs only on the (localdb)\MSSQLLocalDB instance, or on a SQL Server container on this machine addressed as 127.0.0.1,<port> or localhost,<port>. Every other server is refused, including other LocalDB instances, named-pipe and tcp: addresses, named instances and hosted servers." Shorten the class summary to the rule (OR-2). The check order and the other reasons stay as they are.
- DevSeedTargetCheck.cs summary, DevSeedOptions.DefaultConnectionString plus its summary, CspsDesignTimeDbContextFactory.DevelopmentConnectionString plus its summary, and appsettings.Development.json `ConnectionStrings:Csps`: all become `Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true` (JSON-escaped backslash in the json file).
- tests/Csps.Testing: set SqlServerInstance.LocalDbMasterConnectionString to `Server=(localdb)\MSSQLLocalDB;Database=master;Integrated Security=true`, and update the doc comments in SqlServerInstance, SqlBackend and CspsApiFactory: the default instance, shared with TheBETSLLC, so the fixture only creates and drops CSPS_Test_<guid>.
- One-line comment updates in the IntegrationTests csproj and tools/Csps.DevSeed/Program.cs.

E. Scripts.
- tools/scripts/Initialize-LocalDb.ps1: `$instanceName = 'MSSQLLocalDB'`. Keep the same flow: create it when missing (`sqllocaldb create MSSQLLocalDB -s`), otherwise start it (a no-op when it is running). Never stop or delete it. Update the synopsis: it is shared with TheBETSLLC, and CSPS uses only CSPS_* databases on it.
- tools/scripts/Remove-StaleTestDatabases.ps1:
  - The connection string becomes `Server=(localdb)\MSSQLLocalDB;Database=master;Integrated Security=true`.
  - Replace the old self-check (which refused MSSQLLocalDB) with one that throws unless the connection string starts with `Server=(localdb)\MSSQLLocalDB;`.
  - Keep `$namePattern`, `$nameLength = 46`, the case-sensitive `-cmatch`, the age cutoff and -WhatIf exactly as they are.
  - Update the synopsis and safety-rules text: the instance is shared with TheBETSLLC, and only exact CSPS_Test_<guid> names are ever dropped. Update the ShouldProcess target and the "No CSPS_Test_ databases" message to name `(localdb)\MSSQLLocalDB`.
- web/playwright.config.ts (line 74), web/scripts/owner-review.mjs (line 226) and web/scripts/owner-review.test.ts (line 200): `ConnectionStrings__Csps` becomes `Server=(localdb)\\MSSQLLocalDB;Database=CSPS_E2E;Integrated Security=true`. Update the comments in web/scripts/e2e.mjs (lines 9 and 64) and owner-review.mjs (line 186) the same way.

F. Docs (refresh the `updated:` timestamps).
- docs/development.md lines 14, 37-40, 61-62, 66, 117, 126, 167 and 170: the default `(localdb)\MSSQLLocalDB` instance, shared with TheBETSLLC, with CSPS_* databases only. Step 1 now "starts the default LocalDB instance" with the same script.
- Add a short subsection "Moving off the retired CSPS instance":
  - Recreate CSPS_Dev with `dotnet run --project tools/Csps.DevSeed`; CSPS_E2E is recreated by `npm --prefix web run e2e`.
  - The old instance can be removed by hand with `sqllocaldb stop CSPS` and then `sqllocaldb delete CSPS`. This removes only that instance, its .mdf files stay in the user profile, and nothing here automates it.
  - Do NOT run those two commands yourself.
- docs/web/e2e.md lines 15 and 19: the prerequisite row becomes "the default LocalDB instance `(localdb)\MSSQLLocalDB` can start", with check `sqllocaldb info MSSQLLocalDB` and fix `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-LocalDb.ps1`. The guard sentence names MSSQLLocalDB.
- These docs must not contain the old `(localdb)\CSPS` literal. The migration note names the instance only as `CSPS` in the sqllocaldb commands.

G. Verify (after preflight):
- Rerun the step C command; it must exit 0 (migrates and seeds CSPS_Dev on MSSQLLocalDB).
- Run the automated command below.
- Run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1 -WhatIf`. It may list only CSPS_Test_<guid> names (or report none), never a BetsLLC_* name.
  </action>
  <verify>
    <automated>dotnet build Csps.slnx && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests && dotnet run --project tools/Csps.DevSeed && npm --prefix web run test -- --run scripts/owner-review.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `git grep -n -i -F "(localdb)\CSPS" -- src tools web/playwright.config.ts web/scripts docs tests/Csps.Testing; test $? -eq 1` passes (no matches). In `tests/Csps.Infrastructure.IntegrationTests` the same search matches only inside `RefusesTheRetiredCspsLocalDbInstance` and the negative assertion in SqlBackendTests.
    - DevSeedTargetGuard.cs contains `@"(localdb)\MSSQLLocalDB"`; Remove-StaleTestDatabases.ps1 still contains `'^CSPS_Test_[0-9a-f-]{36}$'` and `$nameLength = 46`.
    - The DevSeedTargetGuardTests, DevSeedOptionsTests and SqlBackendTests classes pass, and so does the whole Infrastructure integration project on LocalDB.
    - The tracer run exits 2 before the change and 0 after it. The -WhatIf run lists no BetsLLC_* database.
    - `dotnet build Csps.slnx` reports 0 warnings.
  </acceptance_criteria>
  <done>The dev seed, design-time factory, Development settings, test fixture, E2E configs and LocalDB scripts all target (localdb)\MSSQLLocalDB. The guard refuses the retired instance and every non-CSPS_Dev/CSPS_E2E database there. The dev seed runs end to end on the new instance, and the docs explain the switch.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Move web/src into the owner layout (OR-6) and split endpoint calls into module services (OR-5), with no behaviour change</name>
  <files>web/src/** (git mv per the Path Map), web/src/App.tsx, web/src/main.tsx, web/src/core/api/apiClient.ts, web/src/core/api/errors.ts, web/src/modules/admin/services/siteSettingsService.ts, web/src/modules/admin/services/siteSettingsService.test.ts, web/src/test/source-layout.node.test.ts, web/src/test/lint-rules.node.test.ts, web/src/test/eslint-config.node.test.ts, web/eslint.config.mjs, web/vitest.config.ts, web/.prettierrc.json, web/scripts/budget.ts, web/scripts/budget.test.ts, web/scripts/class-gate.mjs, web/scripts/class-gate.config.mjs, web/scripts/tailwind-classes.test.ts, web/scripts/font-metrics.mjs, web/scripts/font-metrics.test.ts, web/scripts/golden-math.mjs, web/scripts/golden-math.test.ts, web/scripts/vite-budget-plugin.ts, web/scripts/vite-budget-plugin.test.ts, web/scripts/vite-route-preload-plugin.ts, web/scripts/vite-route-preload-plugin.test.ts, web/scripts/vite-preload-font-plugin.test.ts, web/visual/icon-mask.test.ts, web/visual/intentional-differences.ts, web/visual/reference/main.tsx, web/visual/reference/rulings.css, web/visual/reference/rulings.test.ts, web/visual/reference/fragments/{OrderCard,OrderTotals,Overlay,Topbar}.tsx, tools/scripts/Invoke-CoverageGate.ps1</files>
  <behavior>
    - source-layout guard (new `web/src/test/source-layout.node.test.ts`, header `// @vitest-environment node`, reads the disk with node:fs; name legacy folders by bare folder name only):
      - The top level of web/src is exactly assets, components, core, hooks, layouts, lib, modules, types, ui, utils, App.tsx and main.tsx, plus the allowed dev and test folders. Nothing else is there (no app, styles, features, or root vite-env.d.ts).
      - core holds exactly api and routes. core/api holds http/httpClient.ts, apiClient.ts and errors.ts.
      - layouts holds PublicLayout.tsx and AdminLayout.tsx, and every file in it matches `*Layout.tsx` or `*Layout.test.tsx`.
      - modules holds exactly public and admin. Each holds the folders components, hooks, services and pages and no other folder (files at the module root are allowed).
      - ui holds no .tsx file.
      - lib holds no http folder and no api.ts.
    - Lint (web/src/test/lint-rules.node.test.ts, red before the eslint change; the virtual UI file becomes `src/modules/public/pages/x.ts`, and `.tsx` for JSX cases):
      - A transport import (`@/core/api/http/httpClient`, or relative `../core/api/http/httpClient`) in a UI file, in `src/modules/admin/services/x.ts` or in `src/components/x.ts` is exactly one no-restricted-imports error with "Only src/core/api may import the HTTP transport (WEB-04)."
      - The same import in `src/core/api/apiClient.ts` is clean, and `src/core/api/http/httpClient.ts` may import `@/core/api/http/HttpError`.
      - `import { apiClient } from '@/core/api/apiClient'` is clean in `src/modules/admin/services/x.ts` and `src/modules/public/services/x.ts`. In `src/modules/admin/pages/x.ts` and `src/components/x.ts` it is one error with "Only module services (src/modules/*/services) may import apiClient (WEB-04)."
      - `import { HttpError } from '@/core/api/errors'` is clean anywhere.
      - Bare fetch, window/globalThis/self.fetch and `new XMLHttpRequest()` are errors everywhere, including `src/core/api/apiClient.ts` and services, except `src/core/api/http/**`. The message is "Call a module service (src/modules/*/services) instead (WEB-04)."
      - The axios message becomes "Forbidden (PRD Prime Directive 8). Use a module service."
      - CSS (D-33): `@/ui/app.css` is clean in `src/App.tsx` and `src/dev/parity-main.tsx`. In `src/main.tsx` and `src/dev/kit.ts` it is an error. `@/ui/base.css` and `./reference.css` are errors in `src/App.tsx`. The message ends "Only App.tsx and the dev parity entry import @/ui/app.css."
      - The tests that proved the CSS-exception file keeps every other ban (dangerouslySetInnerHTML, className template, the fetch member ban) now target `src/App.tsx`. The http-folder cases target `src/core/api/http/x.tsx`. The `.ts` class-call/cssText/nuqs case targets `src/core/api/apiClient.ts`.
    - Budget (web/scripts/budget.test.ts, red before budget.ts changes):
      - PUBLIC_ROUTE is [`src/layouts/PublicLayout.tsx`, `src/modules/public/pages/PublicPlaceholderPage.tsx`].
      - ADMIN_ROUTE is [`src/layouts/AdminLayout.tsx`, `src/lib/url-state/UrlStateLayout.tsx`, `src/modules/admin/pages/AdminPreviewPage.tsx`].
      - A production chunk whose modules include `src/layouts/AdminLayout.tsx`, or `src/modules/admin/routes.tsx`, fails (D-20, CWE-489).
    - siteSettingsService (converted from the api.test.ts cases, same assertions):
      - `createSiteSettingsService(client).get(signal)` sends GET /api/v1/site-settings once and returns the typed body.
      - A cancelled signal rejects with kind aborted.
      - A ProblemDetails failure rejects with an HttpError imported from `@/core/api/errors`.
      - The shared `siteSettingsService.get()` goes through the global fetch at /api/v1.
      - Three concurrent 401s through one client cause one refresh and three retries, and a failed refresh rejects all three and signs out once.
      - The "declares every area group" test is deleted, because OR-5 replaces the groups.
  </behavior>
  <action>
Implements OR-6 and OR-5. Keep it a pure move: no visible or runtime behaviour change, with one exception, which is the main.tsx/App.tsx split (identical render tree and import order). OR-2: new files get at most one or two header comment lines.

A. RED. Write source-layout.node.test.ts. Update lint-rules.node.test.ts and eslint-config.node.test.ts (virtual paths `src/ui/x.tsx` become `src/components/x.tsx`). Update the budget.test.ts expectations and add the two dev-only cases, all as listed in the behavior. Run `npm --prefix web run test -- --run src/test/source-layout.node.test.ts src/test/lint-rules.node.test.ts scripts/budget.test.ts` and confirm the failures. Commit the red tests.

B. Move and rewrite imports with a throwaway Node script in the session scratchpad (never committed). It works in two phases.

Phase 1 (plan, read-only):
1. Build FILE_MAP from `git ls-files web/src` and the Path Map (first matching row wins).
2. For every .ts/.tsx/.css file, find the module specifiers in `from '…'`, `import('…')`, side-effect `import '…'`, `export … from '…'` and `vi.mock('…')`.
3. Resolve each specifier that starts with `@/` (from web/src) or `.` (from the file's old folder). Try the bare path, then `.ts`, `.tsx`, `/index.ts`, `/index.tsx`.
4. Rewrite a specifier only when its target moved, or when the importing file moved and the specifier is relative. Write the new specifier this way:
   - Keep a directory form when the original pointed at an index file.
   - Keep an explicit extension only if the original had one.
   - Inside `web/src/dev/scenarios/**`, always write a relative path. Playwright loads these files without the `@` alias (web/visual/scenarios.ts).
   - Elsewhere, write `./name` when both files end up in the same folder, and `@/…` otherwise.
5. Special case: every specifier that resolved to the old lib/api.ts becomes `@/core/api/errors`, because all current consumers import only HttpError, isHttpError or HttpErrorKind. The one exception is the file being converted to siteSettingsService.test.ts.
6. Print a summary (files moved, specifiers changed, unresolved specifiers). Unresolved ones must only be package imports or `@/types/api.generated`.

Phase 2 (apply):
1. Run `git mv` for every FILE_MAP entry whose path changes (create the target folders first).
2. Write the rewritten contents to the new paths.
3. Add the four `.gitkeep` files.
4. Check that `git status` shows renames (R), not delete/add pairs.

C. Hand edits after the move.
- **App/main split.**
  - New `web/src/App.tsx` takes from main.tsx: the five Fontsource imports, the stylesheet import (now `@/ui/app.css`), the router import (`router` from `@/core/routes/router`), and the RouterProvider render with the production-only `onError: silent`. It exports `function App()`, which returns that RouterProvider.
  - main.tsx keeps the `#root` check, createRoot with the production-only onCaughtError/onUncaughtError, and StrictMode. It now renders `<App />` (imported from `@/App`) and imports no CSS.
  - Rendering and CSS order stay identical. Root (QueryClientProvider) stays the router's root route in core/routes, so memory-router tests still get the query client.
- **API split (OR-5).**
  - Reduce `core/api/apiClient.ts` to a one-line header comment plus three things: `export const apiClient: HttpClient = createHttpClient({ baseURL: '/api/v1' })`, and re-exports of `createHttpClient` and `type HttpClient` from `./http/httpClient` (the service tests build clients over a fake fetch). Phase 4 adds the session hooks there.
  - New `core/api/errors.ts` re-exports `HttpError`, `isHttpError` and `type HttpErrorKind` from `./http/HttpError`.
  - New `modules/admin/services/siteSettingsService.ts` exports `type SiteSettings = components['schemas']['SiteSettingsDto']` (from `@/types/api.generated`), the `SiteSettingsService` interface with `get(signal?: AbortSignal): Promise<SiteSettings>`, `createSiteSettingsService(client: HttpClient)` (which calls `client.get<SiteSettings>('/site-settings', { signal })`), and `siteSettingsService = createSiteSettingsService(apiClient)`.
  - Convert the moved test to these names, as listed in the behavior. Imports: `createHttpClient` from `@/core/api/apiClient`, HttpError and isHttpError from `@/core/api/errors`.
  - Update the header comment in `core/api/http/httpClient.ts`: core/api is its only importer.
- **web/src/dev/kit.ts:** the glob becomes `'../components/*/index.ts'`, and the header comment names `@/components` and `src/components/<area>/index.ts`.

D. ESLint (web/eslint.config.mjs; OR-5, D-33).
- Messages:
  - callApiMessage: "Call a module service (src/modules/*/services) instead (WEB-04)."
  - transport message: "Only src/core/api may import the HTTP transport (WEB-04)."
  - apiClient message: "Only module services (src/modules/*/services) may import apiClient (WEB-04)."
  - cssImportMessage: "D-33: no stylesheet imports; style with utilities. Only App.tsx and the dev parity entry import @/ui/app.css."
  - axios message: as in the behavior.
- `importBans` takes `{ transport, apiClient, appCss, referenceCss? }`:
  - The transport group is `['**/core/api/http', '**/core/api/http/**', '@/core/api/http', '@/core/api/http/**']`, added unless `transport` is allowed.
  - The apiClient group is `['**/core/api/apiClient', '@/core/api/apiClient']`, added unless `apiClient` is allowed.
  - `appCss` adds `'!@/ui/app.css'` to the CSS group.
- Blocks, in this order after `csps/restrictions` (which bans both groups):
  - `csps/restrictions/core-api` (files `src/core/api/**`; both groups allowed; full syntax bans).
  - `csps/restrictions/http-client` (files `src/core/api/http/**`; both groups allowed; no-restricted-globals off; syntax bans without the fetch member ban).
  - `csps/restrictions/services` (files `src/modules/*/services/**`; apiClient allowed, transport banned; full syntax bans).
  - `csps/restrictions/main` (files `src/App.tsx`, `src/dev/parity-main.tsx`; appCss allowed).
- Delete the old `csps/restrictions/api` block. The Tailwind `entryPoint` becomes `./src/ui/app.css`. Update the comments that named the old paths.

E. Config and tooling paths.
- web/vitest.config.ts: the threshold key becomes `'src/core/api/**'` (comment: core/api, CLAUDE.md coverage rule). Add `'src/App.tsx'` to the coverage exclude next to `'src/main.tsx'`; both are entry wiring that E2E covers, and App.tsx holds what main.tsx held.
- web/.prettierrc.json: `tailwindStylesheet` becomes `./src/ui/app.css`.
- web/scripts/budget.ts:
  - PUBLIC_ROUTE and ADMIN_ROUTE as in the behavior.
  - DEV_ONLY_MODULE_PREFIXES becomes `['src/modules/admin/', 'src/layouts/AdminLayout', 'src/dev/', 'visual/']`.
  - The header example path becomes `src/core/routes/...`.
- web/scripts/class-gate.mjs line 310: `path.join(webRoot, 'src', 'ui', 'app.css')`, and fix the comments at lines 5, 305 and 391.
- web/scripts/class-gate.config.mjs: the regex becomes `/^src\/components\/media\/ImageUploader[^/]*\.tsx?$/` (doc comment too).
- web/scripts/tailwind-classes.test.ts: `src/ui/` becomes `src/components/`, and `src/app/Page.tsx` becomes `src/modules/public/pages/Page.tsx`. The ImageUploader cases at lines 182-184 must follow the new regex. Line 372 becomes `src/modules/public/pages/PublicPlaceholderPage.tsx`.
- web/scripts/font-metrics.test.ts lines 17-18: `../src/ui/base.css` and `../src/ui/app.css`.
- web/scripts/vite-budget-plugin(.test).ts, vite-route-preload-plugin(.test).ts and vite-preload-font-plugin.test.ts: the module-id strings and comments use the new paths. `src/app/admin/routes.tsx` becomes `src/modules/admin/routes.tsx`, `src/app/router.tsx` becomes `src/core/routes/router.tsx`, and the styles path becomes `src/ui/app.css`.
- web/visual/reference/rulings.test.ts line 17: `../../src/ui/base.css`.
- In-src path strings:
  - `components/lists/search-focus-contrast.node.test.ts` URL: `../../ui/base.css`.
  - The recipeFile labels in `components/{forms,layout,lists,overlays}/*.recipe.node.test.ts`: `src/components/...`.
  - `ui/stylesheet-contract.node.test.ts`: the describe title and header become `web/src/ui`. Keep the `.css` filter; ui also holds tw.ts and the test.
  - The `ui/app.css` comment: the folder is `web/src/ui`. The `@source` paths stay the same depth.
  - `components/index.ts` header: `@/components`, `src/components/index.test.ts`.
  - `dev/parity-main.tsx` comment: same imports as src/App.tsx.

F. Comments and path strings outside the moved files: golden-math(.mjs/.test.ts) and font-metrics.mjs, `web/visual/icon-mask.test.ts`, `intentional-differences.ts`, `reference/main.tsx` (fonts now in web/src/App.tsx), `reference/rulings.css` (lines 30, 40, 53 and 229), `reference/fragments/{OrderCard,OrderTotals,Overlay,Topbar}.tsx`, and `tools/scripts/Invoke-CoverageGate.ps1` line 26 (web/src/core/api 100%). Then run the two gates in the acceptance criteria and fix every hit.

G. Run `npm --prefix web run format`, preflight, then the automated verify. If the React Compiler, Tailwind or a budget complains, the cause is a path. Fix the path; never relax a rule, threshold or budget.
  </action>
  <verify>
    <automated>npm --prefix web run verify</automated>
  </verify>
  <acceptance_criteria>
    - `npm --prefix web run verify` exits 0 with zero warnings. It runs typecheck, lint, format:check, test:coverage (with `src/core/api/**` at 100%), build, build:budget, license:check and notices:check.
    - Gate A, no matches, so exit 1 exactly (0 means there are hits; 128 means the command is broken): `git grep -nP "^(?!.*74621f5).*(?:(?<!reference-)src/(app|styles)/|(?<!reference-)src/lib/(api|http|csps|format|errors)|@/(app|styles)/|@/lib/(api|http|csps|format|errors))" -- web tools/scripts ':!web/visual/reference/extract-spec.mjs' ':!web/visual/reference/extract-spec.test.ts'; test $? -eq 1`
    - Gate B, same exit rule: `git grep -nP "^(?!.*74621f5).*(?:@/ui(?!/(tw|app\.css|base\.css)\b)|(?<!reference-)src/ui/(?!tw\.ts|app\.css|base\.css|stylesheet-contract))" -- web ':!web/visual/reference/extract-spec.mjs' ':!web/visual/reference/extract-spec.test.ts'; test $? -eq 1`
    - `git show --stat -M HEAD` (the green commit) lists the moved files as renames (`=>`), and no file under web/src/ui/area folders shows as deleted and re-added.
    - Lines starting `import` in web/src/main.tsx include none that end in `.css'`.
  </acceptance_criteria>
  <done>web/src matches the owner tree and the guard test proves it. Endpoint calls live in module services behind ESLint rules proven by tests. Coverage, budgets and dev-only build checks are keyed to the new paths, and the whole web gate is green with history kept.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Enforce no long dashes in web/src (OR-4) and record OR-1..OR-6 in the rules, PRD, docs and Phase 4 artifacts</name>
  <files>web/src/test/no-long-dash.node.test.ts, web/src/utils/format.ts, web/src/utils/format.test.ts, web/src/utils/csps.ts, web/src/utils/csps.test.ts, web/src/components/lists/copy.ts, web/src/components/lists/columns.ts, web/src/components/lists/ResponsiveTable.test.tsx, web/src/components/brand/Logo.tsx, web/src/components/brand/brand.test.tsx, web/src/dev/showcaseCopy.ts, web/src/layouts/PublicLayout.test.tsx, web/src/components/media/ImageUploader.tsx, web/src/components/media/ImageUploader.test.tsx, web/src/components/states/copy.ts, web/src/components/states/ErrorState.test.tsx, web/src/modules/public/components/siteContact.ts, web/src/dev/scenarios/groups/money.ts, web/src/dev/scenarios/groups/data.ts, web/visual/reference/fragments/PublicShell.tsx, CLAUDE.md, .claude/CLAUDE.md, CSPS-PRD.md, .planning/PROJECT.md, .planning/REQUIREMENTS.md, docs/web/api.md, docs/web/budgets.md, docs/web/parity.md, docs/web/styling.md, docs/web/url-state.md, docs/web/release-gates.md, docs/dependencies.json, .planning/phases/04-identity-authentication/04-RESEARCH.md, .planning/phases/04-identity-authentication/04-UI-SPEC.md, .planning/phases/04-identity-authentication/04-CONTEXT.md</files>
  <behavior>
    - The no-long-dash guard (new `web/src/test/no-long-dash.node.test.ts`, header `// @vitest-environment node`):
      - It reads every file under web/src recursively, except `src/types/api.generated.ts` (generated).
      - It fails on any U+2012, U+2013, U+2014, U+2015, U+2E3A, U+2E3B, U+FE31, U+FE32 or U+FE58, listing each `path:line`.
      - U+2212 (the minus sign in money, D-09) is allowed.
      - The test source writes these characters only as `\u` escapes.
    - Before the replacements it fails with about 30 lines in 16 files. Afterwards it passes, and every copy assertion matches the new text.
  </behavior>
  <action>
Implements OR-4 in code, and records OR-1 to OR-6 for the owner and the Phase 4 planner.

A. RED: write the guard, run `npm --prefix web run test -- --run src/test/no-long-dash.node.test.ts`, confirm it fails, commit.

B. GREEN: replace with exactly this text. These are owner-visible copy choices, so list them in the SUMMARY under "Owner follow-ups" for review.

| File (post-Task-2 path under web/src unless noted) | Old | New |
|---|---|---|
| utils/format.ts | `const EMPTY = '—'`; the doc comments `"—"` (lines 45, 52) | `'-'`; `"-"` |
| utils/format.test.ts | `const EM_DASH = '—'` and its uses | `const EMPTY_TEXT = '-'` (rename every use) |
| utils/csps.ts | header `CSPS — domain types…`; doc `→ "—"`; the two `'—'` returns | `CSPS: domain types…`; `→ "-"`; `'-'` |
| utils/csps.test.ts | the six `'—'` expectations and the line-186 comment | `'-'` |
| components/lists/copy.ts; columns.ts; ResponsiveTable.test.tsx | `missing: '—'`; comment `renders "—"`; test title and expectation | `'-'`; `renders "-"`; `shows "-" …` and `'-'` |
| components/brand/Logo.tsx (aria-label and comment), components/brand/brand.test.tsx (LOGO_NAME), dev/showcaseCopy.ts (markAlt), layouts/PublicLayout.test.tsx (line 177) | `CSPS — Carmen's Stitch & Printing Services`; comment `[C]SPS — the mark stands in for the C.` | `CSPS: Carmen's Stitch & Printing Services`; `[C]SPS: the mark stands in for the C.` |
| components/media/ImageUploader.tsx and its test | `Order images — drag to reorder; the first is the cover` | `Order images: drag to reorder; the first is the cover` |
| components/states/copy.ts (loadFailedBody) and ErrorState.test.tsx (BODY) | `…Your data is safe — nothing was changed.` | `…Your data is safe. Nothing was changed.` |
| modules/public/components/siteContact.ts | `'Mon–Sat · 9:00 AM – 6:00 PM'` | `'Mon-Sat · 9:00 AM - 6:00 PM'` |
| web/visual/reference/fragments/PublicShell.tsx line 96 (outside web/src) | the same hours span | the same new hours, with a one-line comment that it mirrors siteContact.ts under the owner's 2026-10-14 no-long-dash rule, so the public-shell parity case stays equal |
| dev/scenarios/groups/money.ts | `'Jersey top — sublimated, names & numbers'`; `'Shorts — matching colorway'` | `'Jersey top, sublimated, names & numbers'`; `'Shorts, matching colorway'` (shared scenario data, so both parity sides change together) |
| dev/scenarios/groups/data.ts (comments) | `May–Oct 2026`, `Nov 2025–Oct 2026`, `Nov 2025–Apr 2026` | `May to Oct 2026`, `Nov 2025 to Oct 2026`, `Nov 2025 to Apr 2026` |

Then run the guard. If anything else is reported, apply the same style: a colon or period for an aside, "to" for a range in prose, a hyphen for an empty value or a compact range.

C. Record the rules. Refresh the `updated` timestamp in every file you edit.
- **Root CLAUDE.md:**
  - Rewrite the LocalDB bullet (line 11) for OR-1. It must not contain the old instance literal. Write: "the default instance `(localdb)\MSSQLLocalDB` with separate `CSPS_` databases (owner, 2026-10-14; the dedicated CSPS instance is retired). TheBETSLLC uses the same instance, so database names are the guard…". Keep the drop regex and the BetsLLC_* sentence.
  - Line 17: restore into `(localdb)\MSSQLLocalDB` as `CSPS_Legacy_Restore`.
  - Add a short section "## Owner rules (2026-10-14)" with one line each for OR-1 to OR-6. Full detail goes in `.claude/CLAUDE.md` → Conventions; this copy survives a regeneration of that GSD-managed block.
- **.claude/CLAUDE.md** (keep every `<!-- GSD:… -->` marker):
  - Coverage line: `core/api` 100%.
  - Stack HTTP line: in-house `core/api/http/httpClient.ts` over `fetch`, with calls in per-module services.
  - Replace the Conventions block body with:
    - OR-2 to OR-6.
    - The layout tree.
    - Placement rules: components = shared low-level UI with barrel `@/components`; ui = theme (app.css is the one stylesheet entry, imported only by App.tsx; base.css; tw.ts); core/api = http/ (the transport, private), apiClient.ts (services only) and errors.ts (for UI); core/routes = router, the Root route and error boundaries; layouts; modules/{public,admin}/{components,hooks,services,pages}, with module-wide files such as routes.tsx and copy.ts at the module root; hooks; utils (formatters, validators, csps.ts previews); lib (TanStack Query, nuqs and form-submission wrappers); types; assets; dev and test stay outside the owner tree (D-20).
    - Imports: `@/` across folders and `./` within one; dev/scenarios files use relative imports.
    - OR-3 detail: a zod schema per form mirrors the API validator, and errors show inline before submit. Server-only checks stay server-side: uniqueness, the breached-password lookup, rate limits and concurrency.
    - OR-4 detail: U+2212 in money stays. UI-SPEC copy that contains a dash is rewritten in the client.
    - Enforcement: source-layout.node.test.ts, no-long-dash.node.test.ts, and the ESLint WEB-04 rules.
- **CSPS-PRD.md:**
  - Add a `*Created: 2026-10-07T17:17:38-05:00 · Updated: <now>*` line under the title.
  - §9.1: the new tree.
  - §9.3: `web/src/core/api/http/httpClient.ts`, plus a paragraph for per-module services in place of the single-file paragraph.
  - §9.4: add an OR-3 bullet.
  - Line 26 (Prime Directive 8), line 65, the §15 test table row (module services; 100% for `core/api`), §17.2 (no direct `fetch` outside `core/api/http`) and the line-723 checklist: replace each single-file api.ts mention with module services. Mark each change "(owner, 2026-10-14)" once per section.
- **.planning/PROJECT.md:**
  - Line 120: coverage `core/api`.
  - Line 146 decision row: the dev seed runs only on `(localdb)\MSSQLLocalDB` or a loopback container, owner 2026-10-14, quick 261014-ctx.
  - Add one Key Decisions row: "Owner conventions 2026-10-14 (OR-1..OR-6)", "Standing rules set before Phase 4", "✓ Adopted (quick 261014-ctx)".
- **.planning/REQUIREMENTS.md:** paths and wording in WEB-02 (`src/components`, `src/utils/csps.ts`), WEB-03 (`web/src/core/api/http/httpClient.ts`), WEB-04 (per-module services over the shared `core/api` client; ESLint keeps the transport in core/api and apiClient in services; owner, 2026-10-14), WEB-09 and QUAL-03 (`core/api`).
- **docs/web/api.md:** rewrite "The short version", the drift chain's last arrow (`web/src/modules/*/services/*.ts`), step 5, section 2 (services, apiClient, errors, siteSettingsService as the example, adding a call: a new function in its module's service file plus a test next to it over `createFakeFetch`), "One shared client" (the tests now live in siteSettingsService.test.ts) and the section 3 table.
- **Other docs:** docs/web/budgets.md (lines 32-33, 56-57, 76, 99), parity.md (48, 114, 134, 141, 175), styling.md (11, 18, 20, 62, 64, 125, 136; app.css is imported by App.tsx), url-state.md (162, 164, 177), release-gates.md (line 19 threshold) and docs/dependencies.json (the coverage purpose string: `core/api` 100%).
- **Phase 4 artifacts:** add a short "Owner conventions (2026-10-14)" note near the top of 04-RESEARCH.md and 04-UI-SPEC.md that points to .claude/CLAUDE.md Conventions, then:
  - `features/auth` mapping:
    - pages (SignInPage, VerifyCodePage, ForgotPasswordPage, ResetPasswordPage, SessionsPage) go to `web/src/modules/admin/pages/`;
    - SignOutOthersDialog, SignOutDeviceDialog and the device summary formatter go to `web/src/modules/admin/components/`;
    - AuthLayout goes to `web/src/layouts/AuthLayout.tsx`;
    - AUTH_COPY goes to `web/src/modules/admin/authCopy.ts`;
    - the auth calls go to `web/src/modules/admin/services/authService.ts`;
    - session.ts goes to `web/src/modules/admin/services/session.ts`, which registers refresh/onUnauthorized on the shared client in `web/src/core/api/`, so public chunks never import it (PERF-01);
    - guard.ts goes to `web/src/modules/admin/guard.ts`.
    - Keep "planner may move it".
  - `@/ui` becomes `@/components`, except `@/ui/tw`. `web/src/ui/<area>/…` becomes `web/src/components/<area>/…`.
  - api.ts mentions become module services: RESEARCH lines 215, 304, 533, 745; the MSW line names the service files.
  - The coverage line (RESEARCH 102) becomes `core/api`.
  - LocalDB mentions (RESEARCH 40, 914) use `(localdb)\MSSQLLocalDB`, with the version from `sqllocaldb info MSSQLLocalDB`.
  - The BootstrapManager guard (RESEARCH 523): refuse any `BetsLLC_*` catalog and `CSPS_Legacy_Restore`. The instance is no longer a refusal reason.
  - 04-CONTEXT.md lines 143-147: new paths.
  - 04-UI-SPEC copy:
    - line 205 aria-label: as in the table;
    - line 439: "Orders, payments and expenses, all in one place.";
    - line 531: "…Your data is safe. Nothing was changed.";
    - review the other em/en dash lines and rewrite any that are client copy (UI text, aria-label, alt, title). Leave prose and server-side email copy alone.

D. Verify. Run preflight, then the automated command. Then run the doc gates in the acceptance criteria. Optional, only if preflight shows the machine free: `npm --prefix web run parity`. Record its result, or "not run", in the SUMMARY. If a scenario differs only by a dash glyph, do not add a tolerance or exception (T-02-39); record it as an owner follow-up.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/test/no-long-dash.node.test.ts && npm --prefix web run verify</automated>
  </verify>
  <acceptance_criteria>
    - The guard test passes, and `npm --prefix web run verify` exits 0 with zero warnings.
    - Each doc gate below must exit 1 exactly (no matches; 0 means hits, 128 means a broken command):
      - `git grep -n -F "(localdb)\CSPS" -- CLAUDE.md .claude/CLAUDE.md CSPS-PRD.md docs .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/phases/04-identity-authentication; test $? -eq 1`
      - `git grep -nE "lib/http|lib/api\.ts|src/features/|web/src/app/|src/styles/" -- CLAUDE.md .claude/CLAUDE.md CSPS-PRD.md docs .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/phases/04-identity-authentication; test $? -eq 1`
      - `git grep -nP "@/ui(?!/(tw|app\.css|base\.css)\b)|web/src/ui/(?!tw\.ts|app\.css|base\.css)" -- CLAUDE.md .claude/CLAUDE.md docs .planning/phases/04-identity-authentication; test $? -eq 1`
    - .claude/CLAUDE.md still has all its `<!-- GSD:` start/end marker pairs, and its Conventions block names `modules/`, `core/api` and zod.
    - Every edited .md shows a refreshed updated timestamp (`git diff --cached --stat` cross-checked against the files' timestamp lines).
  </acceptance_criteria>
  <done>No long dash remains in web/src and a test keeps it that way. The copy replacements are consistent across tests, parity and the Phase 4 UI-SPEC. CLAUDE.md, .claude/CLAUDE.md, the PRD, PROJECT, REQUIREMENTS, docs/web and the Phase 4 artifacts describe OR-1..OR-6 and the new paths.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Developer CLI and scripts → shared `(localdb)\MSSQLLocalDB` | CSPS tooling now shares an instance with TheBETSLLC; the database name is the only thing separating the two projects' data |
| UI code → HTTP transport | WEB-04 keeps raw fetch/XHR and the transport behind core/api; a restructure could silently drop the lint boundary |
| Build → production web root | D-20 dev-only modules must never ship; the budget plugin checks by path prefix, which a move can make stale |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261014-ctx-01 | Tampering | DevSeedTargetGuard on the shared instance (dev seed `--reset`) | high | mitigate | Name allow-list CSPS_Dev/CSPS_E2E (case-insensitive) checked after the server allow-list; the new theory RefusesTheOtherProjectsDatabasesOnTheSharedInstance proves BetsLLC_* is refused on MSSQLLocalDB (Task 1) |
| T-261014-ctx-02 | Tampering | Remove-StaleTestDatabases.ps1 and the test fixture drop paths | high | mitigate | Exact case-sensitive `^CSPS_Test_[0-9a-f-]{36}$` plus length 46 kept unchanged; the -WhatIf run is checked for BetsLLC_* (Task 1); TestDatabaseName.IsDisposable is untouched |
| T-261014-ctx-03 | Information disclosure | Guard refusal reasons | low | mitigate | Fixed reason strings; existing ReasonNeverEchoesTheConnectionString and the no-echo assertions in RefusesEveryServerOutsideTheAllowList stay (Task 1) |
| T-261014-ctx-04 | Elevation of privilege | WEB-04 boundary after the move (UI calling the transport or fetch directly) | medium | mitigate | ESLint re-keyed to core/api/http and apiClient-in-services; lint-rules.node.test.ts proves each allow and deny case red-first (Task 2) |
| T-261014-ctx-05 | Information disclosure (CWE-489) | Dev-only admin/dev modules in the production build | medium | mitigate | DEV_ONLY_MODULE_PREFIXES re-keyed to src/modules/admin/ and src/layouts/AdminLayout with red-first budget tests; the production build runs in verify (Task 2) |
| T-261014-ctx-06 | Tampering (CSP, D-33) | Stylesheet import exception moved from main.tsx to App.tsx | low | mitigate | Lint tests prove only App.tsx and the parity entry may import @/ui/app.css and nothing else; build-output test still requires exactly one stylesheet (Task 2) |
| T-261014-ctx-SC | Tampering | npm/NuGet installs | high | accept | No package is added, removed or bumped in this plan, so no legitimacy gate applies |
</threat_model>

<verification>
1. Preflight: `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` reports the machine free.
2. `dotnet build Csps.slnx` reports 0 warnings, and `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx` passes. The whole .NET suite runs on (localdb)\MSSQLLocalDB, creating and dropping only CSPS_Test_<guid> databases.
3. `dotnet run --project tools/Csps.DevSeed` exits 0 (CSPS_Dev on MSSQLLocalDB).
4. `npm --prefix web run verify` exits 0 with zero warnings.
5. The path and doc gates in the Task 2 and Task 3 acceptance criteria print nothing.
6. Optional: `npm --prefix web run parity` when the machine is free. Record the result in the SUMMARY.
</verification>

<success_criteria>
- OR-1: every local SQL path uses (localdb)\MSSQLLocalDB with CSPS_* databases. The guard and cleanup script provably cannot touch BetsLLC_* databases, and the dev seed runs end to end.
- OR-6: web/src matches the owner tree with history kept, and a test enforces it.
- OR-5: endpoint calls live in module services, and ESLint enforces it with proving tests.
- OR-4: web/src has no long dash, and a test enforces it.
- OR-2/OR-3: recorded in the rules and PRD, and followed in this plan's own code.
- The rules, PRD, requirements, docs and the Phase 4 artifacts all describe the new conventions, with refreshed timestamps.
- Everything is green: the .NET build and suite, and the web verify.
</success_criteria>

<output>
Create `.planning/quick/261014-ctx-adopt-2026-10-14-conventions-switch-loca/261014-ctx-SUMMARY.md` with YAML frontmatter `created:` and `updated:` (ISO 8601 with offset). Include:
- the commits per task, with the red and green commits named;
- the git-mv rename count;
- the import-rewrite script's summary numbers;
- every copy replacement from Task 3 under "Owner follow-ups" (for the owner to confirm the wording: the hyphen for empty values, the colon in the logo name, and the hours format);
- the parity result or "not run";
- any owner items you parked.
</output>
