---
created: "2026-10-17T16:15:00-05:00"
updated: "2026-10-17T16:15:00-05:00"
phase: 05-profile-user-management
kind: research
---

# Phase 5: Profile & User Management - Research

*Created: 2026-10-17T16:15:00-05:00 · Updated: 2026-10-17T16:15:00-05:00*

**Researched:** 2026-10-17 (after `/gsd-discuss-phase 5` and the approved `05-UI-SPEC.md`; includes the owner additions D-34..D-38)
**Domain:** ASP.NET Core Identity user administration (soft delete, Manager lock, race-safe last-Manager guard, optimistic concurrency, record attribution), an append-only audit-log viewer, React profile/roster/audit screens, the full-bleed sticky admin shell with phone motion, and an evaluation of shadcn/ui under the project's strict CSP and class gate.
**Confidence:** HIGH for codebase facts, package versions, publish dates, advisories and the browser behaviour that was probed in this session (Playwright 1.63 engines). MEDIUM for EF Core / Identity internals not read from source this session. LOW items are listed in the Assumptions Log.

## Summary

Phase 5 is mostly a backend-plus-screens phase built from parts that already exist. The Identity store (`ApplicationUser`, `UserAccounts`), account tokens, session revocation with cache eviction, the audit trail, the idempotency gate, the authorization matrix, the in-house Modal/slide-over, Tabs, ConfirmDialog, MobileNavDrawer and UserMenu are all in place and pass parity, axe and CSP gates. The new work is: a schema migration on `AspNetUsers` (attribution, edit version, Manager lock, soft-delete marker, pending email), a Users controller, a Profile controller, an Audit Log controller, an email-change token purpose, a transaction-owned `sp_getapplock` for the last-Manager guard, a SEC-08 stamping point, and the screens in the UI-SPEC.

Three findings change how the planner should approach the owner's new items. **First, the phone tab bar bug is a height-chain bug only.** A probe in Chromium 153, Firefox 155 and WebKit 26.6 shows that `container-type: inline-size` (the page root's `@container/pg`) does **not** make the page root the containing block of `position: fixed` descendants, so the comment in `navigation.recipe.ts` is out of date. The bar floats because `min-h-full` resolves against an auto-height `#root`; `min-h-dvh` on the shell plus the existing `sticky bottom-0 mt-auto` pins it on both short and long pages (probe output below). **Second, shadcn/ui does not fit this project without heavy rework.** Radix Dialog's Overlay and DropdownMenu (modal by default) inject a `<style>` element through `react-style-singleton`, which the project's `style-src 'self'` blocks with a console error in all three engines (probed). shadcn's class strings use the default Tailwind palette and scales that `--*: initial` removes, so every copied file fails the class gate. Its `cn()` helper (`tailwind-merge`) silently drops `font-display` when `font-heavy` follows it (probed). Radix's scroll-lock chain also pulls `tslib` (0BSD) into the runtime scope, which the license gate allows today only for tools. **Third, D-34's "lines morph to X" is not visible with today's drawer,** because the drawer's scrim and 248px panel cover the top bar's menu button. The morph needs the drawer to open below the pinned top bar (recommended) or a close button inside the drawer.

