# CarmensStitchAndPrintingServices

## Shared machine: do not collide with TheBETSLLC (C:\Work\TheBETSLLC)

Another project is developed on this machine at the same time, often by a separate Claude session. These rules keep the two from interfering.

- **This project's ports:** Vite 5180 (`strictPort: true`), API 5115 http / 7028 https, Playwright E2E host 5199 (when Playwright is added; use `reuseExistingServer: false`).
- **Never use** 5173, 5023 or 5099. Those belong to TheBETSLLC.
- **Avoid ports 49152-65535** (the Windows dynamic range). Hyper-V/WSL reserve blocks there and other programs grab them.
- **LocalDB:** use the dedicated instance `(localdb)\CSPS` (`sqllocaldb create CSPS`), never the shared `MSSQLLocalDB`. Databases use the `CSPS_` prefix (`CSPS_Dev`, `CSPS_E2E`, `CSPS_Test_<guid>`, `CSPS_Legacy_Restore`). Automated cleanup may drop only `^CSPS_Test_[0-9a-f-]{36}$`. Never create, reset, restore over or drop any `BetsLLC_*` database.
- **No Docker or Testcontainers locally.** Tests pick their backend from `CSPS_TEST_SQL=localdb|container`, set per process only. Local runs use LocalDB, and CI (ubuntu) uses the SQL 2025 container. This keeps clear of the 49152-65535 range.
- **Before starting a dev server, Playwright, or a full test run,** run:
  `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`
  If a port is IN USE by another project, or TheBETSLLC's test processes are listed, wait. Never kill another project's processes.
- **Never set** `ASPNETCORE_URLS`, `ASPNETCORE_HTTPS_PORT`, `DEV_SERVER_PORT`, `ASPNETCORE_ENVIRONMENT` or any other variable at User/Machine level, and never change system settings. Set them only inside a single terminal or process.
- **`_local/` holds a production database backup:** never commit, upload or deploy it. Restore it, and only in the legacy-discovery phase, into `(localdb)\CSPS` as `CSPS_Legacy_Restore`. Never restore it over `CSPS_Dev`.
- **One session per folder.** Never work in C:\Work\TheBETSLLC from this project's session.

## Owner decisions (Phase 1 discuss, 2026-10-07; full list in `.planning/phases/01-*/01-CONTEXT.md`)

- **Free only:** no paid licenses, tools or services beyond the existing hosting and domain. Explain license terms in plain words, because the owner reads "license" as "something to pay for".
- **Locale:** PHP `₱`, `en-PH` (`₱12,450.00`, `Oct 6, 2026`). The business zone is `Asia/Manila`, held in SiteSettings (Manager-editable later). Calendar year Jan–Dec.
- **Hosting:** SmarterASP.NET **Basic** (1 DB, 256 MB pool, no scheduler, **no staging**). Production deploys need manual approval. The owner runs the hosting checklist and pastes the results.
- **Email sender:** the legacy site's domain. **Merge** SPF/DKIM/DMARC with the existing records, never replace them, and never disturb the live site.
- **DB:** no JSON columns. Compat level pinned at 160 until the host level is verified. The dev seed is an explicit `tools/` command that refuses any DB except `CSPS_Dev`/`CSPS_E2E`, and nothing seeds or migrates at startup.
- **API surface:** OpenAPI + Scalar only in Development. `/health` is public with a minimal body. A production 500 returns "Something went wrong. Reference: <traceId>". Error text is plain English.
- **Security/tooling:** Data Protection keys are encrypted with a certificate (host-secret PFX; dev PFX in user-secrets). Architecture tests use ArchUnitNET. Coverage uses coverlet.MTP + ReportGenerator. Release cool-down is 14 days.
- **Audit/logs:** IPs truncated to /24 (IPv4) and /48 (IPv6), 2-year audit retention. Logs are JSON files in `{contentRoot}/logs`, kept 30 days.
