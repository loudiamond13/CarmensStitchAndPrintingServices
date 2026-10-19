---
phase: "05"
slug: "profile-user-management"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-17"
---

# Phase 05 — Validation Strategy

*Created: 2026-10-17T16:31:26-05:00 · Updated: 2026-10-19T05:01:00-05:00*

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

Each PLAN.md task carries its own `<automated>` commands with `<fails_when>`; plan 05-37 copies the final per-task map of all 43 plans here. Requirement-level map (test names match the plans):

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | Name save stamps UpdatedBy, rotates version, refreshes shell name | unit + integration + component | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*UpdateProfileNameHandlerTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ProfileEndpointTests"`; `npm --prefix web run test -- --run src/modules/admin/pages/ProfilePage.test.tsx` | ✅ |
| PROF-02 | Request needs current password; link to new, notice to old; 24 h single-use; confirm applies; taken-meanwhile state | integration + E2E | `--filter-class "*EmailChangeTests"`; `npm --prefix web run e2e -- --grep @profile-email` | ✅ |
| PROF-03 | Full rule incl. breach; other sessions revoked, current kept; email sent | integration | `--filter-class "*ChangePasswordTests"` | ✅ |
| PROF-04 | Appearance tab and Topbar toggle share one state; public stays light | component | `npm --prefix web run test -- --run src/modules/admin/theme.test.ts src/modules/admin/pages/ProfilePage.test.tsx` | ✅ |
| USER-01 | Paging, search (incl. `%`, `_`), role/status filters, deleted excluded, caps | integration + hook | `--filter-class "*ListUsersEndpointTests"`; `npm --prefix web run test -- --run src/modules/admin/hooks/useUsersListParams.test.tsx`; E2E list → detail → Back | ✅ |
| USER-02 | Invite (7 d) and temporary route (must-change, shown once, never stored plain) | unit + integration + component | `--filter-class "*CreateUserHandlerTests"`, `"*CreateUserEndpointTests"`; `npm --prefix web run test -- --run src/modules/admin/components/AddUserPanel.test.tsx` | ✅ |
| USER-03 | Edit/lock/unlock/deactivate/activate/soft delete; names stay; scrambled email | integration | `--filter-class "*UserLifecycleTests"`, `"*DeleteUserTests"` | ✅ |
| USER-04 | Self-action refused; last active Manager kept under two concurrent writers (demote, lock, deactivate, delete) | integration (concurrency) | `--filter-class "*LastManagerGuardTests"` | ✅ |
| USER-05 | Role/status change: target's next request with the old sid gets 401 | integration | `--filter-class "*UserLifecycleTests"`, `"*LockUserTests"`, `"*DeleteUserTests"` | ✅ |
| USER-06 | Each action writes exactly its code, target `User` id, no PII in detail | unit + integration | `--filter-class "*AuditActionsTests"` (extend), `"*UserLifecycleTests"`, `"*UpdateUserEndpointTests"` | ✅ |
| USER-07 | Resend replaces the invite token; reset link from a Manager | integration | `--filter-class "*ResendInvitationTests"`, `"*ManagerResetLinkTests"` | ✅ |
| USER-08 | Admin 403 on every Users/AuditLog action; route redirect; nav hidden | matrix + component + E2E | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"`; `npm --prefix web run test -- --run src/modules/admin/routes.test.tsx` | ✅ (add rows) |
| AUDIT-02 | Filters by actor/action/target/date (business days), newest first, paging, 8-month floor | integration + hook + E2E | `--filter-class "*AuditLogEndpointTests"`; `npm --prefix web run test -- --run src/modules/admin/hooks/useAuditListParams.test.tsx` | ✅ |
| SEC-07 | Two concurrent saves with one version: one 2xx, one 409 with the exact text; UI keeps typed values, Load Latest | integration + component | `--filter-class "*UserEditConcurrencyTests"`; `npm --prefix web run test -- --run src/components/states/ConflictBanner.test.tsx` | ✅ |
| SEC-08 | Forged attribution ignored on create and update; "System" for old rows; "(former staff)" after delete | integration + component | `--filter-class "*ProfileAttributionTests"`, `"*CreateUserEndpointTests"`, `"*RecordStampInterceptorTests"`; `npm --prefix web run test -- --run src/components/data/RecordMeta.test.tsx` | ✅ |
| D-06 | Only `TR_AuditLog_AppendOnly` exists; no `CREATE TRIGGER` in other migrations | integration + source scan | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*TriggerInventoryTests"` | ✅ |
| D-01/02/03/05/36 | Full bleed, sticky sidebar/topbar, nav scrolls at 1280×600 and 200% zoom, no sideways scroll 320-1920, tab bar at viewport bottom 320-767 short and long | E2E (3 engines + phones) | `npm --prefix web run e2e -- --grep @shell` | ✅ `shell.spec.ts` |
| D-34/35/38 | aria-expanded and name follow state; presence unmounts at once under reduced motion; no CLS | component + E2E | `npm --prefix web run test -- --run src/components/navigation src/hooks/usePresence.test.ts`; `npm --prefix web run e2e -- --grep @motion` | ✅ |
| D-30..33 | `/admin/components` Manager-only, lazy, Demo data banner, no API calls, CSP/axe clean, budget | build + E2E | `npm --prefix web run build:budget`; `npm --prefix web run e2e -- --grep @showcase` | ✅ `showcase.spec.ts` (extend) |
| Carry-over | Flaky resend test passes 20× in a loaded run | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ResendCodeEndpointTests"` (repeated) | ✅ |