**Primary recommendation:** Build Phase 5 with the existing stack and **no new package**. Do D-34/D-35 motion with theme keyframes plus a small in-house presence hook. Fix D-01/D-36 with a `min-h-dvh` height chain applied by the real layouts only (previews and parity keep App. C's `min-height: 100%`). Do the last-Manager guard with a transaction-owned `sp_getapplock`. Record D-37 in the docs as the owner requires, and offer shadcn per component later (Phase 6+ combobox or date picker) behind the package gate. If the owner still wants Radix now, the only CSP-safe uses are Tabs, a non-modal Popover, and a Dialog rendered without `Dialog.Overlay`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Own name, email, password change (PROF-01..03) | API / Backend | Browser (zod mirror, OR-3) | Identity, current-password check, session revocation and email all live server-side; the browser only pre-validates |
| Theme (PROF-04) | Browser / Client | none | D-22: `localStorage['csps-theme']`, no API |
| Roster list, search, filters, paging (USER-01) | API / Backend | Browser (nuqs URL state, WEB-10) | Server sorts, filters and caps; the URL holds only parsed params |
| Add / edit / lock / deactivate / delete (USER-02..05, 07) | API / Backend | Browser | Guards (D-18, D-19), revocation and audit must be server-enforced |
| Last-Manager guard (USER-04, race-safe) | Database / Storage | API | The lock must be held in the SQL transaction (`sp_getapplock`), not in app memory (single process today, but correctness must not depend on it) |
| Manager-only access (USER-08) | API / Backend | Browser (route loader redirect, nav hiding) | 403 from the Manager policy is the guarantee; the UI hiding is convenience |
| Audit-log viewer (AUDIT-02) | API / Backend | Browser | Filtering and paging over `AuditLog` server-side; detail rendered as text nodes |
| SEC-07 conflict detection | Database / Storage | API, Browser (ConflictBanner) | Concurrency token compared in the UPDATE's WHERE clause |
| SEC-08 attribution | API / Backend (one EF stamping point) | Database (FK columns) | Values come from the token's `sub` and `TimeProvider`, never from DTOs |
| Full-bleed sticky shell, tab bar, motion (D-01..D-05, D-34..D-38) | Browser / Client | CDN / Static (CSS only) | Pure CSS and React; no server change |
| Component showcase in production (D-30..D-33) | Browser / Client | none (no API calls) | Static demo data in a lazy chunk; the route guard is a loader redirect, and static assets stay public, so the chunk holds no secrets |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward (already ruled, not re-asked)
- **C-4 (04 D-21, D-23):** Add user offers both an emailed invitation and a Manager-set temporary password. The temporary password is prefilled with a random readable value the Manager may edit (basic rule only), and the user must replace it at first sign-in (04 D-13). Setting one revokes all of that user's sessions and emails them (04 D-24). Amend USER-02's wording to allow the temporary-password route.
- **C-9 (04 D-28):** An email change sends a confirmation link to the new address and a notice to the old one, and applies only after confirmation.
- **C-35 (02 D-02):** Inactive roster rows are muted but readable: a softer background plus the neutral `Inactive` badge, with all text at least 4.5:1. No opacity fade.
- **C-17 (04 D-06):** Screens the design doesn't draw are composed from existing parts and marked `// SPEC-GAP:`. In this phase that means the email-change confirmation and the audit log.
- **OD-14:** Design-vs-WCAG clashes are ruled item by item in `/gsd-ui-phase 5`.
- **04 D-02:** A Manager lock and a deactivation both produce the same generic sign-in error as a wrong password.

#### Owner rules from this request (2026-10-17)
- **D-01 Full-bleed shell:** Every layout (public, auth and admin) fills the whole viewport even when the content is short. No page-background strip below the shell (the owner's `/admin/sessions` screenshot shows a peach band under the content). The fix belongs in the shared root and layout height chain, not per page.
- **D-02 Sticky admin navigation:** On tablet and desktop, the admin sidebar stays visible however far the page scrolls. The top bar (search, theme, user menu) is pinned too, so only the content area scrolls.
- **D-03 Short screens:** If the viewport is too short for every sidebar item (a small laptop or browser zoom), the nav list scrolls on its own inside the pinned sidebar, with the user card and Logout kept at the bottom. Nothing gets cut off, and the page never scrolls sideways.
- **D-04 Phones:** The slide-out drawer stays as it is. The top bar with the menu button is pinned.
- **D-05 Horizontal clipping bug:** The owner's `/dev/components` screenshot shows sidebar labels cut off on the left ("rd", "Expenses"), so the shell can scroll sideways. Fix it with D-01..D-03 and add a test that the shell never scrolls horizontally from 320 to 1920 px.
- **D-06 No new SQL triggers:** From now on, no migration, script or tool creates a database trigger. The existing `TR_AuditLog_AppendOnly` (01 D-32) stays as the audit log's database-level append-only guarantee. Enforce it with a schema test that lists `sys.triggers` and fails on any trigger other than `TR_AuditLog_AppendOnly`. Record the rule in both CLAUDE.md files as an owner rule. Guards that might have used a trigger are done in application code or with constraints. — **Reversibility:** reversible — the test and the rule are text.

#### Deleting a user (C-41)
- **D-07:** Delete is a **soft delete**. The `AspNetUsers` row stays with its first and last name. The email (and normalized email/username) is scrambled to a unique non-deliverable value, sign-in is blocked, all sessions and outstanding account tokens (invite, reset, email change) are revoked, and the row is marked deleted with a UTC timestamp. — **Reversibility:** one-way — needs a migration for the deleted marker, and scrambled emails can't be recovered.
- **D-08:** "Recorded by" and "Last changed by" (SEC-08) are foreign keys to the user row. The name shown comes from that row, so a later name fix appears everywhere. No name-snapshot columns.
- **D-09:** Delete is **final in the UI**. There is no Restore and no "Deleted" filter for undoing it. Deactivate is the reversible action. Deleted users are excluded from the roster list.
- **D-10:** Scrambling frees the email, so the same person can be re-invited later as a new account. The old row stays separate.
- **D-11:** Wherever a deleted user is shown as an actor ("Recorded by", "Last changed by", the audit log), show their name plus a muted "(former staff)" hint. The final copy is reviewed in `/gsd-ui-phase 5`.

#### Add user / onboarding
- **D-12:** The Add user dialog opens with **"Email an invitation"** selected. "Set a temporary password" is the other choice in the same dialog.
- **D-13:** Invitation links last **7 days**: change `AuthSettings.InviteLinkLifetime` from 72 h to 7 days. This also applies to the `bootstrap-manager` invite, since both use the one setting. A Manager can resend an invitation (USER-07), which replaces the old token.
- **D-14:** A temporary password is shown **once** on the success step, with a Copy button. It's never shown again and never stored in plain text. If it's lost, the Manager sets a new one.
- **D-15:** The role field is preselected to **Admin**, so choosing Manager is always a deliberate choice.

#### Lock vs deactivate, guard rules
- **D-16:** A Manager **Lock** has no timer: the user stays blocked until a Manager unlocks them. It's separate from the 15-minute failed-password lockout (04 D-25, `AuthSettings.PasswordLockoutDuration`). Deactivate means "no longer works here". Lock, unlock, deactivate, reactivate, role change and delete all revoke the user's sessions at once (USER-05).
- **D-17:** A self-service password reset clears only the failed-password lockout (04 D-19). It never clears a Manager lock or a deactivation.
- **D-18:** For the last-Manager guard (USER-04), an **active Manager** is one who is not deactivated, not deleted and not Manager-locked. A failed-password lockout doesn't count. The guard covers demote, lock, deactivate and delete, and it must be race-safe: two simultaneous attempts can never leave zero active Managers. Use a serializable or locking check in the transaction, **not a trigger** (D-06).
- **D-19:** A Manager can't lock, deactivate, demote or delete **themselves**. They change their own name, email and password through My Profile.

#### Stale-save conflicts (SEC-07)
- **D-20:** When a **form save** gets 409, the form keeps the user's typed values and shows the banner "This was changed by someone else. Reload and try again." with a **Load latest** button. Pressing it replaces the form with the server's current version. The edits are never thrown away silently. This is the shared pattern for every later aggregate form.
- **D-21:** Only form saves carry the row version. Single-click roster actions (lock, unlock, deactivate, reactivate, delete, resend invite, send reset link) act on the latest state. The D-18 guard still runs inside their transaction. The two-writer integration test (success criterion 6) covers the user edit form.

#### Theme and My Profile
- **D-22:** The theme stays **per browser** in `localStorage['csps-theme']` (PROF-04). There's no account column or API call, and the public site stays light.
- **D-23:** My Profile uses **tabs**: Details (name, email), Security (password, plus a link to Signed-in devices `/admin/sessions`) and Appearance (theme). Each tab's form saves on its own. The tabs are accessible (the ARIA tabs pattern, keyboard arrows), and the active tab lives in the URL (WEB-10).
- **D-24:** While an email change is pending, Details shows the current email plus a note "Waiting for confirmation at new@…", with **Resend** and **Cancel**. Sign-in keeps using the old email until the link is confirmed. Starting a new change replaces the pending one.
- **D-25:** The email-change confirmation link lasts **24 hours**, is single-use and is hashed (the same `AccountTokens` machinery, with a new purpose).

#### Audit-log viewer (AUDIT-02)
- **D-26:** Manager-only. It opens on the **last 7 days**, newest first, and the range can be widened to everything kept (8 months, 01 D-32). The filters (actor by user id, action, target, date range) and the page live in the URL.
- **D-27:** Each row is a summary (when in Manila time, who, action, target) and **expands** to show the detail (for example "Role: Admin to Manager"), the truncated IP (/24 or /48) and the device. On phones the expanded detail stacks.
- **D-28:** It shows **every** audited event, including sign-in, 2FA, lockout, reset and session events, not only user management.
- **D-29:** Export is **not** in Phase 5 (deferred).

#### Component showcase on the live site (owner-added scope)
- **D-30:** The component showcase (`web/src/dev/ComponentShowcase.tsx`, now at `/dev/components`) ships to the live site so the owner can show it to someone from their day job **from the owner's own Manager session**. No account is created for that person. The showcase stays permanently as a living style guide. — **Reversibility:** reversible — remove the route.
- **D-31:** It opens at a direct link inside the admin portal (e.g. `/admin/components`), behind sign-in and the **Manager** policy. Admins are redirected like `/admin/users` (USER-08). It is **not** in the sidebar.
- **D-32:** A visible **"Demo data"** banner sits on every showcase page, so sample orders, names and totals can't be mistaken for real records.
- **D-33:** This is a narrow exception to 02 D-20 (dev code out of server builds). Only the showcase and the modules it needs go into the production build, as a lazy admin chunk. Everything else stays dev-only: the dev scenarios, the parity entry and the unguarded section previews. The showcase must meet the production rules: strict CSP (no inline style or script), zero console warnings, zero axe violations, and the admin bundle budget (≤ 250 KB gz initial; the showcase must be lazy so it doesn't count toward it). Its static JS chunk holds only demo data and no secrets, because static assets are public even when the route is guarded.

#### Phone shell polish and shadcn (owner, plan-phase request 2026-10-17)
- **D-34 Hamburger animation:** On phones, the top-bar menu button animates when the drawer opens and closes (the three lines morph to an X and back, and the drawer slides in from the left with the scrim fading). Its accessible name and `aria-expanded` follow the state. Nothing moves under `prefers-reduced-motion`. This refines D-04: the drawer's content and behavior stay the same, only the motion is new.
- **D-35 User-menu animation:** On phones, tapping the staff member's avatar and name in the top bar opens the user menu with an animation (the popover fades and scales in from its anchor, and the chevron turns 180°). Closing reverses it. Nothing moves under `prefers-reduced-motion`. Focus handling, Escape and outside-click stay as they are.
- **D-36 Tab bar pinned to the bottom:** The phone tab bar (Dashboard, Orders, Expenses, Profile) always sits at the bottom of the viewport (`bottom-0`), whatever the content height. The owner's screenshot of a short page ("Page not found") shows it floating mid-screen with empty page below it. Content is never hidden behind the bar (bottom padding matches its height plus the safe-area inset), and a test pins it to the viewport bottom on a short page and a long page at 320-767 px. This lands with D-01's height chain.
- **D-37 shadcn allowed:** The owner allows shadcn/ui for this project. This is an owner exception to the CLAUDE.md "Forbidden: any UI kit" rule and to UI-SPEC §0 rule 1, recorded in both CLAUDE.md files, PROJECT.md and the UI-SPEC registry table. shadcn copies component source into the repo (MIT), so components live inside the OR-6 tree (`web/src/components/...`, never a new top-level `ui/` folder; `web/src/ui` stays the theme) and follow OR-2, OR-4 and the strict CSP. Every package it pulls in (for example Radix primitives, `class-variance-authority`, `tailwind-merge`) still goes through the normal gate: exact version, license, 14-day cool-down, advisory check, the RESEARCH.md record and the owner's OK per package (memory: package approval). Use it where it earns its place (the drawer, popover and dialog motion in D-34/D-35, and the Phase 5 dialogs and tabs if it beats the in-house parts), never to restyle away from the UI-SPEC look. — **Reversibility:** costly — copied components are easy to remove, but every screen built on them would need rework.
- **D-38 Motion rules:** All new motion is CSS transitions or keyframes from the theme (no animation library unless it passes the D-37 gate), 150-250 ms, no layout shift (CLS < 0.05), and honors `prefers-reduced-motion`.

### Claude's Discretion
- The exact deleted-marker shape (a nullable `DeletedAtUtc` vs a status enum value), as long as D-07..D-11 hold and the roster's status filter stays Active, Inactive, Locked.
- The scrambled-email format, which must be unique, non-deliverable and pass Identity validation.
- How the full-bleed height chain is built (`html`, `body`, `#root`, `min-h-dvh` and so on), and whether sticky uses `position: sticky` or a fixed-height grid with an inner scroll area, as long as D-01..D-05 hold and the skip link and focus order still work.
- Triage order of IN-01..IN-19, which is test-first where behavior changes, per the roadmap.

### Deferred Ideas (OUT OF SCOPE)
- **Audit-log CSV export** of the current filter (itself audited): a later phase, possibly Phase 14 release readiness or a reporting phase.
- **Theme saved on the account across devices:** declined for now (D-22). Revisit if staff ask for it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | Any signed-in user can update their first and last name | Profile controller `PUT /api/v1/profile` with edit version (SEC-07 pattern); session-user refresh after save (§ Architecture → Profile) |
| PROF-02 | Email change after current password; link to new, notice to old; applies on confirm ⚑ C-9 | New `AccountTokenPurpose.EmailChange = 3`, 24 h lifetime, pending email on the user row, explicit confirm button page (§ Email change) |
| PROF-03 | Password change with current password; policy; other sessions revoked; email | Reuse `PasswordRules` (full rule incl. HIBP), `ISessions.RevokeAllAsync` except current `sid`, `PasswordChanged` audit, password-changed email (§ Profile) |
| PROF-04 | Theme toggle persists in `localStorage['csps-theme']`; public stays light ⚑ C-11 | Existing `theme.ts`; lift theme state so Appearance tab and Topbar share one setter (outlet context) |
| USER-01 | List with paging, search name/email, role and status filters; URL state | `GET /api/v1/users` with `ListQueryRules`; `useUsersListParams()` on `createListParams` (§ Roster query) |
| USER-02 | Create user without the Manager seeing the password (invite) ⚑ C-4 | Invite route reuses `BootstrapManagerHandler` token + outbox pattern; temporary route sets must-change (04 D-13), shown once (D-14) |
| USER-03 | Edit name/email/role, lock/unlock, deactivate/reactivate, delete with confirm; names remain ⚑ C-41 | Soft delete (D-07), FK attribution (D-08), Manager lock column (D-16) (§ Data model) |
| USER-04 | No self delete/deactivate/demote; never remove last active Manager (race-safe) | `sp_getapplock` on one resource inside the transaction + count under the lock; two-writer test (§ Pattern 2) |
| USER-05 | Role/status changes revoke sessions immediately | `ISessions.RevokeAllAsync` + `ISessionCache.EvictUserAsync` after commit (Phase 4 pattern) |
| USER-06 | All user-management actions audited | New `user.*` / `profile.*` action codes in `AuditActions`, no PII in detail (§ Audit) |
| USER-07 | Resend invitation or send reset link | Resend: revoke open invitation tokens + new 7-day token (D-13); reset: reuse forgot-password issuance with a Manager-route email |
| USER-08 | Non-Managers never see Users nav; `/admin/users` redirects; API 403 | `[Authorize(Policy = Policies.Manager)]` + matrix rows; route `loader` `redirect('/admin')` (never `<Navigate>`) |
| AUDIT-02 | Manager views audit log filtered by actor, action, target, date range; URL state; actor by id | `GET /api/v1/audit-log` over `AuditLog` + `IBusinessCalendar` day bounds; `useAuditListParams()` (§ Audit viewer) |
| SEC-07 | Two writers never both succeed; 409 + banner + reload; two-writer test | Dedicated `EditVersion` concurrency token on users (bookkeeping does not bump it); `ConflictBanner` (§ Pattern 3) |
| SEC-08 | CreatedBy/At, UpdatedBy/At set by server; forged values ignored; "System" for old rows | Nullable FK columns + one stamping point; integration test sends forged fields (§ Pattern 4) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives the planner must verify each plan against (root `CLAUDE.md` and `.claude/CLAUDE.md`):

- **Shared machine:** ports Vite 5180, API 5115/7028, E2E 5199 (`reuseExistingServer: false`); never 5173/5023/5099 or 49152-65535. Run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before a dev server, Playwright or a full test run; never kill another project's processes.
- **LocalDB (OR-1):** default instance with `CSPS_*` databases only; cleanup drops only `^CSPS_Test_[0-9a-f-]{36}$`; never touch `BetsLLC_*`. `CSPS_TEST_SQL=localdb|container` per process only. No Docker locally.
- **Never set** environment variables at User/Machine level.
- **Free only;** licenses MIT, Apache-2.0, BSD, ISC plus recorded exceptions (0BSD is recorded for the `tool` scope only). Never GPL/AGPL/SSPL/commercial.
- **Forbidden packages:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit (owner exception D-37 for shadcn, per package), `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **New dependencies:** purpose, license, maintenance, legitimacy check in RESEARCH.md; **14-day cool-down**; owner OK per package.
- **Architecture:** Onion enforced by ArchUnitNET; no mediator; one handler per use case; `Result<T>` → RFC 9457 ProblemDetails; one `[ApiController]` per resource; explicit `[Authorize(Policy=...)]` or `[AllowAnonymous]`; `SuppressModelStateInvalidFilter`; validation in handlers; authorization-matrix rows for every action × {anonymous, Admin, Manager}.
- **Schema:** EF migrations only; no JSON columns; drops/renames/lossy changes ask the owner; reviewed idempotent scripts for production; no `Database.Migrate()` at startup. **OR-7 / D-06: no SQL triggers** except `TR_AuditLog_AppendOnly` (already recorded in both CLAUDE.md files on 2026-10-17).
- **Time and money:** UTC storage + `TimeProvider` / `IBusinessCalendar`; never `DateTime.Now`.
- **Quality:** TDD; zero warnings (build, analyzers, lint, types, tests, browser console); coverage Domain 100%, Application ≥ 95%, `core/api` 100%, web ≥ 90%.
- **Security:** CWE Top 25 review; strict CSP with no `unsafe-inline`/`unsafe-eval`; default-deny; append-only audit; no secrets or data in git (the repo is public).
- **A11y:** WCAG 2.2 AA; zero axe violations (component and page).
- **Perf:** public JS ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz; LCP < 2.0 s (report-only until Phase 11), CLS < 0.05, INP < 200 ms.
- **Responsive:** 320-1920 px, touch targets ≥ 44 px, no horizontal scroll.
- **Web conventions:** OR-2 minimal comments; OR-3 zod mirrors every server rule; OR-4 no em/en dash in `web/src` (use `EmptyValue` for empties); OR-5 per-module services, only `core/api/http` touches `fetch`; OR-6 the owner tree (`web/src/ui` is the theme).
- **Merges (D-08):** only `tools/scripts/Merge-PullRequest.ps1`, only on the owner's instruction.
- **Workflow:** `/gsd-plan-phase 5 --tdd`; `/gsd-secure-phase 5` and `/gsd-ui-review 5` before `/gsd-ship 5`. Every `.md` created or edited carries `Created/Updated` timestamps.

## Standard Stack

**No new package is recommended for Phase 5.** Everything below is already installed and approved.

### Core (installed, verified in `web/package.json` and `Directory.Packages.props` this session)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | 10.0.13 | Users, roles, password hashes, security stamp | Already the account store (`AddIdentityCore`) |
| Microsoft.EntityFrameworkCore.SqlServer / Design | 10.0.13 | Migration for the new user columns, queries | Project standard |
| FluentValidation | 12.1.1 | Request validators run in handlers | Project standard (no `.AspNetCore` package) |
| react 19.3.0 / react-router 8.4.0 | as pinned | Screens, loaders (`redirect()`) | Project standard |
| @tanstack/react-query 5.103.2 | as pinned | Lists, detail fetch, invalidation | WEB-08 |
| nuqs 2.10.1 | as pinned | URL list state (WEB-10) | Owner-approved; note 2.10.2 cool-down was due 2026-10-22, owner OK still needed before switching |
| react-hook-form 7.89.0 + zod 4.6.5 + @hookform/resolvers 5.9.1 | as pinned | Forms, OR-3 mirrors | Project standard |
| lucide-react 1.53.0 | pinned (owner cool-down waiver D-11, pin D-34, recorded in `web/.npmrc`) | The six new icons (`copy`, `lock-open`, `key-round`, `user-x`, `user-check`, `history`) | Named imports through `icons.ts` |
| clsx 2.1.1 | as pinned | Class composition | Already used everywhere; replaces shadcn's `cn()` |

### Supporting (tests, installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xunit.v3 4.0.1 + Shouldly 4.3.0 + NSubstitute 6.2.0 | as pinned | .NET unit and integration tests | Every handler and endpoint |
| Microsoft.Extensions.TimeProvider.Testing 10.10.0 | as pinned | `FakeTimeProvider` for token lifetimes (7 d, 24 h) | Handler tests |
| Respawn 7.0.0 | as pinned | DB reset (ignores `AuditLog`, `__EFMigrationsHistory`, `SiteSettings`) | Integration tests |
| Vitest 5.0.1, RTL, user-event, MSW 3.0.1 | as pinned | Component and service tests | Every screen |
| @playwright/test 1.63.0 + @axe-core/playwright 4.13.0 | as pinned | Shell geometry (D-01, D-02, D-05, D-36), E2E, axe | Shell and screen specs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-house Modal (slide-over), Tabs, ConfirmDialog, MobileNavDrawer, UserMenu | shadcn Sheet / Dialog / Tabs / DropdownMenu / Popover (Radix) | Blocked by CSP (`<style>` injection) unless Overlay is omitted and menus are non-modal; every class string must be rewritten for the class gate; portals break `data-theme` and the `pg` container; ~30-45 KB gz into the admin initial chunk; parity rework. See § shadcn evaluation. |
| `sp_getapplock` for the last-Manager guard | `SERIALIZABLE` transaction with a count | Serializable on two concurrent demotes produces a deadlock victim (error 1205) that must be retried or mapped; the applock serializes cleanly and is already the project's one reviewed raw-SQL call |
| Dedicated `EditVersion` concurrency token | SQL `rowversion` or Identity `ConcurrencyStamp` | Both change on every row write, including failed-password counting, rehash and security-stamp updates, so a Manager's form would get false 409s when the target simply mistypes a password |
| CSS keyframes + presence hook | `motion`, `framer-motion`, `react-transition-group` | A new package through the gate for four keyframes; D-38 prefers theme keyframes |

**Installation:** none.

**Version verification:** run this session (`npm view <pkg> time --json`, cut-off 2026-10-03 for the 14-day rule) for the shadcn candidates in § Package Legitimacy Audit. The installed stack above is read from the manifests, not re-resolved.

## shadcn/ui evaluation (D-37)

### What shadcn is today
- The `shadcn` CLI is at 4.22.0 (2026-10-16); the newest version past the cool-down is **4.21.1 (2026-10-01)** [VERIFIED: npm registry]. It copies component source from a registry into your repo; `components.json` is "only required if you're using the CLI" [CITED: ui.shadcn.com/docs/components-json].
- Tailwind v4 and React 19: "all components are updated for v4 and React 19"; `tailwindcss-animate` is replaced by `tw-animate-css`; every primitive has a `data-slot`; `forwardRef` is gone; the `default` style is deprecated for `new-york` [CITED: ui.shadcn.com/docs/tailwind-v4].
- Radix peer range accepts React 19.3: `"react": "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc"` [VERIFIED: @radix-ui/react-dialog 1.1.23 package.json, read from the tarball].
- The current new-york-v4 registry files import the unified `radix-ui` package (`import { Dialog as SheetPrimitive } from "radix-ui"`), `XIcon` from `lucide-react`, and `cn` from the utils alias, and start with `"use client"` [VERIFIED: https://ui.shadcn.com/r/styles/new-york-v4/sheet.json fetched this session].

### `components.json` mapped into the OR-6 tree (only if a component is ever adopted)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/ui/app.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/primitives",
    "utils": "@/utils/cn",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```
- `aliases.ui` decides where `ui` components go [CITED: ui.shadcn.com/docs/components-json]; pointing it at `@/components/primitives` keeps copied files inside `web/src/components` and never creates `web/src/ui` content (that folder is the theme, OR-6). `primitives` is a proposed area name [ASSUMED]; `source-layout.node.test.ts` and `web/src/components/index.test.ts` would need the new area.
- `tailwind.config` must be blank for v4 [CITED: ui.shadcn.com/docs/components-json].
- **Never run `shadcn init` against `src/ui/app.css`.** The v4 setup adds `@import "tw-animate-css"` and theme variables [CITED: ui.shadcn.com/docs/tailwind-v4], which collide with the stylesheet contract (`app.css` holds only the Tailwind entry, `@source not`, the base import, `@custom-variant`, `@theme`/`@theme inline` and keyframes inside `@theme`; no `@apply`) and with `--*: initial` [VERIFIED: web/src/ui/app.css:5-49 and STATE.md 02-05 note]. If a component is adopted, copy its source by hand from the registry JSON (as done in this session) and rewrite it.

### Blocking findings

**1. Radix scroll lock injects a `<style>` element, which the strict CSP blocks (probed).**
- The project CSP: `"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"` [VERIFIED: src/Csps.Server/Http/SecurityHeadersMiddleware.cs:16-17].
- `react-style-singleton` 2.2.3 does `var tag = document.createElement('style'); ... tag.appendChild(document.createTextNode(css)); ... head.appendChild(tag);` and only adds a nonce if `get-nonce` has one [VERIFIED: tarball dist/es2015/singleton.js]. `react-remove-scroll-bar` 2.3.8 uses it to write `overflow: hidden !important` rules for `body[...]` [VERIFIED: tarball dist/es2015/component.js:13-52].
- `@radix-ui/react-dialog` 1.1.23 wraps **`Dialog.Overlay`** in `RemoveScroll` (`jsx(RemoveScroll, { as: Slot, allowPinchZoom: true, shards: [context.contentRef], ...`) and calls `hideOthers(content)` for modal content [VERIFIED: tarball dist/index.mjs:105-146]. `@radix-ui/react-menu` (DropdownMenu) uses `RemoveScroll` whenever `modal` is true, and `modal = true` is the default [VERIFIED: @radix-ui/react-menu 2.2.1 tarball dist/index.mjs:61 and 227; the eligible DropdownMenu 2.1.24 depends on react-menu 2.1.24, same structure ASSUMED].
- Probe (this session, Playwright 1.63, a page served with the project's `style-src 'self'`): a JS-inserted `<style>` is blocked, a `securitypolicyviolation` fires and the console logs an error, while CSSOM `element.style.x = ...` and `style.setProperty('--x', ...)` apply with no violation:
  ```
  chromium {"a":"rgb(0, 0, 0)","b":"rgb(0, 128, 0)","v":["style-src-elem inline"]} console: ["Applying inline style violates the following Content Security Policy directive 'style-src 'self''. Either the 'unsafe-in"]
  firefox {"a":"rgb(0, 0, 0)","b":"rgb(0, 128, 0)","v":["style-src-elem inline"]} console: ["[JavaScript Error: \"Content-Security-Policy: The page’s settings blocked an inline style (style-src-elem) from being app"]
  webkit {"a":"rgb(0, 0, 0)","b":"rgb(0, 128, 0)","v":["style-src-elem inline"]} console: ["Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive"]
  ```
  [VERIFIED: probe output]. MDN agrees that styles "set directly on the element's style property will not be blocked", but `setAttribute("style", ...)` and `style.cssText` are [CITED: developer.mozilla.org .../Content-Security-Policy/style-src].
- So the Sheet and Dialog as shadcn ships them (Overlay inside Content) and a default DropdownMenu break the zero-console-error E2E guard and the CSP listener. A nonce would need per-request HTML rewriting of a static `index.html` plus `setNonce()`; not worth it.
- What is CSP-safe: Radix inline positioning and focus guards go through CSSOM. React DOM sets styles per property (`style[styleName] = value`, `style.setProperty` for `--*`) [VERIFIED: web/node_modules/react-dom/cjs/react-dom-client.production.js:1439-1456]; Radix focus guards use `element.style.outline = "none"` etc. and DismissableLayer sets `body.style.pointerEvents` [VERIFIED: @radix-ui/react-focus-guards 1.1.6 and react-dismissable-layer 1.1.19 tarballs]. So Tabs, a non-modal Popover, a `modal={false}` DropdownMenu, and a Dialog rendered **without** `Dialog.Overlay` (own scrim div, own `useBodyScrollLock` class) stay inside the CSP.

**2. Class strings fail the class gate.** The shadcn Sheet uses `bg-black/50`, `bg-background`, `shadow-lg`, `ring-offset-background`, `opacity-70`, `sm:max-w-sm`, `data-[state=open]:slide-in-from-right` [VERIFIED: sheet.json content]. The theme wipes Tailwind defaults (`--*: initial;`) [VERIFIED: web/src/ui/app.css:26], the class gate rejects colour literals, opacity outside the D-02 allow-list and unknown tokens (STATE 02-05), and responsive rules here are `pg-*` container variants, not `sm:`. Every copied file would be rewritten into recipes. At that point the in-house component already exists and already passes parity.

**3. `cn()` / tailwind-merge corrupts this theme's classes (probed).** tailwind-merge 3.7.0 with its default config, run this session:
```
"font-display font-heavy" => "font-heavy"
"font-sans font-button" => "font-button"
"shadow-level-2 shadow-level-3" => "shadow-level-3"
"rounded-pill rounded-md" => "rounded-pill rounded-md"
```
It reads `font-heavy`/`font-button` (custom weights) as font families and drops `font-display`, which would break e.g. `loginTitleClasses` (`font-display ... font-heavy`) [VERIFIED: probe output; web/src/components/layout/layout.recipe.ts:95-97]. If anything is ever copied, `cn` must be plain `clsx` (already installed), or `extendTailwindMerge` configured with the whole theme.

**4. Portals.** shadcn Sheet/Dialog/DropdownMenu/Popover render through `Portal` to `document.body` [VERIFIED: registry JSON has `Portal`]. The project forbids body portals because `data-theme` and the `pg` container live on the page root [VERIFIED: web/src/components/overlays/fixedLayerGuard.ts:11-16]. Radix Portal takes a `container` prop [VERIFIED: react-dialog dist/index.mjs:94 passes `container`], so adoption would need `container={pageRoot}` everywhere or no Portal.

**5. License.** `react-remove-scroll`, `react-remove-scroll-bar`, `react-style-singleton`, `use-callback-ref`, `use-sidecar` and `aria-hidden` all depend on `tslib`, whose license is **0BSD** [VERIFIED: npm registry `npm view ... dependencies` and `npm view tslib license` = `0BSD`]. The 0BSD exception is recorded for scope `tool` only [VERIFIED: docs/license-exceptions.json:98-101]. Dialog, Popover or DropdownMenu would need a new owner license ruling for 0BSD at `runtime`. Radix Tabs does not pull these.

**6. a11y model mismatch.** Radix modal content calls `hideOthers` (sets `aria-hidden` on siblings); this project uses `inert` (R2-10) and the `isTopFocusTrap` stack. Mixing both on one page is a source of axe and focus bugs.

**7. Bundle.** Gzip sizes per package with its own dependencies (bundlephobia, this session): DropdownMenu 2.1.24 = 29,399 B, Popover 1.1.23 = 22,633 B, Tabs 1.1.21 = 8,423 B, tailwind-merge 3.7.0 = 9,159 B, class-variance-authority 0.7.1 = 655 B [VERIFIED: bundlephobia API]. Dialog was rate-limited; ~12-15 KB gz estimated from Popover minus floating-ui [ASSUMED]. Admin JS was 194,392 B of 250,000 B after Phase 4 [VERIFIED: .planning/phases/04-identity-authentication/04-REVIEW-FIX.md:37]. Drawer + user menu live in the shell, so Sheet + DropdownMenu would land in the initial admin chunk (~35-40 KB of ~55 KB headroom, shared dependencies overlap).

**8. OR-4.** The six registry files fetched (sheet, dialog, dropdown-menu, popover, tabs, button) contain no U+2012-U+2015 or U+2212 [VERIFIED: scan of the fetched JSON]. The no-long-dash test would still guard copied code.

### Where shadcn would earn its place (recommendation)
| Phase 5 need | In-house today | shadcn / Radix option | Recommendation |
|---|---|---|---|
| Phone drawer motion (D-34) | `MobileNavDrawer` (focus trap, Esc, scrim click, link close, scroll-lock class) | Sheet (Dialog): Overlay injects `<style>`; portal; class rewrite | **Keep in-house**; add keyframes + presence hook |
| User menu motion (D-35) | `UserMenu` (APG menu button, roving focus) | DropdownMenu (`modal` default injects `<style>`; `modal={false}` is CSP-safe) | **Keep in-house**; add keyframes + chevron rotate |
| Add/Edit slide-overs, dialogs | `Modal` (`variant="slideover"`), `ConfirmDialog`, D-42 fit rules | Dialog without Overlay | **Keep in-house** (D-42 owner rules, parity) |
| Profile tabs (D-23) | `Tabs` + `getTabPanelProps` with roving tabIndex (02-19) | Radix Tabs (CSP-safe, 8.4 KB) | **Keep in-house** (already WAI-ARIA, already in the showcase) |
| Later phases | none | Combobox/Command (staff pickers, Phase 6/7), date picker | Re-evaluate per component when the need appears |

D-37 still requires the doc changes (both CLAUDE.md files, PROJECT.md, the UI-SPEC registry table) even if no component is adopted now; the planner should include that doc task.

## Package Legitimacy Audit

> No package is recommended for installation in Phase 5. The table is the approval-checkpoint list **if** the owner chooses to adopt shadcn components anyway. Versions are the newest at least 14 days old on 2026-10-17 (published on or before 2026-10-03). The seam reported the latest versions as `SUS` for `too-new` only; the eligible versions below are older. Advisory counts are from the GitHub Advisory Database (`gh api /advisories?ecosystem=npm&affects=<pkg>`, which returned 11 for `lodash` as a sanity check).

| Package | Eligible exact version (published) | Registry | First published | Weekly downloads | Source repo | License | Advisories | postinstall | Seam verdict (latest) | Disposition |
|---------|-----------|----------|-----|-----------|-------------|---------|---------|---|---------|-------------|
| shadcn (CLI, dev tool via npx) | 4.21.1 (2026-10-01) | npm | 2024-07-09 | 11.9 M | github.com/shadcn-ui/ui | MIT | 0 | none | SUS (too-new: 4.22.0) | Not recommended; checkpoint if used |
| radix-ui (unified) | 1.6.7 (2026-07-24); 1.7.0 eligible 2026-10-19 | npm | 2022-08-01 | 17.1 M | github.com/radix-ui/primitives | MIT | 0 | none | SUS (too-new: 1.8.1) | Not recommended (55 direct deps); prefer per-primitive packages |
| @radix-ui/react-dialog | 1.1.23 (2026-07-24) | npm | 2020-12-15 | 73.5 M | github.com/radix-ui/primitives | MIT | 0 | none | SUS (too-new: 1.3.1) | Not recommended (CSP, 0BSD tslib) |
| @radix-ui/react-dropdown-menu | 2.1.24 (2026-07-24) | npm | 2020-12-15 | 56.1 M | github.com/radix-ui/primitives | MIT | 0 | none | SUS (too-new: 2.2.1) | Not recommended (CSP when modal, 0BSD tslib) |
| @radix-ui/react-popover | 1.1.23 (2026-07-24) | npm | 2020-12-15 | 56.6 M | github.com/radix-ui/primitives | MIT | 0 | none | SUS (too-new: 1.3.1) | Not recommended |
| @radix-ui/react-tabs | 1.1.21 (2026-07-24) | npm | 2020-12-15 | 59.4 M | github.com/radix-ui/primitives | MIT | 0 | none | SUS (too-new: 1.2.1) | Not needed (in-house Tabs) |
| @radix-ui/react-slot | 1.3.3 (2026-07-24) | npm | 2021-01-29 | n/a | github.com/radix-ui/primitives | MIT | n/a | none | not run | Only with shadcn Button `asChild` |
| class-variance-authority | 0.7.1 (2024-11-26) | npm | 2022-01-26 | 65.2 M | github.com/joe-bell/cva | **Apache-2.0** | 0 | none | OK | Not needed (recipes use `tw()` maps) |
| tailwind-merge | 3.7.0 (2026-09-12) | npm | 2021-07-18 | 85.1 M | github.com/dcastil/tailwind-merge | MIT | 0 | none | OK | **Reject as default `cn`** (probed class corruption) |
| tw-animate-css | 1.4.0 (2025-09-24) | npm | 2025-03-10 | 38.9 M | github.com/Wombosvideo/tw-animate-css | MIT | 0 | none | OK | Not needed (theme keyframes) |
| Transitive (Dialog/Popover/Menu): react-remove-scroll 2.7.2, react-remove-scroll-bar 2.3.8, react-style-singleton 2.2.3, aria-hidden 1.2.6, get-nonce 1.0.1, use-callback-ref, use-sidecar, detect-node-es, @floating-ui/react-dom 2.1.9 | as listed | npm | 2018-2021 | 70-88 M | github.com/theKashey/*, floating-ui | MIT | 0 | none | OK | Would arrive with the primitives |
| Transitive: tslib | 2.8.1 | npm | n/a | n/a | github.com/microsoft/tslib | **0BSD** | n/a | none | not run | Needs a new owner license ruling for scope `runtime` |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none of the eligible versions; every `SUS` above is the seam's `too-new` reason for the latest release. If any row is adopted, the planner inserts a `checkpoint:human-verify` (the owner's per-package OK, memory rule) before the install and registers it in `docs/dependencies.json` and `THIRD-PARTY-NOTICES.txt` (`npm run notices`).
**Package names were confirmed against official sources:** shadcn docs and registry name `radix-ui`, `lucide-react`; Radix packages are named in the fetched `@radix-ui/react-dialog` tarball's `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
Browser (admin SPA, strict CSP)
  │  route loader: requireSessionLoader → requireManager (redirect('/admin') for Admin)
  │  pages: UsersPage / ProfilePage(tabs) / AuditLogPage / ConfirmEmailPage / ComponentShowcase(lazy)
  │  forms: RHF + zod mirror (OR-3) ── useSubmission(Idempotency-Key per submit, WEB-09)
  │  lists: useXxxListParams (nuqs) → query key (parsed values) → modules/admin/services/*
  ▼
core/api httpClient (Bearer access token, 401 → single-flight refresh)
  ▼
ASP.NET Core 10 pipeline: security headers → auth (JWT + sid session check via ISessionCache)
  → authorization (Policies.Manager / Staff, default deny) → idempotency gate (POST)
  ▼
Controllers (thin): UsersController /api/v1/users · ProfileController /api/v1/profile · AuditLogController /api/v1/audit-log
  ▼
Handlers (one per use case) ── FluentValidation → Result<T>
  │       ├─ guard path (demote/lock/deactivate/delete): IUnitOfWork.InTransactionAsync
  │       │     └─ sp_getapplock 'csps-active-managers' → count active Managers → write → audit Record
  │       ├─ form save path: compare client EditVersion → write with OriginalValue = client version
  │       │     └─ DbUpdateConcurrencyException / ConcurrencyFailure → 409 (SEC-07)
  │       └─ email paths: AccountToken (Invitation / PasswordReset / EmailChange) + EmailOutbox in same txn
  ▼
CspsDbContext (scoped) ── stamping point sets Created*/Updated* from IRequestContext.UserId + TimeProvider
  ▼
SQL Server: AspNetUsers (+ new columns) · AspNetUserRoles · AccountTokens · UserSessions/RefreshTokens
            · EmailOutbox · AuditLog (TR_AuditLog_AppendOnly, the only trigger)
  ▲
After commit: ISessionCache.EvictUserAsync(target) → target's next request with old sid fails → 401 → "Your session ended"
```

### Recommended Project Structure (new files only)
```
src/Csps.Domain/Auditing/AuditActions.cs            # + user.* and profile.* codes
src/Csps.Domain/Identity/AccountToken.cs            # + AccountTokenPurpose.EmailChange = 3
src/Csps.Application/Users/                         # one handler per use case
  ListUsersHandler, GetUserHandler, CreateUserHandler (invite | temporary), UpdateUserHandler (form, EditVersion)
  LockUserHandler, UnlockUserHandler, DeactivateUserHandler, ActivateUserHandler, DeleteUserHandler
  ResendInvitationHandler, SendResetLinkHandler, SetTemporaryPasswordHandler, ManagerGuard (shared rule)
src/Csps.Application/Profile/                       # GetProfile, UpdateName, ChangePassword, RequestEmailChange,
                                                    # ResendEmailChange, CancelEmailChange, CheckEmailChange, ConfirmEmailChange
src/Csps.Application/Audit/ListAuditLogHandler.cs
src/Csps.Application/Ports/IUserDirectory.cs        # roster/audit read models (keeps Identity out of Application)
src/Csps.Infrastructure/Identity/                   # UserDirectory, ManagerRosterLock (sp_getapplock)
src/Csps.Infrastructure/Persistence/RecordStampInterceptor.cs   # SEC-08 one place
src/Csps.Infrastructure/Persistence/Migrations/<ts>_AddUserManagement.cs
src/Csps.Server/Controllers/UsersController.cs, ProfileController.cs, AuditLogController.cs
web/src/modules/admin/pages/   UsersPage, ProfilePage, AuditLogPage, ConfirmEmailPage, ComponentShowcasePage
web/src/modules/admin/components/ AddUserPanel, EditUserPanel, DeactivateUserDialog, LockUserDialog,
                                  TemporaryPasswordDialog, CopyField, ChangeEmailDialog, AuditDetail
web/src/modules/admin/hooks/   useUsersListParams, useAuditListParams, useProfileTab
web/src/modules/admin/services/ usersService.ts, profileService.ts, auditLogService.ts
web/src/modules/admin/         usersCopy.ts, profileCopy.ts, auditCopy.ts, usersSchemas.ts, profileSchemas.ts
web/src/components/            entry/RadioGroup, forms/DateInput, states/ConflictBanner, data/ActorName, data/RecordMeta
web/src/hooks/usePresence.ts   # exit-animation helper for drawer and user menu (D-34, D-35)
web/src/utils/temporaryPassword.ts  # Tela-Sukat-7381 generator (crypto.getRandomValues) + word list
```

### Pattern 1: Full-bleed height chain and the pinned phone tab bar (D-01, D-02, D-36)

**Root cause (verified).** Today:
- `pageRootClasses = tw('@container/pg relative min-h-full bg-bg font-sans text-[16px] leading-6 text-ink')` [VERIFIED: web/src/components/layout/layout.recipe.ts:16]
- `adminClasses = tw('flex min-h-full bg-bg text-ink')` [VERIFIED: web/src/modules/admin/components/admin.recipe.ts:9]
- `tabBarClasses = tw('sticky bottom-0 z-30 mt-auto hidden grid-cols-4 border-t border-line bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-2 pt-[6px] pb-3 [backdrop-filter:blur(12px)] pg-phone:grid')` [VERIFIED: admin.recipe.ts:27-29]
- `index.html` has `<div id="root"></div>` and no height on `html`, `body` or `#root` [VERIFIED: web/index.html; web/src/ui/base.css body rule].

`min-height: 100%` resolves against an auto-height parent, so it does nothing; the main column is content-tall, `mt-auto` has no free space, and `sticky bottom-0` never moves an element below its normal position. On a short page the bar sits right after the content.

**The containing-block hypothesis is refuted.** The comment at `navigation.recipe.ts:198-202` ("The page root is a size container, which makes it the containing block of fixed descendants") does not hold in current engines. Probe (this session): a `position: fixed; bottom: 0` child of a `container-type: inline-size; position: relative` element, page scrolled by 1000px, plus the candidate fix (`min-height: 100dvh` flex column, bar `position: sticky; bottom: 0; margin-top: auto`) on a short page and on a long page scrolled to the middle:
```
chromium 153.0.8010.12 {"fixedAtTop":844,"fixedAfterScroll":{"bottom":844,"vh":844,"sy":1000},"shortPageBar":{"barBottom":844,"vh":844},"longPageBarScrolled":{"barBottom":844,"vh":844}}
firefox 155.0 {"fixedAtTop":844,"fixedAfterScroll":{"bottom":844,"vh":844,"sy":1000},"shortPageBar":{"barBottom":844,"vh":844},"longPageBarScrolled":{"barBottom":844,"vh":844}}
webkit 26.6 {"fixedAtTop":844,"fixedAfterScroll":{"bottom":844,"vh":844,"sy":1000},"shortPageBar":{"barBottom":844,"vh":844},"longPageBarScrolled":{"barBottom":844,"vh":844}}
```
[VERIFIED: probe output]. The fixed child stays at the viewport bottom after scrolling (so the container does not trap it), and the candidate fix pins the bar to the viewport bottom in both cases. Update the stale comment while touching that file. Real iOS Safari was not probed; the owner's phone check in UAT covers it.

**Fix (recommended):**
- Keep `pageRootClasses` and `adminClasses` exactly as App. C (parity and the in-showcase `AdminShell` preview render them inside fixed-width frames, where `100dvh` would be wrong) [VERIFIED: web/src/dev/previews/AdminShell.tsx:29-39 uses `AdminFrame` and `pageRootClasses`].
- Have the **real layouts** opt in with a marker on the page root, e.g. `data-fill="viewport"`, and give the shell recipes `in-data-[fill=viewport]:` variants: page root `min-h-dvh`, `.s-admin` `min-h-dvh`, the shell Sidebar `sticky top-0 h-dvh` (replacing `min-h-full`, and without `min-h-[480px]` in that context so D-03 can scroll), the Sidebar `nav` `min-h-0 flex-1 overflow-y-auto overscroll-contain`. This follows the project's `data-ui` marker style and touches no parity case.
- Public layout: `PublicLayout` already gives `main` `min-h-[calc(100dvh-var(--header-height))]` [VERIFIED: web/src/layouts/PublicLayout.tsx:37]; the root still needs `min-h-dvh` so a short page with a footer shows no strip. Auth already uses `min-h-dvh` (`authPageRootClasses`, layout.recipe.ts:41-43).
- Tab bar: keep `sticky bottom-0 mt-auto`; add `pb-[calc(12px+env(safe-area-inset-bottom))]` in place of `pb-3`. Because the bar is in flow, the end of `main` is never hidden behind it on a long page (no extra padding on `main` needed). Note `env(safe-area-inset-bottom)` is 0 unless the viewport meta has `viewport-fit=cover` (Open Question 6).
- D-02: no ancestor of the Sidebar or Topbar may get `overflow: hidden` or `overflow: auto` (either makes that ancestor the sticky scroll container); fix wide children instead (D-05).
- D-05 diagnosis: reproduce with Playwright (`document.documentElement.scrollWidth > innerWidth`), then find the culprit by walking elements whose `getBoundingClientRect().right > innerWidth`. Candidates in the showcase are fixed-width case frames and nested shell previews; the fix belongs to the child (its frame scrolls inside itself), never `overflow-x: hidden` on `html`/`body`.

### Pattern 2: Race-safe last-Manager guard (USER-04, D-18)

**What:** one transaction-owned application lock serializes every change that can reduce the number of active Managers; the count is read after the lock is held.
**When:** demote, lock, deactivate, delete (and any future path that changes a Manager's active state).

```csharp
// Infrastructure: same shape as AccountTokenStore.LockAccountAsync (src/Csps.Infrastructure/Identity/AccountTokenStore.cs:28-43)
public async Task LockActiveManagersAsync(CancellationToken cancellationToken)
{
    var outcome = new SqlParameter("@result", SqlDbType.Int) { Direction = ParameterDirection.Output };
    await context.Database.ExecuteSqlRawAsync(
        "EXEC @result = sp_getapplock @Resource = {0}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000",
        ["csps-active-managers", outcome],
        cancellationToken).ConfigureAwait(false);
    if (outcome.Value is not int code || code < 0)
    {
        throw new InvalidOperationException("The Manager roster lock could not be taken.");
    }
}

// Application handler (inside IUnitOfWork.InTransactionAsync)
await roster.LockActiveManagersAsync(ct);
var target = await directory.FindForChangeAsync(command.UserId, ct);           // read AFTER the lock
if (target is null) return UserErrors.NotFound;
if (target.Id == requestContext.UserId) return UserErrors.SelfAction;           // D-19
if (target.IsActiveManager && await directory.CountActiveManagersAsync(excluding: target.Id, ct) == 0)
{
    return UserErrors.LastActiveManager;                                         // "You can't remove the last active Manager."
}
// ... apply the change, revoke sessions, audit.Record(...), SaveChanges; evict the session cache after commit
```
- `sp_getapplock` with `@LockOwner = 'Transaction'` releases at commit or rollback; the pattern already exists twice in the codebase and is "the one reviewed raw-SQL call" [VERIFIED: src/Csps.Infrastructure/Identity/AccountTokenStore.cs:34; src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs:127-176].
- "Active Manager" = role Manager, `IsActive`, not deleted, not Manager-locked; a failed-password `LockoutEnd` does not count (D-18).
- **Two-writer test:** two Managers A and B; A demotes B and B demotes A at the same moment (two `HttpClient`s, start both behind a `TaskCompletionSource` barrier, `Task.WhenAll`). Assert exactly one 2xx and one refusal with the guard code, and that one active Manager remains. Repeat the same with deactivate and with delete.

### Pattern 3: SEC-07 edit version for users (D-20, D-21)

**What:** a dedicated concurrency token that only staff edits rotate.
**Why not rowversion or `ConcurrencyStamp`:** Identity's store does `user.ConcurrencyStamp = Guid.NewGuid().ToString(); Context.Update(user);` on **every** `UpdateAsync` [CITED: github.com/dotnet/aspnetcore release/10.0 src/Identity/EntityFrameworkCore/src/UserStore.cs:212-230], and `UserAccounts` calls it for failed-password counting, rehash, must-change flags and breach marks [VERIFIED: src/Csps.Infrastructure/Identity/UserAccounts.cs:97-102, 113-135, 173-194]. A `rowversion` changes on those writes too. Either would give a Manager a false 409 when the person being edited mistypes a password.

```csharp
// ApplicationUser: public Guid EditVersion { get; set; }   configured .IsConcurrencyToken()
// Form save (UpdateUserHandler / UpdateNameHandler):
var user = await users.FindByIdAsync(key);                        // tracked
var entry = context.Entry(user);
entry.Property(u => u.EditVersion).OriginalValue = request.Version; // the version the form was opened with
user.FirstName = request.FirstName.Trim();
user.EditVersion = Guid.NewGuid();                                  // rotate: this is a staff edit
var result = await users.UpdateAsync(user);                         // WHERE ... AND EditVersion = @original
if (result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.ConcurrencyFailure)))
{
    return UserErrors.StaleEdit;                                    // 409 "This was changed by someone else. Reload and try again."
}
```
- Single-click actions (lock, deactivate, delete, …) rotate `EditVersion` too (they are staff edits under SEC-08) but do not send one (D-21); an open form saved after them then gets 409 and the D-20 banner, which is the intended outcome.
- Return the version in every user and profile read; the web form keeps it in hidden form state and sends it on save. The two-writer test (success criterion 6) PUTs the same version twice concurrently and asserts one 2xx, one 409 with the exact detail text.

### Pattern 4: SEC-08 attribution in one place

- Columns on `AspNetUsers`: `CreatedById uniqueidentifier NULL` (FK → `AspNetUsers.Id`, `ON DELETE NO ACTION`), `CreatedAtUtc datetimeoffset NULL`, `UpdatedById` (same FK), `UpdatedAtUtc`. Null `CreatedById` reads as "System" (bootstrap Manager, rows before this migration, tools) [ASSUMED representation; "Legacy import" (MIG-10) is decided in Phase 16].
- Stamping point: a `SaveChangesInterceptor` in Infrastructure. On `Added` it sets `CreatedById/CreatedAtUtc`; on `Modified` it sets `UpdatedById/UpdatedAtUtc` **only when `EditVersion` changed** (original != current), so Identity bookkeeping never stamps. Because `UserStore.UpdateAsync` calls `Context.Update(user)`, every property reads as `IsModified`; compare `OriginalValue` with `CurrentValue`, never `IsModified` [CITED: UserStore.cs:218-220].
- The DbContext factory is built from the root provider (`services.AddDbContextFactory<CspsDbContext>((provider, options) => ... provider.GetRequiredService<OutboxSignalInterceptor>())`) [VERIFIED: src/Csps.Infrastructure/DependencyInjection.cs:120-121], so a scoped `IRequestContext` cannot be constructor-injected into the interceptor. Give the interceptor a singleton actor accessor (an Application port implemented in Server over `IHttpContextAccessor`, the same source `HttpRequestContext` reads [VERIFIED: src/Csps.Server/Http/HttpRequestContext.cs:16-24]) plus `TimeProvider`. Outside a request the actor is null ("System").
- DTOs have no attribution fields; System.Text.Json skips unknown members by default and no `UnmappedMemberHandling` override exists in Server [VERIFIED: grep of src/Csps.Server]. The SEC-08 test posts `createdById`, `createdAtUtc`, `updatedById`, `updatedAtUtc` with forged values on create and update and asserts the stored values equal the token's `sub` and the fake clock.

### Pattern 5: Soft delete, Manager lock, pending email (data model)

Current columns: `FirstName`, `LastName`, `IsActive`, `MustChangePassword`, `MustChangePasswordReason`, `BreachRecheckPending` [VERIFIED: src/Csps.Infrastructure/Identity/ApplicationUser.cs:13-28]. Add in one migration (`AddUserManagement`), no trigger, no JSON:

| Column | Type | Purpose |
|---|---|---|
| `EditVersion` | `uniqueidentifier NOT NULL DEFAULT NEWID()` | SEC-07 token (Pattern 3) |
| `CreatedById`, `CreatedAtUtc`, `UpdatedById`, `UpdatedAtUtc` | FK / `datetimeoffset` NULL | SEC-08 (Pattern 4) |
| `ManagerLockedAtUtc` | `datetimeoffset NULL` | D-16 Manager lock, no timer; separate from Identity `LockoutEnd` |
| `DeletedAtUtc` | `datetimeoffset NULL` | D-07 marker (discretion: nullable timestamp keeps the status filter Active/Inactive/Locked) |
| `PendingEmail` | `nvarchar(256) NULL` | D-24 pending change; not in the unique email index, so it reserves nothing (P3 "email taken meanwhile" state) |

- `AccountTokenPurpose` today: `PasswordReset = 1`, `Invitation = 2` (comment: "Phase 5 adds email-change confirmation here (D-28) without a schema change") [VERIFIED: src/Csps.Domain/Identity/AccountToken.cs:3-11]. Add `EmailChange = 3` (stored byte, never renumber). The token row has no payload column, so the new address lives in `PendingEmail`.
- Scrambled email (discretion): `deleted-{userId:N}@deleted.invalid` for `Email` and `UserName`, normalized forms uppercased. Unique by id, passes Identity's single-`@` email check, and `.invalid` is a reserved non-resolving TLD (RFC 2606/6761) [ASSUMED]. Add an outbox guard that refuses any recipient ending in `.invalid` (defense in depth), and scrub outbox history for that address (ties to IN-08).
- "Can sign in" today is spread over about 11 Application call sites that read `IsActive`/`LockoutEnd` (ForgotPassword, InviteLinkLookup, ListSessions, PendingPasswordChangeLookup, Refresh, ResendCode, ResetLinkLookup, RevokeSession, SignIn, VerifyCode, UserAccount) [VERIFIED: grep this session]. Add one computed rule on `UserAccount` (active, not deleted, not Manager-locked) and switch every site to it, test-first, so no path forgets the Manager lock or the delete.
- D-17: the reset handler calls only the failed-password `ClearLockoutAsync`; it must never touch `ManagerLockedAtUtc` or `IsActive`.

### Pattern 6: Email change (PROF-02, C-9, D-24, D-25)

1. `POST /api/v1/profile/email-change` (Idempotency-Key; body: new email, current password). In one transaction: per-account applock (`LockAccountAsync`), verify the current password (count a wrong one through the existing failed-password path or a per-account rate limit; see Security), check the new address is not used by another non-deleted account, revoke open `EmailChange` tokens, create a 24 h token, set `PendingEmail`, enqueue "Confirm new email" to the new address and "Email change requested" to the old one, audit `profile.email-change-requested`.
2. `POST /api/v1/profile/email-change/check` (anonymous, exempt as read-only, like the invite check) returns the masked state for P3.
3. `POST /api/v1/profile/email-change/confirm` (anonymous; the token in the body, never the URL query). Spend the token, re-check uniqueness (the unique `EmailIndex` on `NormalizedEmail` [VERIFIED: ApplicationUserConfiguration.cs:52-55] turns a lost race into a unique-key error → "This email can't be used"), set `Email`, `UserName`, normalized forms, clear `PendingEmail`, rotate `EditVersion`, audit `profile.email-changed`.
4. Resend and cancel: `POST .../email-change/resend`, `DELETE /api/v1/profile/email-change`.
- The web page reads the token from `location.hash` and removes it with `history.replaceState` at once (P4 S5 pattern); an explicit "Confirm New Email" button means a mail scanner opening the link changes nothing.

### Pattern 7: Phone motion without a package (D-34, D-35, D-38)

**Keyframes in the theme** (the stylesheet contract already allows `@keyframes` inside `@theme`; existing ones are `csp-fade`, `csp-rise`, `csp-slide` [VERIFIED: web/src/ui/app.css:44-80]):
```css
/* app.css @theme additions (D-38: 150-250 ms, transform/opacity only, no layout shift) */
--animate-csp-drawer-in: csp-drawer-in 0.2s ease;
--animate-csp-drawer-out: csp-drawer-out 0.2s ease forwards;
--animate-csp-fade-out: csp-fade-out 0.15s ease forwards;
--animate-csp-pop-in: csp-pop-in 0.15s ease;
--animate-csp-pop-out: csp-pop-out 0.15s ease forwards;
@keyframes csp-drawer-in { from { transform: translateX(-100%); } }
@keyframes csp-drawer-out { to { transform: translateX(-100%); } }
@keyframes csp-fade-out { to { opacity: 0; } }
@keyframes csp-pop-in { from { opacity: 0; transform: scale(0.96); } }
@keyframes csp-pop-out { to { opacity: 0; transform: scale(0.96); } }
```
- Reduced motion: `base.css` already forces `transition-duration: 0s !important` under `prefers-reduced-motion: reduce` but **not** animations [VERIFIED: web/src/ui/base.css reduced-motion block]; each animated element adds `motion-reduce:animate-none`, as the overlays do [VERIFIED: web/src/components/overlays/overlays.recipe.ts:44, 72].
- Hamburger to X (pure transitions on three bars; no opacity token, so the class gate's opacity rule is not touched):
```ts
// navigation.recipe.ts (the button gets `group/menu`; bars are aria-hidden spans replacing the `menu` icon)
export const burgerBarClasses = tw('block h-[2px] w-[18px] rounded-[1px] bg-current transition-transform duration-200 ease-[ease]');
export const burgerTopClasses = tw('group-aria-expanded/menu:translate-y-[6px] group-aria-expanded/menu:rotate-45');
export const burgerMiddleClasses = tw('my-[4px] group-aria-expanded/menu:scale-x-0');
export const burgerBottomClasses = tw('group-aria-expanded/menu:-translate-y-[6px] group-aria-expanded/menu:-rotate-45');
```
  Bars 2px tall with 4px gaps put the centres 6px apart, so ±6px meets in the middle. Name: "Open navigation" / "Close navigation", plus `aria-expanded` (D-34).
- Chevron: `group-aria-expanded/um:rotate-180 transition-transform duration-200` on the UserMenu chevron (the button already carries `aria-expanded` [VERIFIED: web/src/components/navigation/UserMenu.tsx:76-95]).
- Exit animations need the node to stay mounted after `open` turns false. Both components unmount at once today (`open ? <OpenDrawer/> : null`, `openAt !== null && <MenuPopover/>`) [VERIFIED: MobileNavDrawer.tsx:56-58; UserMenu.tsx:96-107]. Add a small presence hook:
```ts
// web/src/hooks/usePresence.ts: keeps a closing node mounted until its exit animation ends.
export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const nodeRef = useRef<HTMLElement | null>(null);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    const node = nodeRef.current;
    if (open || node === null) return undefined;
    // No exit animation (reduced motion, jsdom): unmount now. animationend never fires for `animation: none`.
    if (getComputedStyle(node).animationName === 'none' || getComputedStyle(node).animationName === '') {
      setMounted(false);
      return undefined;
    }
    const done = () => setMounted(false);
    node.addEventListener('animationend', done, { once: true });
    const fallback = window.setTimeout(done, 300);
    return () => { node.removeEventListener('animationend', done); window.clearTimeout(fallback); };
  }, [open]);
  return { mounted, state: open ? 'open' : 'closed', nodeRef } as const;
}
```
  The drawer layer and panel read `data-state` (`data-[state=closed]:animate-csp-fade-out`, `data-[state=closed]:animate-csp-drawer-out`). While closing, the focus trap, `inert` and body scroll lock must already be released, and clicks must not reach the closing layer (`data-[state=closed]:pointer-events-none`). Radix `Presence` uses the same idea (reads `animationName`, listens for `animationend`) [VERIFIED: @radix-ui/react-presence tarball dist/index.mjs:50-123].
- **The D-34 visibility problem.** `drawerClasses = tw('fixed inset-0 z-(--z-overlay) flex items-start bg-scrim')` and `drawerPanelClasses = tw('sticky top-0 h-dvh w-(--sidebar-width) overflow-y-auto overscroll-contain')` [VERIFIED: navigation.recipe.ts:205-208]: the scrim covers the Topbar (z 20) and the 248px panel sits exactly over the menu button at the Topbar's left edge, so the X would be hidden and could not be pressed. Recommended (Open Question 1): open the drawer **below** the pinned Topbar (`top-(--topbar-height)` for scrim and panel, panel height `calc(100dvh - var(--topbar-height))`), keep the menu button live as the close control, make the rest of the Topbar (search, theme, user menu), the side column, `main` and the tab bar `inert`, and extend the focus trap so Tab cycles through the button and the panel. The drawer's content (the Sidebar) does not change.

### Pattern 8: Component showcase in production (D-30..D-33)

- The production budget build fails on any module under `src/dev/` (`DEV_ONLY_MODULE_PREFIXES = ['src/modules/admin/pages/AdminPreviewPage', 'src/modules/admin/previewCopy', 'src/dev/', 'visual/']`) [VERIFIED: web/scripts/budget.ts:104-113]. The showcase must move (for example to `web/src/modules/admin/showcase/`) or the prefix list must be narrowed by decision, with `build-output.node.test.ts` updated.
- The showcase renders **every dev scenario** through `renderNode(kit, scenario.node, ...)`, and `kit.ts` eagerly globs every component barrel and `./previews/*.tsx` [VERIFIED: web/src/dev/ComponentShowcase.tsx:24-41, 90; web/src/dev/kit.ts:11-12]. D-33 says "the dev scenarios ... stay dev-only". The showcase cannot ship without the scenario data it renders (Open Question 3). Recommended reading: the scenario **data** ships as part of the lazy showcase chunk (it is spec §12 demo data), while the parity entry (`parity-main.tsx`, `visual/`), `AdminPreviewPage`/`previewCopy` and the `/dev/*` routes stay out.
- Route: `/admin/components` under the guarded admin layout, loader redirect for Admins like `/admin/users`, lazy via `lazyRoute()`, document title "Component Showcase · CSPS Admin", Demo data badge + `Note` banner first in `main`. Prove "no live API calls" with an MSW/Playwright request listener on the page. Remove `/dev/components` or redirect it in dev builds.

### Anti-Patterns to Avoid
- **`overflow-x: hidden` on `html`/`body`/shell ancestors** to hide D-05: it breaks `position: sticky` (D-02) and hides the bug instead of fixing the wide child.
- **`min-h-dvh` in `pageRootClasses` itself:** every preview and parity frame that reuses it would grow to the viewport height and the App. C look-equality cases would fail.
- **Fixing the tab bar with `position: fixed`:** it works geometrically (the container does not trap it), but then `main` needs a padding that tracks the bar's height and the safe area; sticky-in-flow needs none.
- **Counting active Managers before taking the lock,** or taking the lock outside the transaction: both reopen the race.
- **Using `ConcurrencyStamp` or `rowversion` for the form version:** false conflicts from bookkeeping writes.
- **Writing names or emails into `AuditEntry.Detail`:** forbidden by the audit rules (Open Question 2).
- **`<Navigate>` for the Admin redirect:** use the route `loader` with `redirect()` (nuqs #1245, WEB-10).
- **Portals to `document.body`** for any new overlay.
- **`shadcn init` on `src/ui/app.css`** or adopting `cn()` with default tailwind-merge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency check on save | Manual SELECT-then-compare | EF concurrency token (`IsConcurrencyToken`) with `OriginalValue` = client version | The check must be in the UPDATE's WHERE to close the race |
| Serializing guard checks | In-memory `SemaphoreSlim` / static lock | `sp_getapplock` (`LockOwner = 'Transaction'`) | Works across processes and recycles; releases on rollback |
| Token hashing, single use, expiry | New token table | `AccountToken` + `AccountTokenPurpose.EmailChange` | Existing hashed single-use machinery with rowversion |
| Session revocation | Custom blocklist | `ISessions.RevokeAllAsync` + `ISessionCache.EvictUserAsync` | Phase 4 path with tests (sid check per request) |
| Idempotent POSTs | Per-endpoint duplicate checks | The idempotency gate + `Idempotency-Key` from `useSubmission` | SEC-06 middleware already covers every POST |
| Business-day date ranges | `new Date()` math | `IBusinessCalendar` (server), `parseAsBusinessDate` + `resolveDateRange` (web) | Asia/Manila day bounds, WEB-10 rules |
| URL list state | `useState` + `useSearchParams` | `createListParams` / `useXxxListParams` (nuqs) | Allow-list parsers, push/replace rules, tests exist |
| Dialog focus trap, inert, scroll lock | Radix or a new trap | `useFocusTrap`, `useInertOutside`, `useBodyScrollLock` | CSP-safe (class, not `<style>`), stacked-trap aware |
| Temporary password randomness | `Math.random` | `crypto.getRandomValues` (web) | Unbiased, CSPRNG |
| Password rules | New checks | `PasswordRules` / `PasswordPolicy` (server), `passwordRules.ts` + golden vectors (web) | Shared cases already proven |

**Key insight:** every hard part of this phase (tokens, sessions, idempotency, audit, focus management, URL state) already has a tested implementation; the risk is in wiring new paths into all of the existing checks, not in building new mechanisms.

## Runtime State Inventory

Not a rename or refactor phase; included because it changes stored data semantics.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `AccountTokens` invitation rows keep their stored `ExpiresAt` (72 h) after D-13; existing `AspNetUsers` rows get null attribution ("System") and a new `EditVersion` default | Code edit only (new tokens use 7 days); migration default `NEWID()` for `EditVersion` |
| Live service config | None. No external service stores user identifiers by name (email goes out through the outbox). | None |
| OS-registered state | None (no host scheduler; Basic plan). | None |
| Secrets/env vars | None renamed. `Auth:InviteLinkLifetime` has no override in appsettings (only the code default) [VERIFIED: grep of appsettings*.json] | Change the default in `AuthSettings` (line 63: `TimeSpan.FromHours(72)`) |
| Build artifacts | `src/Csps.Server/wwwroot` holds the last local production build; the showcase move changes chunk names | Rebuild; no manual cleanup |

## Common Pitfalls

### Pitfall 1: A sign-in path forgets the Manager lock or the delete
**What goes wrong:** a locked or deleted user still refreshes, resends a code, accepts an old invite or gets a reset link.
**Why:** "can sign in" is checked in about 11 places with `IsActive` and `LockoutEnd`.
**How to avoid:** one computed rule on `UserAccount`; a table-driven integration test (`InactiveAccountTests` style) over every auth endpoint × {deactivated, Manager-locked, deleted}.
**Warning signs:** a new column read in only some handlers.

### Pitfall 2: Identity marks every column modified
**What goes wrong:** the SEC-08 interceptor stamps `UpdatedBy` on a failed password, or a stale-check never fires.
**Why:** `UserStore.UpdateAsync` calls `Context.Update(user)`, which flags all properties.
**How to avoid:** compare original vs current `EditVersion`; set the version's `OriginalValue` to the client's value.

### Pitfall 3: Audit detail leaks personal data
**What goes wrong:** "Name: Ana to Anna" or "Email: a@x to b@y" is stored in an append-only table kept 8 months.
**Why:** the UI-SPEC "What changed" lines ask for old and new values, but `docs/operations/audit-log.md` says "`Detail` ... never holds passwords, codes, tokens, e-mail addresses or phone numbers" and "Entries never contain an e-mail address, a name, a sign-in code, a token or a password" [VERIFIED: docs/operations/audit-log.md:35-36, 75].
**How to avoid:** store field names and role values only (`fields=first-name,last-name`, `role=admin>manager`); render "Name changed", "Email changed", "Role: Admin to Manager". Owner ruling: Open Question 2.

### Pitfall 4: Exit animation never ends in tests or under reduced motion
**What goes wrong:** the drawer stays mounted forever in jsdom or with `animate-none`, focus trap never releases.
**Why:** `animationend` does not fire when no animation runs.
**How to avoid:** the presence hook unmounts at once when `animationName` is `none` or empty, plus a 300 ms fallback timer; component tests assert immediate unmount in jsdom.

### Pitfall 5: The class gate and the opacity allow-list
**What goes wrong:** `opacity-0` or `bg-black/50` utilities fail `scripts/class-gate.mjs`.
**Why:** opacity tokens need a decision ID in the allow-list (STATE 02-05).
**How to avoid:** use transforms (`scale-x-0`) for the burger and keyframes (opacity inside `@keyframes`) for fades; or cite D-34/D-35 as the decision when adding an allow-list entry.

### Pitfall 6: Showcase leaks into the initial admin chunk
**What goes wrong:** moving the showcase pulls `kit.ts`'s eager glob of every barrel into a shared chunk loaded by `/admin`.
**Why:** Rolldown shares modules used by both the initial and the lazy graph.
**How to avoid:** import the showcase only through `lazyRoute(() => import(...))`; run `npm --prefix web run build:budget` and check admin JS stays near 194 KB plus the new pages.

### Pitfall 7: Invite lifetime copy and tests
**What goes wrong:** "72 hours" stays in the invite email, the S6 invalid-invite copy or tests.
**Why:** the value appears in `AuthSettings.cs`, `BootstrapManagerHandler.cs`, `EmailRendererTests.cs`, `InviteTests.cs`, `authCopy.ts`, `AcceptInvitePage.test.tsx` [VERIFIED: grep this session].
**How to avoid:** change all in one plan; the owner reviews the amended invite email (P4 D-30 checkpoint).

### Pitfall 8: DELETE without a row version vs SEC-06
**What goes wrong:** SEC-06 says "PUT, PATCH and DELETE rely on rowversion", but D-21 says delete acts on the latest state.
**How to avoid:** `DELETE /api/v1/users/{id}` without a version, naturally idempotent (a second call finds the user deleted and answers 404 "This user was deleted."), recorded as a D-21 deviation, following the existing `DELETE /api/v1/sessions/{id}` precedent [VERIFIED: src/Csps.Server/Controllers/SessionsController.cs:46]. Owner confirmation in Open Question 4.

### Pitfall 9: Search wildcards
**What goes wrong:** `q=%` or `q=_` matches everything.
**How to avoid:** a test with `%`, `_` and `[` in `q`; use EF `Contains` (parameter escaping) or `EF.Functions.Like` with an escape character [ASSUMED: EF Core 10 escapes `Contains` parameters].

### Pitfall 10: The flaky resend-code test
**What goes wrong:** `TheSixthCodeInAnHourIsRefusedWithNoWaitTime` failed once in a full run.
**Why (hypothesis):** load-sensitive timing between the stepped clock, the dispatcher sweep and `WaitForEmailsAsync`'s `Patience` window [VERIFIED: the test at tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs:63-89 already waits for count 5].
**How to avoid:** reproduce first (`--repeat` under a parallel full run), then fix the cause (e.g. which assertion fails); never loosen the 5-per-hour cap.

## Code Examples

### Admin-only route loader (USER-08)
```ts
// web/src/modules/admin/guard.ts (addition). Redirect from the loader, never <Navigate> (nuqs #1245).
export async function requireManagerLoader(args: Pick<LoaderFunctionArgs, 'request'>): Promise<SessionUser> {
  const user = await requireSessionLoader(args);
  if (user.role !== 'manager') {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's redirect() is thrown by design.
    throw redirect('/admin');
  }
  return user;
}
```

### Controller shape (one resource, thin actions)
```csharp
[ApiController]
[Route("api/v1/users")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
public sealed class UsersController : ControllerBase
{
    [HttpGet] public Task<IActionResult> List([FromQuery] ListUsersRequest request, [FromServices] ListUsersHandler handler, CancellationToken ct) => ...;
    [HttpPut("{id:guid}")] public Task<IActionResult> Update(Guid id, UpdateUserRequest request, ...) => ...;     // carries Version
    [HttpPost("{id:guid}/lock")] public Task<IActionResult> Lock(Guid id, ...) => ...;                           // Idempotency-Key
    [HttpDelete("{id:guid}")] public Task<IActionResult> Delete(Guid id, ...) => ...;                            // no version (D-21)
}
```
Policies are `Staff = "Staff"` and `Manager = "Manager"` [VERIFIED: src/Csps.Application/Security/Policies.cs:10, 13]; roles `Admin = "Admin"`, `Manager = "Manager"` [VERIFIED: src/Csps.Application/Security/Roles.cs:21, 24]. Every new action needs an `AuthorizationMatrix` row (anonymous 401, Admin 403, Manager 2xx/4xx) [VERIFIED: tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs].

### No-new-triggers schema test (D-06)
```csharp
[Fact]
public async Task TheOnlyTriggerIsTheAuditLogAppendOnlyGuard()
{
    // sys.triggers lists table triggers and database-level DDL triggers.
    command.CommandText = "SELECT name FROM sys.triggers ORDER BY name;";
    var names = await ReadNamesAsync(command);
    names.ShouldBe([AuditEntryConfiguration.TriggerName]);   // "TR_AuditLog_AppendOnly"
}
```
`AuditEntryConfiguration.TriggerName = "TR_AuditLog_AppendOnly"` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/AuditEntryConfiguration.cs:16]. Put it next to `AuditLogAppendOnlyTests` (which already queries `sys.triggers` for that trigger) and add a migration-source scan that fails on `CREATE TRIGGER` outside the `AddAuditLog` migration.

### Shell geometry E2E (D-01, D-02, D-05, D-36)
```ts
test('@shell the phone tab bar sits at the viewport bottom on a short page', async ({ appPage }) => {
  await appPage.setViewportSize({ width: 375, height: 812 });
  await appPage.goto('/admin/does-not-exist');                 // short "Page not found"
  const bar = appPage.getByRole('navigation', { name: 'Admin' }).last();
  const box = await bar.boundingBox();
  expect(Math.round(box!.y + box!.height)).toBe(812);
  expect(await appPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
```
Use the existing guarded fixtures in `web/e2e/fixtures.ts` (zero console warnings, CSP listener) and loop widths 320-767 (tab bar) and 320-1920 (no sideways scroll).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `container-type` implied layout containment (fixed children trapped) | Current Chromium 153, Firefox 155, WebKit 26.6 do not trap fixed children of an `inline-size` container (probed) | Spec moved away from layout containment; engines followed [ASSUMED date] | Comment in `navigation.recipe.ts:198-202` is stale; `fixed` overlays are viewport-relative |
| `tailwindcss-animate` | `tw-animate-css` | shadcn Tailwind v4 update [CITED: ui.shadcn.com/docs/tailwind-v4] | Not needed here (theme keyframes) |
| JS-only enter animations | `@starting-style` (`starting:` variant in Tailwind v4) | Tailwind v4.0 [CITED: tailwindcss.com/blog/tailwindcss-v4] | Option for entry; exit still needs a presence hook, so keyframes + hook are simpler and uniform |
| shadcn `default` style, `forwardRef` | `new-york`, `React.ComponentProps`, `data-slot` | shadcn v4 era [CITED: ui.shadcn.com/docs/tailwind-v4] | Only relevant if adopted |

**Deprecated/outdated:**
- The navigation recipe comment about the page root trapping `fixed` descendants (probed false).
- `AuthSettings.InviteLinkLifetime = TimeSpan.FromHours(72)` (D-13: 7 days) [VERIFIED: src/Csps.Application/Auth/AuthSettings.cs:63].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Radix Dialog gzip ≈ 12-15 KB with deps (not measured: rate-limited) | shadcn evaluation | Only matters if Dialog is adopted |
| A2 | DropdownMenu 2.1.24 (eligible) has the same `modal → RemoveScroll` structure as react-menu 2.2.1 read this session | shadcn evaluation | Only matters if adopted; verify in the tarball first |
| A3 | `components.json` alias `ui: "@/components/primitives"` is a sensible area name | shadcn evaluation | Naming only |
| A4 | Null `CreatedById` as "System" (no sentinel user row) | Pattern 4 | Phase 16 "Legacy import" may need a second sentinel; low |
| A5 | `.invalid` TLD reserved and never delivered (RFC 2606/6761) | Pattern 5 | Low; the outbox guard covers it anyway |
| A6 | EF Core 10 escapes LIKE wildcards in `Contains` parameters | Pitfall 9 | Search could over-match; the test catches it |
| A7 | The engines' change on container containment happened before the Playwright 1.63 builds; real iOS Safari behaves like WebKit 26.6 | Pattern 1 | If real Safari traps fixed children, sticky-in-flow still works (sticky is unaffected); low |
| A8 | `group-aria-expanded/<name>:` variant works in Tailwind 4.3.3 with named groups | Pattern 7 | Class gate fails fast; fallback `group-aria-[expanded=true]/menu:` |
| A9 | `env(safe-area-inset-bottom)` in an arbitrary `pb-[calc(...)]` passes the class gate compile | Pattern 1 | Fallback: a theme variable |

## Open Questions (owner rulings; contract default in bold)

1. **D-34 visibility of the X.** Today the drawer covers the menu button. Options: **(A) open the drawer below the pinned top bar; the menu button stays live as "Close navigation"** (the Sidebar content is unchanged; the scrim no longer covers the top bar); (B) keep the full-height drawer and add an X close button in the drawer's top row (changes drawer content). Recommendation: A.
2. **Audit "What changed" with names and emails.** The UI-SPEC lines "Name: {old} to {new}" and "Email: {old} to {new}" conflict with the audit-log rule (no names or emails in entries). Default: **store field names and role values only; show "Name changed", "Email changed", "Role: Admin to Manager"**. Alternative: allow names/emails in detail (needs a privacy ruling: 8-month retention, append-only, cannot be scrubbed on delete).
3. **Showcase scenarios in production.** The showcase is built from the dev scenario list. Default: **ship the scenario data in the lazy showcase chunk (demo data per spec §12); keep the parity entry, `visual/`, `AdminPreviewPage`/`previewCopy` and `/dev/*` routes out.**
4. **DELETE without a row version.** Default: **`DELETE /api/v1/users/{id}` with no version (D-21), recorded as a SEC-06 wording deviation like `DELETE /api/v1/sessions/{id}`.**
5. **Forgot-password for a Manager-locked user.** 04-18 gives reset links only to active, confirmed accounts. Default: **treat Manager-locked like deactivated (no link; same neutral response); D-17 keeps the lock after any reset.**
6. **`viewport-fit=cover`.** Without it, `env(safe-area-inset-bottom)` is 0 on iOS, so the bar's inset padding is inert in the browser (it matters in a home-screen app). Adding it lets the public site run under the notch in landscape and needs left/right safe-area padding there. Default: **add the `env()` padding now, defer `viewport-fit=cover` to the PWA work.**
7. **D-35 scope.** The UserMenu is one component for all widths. Default: **animate at all widths** (same component; nothing moves under reduced motion); alternative: `pg-phone:`-only motion.
8. **shadcn adoption.** Default: **no shadcn component or package in Phase 5; record D-37 in the docs; re-evaluate per component later.** If the owner wants it anyway, the only CSP-safe set is Tabs, non-modal Popover/DropdownMenu, and Dialog without `Dialog.Overlay`, plus a 0BSD runtime license ruling for `tslib`.
9. **Wrong current password on profile changes.** Default: **count it through the existing per-account failed-password path (lockout after 5) and the per-account rate limit**, so a stolen session cannot guess the password to change the email.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | Build, tests, migrations | ✓ | 10.0.402 (global.json 10.0.401, latestPatch) | none |
| Node / npm | Web build, Vitest, Playwright | ✓ | 24.21.0 / 11.19.0 | none |
| SQL Server LocalDB | Integration tests (`CSPS_TEST_SQL=localdb`) | ✓ | the default instance (use this, OR-1) and the retired project instance are both present | CI container on ubuntu |
| Playwright browsers | E2E, shell geometry | ✓ | chromium 1243, firefox 1543, webkit 2359 builds | none |
| gh CLI | Advisory checks, PRs | ✓ | 2.102.0 | none |
| Docker | none locally (forbidden) | n/a | n/a | n/a |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | .NET: xunit.v3 4.0.1 on MTP, Shouldly 4.3.0, NSubstitute 6.2.0, FakeTimeProvider, Respawn 7.0.0, ArchUnitNET 0.13.4, coverlet.MTP 10.0.1. Web: Vitest 5.0.1 + RTL + jsdom + in-house axe matcher, MSW 3.0.1, Playwright 1.63.0 + @axe-core/playwright 4.13.0 |
| Config file | `global.json` (MTP), `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/playwright.config.ts` |
| Quick run command | `dotnet test --project tests/<Project> --filter-class "*<Class>"` (.NET); `npm --prefix web run test -- --run src/modules/admin` (web) |
| Full suite command | Preflight, then `dotnet test --solution Csps.slnx` (with `CSPS_TEST_SQL=localdb` set in that process), `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |

### Phase Requirements → Test Map
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

### Sampling Rate
- **Per task commit:** the touched project's `--filter-class` run, or `npm --prefix web run test -- --run <path>`.
- **Per wave merge:** preflight, `dotnet test --solution Csps.slnx` + `npm --prefix web run verify`.
- **Phase gate:** full suite + coverage gate + `npm --prefix web run e2e` (three engines + phones), zero warnings, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Migration `AddUserManagement` + `IdentitySchemaTests` additions (new columns, FK, no JSON, no trigger)
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs` (D-06)
- [ ] `tests/Csps.Server.IntegrationTests/Users/*` (list, create, lifecycle, guard concurrency, edit concurrency, attribution, revocation, resend/reset)
- [ ] `tests/Csps.Server.IntegrationTests/Profile/*` (name, password, email change)
- [ ] `tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs`
- [ ] A two-client concurrency helper (barrier + `Task.WhenAll`) in `Csps.Testing`
- [ ] Matrix rows for every new action; `IdempotencyCoverageTests` entries (or exemptions with reasons) for the new POSTs
- [ ] Web: MSW handlers for users/profile/audit services; `usePresence` tests; shell `@shell` E2E specs

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Current password required for password and email change; temporary password forces change at next sign-in (04 D-13) and still needs the emailed code (04 D-22); `PasswordRules` full rule incl. HIBP |
| V3 Session Management | yes | Revoke all sessions on role/status change, lock, delete, temporary password; keep the current session on own password change; `ISessionCache.EvictUserAsync` after commit |
| V4 Access Control | yes | `Policies.Manager` on Users/AuditLog/showcase; default deny; profile endpoints act on the token's `sub` only (CWE-639); D-19 self-action refusal server-side; matrix tests |
| V5 Input Validation | yes | FluentValidation in handlers; zod mirrors (OR-3); search capped at 100 (SEC-03); URL params allow-listed (WEB-10, CWE-20, CWE-601) |
| V6 Cryptography | yes (reuse) | SHA-256 hashed single-use tokens (`AccountToken`); CSPRNG for tokens and temporary passwords; never hand-roll |
| V7 Error Handling and Logging | yes | Append-only audit with no PII; log masking (`*Hash`, `*Stamp`, `*Key`); ProblemDetails without internals (CWE-209) |
| V8 Data Protection | yes | Soft delete scrambles the email; outbox recipient scrub (IN-08); temporary password shown once, never stored plain or logged |
| V13 API | yes | Idempotency-Key on POSTs; edit version on form PUTs; 409 semantics |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Race removes the last Manager (CWE-362) | Denial of service / Elevation | Transaction-owned `sp_getapplock` + count under the lock |
| Mass assignment of role or attribution (CWE-915) | Tampering | Explicit request DTOs; attribution only from token + clock; test with forged fields |
| IDOR on profile (CWE-639) | Elevation | No user id in profile routes; `IRequestContext.UserId` only |
| Missing authorization on a new action (CWE-862/863) | Elevation | Matrix discovery test fails on any uncovered action |
| Stolen session changes the email (account takeover) | Spoofing | Current password, notice to the old address, confirmation at the new one, failed-password counting |
| Lost update (SEC-07) | Tampering | Edit-version concurrency token |
| Stored XSS via names in audit/roster (CWE-79) | Tampering | React text nodes only; no `dangerouslySetInnerHTML` (lint) |
| Open redirect through URL params (CWE-601) | Spoofing | Allow-list parsers; `safeReturnUrl` (IN-14 triage) |
| Role spoofing in the web shell (IN-17: unknown role becomes `manager`) | Elevation (UI only) | Fix IN-17 early in this phase (unknown role → treat as Admin or refuse); server stays authoritative |
| CSP regression from a new dependency | Tampering | No `<style>` injection; CSP listener in E2E (probed) |

## Sources

### Primary (HIGH confidence)
- Codebase read this session: `ApplicationUser.cs`, `ApplicationUserConfiguration.cs`, `UserAccounts.cs`, `IUserAccounts.cs`, `UserAccount.cs`, `AccountToken.cs`, `AccountTokenStore.cs`, `AuditActions.cs`, `AuditEntry.cs`, `AuthSettings.cs`, `Policies.cs`, `Roles.cs`, `SecurityHeadersMiddleware.cs`, `DependencyInjection.cs`, `CspsDbContextOptions.cs`, `HttpRequestContext.cs`, `AuthorizationMatrix.cs`, `ResendCodeEndpointTests.cs`, `docs/operations/audit-log.md`, `web/index.html`, `app.css`, `base.css`, `layout.recipe.ts`, `admin.recipe.ts`, `navigation.recipe.ts`, `AdminLayout.tsx`, `MobileNavDrawer.tsx`, `UserMenu.tsx`, `Topbar.tsx`, `TabBar.tsx`, `fixedLayerGuard.ts`, `useBodyScrollLock.ts`, `overlays.recipe.ts`, `ComponentShowcase.tsx`, `kit.ts`, `routes.tsx`, `guard.ts`, `budget.ts`, `package.json`, `.npmrc`, `Directory.Packages.props`
- npm tarballs read this session: `@radix-ui/react-dialog@1.1.23`, `@radix-ui/react-menu@2.2.1`, `@radix-ui/react-popper`, `@radix-ui/react-presence`, `@radix-ui/react-focus-guards@1.1.6`, `@radix-ui/react-dismissable-layer@1.1.19`, `react-remove-scroll@2.7.2`, `react-remove-scroll-bar@2.3.8`, `react-style-singleton@2.2.3`, `tailwind-merge@3.7.0`
- Playwright 1.63 probes this session (containing block + sticky fix; CSP `<style>` vs CSSOM; tailwind-merge merges)
- npm registry (`npm view ... time/license/dependencies`), GitHub Advisory Database (`gh api /advisories`), the GSD package-legitimacy seam
- [UserStore.cs (release/10.0)](https://raw.githubusercontent.com/dotnet/aspnetcore/release/10.0/src/Identity/EntityFrameworkCore/src/UserStore.cs): `UpdateAsync` rotates `ConcurrencyStamp` and calls `Context.Update`

### Secondary (MEDIUM confidence)
- [shadcn components.json](https://ui.shadcn.com/docs/components-json): fields, aliases, Tailwind v4 blank config
- [shadcn Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4): React 19, tw-animate-css, data-slot, new-york
- shadcn registry JSON (new-york-v4: sheet, dialog, dropdown-menu, popover, tabs, button)
- [MDN style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src): CSSOM not blocked; `setAttribute('style')` and `cssText` blocked
- [Tailwind CSS v4.0 blog](https://tailwindcss.com/blog/tailwindcss-v4): `starting:` variant, container queries
- Bundlephobia API (gzip sizes)

### Tertiary (LOW confidence)
- [Base UI CSP Provider](https://base-ui.com/react/utils/csp-provider) (search result; same `<style>` problem in another library)
- [CSSWG issue #10102 archive](https://lists.w3.org/Archives/Public/public-css-archive/2024Sep/1000.html) and [MDN Containing block](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_display/Containing_block): background for the container containment question (the probe is the deciding evidence)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new package; versions read from the manifests.
- shadcn evaluation: HIGH for CSP, class-merge and license findings (probed or read from tarballs); MEDIUM for bundle estimates.
- Architecture: HIGH for the guard, version token and height-chain fix (code read, probes run); MEDIUM for the SEC-08 interceptor wiring (EF provider lifetimes not probed).
- Pitfalls: HIGH; each is tied to a file or a probe.

**Research date:** 2026-10-17
**Valid until:** 2026-11-16 for codebase findings; re-check package versions and cool-down eligibility at install time (radix-ui 1.7.0 becomes eligible 2026-10-19).
