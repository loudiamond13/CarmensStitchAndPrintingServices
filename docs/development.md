# Developer guide: from a fresh clone to a running API

*Created: 2026-10-07T13:02:24-05:00 · Updated: 2026-10-07T22:31:43-05:00*

This page takes a new developer from `git clone` to a running, tested CSPS API on a Windows machine. Follow the steps in order. Every command runs from the repository root in a normal terminal (Windows PowerShell 5.1 or PowerShell 7).

> **This machine is shared.** Another project (TheBETSLLC, in `C:\Work\TheBETSLLC`) is developed here at the same time, often by a separate session. The rules in [Shared-machine rules](#shared-machine-rules) keep the two apart. Read them before you start anything.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| .NET SDK | 10.0.401 | Pinned in `global.json` with `rollForward: latestPatch`, so any later 10.0.4xx patch works. Tests run on Microsoft.Testing.Platform (`dotnet test --project ...`). |
| SQL Server 2025 Express LocalDB | 2025 | Provides `sqllocaldb`. CSPS uses its own instance, `(localdb)\CSPS`. |
| Node.js / npm | 24.15+ / 11.19+ | For the web app in `web/` and the OpenAPI generator in `tools/openapi-gen/`. `engine-strict` refuses older versions. |
| Windows PowerShell | 5.1 | Every script in `tools/scripts` runs on 5.1 (and on PowerShell 7). |
| Git | any recent | |

**No Docker locally.** Tests use LocalDB on a developer machine. Only CI (Linux) uses a SQL Server container. This keeps clear of the Windows dynamic port range.

The license gate (`New-ThirdPartyNotices.ps1`) looks package metadata up on nuget.org, so it needs network access.

## Ports

| Port | Used by | From |
|------|---------|------|
| 5115 | API over http (`--launch-profile http`) | now |
| 7028 | API over https (`--launch-profile https`) | now |
| 5180 | Vite dev server (`strictPort: true`) | Phase 2 |
| 5199 | Playwright E2E host (`reuseExistingServer: false`) | Phase 2 |

**Never use** 5173, 5023 or 5099 (they belong to TheBETSLLC), and avoid **49152-65535** (the Windows dynamic range, where Hyper-V and WSL reserve blocks).

## First-time setup

Run these once, in this order.

1. **Create and start the CSPS LocalDB instance.** Safe to re-run. It never touches the shared `MSSQLLocalDB` instance.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-LocalDb.ps1
   ```

2. **Restore the local dotnet tools** (`dotnet-ef`, `reportgenerator`, `nuget-license`, pinned in `.config/dotnet-tools.json`).

   ```powershell
   dotnet tool restore
   ```

3. **Create your development secrets.** This writes the JWT signing key and the Data Protection certificate to *your* user-secrets store (`%APPDATA%\Microsoft\UserSecrets\...`), never to git, environment variables or machine settings. The API refuses to start without them. Safe to re-run, because existing values are kept.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-DevSecrets.ps1
   ```

4. **Build the schema from the migrations.** Every table comes from EF Core migrations, so an empty database becomes the full schema with no backup file.

   ```powershell
   dotnet ef database update --project src/Csps.Infrastructure --startup-project src/Csps.Server
   ```

   This targets `CSPS_Dev` on `(localdb)\CSPS`. To target the E2E database instead, add
   `--connection "Server=(localdb)\CSPS;Database=CSPS_E2E;Integrated Security=true"`.

   When this command creates a new database, SQL Server gives it the server's default compatibility level (170 on SQL Server 2025). The seed in step 5 pins it to 160, the level the app's SQL is generated for, so always run step 5 after creating a database.

5. **Seed development data.** The seed is an explicit command. Nothing seeds or migrates when the API starts. It only accepts `CSPS_Dev` (the default) or `CSPS_E2E`, and only on the dedicated `(localdb)\CSPS` instance or on a SQL Server container on this machine addressed as `127.0.0.1,<port>` or `localhost,<port>` (the container the CI tests use). It refuses every other database and every other server, including the shared `MSSQLLocalDB` instance, named-pipe (`np:`) and `tcp:` addresses, named instances, hosted servers such as the SmarterASP.NET database, and any connection string with a `Failover Partner`. A refusal exits with code 2 before anything connects. It also applies any pending migrations before seeding, and is safe to re-run.

   ```powershell
   dotnet run --project tools/Csps.DevSeed -- --reset
   ```

   `--reset` drops `CSPS_Dev` first and rebuilds it from the migrations. Leave it off to keep existing data. Use `--database CSPS_E2E` for the E2E database.

## Running the API

1. Run the preflight check first. If a port is **IN USE** by another project, or TheBETSLLC's test processes are listed, **wait**. Never stop another project's processes.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
   ```

2. Start the API:

   ```powershell
   dotnet run --project src/Csps.Server --launch-profile http
   ```

3. Check it:
   - <http://localhost:5115/health> is public and returns a minimal body.
   - <http://localhost:5115/scalar> is the API reference (Scalar), with the OpenAPI document at `/openapi/v1.json`. Both exist **in Development only**. Outside Development both prefixes answer a plain 404 and never show the web app (D-29).

The launch profile sets `ASPNETCORE_ENVIRONMENT=Development` for that process only. Never set it, or any other variable, at User or Machine level.

## Web app (web/)

The public site and the admin portal are one React app in `web/`, built with Vite. The API serves the built app from its web root, so production needs no separate web server.

1. **Install the exact locked packages** (once, and after every `package-lock.json` change). `web/.npmrc` pins exact versions and the 14-day release cool-down. Never add a package with a plain `npm install <name>`: every new package or version needs the owner's approval first (see [Dependencies](dependencies.md)).

   ```powershell
   npm --prefix web ci
   ```

2. **Day-to-day development: two terminals.** Run the preflight check first (see [Running the API](#running-the-api)). Then start the API in one terminal and the Vite dev server in the other:

   ```powershell
   dotnet run --project src/Csps.Server --launch-profile http
   ```

   ```powershell
   npm --prefix web run dev
   ```

   Open <http://localhost:5180>. The dev server uses port **5180** with `strictPort`: if the port is taken it stops with an error instead of moving to another port, so it never collides with TheBETSLLC. It forwards every `/api` request to the API on <http://localhost:5115>.

3. **Production build.** This empties and rewrites `src/Csps.Server/wwwroot`, which the API then serves at <http://localhost:5115/>:

   ```powershell
   npm --prefix web run build
   ```

   `src/Csps.Server/wwwroot` is build output. It is git-ignored and never edited by hand. Hand-written static files (`mark.svg`, `robots.txt`) live in `web/public/`. The .NET tests never need this build: they serve a small stub web root from `tests/Csps.Testing/Fixtures/webroot`.

4. **OpenAPI type generator.** `tools/openapi-gen/` is a separate npm folder with its own TypeScript 5.9, which the generator needs. Install it with `npm --prefix tools/openapi-gen ci`.

How the API serves the app:

- Any page path, such as `/products` or `/admin/orders`, gets the app's `index.html`, which the browser revalidates on every visit.
- Files under `/assets/` are cached for a year, because their names change with every build.
- A missing file, such as `/missing.js`, is a plain 404. Unknown `/api` paths stay API errors.
- Static text (html, css, JavaScript, SVG) is compressed. JSON never is.

Set environment variables only inside one terminal or process, never at User or Machine level.

## Testing

Run the preflight check (above) before a full test run.

| What | Command |
|------|---------|
| One project (quick) | `dotnet test --project tests/Csps.Domain.UnitTests` |
| One test class | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*SolutionLayoutTests"` |
| Everything | `dotnet test --solution Csps.slnx` |

- **Database tests** create their own `CSPS_Test_<guid>` database on `(localdb)\CSPS` and drop it when they finish.
- **`CSPS_TEST_SQL`** picks the SQL backend for integration tests: unset or `localdb` uses LocalDB (the only local option), and `container` uses a SQL Server 2025 container (CI only). Set it only for a single process or terminal, for example `$env:CSPS_TEST_SQL = 'localdb'` in one PowerShell window. Never set it at User or Machine level.
- **Leftover test databases** from a crashed run can be listed, and then removed, with:

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1 -WhatIf
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1
  ```

  It drops only names matching `^CSPS_Test_[0-9a-f-]{36}$` that are older than two hours, and only on `(localdb)\CSPS`.

## Quality gates

Run all of these before you push. CI (Phase 3) runs the same commands.

| Gate | Command | Passes when |
|------|---------|-------------|
| Build | `dotnet build Csps.slnx -tl:off` | 0 warnings and 0 errors. Warnings are errors (`TreatWarningsAsErrors`). |
| Formatting | `dotnet format Csps.slnx --verify-no-changes` | Nothing would change. |
| Tests | `dotnet test --solution Csps.slnx` | Every test passes. |
| Coverage | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | Csps.Domain is at 100% line and 100% branch, and Csps.Application is at 95% line or more. The report is in `artifacts/coverage/`. |
| Licenses and notices | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/New-ThirdPartyNotices.ps1` | Every package (transitive ones included) uses an allowed license (`docs/allowed-licenses.json`) or an owner-approved exact-version exception (`docs/license-exceptions.json`). It regenerates `THIRD-PARTY-NOTICES.md`, so commit that file when it changes. |

Never reach a gate by lowering a threshold, excluding production code from coverage, or widening the license lists. Report the problem instead. Adding a package follows `docs/dependencies.md`, which covers the 14-day release cool-down and owner approval.

## Schema changes

- Add a migration:

  ```powershell
  dotnet ef migrations add <Name> --project src/Csps.Infrastructure --startup-project src/Csps.Server
  ```

  Migrations live in `src/Csps.Infrastructure/Persistence/Migrations`. No JSON columns. Drops, renames and lossy type changes are one-way doors, so ask the owner first.
- **Production** schema changes go out only as a reviewed idempotent script:

  ```powershell
  dotnet ef migrations script --idempotent --project src/Csps.Infrastructure --startup-project src/Csps.Server --output artifacts/migrations/<Name>.sql
  ```

  The API never runs `Database.Migrate()` at startup.

## Hosting and operations

- `.planning/HOSTING-RECORD.md` is the SmarterASP.NET Basic hosting checklist the owner runs, with the facts found on the host and what they mean for later phases. Check it before relying on a host detail such as the runtime version or the database compatibility level.
- `docs/operations/` holds the runbooks: `data-protection-rotation.md` (rotating the Data Protection certificate) and `audit-log.md`.
- `tools/Csps.HostProbe/README.md` explains the one-time host probe. It never goes on the live site.

## Shared-machine rules

- **Databases:** use only the `CSPS_` databases on `(localdb)\CSPS` (`CSPS_Dev`, `CSPS_E2E`, `CSPS_Test_<guid>`, `CSPS_Legacy_Restore`). Never use the shared `MSSQLLocalDB` instance, and never create, reset, restore over or drop any `BetsLLC_*` database.
- **Ports:** see [Ports](#ports). Run the preflight check before a dev server, Playwright or a full test run, and wait if another project is busy.
- **Environment variables:** never set `ASPNETCORE_URLS`, `ASPNETCORE_HTTPS_PORT`, `ASPNETCORE_ENVIRONMENT`, `CSPS_TEST_SQL` or any other variable at User or Machine level, and never change system settings. Set them only inside one terminal or process.
- **`_local/`** holds a production database backup. Never commit, upload or deploy it, and never open it outside the legacy-discovery phase. It is restored only into `(localdb)\CSPS` as `CSPS_Legacy_Restore`, never over `CSPS_Dev`.
- **One session per folder.** Never work in `C:\Work\TheBETSLLC` from a CSPS session.