### Final per-task verification map (copied from the 43 plans by plan 05-37)

Status is the result when the plan closed; plan 05-37 re-ran the whole gate at the end of the phase (see its SUMMARY). The owner checkpoint is the only open row.

| Plan task | Task | Automated verification | Status |
|-----------|------|------------------------|--------|
| 05-01 T1 | Tracer - on a phone, the admin tab bar sits at the viewport bottom on a short page and on a long page (D-36, D-01 admin chain) | `npm --prefix web run e2e -- --grep @shell --project chromium`<br>`npm --prefix web run test -- --run src/components/layout` | ✅ |
| 05-01 T2 | Sidebar and top bar pinned at any scroll depth; the nav list scrolls on its own on short screens (D-02, D-03, D-04) | `npm --prefix web run e2e -- --grep @shell` | ✅ |
| 05-01 T3 | Public and error pages fill the viewport, and no page in the shell scrolls sideways from 320 to 1920 px (D-01, D-05) | `npm --prefix web run e2e -- --grep @shell`<br>`npm --prefix web run verify` | ✅ |
| 05-02 T1 | Tracer - the Add Payment dialog fades and scales out on Cancel, then leaves the DOM, while focus is already back on its button (D-38, D-39) | `npm --prefix web run test -- --run src/hooks src/components/overlays` | ✅ |
| 05-02 T2 | ConfirmDialog and the SignOut dialogs take an open prop, animate closed and start clean on every open (D-39) | `npm --prefix web run test -- --run src/components/overlays src/modules/admin/components` | ✅ |
| 05-02 T3 | Browser proof in three engines: close plays then unmounts, reduced motion is instant, no layout shift; motion rules documented (D-38, D-39) | `npm --prefix web run e2e -- --grep @motion`<br>`npm --prefix web run verify`<br>`npm --prefix web run parity -- --grep "@parity @overlays"` | ✅ |
| 05-03 T1 | Tracer - an Admin who opens /admin/users lands on /admin, a Manager stays, and an unknown role ends the session (USER-08, IN-17) | `npm --prefix web run test -- --run src/modules/admin/services/session.test.ts src/modules/admin/guard.test.ts src/modules/admin/routes.test.tsx` | ✅ |
| 05-03 T2 | Six Phase 5 icons from the installed lucide-react (UI-SPEC OQ-9 contract default) | `npm --prefix web run test -- --run src/components/brand`<br>`npm --prefix web run verify` | ✅ |
| 05-04 T1 | Tracer - a migrated database has exactly one trigger and the production script creates only that one (D-06) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*TriggerInventoryTests"` | ✅ |
| 05-04 T2 | The sixth-code-in-an-hour test passes reliably in full runs, cap assertions intact (Phase 4 carry-over) | `bash -c 'for i in 1 2 3 4 5 6 7 8 9 10; do dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ResendCodeEndpointTests" \|\| exit 1; done'` | ✅ |
| 05-05 T1 | Tracer - a Manager-locked or deleted account gets the generic sign-in error and no session (new columns end to end) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*InactiveAccountTests"`<br>`dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MigrationScriptTests"` | ✅ |
| 05-05 T2 | Pre-Phase-5 accounts get their creation date and a version; the schema is pinned by tests and documented | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*UserManagementMigrationTests"`<br>`dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*IdentitySchemaTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*UserAccountTests"` | ✅ |
| 05-06 T1 | Tracer - a fresh invite still works on day 7 and stops 1 ms after (D-13) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*InviteTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*BootstrapManagerHandlerTests"` | ✅ |
| 05-06 T2 | The invite email, the invalid-invite screen and the docs say 7 days (D-13) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailRendererTests"`<br>`npm --prefix web run test -- --run src/modules/admin/pages/AcceptInvitePage.test.tsx` | ✅ |
| 05-07 T1 | Tracer - sign-in and code resend answer one ResendWaitResponse from server to screen (IN-12) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"`<br>`npm --prefix tools/openapi-gen run check`<br>`npm --prefix web run test -- --run src/modules/admin/services/authService.test.ts` | ✅ |
| 05-07 T2 | The breach check refuses oversized answers and the public base URL refuses user info (IN-09, IN-10) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*HibpPwnedPasswordsTests"`<br>`dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AppLinksOptionsTests"` | ✅ |
| 05-07 T3 | The bootstrap guard recognises every loopback form, and the outbox retention rule is written down (IN-07, IN-08) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*BootstrapManagerTests"` | ✅ |
| 05-08 T1 | Tracer - on a phone the drawer slides in and back out with the scrim fading, and the menu button says Open or Close navigation (D-34) | `npm --prefix web run test -- --run src/components/navigation`<br>`npm --prefix web run e2e -- --grep "@motion drawer"` | ✅ |
| 05-08 T2 | The user menu pops in from its anchor and the chevron turns, at every width (D-35) | `npm --prefix web run test -- --run src/components/navigation/UserMenu.test.tsx`<br>`npm --prefix web run e2e -- --grep "@motion user menu"`<br>`npm --prefix web run parity -- --grep "@parity @(navigation\|navigation-gaps)"` | ✅ |
| 05-08 T3 | The shell and Signed-in devices dialogs stay mounted and close with motion (D-39 callers) | `npm --prefix web run test -- --run src/layouts/AdminLayout.test.tsx src/modules/admin/pages/SessionsPage.test.tsx`<br>`npm --prefix web run e2e -- --grep "@motion\|@sessions"`<br>`npm --prefix web run verify` | ✅ |
| 05-09 T1 | Tracer - a staff member saves a new name with the version they loaded and sees it on the next read; a stale version gets 409 (PROF-01, SEC-07) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ProfileEndpointTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"`<br>`npm --prefix tools/openapi-gen run check` | ✅ |
| 05-09 T2 | Two tabs saving at once: exactly one wins, through a reusable two-writer helper (SEC-07) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ProfileConcurrencyTests"` | ✅ |
| 05-10 T1 | Tracer - a Manager-locked or deleted person cannot finish the code step, resend a code, refresh or set a new password (blocked everywhere after sign-in) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*InactiveAccountTests"` | ✅ |
| 05-10 T2 | Link flows refuse blocked accounts, forgot-password stays neutral, and a reset never lifts a Manager lock (D-17, D-41 Q5) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PasswordResetTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ForgotPasswordHandlerTests"` | ✅ |
| 05-10 T3 | The Testing-only staff fixture can create a Manager-locked account for E2E | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*TestingFixturesEndpointTests"`<br>`dotnet test --project tests/Csps.ArchitectureTests --filter-class "*ReleaseHasNoEmailSinkTests"` | ✅ |
| 05-11 T1 | Tracer - saving my name records me and the server clock as the last changer, whatever the request body claims (SEC-08) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ProfileAttributionTests"`<br>`dotnet test --project tests/Csps.ArchitectureTests --filter-class "*LayerTests"` | ✅ |
| 05-11 T2 | The stamping rules in isolation: create, staff edit, bookkeeping write and no-actor writes (SEC-08 edges) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*RecordStampInterceptorTests"` | ✅ |
| 05-12 T1 | Tracer - I change my password on this device; my other device is signed out and I get the notice email (PROF-03) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ChangePasswordTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Idempotency*"` | ✅ |
| 05-12 T2 | Wrong current passwords count toward the lockout; rule failures come back under their fields (D-41 Q9) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ChangePasswordHandlerTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ChangePasswordTests"` | ✅ |
| 05-12 T3 | The password-changed email names other devices for a profile change; the events are documented | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailRendererTests"` | ✅ |
| 05-13 T1 | Tracer - I open My Profile, switch tabs by keyboard with the tab in the URL, and save a new first name (PROF-01, D-23) | `npm --prefix web run test -- --run src/modules/admin/pages/ProfilePage.test.tsx src/modules/admin/hooks/useProfileTab.test.tsx src/modules/admin/services/profileService.test.ts src/modules/admin/profileSchemas.test.ts` | ✅ |
| 05-13 T2 | A stale name save keeps what I typed behind the shared conflict banner, and the shell shows my new name (D-20, SEC-07) | `npm --prefix web run test -- --run src/components/states src/modules/admin/pages/ProfilePage.test.tsx src/layouts/AdminLayout.test.tsx src/components/index.test.ts` | ✅ |
| 05-13 T3 | The Appearance tab and the top bar toggle share one theme; the whole page is proven in three engines (PROF-04, D-22) | `npm --prefix web run test -- --run src/modules/admin src/layouts`<br>`npm --prefix web run e2e -- --grep @profile`<br>`npm --prefix web run verify` | ✅ |
| 05-14 T1 | Tracer - I ask to change my email, open the link sent to the new address, confirm, and from then on sign in with the new email (PROF-02, D-25) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*EmailChangeTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ✅ |
| 05-14 T2 | Unit coverage for the email-change request and confirm handlers (Application coverage) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*EmailChangeHandlerTests"`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-15 T1 | Tracer - with a change waiting, I resend the link and the old one stops working, or I cancel and keep my current email (D-24) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*EmailChangePendingTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*EmailChangePendingHandlerTests"` | ✅ |
| 05-15 T2 | The address was taken before the link was used: a distinct answer, nothing changes, the pending change is cleared | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*EmailChange*"`<br>`npm --prefix tools/openapi-gen run check` | ✅ |
| 05-16 T1 | Tracer - I open the link from my new inbox, see the address, press Confirm New Email and am told my email changed (PROF-02) | `npm --prefix web run test -- --run src/modules/admin/pages/ConfirmEmailPage.test.tsx src/modules/admin/services/profileService.test.ts src/modules/admin/routes.test.tsx` | ✅ |
| 05-16 T2 | Fragment helpers move to utils so no page imports another page (IN-18 part) | `npm --prefix web run test -- --run src/utils/urlFragment.test.ts src/modules/admin/pages`<br>`npm --prefix web run verify` | ✅ |
| 05-17 T1 | Tracer - a Manager lists the staff sorted by name with search and filters, and an Admin is refused (USER-01, USER-08) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListUsersEndpointTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ✅ |
| 05-17 T2 | The user detail shows Recorded by and Last changed by from the actors' own rows, with former staff marked (SEC-08, D-08, D-11) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*GetUserEndpointTests"`<br>`npm --prefix tools/openapi-gen run check` | ✅ |
| 05-17 T3 | Handler and validator unit tests for the roster reads (Application coverage) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*Users*"`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-18 T1 | Tracer - from the Change Email dialog I send a confirmation link, the card shows the pending note, and the link from my new inbox completes the change (PROF-02, D-24) | `npm --prefix web run test -- --run src/modules/admin/components/ChangeEmailDialog.test.tsx src/modules/admin/pages/ProfilePage.test.tsx src/modules/admin/profileSchemas.test.ts src/modules/admin/services/profileService.test.ts`<br>`npm --prefix web run e2e -- --grep @profile-email` | ✅ |
| 05-18 T2 | The Security tab changes my password with every rule checked in the browser first (PROF-03, OR-3) | `npm --prefix web run test -- --run src/modules/admin` | ✅ |
| 05-18 T3 | Browser proof: a password change on one device signs out the other; the whole profile passes axe and the gates (PROF-03) | `npm --prefix web run e2e -- --grep "@profile-password\|@profile-email\|@profile"`<br>`npm --prefix web run verify` | ✅ |
| 05-19 T1 | Tracer - a Manager invites Ana, Ana gets an email saying the Manager set up her account, sets her password and signs in (USER-02, D-12, D-13) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CreateUserEndpointTests"`<br>`dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailRendererTests"` | ✅ |
| 05-19 T2 | The temporary-password route: basic rule, must change at first sign-in, never returned or stored in plain text (C-4, 04 D-21, D-14) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CreateUserEndpointTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CreateUserHandlerTests"` | ✅ |
| 05-19 T3 | Server-set attribution, replay and race safety for create; USER-02 wording amended (SEC-08, SEC-06, C-4) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CreateUserEndpointTests"` | ✅ |
| 05-20 T1 | Tracer - a Manager opens Users and sees every staff member with role, status and invitation badges, the own row linking to My Profile (USER-01, D-19) | `npm --prefix web run test -- --run src/modules/admin/pages/UsersPage.test.tsx src/modules/admin/services/usersService.test.ts src/modules/admin/routes.test.tsx src/components/lists/ResponsiveTable.test.tsx` | ✅ |
| 05-20 T2 | Search, role and status filters, chips and paging live in the URL (WEB-10, USER-01) | `npm --prefix web run test -- --run src/modules/admin/hooks/useUsersListParams.test.tsx src/modules/admin/pages/UsersPage.test.tsx` | ✅ |
| 05-20 T3 | Browser proof: filters survive list to My Profile and Back, Admins are redirected, no sideways scroll (USER-01, USER-08) | `npm --prefix web run e2e -- --grep @users`<br>`npm --prefix web run verify` | ✅ |
| 05-21 T1 | Tracer - a Manager deactivates a colleague who is signed in; the colleague is signed out at once and can no longer sign in; activating lets them back (USER-03, USER-05) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UserLifecycleTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ✅ |
| 05-21 T2 | The last active Manager can never be removed, even by two Managers at the same moment, and nobody can deactivate themselves (USER-04, D-18, D-19) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*LastManagerGuardTests"` | ✅ |
| 05-21 T3 | Unit tests for the guard and the handlers; audit events documented (USER-04, USER-06) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*Users*"`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-22 T1 | Tracer - a Manager adds Ana by invitation from the Users page and sees her row with Invite pending (USER-02, D-12, D-15) | `npm --prefix web run test -- --run src/modules/admin/components/AddUserPanel.test.tsx src/modules/admin/pages/UsersPage.test.tsx src/modules/admin/usersSchemas.test.ts src/modules/admin/services/usersService.test.ts` | ✅ |
| 05-22 T2 | The access choice, the temporary password with New Suggestion, and the shown-once step with Copy Password (C-4, D-14, OQ-10) | `npm --prefix web run test -- --run src/components/entry src/utils/temporaryPassword.test.ts src/modules/admin/components src/components/index.test.ts` | ✅ |
| 05-22 T3 | Browser proof of both routes, including the person's first sign-in (USER-02) | `npm --prefix web run e2e -- --grep @users-add`<br>`npm --prefix web run verify` | ✅ |
| 05-23 T1 | Tracer - a Manager renames a colleague with the version they loaded; a second Manager with the same version gets 409 (USER-03, SEC-07, success criterion 6) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UpdateUserEndpointTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UserEditConcurrencyTests"` | ✅ |
| 05-23 T2 | A role change signs the person out at once, and demoting the last active Manager is refused even under a race (USER-04, USER-05, D-18) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UpdateUserEndpointTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*UpdateUserHandlerTests"` | ✅ |
| 05-24 T1 | Tracer - a Manager locks a colleague who may be at risk; they are signed out, cannot sign in or reset their way back, and are back only after Unlock (D-16, D-17, USER-05) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*LockUserTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ✅ |
| 05-24 T2 | Locking respects the last active Manager and never locks oneself, even under a race (USER-04, D-18, D-19) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*LastManagerGuardTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*LockUserHandlerTests"` | ✅ |
| 05-25 T1 | Tracer - a Manager opens Edit on a colleague, changes the name and role with a sign-out note, and saves (USER-03, USER-05) | `npm --prefix web run test -- --run src/modules/admin/components/EditUserPanel.test.tsx src/modules/admin/pages/UsersPage.test.tsx src/modules/admin/usersSchemas.test.ts src/modules/admin/services/usersService.test.ts` | ✅ |
| 05-25 T2 | Stale saves, guard refusals and a user deleted meanwhile never lose what the Manager typed (D-20, D-18) | `npm --prefix web run test -- --run src/modules/admin/components/EditUserPanel.test.tsx` | ✅ |
| 05-25 T3 | Recorded by and Last changed by with the former-staff hint, the activity link, and the browser proof (SEC-08, D-11) | `npm --prefix web run test -- --run src/components/data src/modules/admin src/components/index.test.ts`<br>`npm --prefix web run e2e -- --grep @users-edit`<br>`npm --prefix web run verify` | ✅ |
| 05-26 T1 | Tracer - a Manager deletes a colleague; they vanish from the roster, are signed out, cannot sign in, and their name stays on what they recorded (D-07, D-08, D-09, D-11) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DeleteUserTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ✅ |
| 05-26 T2 | Deleting respects the last active Manager and never deletes oneself (USER-04, D-18, D-19) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*LastManagerGuardTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*DeleteUserHandlerTests"` | ✅ |
| 05-26 T3 | The outbox never mails a deleted address and forgets the old one; SEC-06 wording notes the DELETE deviation (IN-08 part, D-41 Q4) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailOutboxTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DeleteUserTests"`<br>`npm --prefix tools/openapi-gen run check` | ✅ |
| 05-27 T1 | Tracer - a Manager resends Ana's invitation; the old link dies and the new 7-day link works (USER-07, D-13) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ResendInvitationTests"` | ✅ |
| 05-27 T2 | A Manager sends a reset link the person opens themself; locked or deactivated people get none (USER-07, D-41 Q5) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ManagerResetLinkTests"`<br>`dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailRendererTests"` | ✅ |
| 05-27 T3 | A Manager sets a temporary password; the person is signed out everywhere, notified, and must change it at next sign-in (C-4, 04 D-24, D-14) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*TemporaryPasswordTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*AccountAccessHandlerTests"`<br>`npm --prefix tools/openapi-gen run check` | ✅ |
| 05-28 T1 | Tracer - a Manager deactivates a colleague from the row through the confirm dialog, sees the row turn Inactive, then activates them again with one tap (USER-03, OQ-1, OQ-3) | `npm --prefix web run test -- --run src/modules/admin/components/DeactivateUserDialog.test.tsx src/modules/admin/pages/UsersPage.test.tsx src/modules/admin/services/usersService.test.ts` | ✅ |
| 05-28 T2 | Delete with the shared confirm dialog, focus that lands somewhere sensible, and the guard line when it is refused (USER-03, USER-04, D-09) | `npm --prefix web run test -- --run src/modules/admin/pages/UsersPage.test.tsx` | ✅ |
| 05-28 T3 | Browser proof: the person is signed out at once, the last Manager is protected, and the dialogs close with motion (USER-04, USER-05) | `npm --prefix web run e2e -- --grep @users-actions`<br>`npm --prefix web run verify` | ✅ |
| 05-29 T1 | Tracer - a Manager reads the last 7 days of the audit log, newest first, with who did what to whom (AUDIT-02, D-26, D-28) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuditLogEndpointTests"`<br>`dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AuditActionsTests"` | ✅ |
| 05-29 T2 | Filters by who, what, whom and business-day range, with the kept-window floor (AUDIT-02, D-26) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuditLogEndpointTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ListAuditLogHandlerTests"`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-30 T1 | Tracer - from the Edit panel a Manager locks a colleague through the Lock dialog, sees Unlock take its place, and unlocks them (D-16, U4) | `npm --prefix web run test -- --run src/modules/admin/components/LockUserDialog.test.tsx src/modules/admin/components/EditUserPanel.test.tsx src/modules/admin/services/usersService.test.ts` | ✅ |
| 05-30 T2 | Resend invitation, send a reset link, and set a temporary password shown once (USER-07, C-4, D-14, U5) | `npm --prefix web run test -- --run src/modules/admin/components` | ✅ |
| 05-30 T3 | Email notes and Cancel Email Change in the Edit panel, proven in the browser (C-9, OQ-4) | `npm --prefix web run test -- --run src/modules/admin`<br>`npm --prefix web run e2e -- --grep @users-access`<br>`npm --prefix web run verify` | ✅ |
| 05-31 T1 | Tracer - the preview tool writes every Phase 5 email next to the Phase 4 ones for the owner to open | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailPreviewTests"` | ✅ |
| 05-31 T2 | The owner reviews the Phase 5 emails | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailRendererTests"` | ✅ |
| 05-32 T1 | Tracer - a table row opens and closes its own detail row, stacked inside the card on phones (D-27) | `npm --prefix web run test -- --run src/components/lists` | ✅ |
| 05-32 T2 | Grouped Select options and the DateInput primitive (AUDIT-02 filters) | `npm --prefix web run test -- --run src/components/forms src/components/index.test.ts` | ✅ |
| 05-32 T3 | Managers see an Audit Log item in the sidebar and the drawer; Admins never do (USER-08, OQ-2) | `npm --prefix web run test -- --run src/components/navigation`<br>`npm --prefix web run verify` | ✅ |
| 05-33 T1 | Tracer - a Manager opens the Audit Log, sees the last 7 days newest first, and expands an entry to read what changed, the IP, the device and the reference (AUDIT-02, D-27, D-40) | `npm --prefix web run test -- --run src/modules/admin/pages/AuditLogPage.test.tsx src/modules/admin/components/AuditDetail.test.tsx src/modules/admin/auditCopy.test.ts src/modules/admin/services/auditLogService.test.ts src/modules/admin/routes.test.tsx` | ✅ |
| 05-33 T2 | Date range, Done by, Action and Done to filters in the URL (D-26, WEB-10) | `npm --prefix web run test -- --run src/modules/admin/hooks/useAuditListParams.test.tsx src/modules/admin/pages/AuditLogPage.test.tsx` | ✅ |
| 05-33 T3 | Browser proof: find a user-management action by filters, Back restores them, Admins are redirected (AUDIT-02, success criterion 5) | `npm --prefix web run e2e -- --grep @audit`<br>`npm --prefix web run verify` | ✅ |
| 05-34 T1 | Tracer - a reset or invite acceptance during a slow breach check holds no database transaction (IN-05) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*AcceptInviteHandlerTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ResetPasswordHandlerTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PasswordResetTests"` | ✅ |
| 05-34 T2 | Dead members gone, safe ToString, accurate summaries (IN-01, IN-03, IN-06) | `dotnet test --project tests/Csps.Application.UnitTests`<br>`dotnet test --project tests/Csps.Server.IntegrationTests`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-35 T1 | Tracer - a Manager opens /admin/components on the live build and sees the showcase with the Demo data badge and banner; an Admin is sent to /admin (D-30, D-31, D-32) | `npm --prefix web run test -- --run src/modules/admin src/dev`<br>`npm --prefix web run e2e -- --grep @showcase` | ✅ |
| 05-35 T2 | The production build keeps the showcase lazy and isolated and proves its chunk holds no secrets (D-33, D-41 Q3) | `npm --prefix web run test -- --run scripts/budget.test.ts src/test/build-output.node.test.ts`<br>`npm --prefix web run build:budget` | ✅ |
| 05-36 T1 | Tracer - after a failed refresh and a peer-tab refresh, a later 401 still signs the tab out (IN-13, IN-19) | `npm --prefix web run test -- --run src/modules/admin/services/session.test.ts` | ✅ |
| 05-36 T2 | Return paths are validated exactly as returned, the resend announcement follows the server, and dead copy is gone (IN-14, IN-16, IN-15) | `npm --prefix web run test -- --run src/modules/admin/guard.test.ts src/modules/admin/pages/VerifyCodePage.test.tsx src/modules/admin` | ✅ |
| 05-36 T3 | One set-password form helper for the three screens and one E2E origin (IN-18, IN-11) | `npm --prefix web run test -- --run src/modules/admin`<br>`npm --prefix web run e2e -- --grep "@auth"`<br>`npm --prefix web run verify` | ✅ |
| 05-37 T1 | Tracer - every new Phase 5 screen passes the no-sideways-scroll, long-text and dialog-fit sweeps in three engines and on phones | `npm --prefix web run e2e -- --grep "@shell\|@long-text"` | ✅ |
| 05-37 T2 | Records and the full local gate: review-note dispositions, the validation map, the API guide and the owner review pack | `dotnet test --solution Csps.slnx`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1`<br>`npm --prefix web run verify`<br>`npm --prefix web run test -- --run scripts/owner-review.test.ts`<br>`dotnet list Csps.slnx package --vulnerable --include-transitive`<br>`npm --prefix web audit --audit-level=high` | ✅ |
| 05-37 T3 | The owner reviews Phase 5 and rules the open items | `git status --porcelain artifacts/` | ⬜ owner |
| 05-38 T1 | Tracer - A name change is audited with field names only; a save that changes nothing writes nothing (USER-06, D-40) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*UpdateProfileNameHandlerTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ProfileEndpointTests"`<br>`dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AuditActionsTests"` | ✅ |
| 05-38 T2 | Unit coverage for the profile read and the name validator (Application coverage) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*Profile*"`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-39 T1 | Tracer - The request checks my current password like a password change, refuses my own or a taken address, and replaces an older pending change (D-24, D-41 Q9) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*EmailChangeTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ChangePasswordTests"`<br>`dotnet test --project tests/Csps.Application.UnitTests --filter-class "*EmailChangeHandlerTests"` | ✅ |
| 05-39 T2 | The link check for the confirm page, one invalid answer for every dead link, rendered emails and docs (D-25) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*EmailChangeTests"`<br>`dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailRendererTests"`<br>`npm --prefix tools/openapi-gen run check`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-40 T1 | Tracer - A Manager changes a colleague's email the C-9 way, or cancels a pending change (C-9, OQ-4) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ManagerEmailChangeTests"`<br>`dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*EmailRendererTests"`<br>`npm --prefix tools/openapi-gen run check` | ✅ |
| 05-40 T2 | Unit coverage for the Manager email branches and the cancel handler (Application coverage) | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*UpdateUserHandlerTests"`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-41 T1 | Tracer - a Manager gets the people list for the audit filters, former staff last (AUDIT-02, D-11) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuditLogEndpointTests"`<br>`npm --prefix tools/openapi-gen run check` | ✅ |
| 05-41 T2 | How Managers read the audit log is documented, and coverage holds (AUDIT-02, D-29, D-40) | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |
| 05-42 T1 | Tracer - the showcase gains a 'Staff and audit' section with the new primitives and roster rows in every state (UI-SPEC C1) | `npm --prefix web run test -- --run src/modules/admin/components/showcase` | ✅ |
| 05-42 T2 | The panels, dialogs and profile tabs are live demos too, proven in the production showcase (UI-SPEC C1) | `npm --prefix web run e2e -- --grep @showcase`<br>`npm --prefix web run verify` | ✅ |
| 05-43 T1 | Tracer - every auth handler writes its audit words and keys from one source, and the stored entries are unchanged (IN-02) | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AuditActionsTests"`<br>`dotnet test --project tests/Csps.Server.IntegrationTests` | ✅ |
| 05-43 T2 | One link lookup, one empty-password message, and list messages that follow the caps (IN-02, IN-04) | `dotnet test --project tests/Csps.Application.UnitTests`<br>`powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | ✅ |


*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Gap-closure verification map (plans 05-44 to 05-52, 2026-10-19)

| Plan | Gap | Automated verification | Status |
|------|-----|------------------------|--------|
| 05-44 | CR-01 Sign Out Other Devices on every use; Resend Code sibling | `npm --prefix web run test -- --run src/modules/admin/components/SignOutOthersDialog.test.tsx src/modules/admin/pages/SessionsPage.test.tsx src/modules/admin/pages/VerifyCodePage.test.tsx`; `npm --prefix web run e2e -- --grep @session-menu` | ✅ |
| 05-45 | WR-01 reset links end on temporary password, password change, at-once email move | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*TemporaryPasswordTests"` (also `*ChangePasswordTests`, `*ManagerEmailChangeTests`) | ✅ |
| 05-46 | D-49 temporary-password address unproved until the first correct code | `--filter-class "*CreateUserEndpointTests"`, `"*SignInHandlerTests"`, `"*VerifyCodeHandlerTests"` | ✅ |
| 05-47 | D-49 no reset link to an unproved address | `--filter-class "*ManagerResetLinkTests"`, `"*ForgotPasswordTests"`, `"*AccountAccessHandlerTests"` | ✅ |
| 05-48 | WR-05/WR-14 one active-Manager rule; WR-08 unreachable bootstrap host | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*BootstrapManagerTests"` (also `*UserAccountsTests`) | ✅ |
| 05-49 | D-50 keyed idempotency hash and bounded purge | `--filter-class "*IdempotencyRequestHasherTests"`, `"*IdempotencyTests"` | ✅ (purge-failure path has no test; recorded as human judgment) |
| 05-50 | WR-20 tap areas: menu button, sidebar toggle, chip clear | `npm --prefix web run e2e -- --grep @target-size`; `button.recipe.node.test.ts` | ✅ |
| 05-51 | WR-20 row actions (D-51 space) and roster sweep | `npm --prefix web run e2e -- --grep @target-size`; `npm --prefix web run parity -- --grep "@parity @(navigation|layouts-admin|lists)"`; `rulings.test.ts` | ✅ |
| 05-52 | WR-09 profile password rate limit and discovery guard | `--filter-class "*RateLimitTests"` | ✅ |

