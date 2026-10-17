---
phase: "05"
slug: "profile-user-management"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-17"
---

# Phase 05 — Validation Strategy

*Created: 2026-10-17T16:31:26-05:00 · Updated: 2026-10-17T16:31:26-05:00*

> Per-phase validation contract for feedback sampling during execution. Source: `05-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 4.0.1 on MTP, Shouldly, NSubstitute, FakeTimeProvider, Respawn, ArchUnitNET, coverlet.MTP. Web: Vitest 5 + RTL + jsdom + in-house axe matcher, MSW 3, Playwright 1.63 + @axe-core/playwright |
| **Config file** | `global.json`, `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project tests/<Project> --filter-class "*<Class>"` / `npm --prefix web run test -- --run <path>` |
| **Full suite command** | preflight, then `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` in that process), `tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |
| **Estimated runtime** | quick ~30-90 s; full ~15-25 min |

---

## Sampling Rate

- **After every task commit:** the touched project's `--filter-class` run, or `npm --prefix web run test -- --run <path>`
- **After every plan wave:** preflight, `dotnet test --solution Csps.slnx` + `npm --prefix web run verify`
- **Before `/gsd-verify-work`:** full suite + coverage gate + e2e (three engines + phones), zero warnings
- **Max feedback latency:** 90 seconds per task

---

## Per-Task Verification Map

Filled by the planner per task; requirement-level map:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | Name save stamps UpdatedBy, rotates version, refreshes shell name | unit + integration + component | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*UpdateNameHandlerTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ProfileEndpointTests"`; `npm --prefix web run test -- --run src/modules/admin/pages/ProfilePage.test.tsx` | ❌ Wave 0 |
| PROF-02 | Request needs current password; link to new, notice to old; 24 h single-use; confirm applies; taken-meanwhile state | integration + E2E | `--filter-class "*EmailChangeTests"`; `npm --prefix web run e2e -- --grep @profile-email` | ❌ Wave 0 |
| PROF-03 | Full rule incl. breach; other sessions revoked, current kept; email sent | integration | `--filter-class "*ChangePasswordTests"` | ❌ Wave 0 |
| PROF-04 | Appearance tab and Topbar toggle share one state; public stays light | component | `npm --prefix web run test -- --run src/modules/admin/theme.test.ts src/modules/admin/pages/ProfilePage.test.tsx` | ✅ theme.test.ts / ❌ page |
| USER-01 | Paging, search (incl. `%`, `_`), role/status filters, deleted excluded, caps | integration + hook | `--filter-class "*ListUsersEndpointTests"`; `npm --prefix web run test -- --run src/modules/admin/hooks/useUsersListParams.test.tsx`; E2E list → detail → Back | ❌ Wave 0 |
| USER-02 | Invite (7 d) and temporary route (must-change, shown once, never stored plain) | unit + integration + component | `--filter-class "*CreateUserHandlerTests"`, `"*CreateUserEndpointTests"`; `npm --prefix web run test -- --run src/modules/admin/components/AddUserPanel.test.tsx` | ❌ Wave 0 |
| USER-03 | Edit/lock/unlock/deactivate/activate/soft delete; names stay; scrambled email | integration | `--filter-class "*UserLifecycleTests"`, `"*DeleteUserTests"` | ❌ Wave 0 |
| USER-04 | Self-action refused; last active Manager kept under two concurrent writers (demote, lock, deactivate, delete) | integration (concurrency) | `--filter-class "*LastManagerGuardTests"` | ❌ Wave 0 |
| USER-05 | Role/status change: target's next request with the old sid gets 401 | integration | `--filter-class "*UserSessionRevocationTests"` | ❌ Wave 0 (pattern: `SessionRevocationTests`) |
| USER-06 | Each action writes exactly its code, target `User` id, no PII in detail | unit + integration | `--filter-class "*AuditActionsTests"` (extend), `"*UserAuditTests"` | ✅ / ❌ |
| USER-07 | Resend replaces the invite token; reset link from a Manager | integration | `--filter-class "*ResendInvitationTests"`, `"*ManagerResetLinkTests"` | ❌ Wave 0 |
| USER-08 | Admin 403 on every Users/AuditLog action; route redirect; nav hidden | matrix + component + E2E | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"`; `npm --prefix web run test -- --run src/modules/admin/routes.test.tsx` | ✅ (add rows) |
| AUDIT-02 | Filters by actor/action/target/date (business days), newest first, paging, 8-month floor | integration + hook + E2E | `--filter-class "*AuditLogEndpointTests"`; `npm --prefix web run test -- --run src/modules/admin/hooks/useAuditListParams.test.tsx` | ❌ Wave 0 |
| SEC-07 | Two concurrent saves with one version: one 2xx, one 409 with the exact text; UI keeps typed values, Load Latest | integration + component | `--filter-class "*UserEditConcurrencyTests"`; `npm --prefix web run test -- --run src/components/states/ConflictBanner.test.tsx` | ❌ Wave 0 |
| SEC-08 | Forged attribution ignored on create and update; "System" for old rows; "(former staff)" after delete | integration + component | `--filter-class "*UserAttributionTests"`; `npm --prefix web run test -- --run src/components/data/RecordMeta.test.tsx` | ❌ Wave 0 |
| D-06 | Only `TR_AuditLog_AppendOnly` exists; no `CREATE TRIGGER` in other migrations | integration + source scan | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*TriggerInventoryTests"` | ❌ Wave 0 |
| D-01/02/03/05/36 | Full bleed, sticky sidebar/topbar, nav scrolls at 1280×600 and 200% zoom, no sideways scroll 320-1920, tab bar at viewport bottom 320-767 short and long | E2E (3 engines + phones) | `npm --prefix web run e2e -- --grep @shell` | ❌ Wave 0 (extend `responsive.spec.ts`) |
| D-34/35/38 | aria-expanded and name follow state; presence unmounts at once under reduced motion; no CLS | component + E2E | `npm --prefix web run test -- --run src/components/navigation src/hooks/usePresence.test.ts`; `npm --prefix web run e2e -- --grep @shell-motion` | ❌ Wave 0 |
| D-30..33 | `/admin/components` Manager-only, lazy, Demo data banner, no API calls, CSP/axe clean, budget | build + E2E | `npm --prefix web run build:budget`; `npm --prefix web run e2e -- --grep @showcase` | ✅ `showcase.spec.ts` (extend) |
| Carry-over | Flaky resend test passes 20× in a loaded run | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ResendCodeEndpointTests"` (repeated) | ✅ |


