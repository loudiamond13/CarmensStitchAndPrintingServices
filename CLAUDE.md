# CarmensStitchAndPrintingServices
*Created: 2026-10-07T17:17:38-05:00 · Updated: 2026-10-14T10:16:00-05:00*

## Shared machine: do not collide with TheBETSLLC (C:\Work\TheBETSLLC)

Another project is developed on this machine at the same time, often by a separate Claude session. These rules keep the two from interfering.

- **This project's ports:** Vite 5180 (`strictPort: true`), API 5115 http / 7028 https, HostProbe tool 5116 http / 7029 https, Playwright E2E host 5199 (when Playwright is added; use `reuseExistingServer: false`).
- **Never use** 5173, 5023 or 5099. Those belong to TheBETSLLC.
- **Avoid ports 49152-65535** (the Windows dynamic range). Hyper-V/WSL reserve blocks there and other programs grab them.
- **LocalDB:** use the default instance `(localdb)\MSSQLLocalDB` with separate `CSPS_` databases (owner, 2026-10-14; the dedicated CSPS instance is retired). TheBETSLLC uses the same instance, so database names are the guard. Databases use the `CSPS_` prefix (`CSPS_Dev`, `CSPS_E2E`, `CSPS_Test_<guid>`, `CSPS_Legacy_Restore`). Automated cleanup may drop only `^CSPS_Test_[0-9a-f-]{36}$`. Never create, reset, restore over or drop any `BetsLLC_*` database.
- **No Docker or Testcontainers locally.** Tests pick their backend from `CSPS_TEST_SQL=localdb|container`, set per process only. Local runs use LocalDB, and CI (ubuntu) uses the SQL 2025 container. This keeps clear of the 49152-65535 range.
- **Before starting a dev server, Playwright, or a full test run,** run:
  `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`
  If a port is IN USE by another project, or TheBETSLLC's test processes are listed, wait. Never kill another project's processes.
- **Never set** `ASPNETCORE_URLS`, `ASPNETCORE_HTTPS_PORT`, `DEV_SERVER_PORT`, `ASPNETCORE_ENVIRONMENT` or any other variable at User/Machine level, and never change system settings. Set them only inside a single terminal or process.
- **`_local/` holds a production database backup:** never commit, upload or deploy it. Restore it, and only in the legacy-discovery phase, into `(localdb)\MSSQLLocalDB` as `CSPS_Legacy_Restore`. Never restore it over `CSPS_Dev`.
- **One session per folder.** Never work in C:\Work\TheBETSLLC from this project's session.

## Owner decisions (Phase 1 discuss, 2026-10-07; full list in `.planning/phases/01-*/01-CONTEXT.md`)

- **Free only:** no paid licenses, tools or services beyond the existing hosting and domain. Explain license terms in plain words, because the owner reads "license" as "something to pay for".
- **Locale:** PHP `₱`, `en-PH` (`₱12,450.00`, `Oct 6, 2026`). The business zone is `Asia/Manila`, held in SiteSettings (Manager-editable later). Calendar year Jan–Dec.
- **Hosting:** SmarterASP.NET **Basic** (1 DB, 256 MB pool, no scheduler, **no staging**). Production deploys need manual approval. The owner runs the hosting checklist and pastes the results.
- **Email sender:** the legacy site's domain. **Merge** SPF/DKIM/DMARC with the existing records, never replace them, and never disturb the live site.
- **DB:** no JSON columns. Compat level pinned at 160 until the host level is verified. The dev seed is an explicit `tools/` command that refuses any DB except `CSPS_Dev`/`CSPS_E2E`, and nothing seeds or migrates at startup.
- **API surface:** OpenAPI + Scalar only in Development. `/health` is public with a minimal body. A production 500 returns "Something went wrong. Reference: <traceId>". Error text is plain English.
- **Security/tooling:** Data Protection keys are encrypted with a certificate (host-secret PFX; dev PFX in user-secrets). Architecture tests use ArchUnitNET. Coverage uses coverlet.MTP + ReportGenerator. Release cool-down is 14 days.
- **Audit/logs:** IPs truncated to /24 (IPv4) and /48 (IPv6), 8-month audit retention (D-32). Logs are JSON files in `{contentRoot}/logs`, kept 30 days.

## Owner rules (2026-10-14)

Full detail is in `.claude/CLAUDE.md` under Conventions. This copy stays if that GSD-managed block is regenerated.

- **OR-1 LocalDB:** default `(localdb)\MSSQLLocalDB`, separate `CSPS_*` databases, never touch `BetsLLC_*`.
- **OR-2 Comments:** minimal and concise, enough for the owner to follow the code in review.
- **OR-3 Validation:** client-side (zod) covers every rule the backend validates, before any request is sent.
- **OR-4 No long dash:** no em dash or en dash in the client (code, copy, comments). The minus sign U+2212 in money stays.
- **OR-5 API calls:** per module in `modules/{public,admin}/services/`. The shared client and interceptors live in `core/api/`.
- **OR-6 Layout:** `web/src` follows the owner tree: `assets, components, core, hooks, layouts, lib, modules, types, ui, utils` (plus `dev` and `test`).