---

## Wave 0 Requirements

- [x] Migration `AddUserManagement` + `IdentitySchemaTests` additions (new columns, FK, no JSON, no trigger)
- [x] `tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs` (D-06)
- [x] `tests/Csps.Server.IntegrationTests/Users/*` (list, create, lifecycle, guard concurrency, edit concurrency, attribution, revocation, resend/reset)
- [x] `tests/Csps.Server.IntegrationTests/Profile/*` (name, password, email change)
- [x] `tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs`
- [x] A two-client concurrency helper (barrier + `Task.WhenAll`) in `Csps.Testing`
- [x] Matrix rows for every new action; `IdempotencyCoverageTests` entries (or exemptions with reasons) for the new POSTs
- [x] Web: MSW handlers for users/profile/audit services; `usePresence` tests; shell `@shell` E2E specs


---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production refresh-cookie `Expires` only with "Keep me signed in" | Phase 4 carry-over | Needs the first HTTPS production deploy | Sign in on the live site with and without the box ticked; check `__Secure-csps_rt` Set-Cookie for `Expires` |
| Email-change link and old-address notice arrive in a real inbox | PROF-02 | Real SMTP delivery | Change email on a dev account with SMTP configured; confirm both mails |
| Motion feels right (drawer, user menu, dialogs) on a real phone | D-34, D-35, D-39 | Subjective feel; automated tests cover state and reduced motion | Open/close each on a phone, then with reduced motion on |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] the Nyquist flag is set to true in the frontmatter

**Approval:** executor-checked 2026-10-18 (plan 05-37, every test in the map exists and the full local gate passed); owner sign-off of the screen review is the open checkpoint of plan 05-37

## Validation Audit 2026-10-19

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Audited 2026-10-18 (evening, Manila business date; heading is UTC) by /gsd-execute-phase 5 verify gates: every mapped test class and file exists; the full .NET suite (3,250 passed, 1 skipped), web `verify` (5,450 of 5,450, after quick 261018-st8 raised the class-gate sweep budget) and E2E (993 passed, 37 skipped, 1 Firefox load flake that passes alone) ran green. Nyquist compliance holds. CR-01 (05-REVIEW.md) is a behavior defect with no covering test, so it is tracked as a verification gap, not a sampling gap.

## Validation Audit 2026-10-19

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Gap plans mapped | 9 |