*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Migration `AddUserManagement` + `IdentitySchemaTests` additions (new columns, FK, no JSON, no trigger)
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs` (D-06)
- [ ] `tests/Csps.Server.IntegrationTests/Users/*` (list, create, lifecycle, guard concurrency, edit concurrency, attribution, revocation, resend/reset)
- [ ] `tests/Csps.Server.IntegrationTests/Profile/*` (name, password, email change)
- [ ] `tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs`
- [ ] A two-client concurrency helper (barrier + `Task.WhenAll`) in `Csps.Testing`
- [ ] Matrix rows for every new action; `IdempotencyCoverageTests` entries (or exemptions with reasons) for the new POSTs
- [ ] Web: MSW handlers for users/profile/audit services; `usePresence` tests; shell `@shell` E2E specs


---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production refresh-cookie `Expires` only with "Keep me signed in" | Phase 4 carry-over | Needs the first HTTPS production deploy | Sign in on the live site with and without the box ticked; check `__Secure-csps_rt` Set-Cookie for `Expires` |
| Email-change link and old-address notice arrive in a real inbox | PROF-02 | Real SMTP delivery | Change email on a dev account with SMTP configured; confirm both mails |
| Motion feels right (drawer, user menu, dialogs) on a real phone | D-34, D-35, D-39 | Subjective feel; automated tests cover state and reduced motion | Open/close each on a phone, then with reduced motion on |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
