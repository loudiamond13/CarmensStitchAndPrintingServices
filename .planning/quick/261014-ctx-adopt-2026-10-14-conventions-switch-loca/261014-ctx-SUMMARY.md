---
quick_id: 261014-ctx
status: complete
created: 2026-10-14T13:40:00-05:00
updated: 2026-10-14T13:40:00-05:00
---

# 261014-ctx: Adopt owner conventions of 2026-10-14

Also done in this session (no repo change): deleted the merged branches `gsd/phase-1-hosting-verification-backend-foundation` and `gsd/phase-2-web-foundation-design-system` locally and on GitHub.

## Task 1: LocalDB switch (3132ff8, 21b2b1e)
- Dev seed, design-time factory, appsettings, test fixture, scripts and web e2e configs use `(localdb)\MSSQLLocalDB` with `CSPS_*` databases.
- The dev-seed guard allows only `CSPS_Dev`/`CSPS_E2E` on MSSQLLocalDB (or the CI container) and refuses `BetsLLC_*` and the retired CSPS instance.
- Existing `CSPS_Dev`/`CSPS_E2E` were detached from `(localdb)\CSPS` and attached to MSSQLLocalDB (data kept). The CSPS instance is stopped and empty.
- Tracer: dev seed on MSSQLLocalDB exits 0. Infrastructure integration tests 128/128.

## Task 2: web/src restructure (2dd21e8, 7b3f879)
- `git mv` into assets/, components/, hooks/, types/, utils/, ui/ (theme), lib/, core/{api,routes}, layouts/, modules/{public,admin}/{components,hooks,services,pages}, App.tsx, main.tsx. `src/dev` and `src/test` unchanged.
- API split: `core/api/apiClient.ts` + `errors.ts` shared, `modules/admin/services/siteSettingsService.ts`. Coverage 100% keyed to `src/core/api/**`.

## Task 3: no long dash + rules recorded (9248986..0783f88, 3b2daf6)
- Guard test `web/src/test/no-long-dash.node.test.ts`; 36 dashes removed. U+2212 minus kept for negative money.
- Also removed from `web/index.html` title and `web/public/mark.svg`.
- Rules OR-1..OR-6 recorded in CLAUDE.md, .claude/CLAUDE.md, PRD, PROJECT, REQUIREMENTS, docs/web, Phase 4 RESEARCH/UI-SPEC/CONTEXT.
- Fixed a Task 2 rewrite bug in three parity fragments; parity 456/456.

## Verification
`npm --prefix web run verify` exit 0, 3126 tests, zero warnings. Re-ran vitest after the final title fix: 3126/0.

## Owner follow-ups
- Copy changes: empty value shows `-`; logo/title `CSPS: Carmen's Stitch & Printing Services`; hours `Mon-Sat · 9:00 AM - 6:00 PM`; load error `Your data is safe. Nothing was changed.`
- `CSPS-UI-SPEC.md` (frozen, hash-pinned) still contains em dashes.
- **Blocking:** NuGetAudit fails restore on main: System.Security.Cryptography.Pkcs 9.0.11/10.0.12 and System.Security.Cryptography.Xml 10.0.12 (high severity). Needs a package bump with owner OK.
