# Phase 5: Profile & User Management - Context

*Created: 2026-10-17T12:30:00-05:00 · Updated: 2026-10-19T05:10:04-05:00*

**Gathered:** 2026-10-17
**Status:** Ready for planning
**Branch:** `gsd/phase-05-profile-user-management` (owner, 2026-10-17: every Phase 5 commit goes on this branch; it was cut from `docs/phase-04-uat-close`, whose Phase 4 closing commits are not on `main` yet)

<domain>
## Phase Boundary

Every staff member manages their own name, email, password and theme. A Manager runs the staff roster: invite, edit, lock, deactivate and delete, under guard rules. Every action is audited and visible in a Manager-only audit-log viewer. Edits are conflict-safe (SEC-07) and record who made them (SEC-08).

Requirements: PROF-01..04, USER-01..08, AUDIT-02, SEC-07, SEC-08. The Phase 5 roadmap entry is the scope anchor, together with its Phase 4 carry-overs: the refresh-cookie `Expires` UAT check, review info notes IN-01..IN-19 (`04-REVIEW-DISPOSITION.md`), and the flaky `ResendCodeEndpointTests.TheSixthCodeInAnHourIsRefusedWithNoWaitTime`.

The owner added four items in this discussion: the full-bleed app shell, the sticky admin sidebar and top bar, the no-new-triggers rule, and shipping the component showcase to the live site for Managers.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (already ruled, not re-asked)
- **C-4 (04 D-21, D-23):** Add user offers both an emailed invitation and a Manager-set temporary password. The temporary password is prefilled with a random readable value the Manager may edit (basic rule only), and the user must replace it at first sign-in (04 D-13). Setting one revokes all of that user's sessions and emails them (04 D-24). Amend USER-02's wording to allow the temporary-password route.
- **C-9 (04 D-28):** An email change sends a confirmation link to the new address and a notice to the old one, and applies only after confirmation.
- **C-35 (02 D-02):** Inactive roster rows are muted but readable: a softer background plus the neutral `Inactive` badge, with all text at least 4.5:1. No opacity fade.
- **C-17 (04 D-06):** Screens the design doesn't draw are composed from existing parts and marked `// SPEC-GAP:`. In this phase that means the email-change confirmation and the audit log.
- **OD-14:** Design-vs-WCAG clashes are ruled item by item in `/gsd-ui-phase 5`.
- **04 D-02:** A Manager lock and a deactivation both produce the same generic sign-in error as a wrong password.

### Owner rules from this request (2026-10-17)
- **D-01 Full-bleed shell:** Every layout (public, auth and admin) fills the whole viewport even when the content is short. No page-background strip below the shell (the owner's `/admin/sessions` screenshot shows a peach band under the content). The fix belongs in the shared root and layout height chain, not per page.
- **D-02 Sticky admin navigation:** On tablet and desktop, the admin sidebar stays visible however far the page scrolls. The top bar (search, theme, user menu) is pinned too, so only the content area scrolls.
- **D-03 Short screens:** If the viewport is too short for every sidebar item (a small laptop or browser zoom), the nav list scrolls on its own inside the pinned sidebar, with the user card and Logout kept at the bottom. Nothing gets cut off, and the page never scrolls sideways.
- **D-04 Phones:** The slide-out drawer stays as it is. The top bar with the menu button is pinned.
- **D-05 Horizontal clipping bug:** The owner's `/dev/components` screenshot shows sidebar labels cut off on the left ("rd", "Expenses"), so the shell can scroll sideways. Fix it with D-01..D-03 and add a test that the shell never scrolls horizontally from 320 to 1920 px.
- **D-06 No new SQL triggers:** From now on, no migration, script or tool creates a database trigger. The existing `TR_AuditLog_AppendOnly` (01 D-32) stays as the audit log's database-level append-only guarantee. Enforce it with a schema test that lists `sys.triggers` and fails on any trigger other than `TR_AuditLog_AppendOnly`. Record the rule in both CLAUDE.md files as an owner rule. Guards that might have used a trigger are done in application code or with constraints. — **Reversibility:** reversible — the test and the rule are text.

### Deleting a user (C-41)
- **D-07:** Delete is a **soft delete**. The `AspNetUsers` row stays with its first and last name. The email (and normalized email/username) is scrambled to a unique non-deliverable value, sign-in is blocked, all sessions and outstanding account tokens (invite, reset, email change) are revoked, and the row is marked deleted with a UTC timestamp. — **Reversibility:** one-way — needs a migration for the deleted marker, and scrambled emails can't be recovered.
- **D-08:** "Recorded by" and "Last changed by" (SEC-08) are foreign keys to the user row. The name shown comes from that row, so a later name fix appears everywhere. No name-snapshot columns.
- **D-09:** Delete is **final in the UI**. There is no Restore and no "Deleted" filter for undoing it. Deactivate is the reversible action. Deleted users are excluded from the roster list.
- **D-10:** Scrambling frees the email, so the same person can be re-invited later as a new account. The old row stays separate.
- **D-11:** Wherever a deleted user is shown as an actor ("Recorded by", "Last changed by", the audit log), show their name plus a muted "(former staff)" hint. The final copy is reviewed in `/gsd-ui-phase 5`.

### Add user / onboarding
- **D-12:** The Add user dialog opens with **"Email an invitation"** selected. "Set a temporary password" is the other choice in the same dialog.
- **D-13:** Invitation links last **7 days**: change `AuthSettings.InviteLinkLifetime` from 72 h to 7 days. This also applies to the `bootstrap-manager` invite, since both use the one setting. A Manager can resend an invitation (USER-07), which replaces the old token.
- **D-14:** A temporary password is shown **once** on the success step, with a Copy button. It's never shown again and never stored in plain text. If it's lost, the Manager sets a new one.
- **D-15:** The role field is preselected to **Admin**, so choosing Manager is always a deliberate choice.

### Lock vs deactivate, guard rules
- **D-16:** A Manager **Lock** has no timer: the user stays blocked until a Manager unlocks them. It's separate from the 15-minute failed-password lockout (04 D-25, `AuthSettings.PasswordLockoutDuration`). Deactivate means "no longer works here". Lock, unlock, deactivate, reactivate, role change and delete all revoke the user's sessions at once (USER-05).
- **D-17:** A self-service password reset clears only the failed-password lockout (04 D-19). It never clears a Manager lock or a deactivation.
- **D-18:** For the last-Manager guard (USER-04), an **active Manager** is one who is not deactivated, not deleted and not Manager-locked. A failed-password lockout doesn't count. The guard covers demote, lock, deactivate and delete, and it must be race-safe: two simultaneous attempts can never leave zero active Managers. Use a serializable or locking check in the transaction, **not a trigger** (D-06).
- **D-19:** A Manager can't lock, deactivate, demote or delete **themselves**. They change their own name, email and password through My Profile.

### Stale-save conflicts (SEC-07)
- **D-20:** When a **form save** gets 409, the form keeps the user's typed values and shows the banner "This was changed by someone else. Reload and try again." with a **Load latest** button. Pressing it replaces the form with the server's current version. The edits are never thrown away silently. This is the shared pattern for every later aggregate form.
- **D-21:** Only form saves carry the row version. Single-click roster actions (lock, unlock, deactivate, reactivate, delete, resend invite, send reset link) act on the latest state. The D-18 guard still runs inside their transaction. The two-writer integration test (success criterion 6) covers the user edit form.

### Theme and My Profile
- **D-22:** The theme stays **per browser** in `localStorage['csps-theme']` (PROF-04). There's no account column or API call, and the public site stays light.
- **D-23:** My Profile uses **tabs**: Details (name, email), Security (password, plus a link to Signed-in devices `/admin/sessions`) and Appearance (theme). Each tab's form saves on its own. The tabs are accessible (the ARIA tabs pattern, keyboard arrows), and the active tab lives in the URL (WEB-10).
- **D-24:** While an email change is pending, Details shows the current email plus a note "Waiting for confirmation at new@…", with **Resend** and **Cancel**. Sign-in keeps using the old email until the link is confirmed. Starting a new change replaces the pending one.
- **D-25:** The email-change confirmation link lasts **24 hours**, is single-use and is hashed (the same `AccountTokens` machinery, with a new purpose).

### Audit-log viewer (AUDIT-02)
- **D-26:** Manager-only. It opens on the **last 7 days**, newest first, and the range can be widened to everything kept (8 months, 01 D-32). The filters (actor by user id, action, target, date range) and the page live in the URL.
- **D-27:** Each row is a summary (when in Manila time, who, action, target) and **expands** to show the detail (for example "Role: Admin to Manager"), the truncated IP (/24 or /48) and the device. On phones the expanded detail stacks.
- **D-28:** It shows **every** audited event, including sign-in, 2FA, lockout, reset and session events, not only user management.
- **D-29:** Export is **not** in Phase 5 (deferred).

### Component showcase on the live site (owner-added scope)
- **D-30:** The component showcase (`web/src/dev/ComponentShowcase.tsx`, now at `/dev/components`) ships to the live site so the owner can show it to someone from their day job **from the owner's own Manager session**. No account is created for that person. The showcase stays permanently as a living style guide. — **Reversibility:** reversible — remove the route.
- **D-31:** It opens at a direct link inside the admin portal (e.g. `/admin/components`), behind sign-in and the **Manager** policy. Admins are redirected like `/admin/users` (USER-08). It is **not** in the sidebar.
- **D-32:** A visible **"Demo data"** banner sits on every showcase page, so sample orders, names and totals can't be mistaken for real records.
- **D-33:** This is a narrow exception to 02 D-20 (dev code out of server builds). Only the showcase and the modules it needs go into the production build, as a lazy admin chunk. Everything else stays dev-only: the dev scenarios, the parity entry and the unguarded section previews. The showcase must meet the production rules: strict CSP (no inline style or script), zero console warnings, zero axe violations, and the admin bundle budget (≤ 250 KB gz initial; the showcase must be lazy so it doesn't count toward it). Its static JS chunk holds only demo data and no secrets, because static assets are public even when the route is guarded.

### Shell and overlay motion (owner, plan-phase request 2026-10-17; ruled after research)
- **D-34 Drawer animation:** On phones, the slide-out navigation drawer animates on both open and close: the panel slides in from the left and back out, and the scrim fades in and out. The close animation finishes before the drawer leaves the DOM. The drawer keeps its current full-height layout, content and behavior (D-04). The owner asked for the drawer's open and close motion; a hamburger-to-X icon morph is not required. The menu button's accessible name and `aria-expanded` follow the state.
- **D-35 User-menu animation:** Opening the user menu (the avatar, name and chevron in the top bar, circled in the owner's phone screenshot) animates at **all widths**: the popover fades and scales in from its anchor and the chevron turns 180°. Closing reverses it before the menu unmounts. Focus handling, Escape and outside-click stay as they are.
- **D-36 Tab bar pinned to the bottom:** The phone tab bar (Dashboard, Orders, Expenses, Profile) always sits at the bottom of the viewport (`bottom-0`), whatever the content height. The owner's screenshot of a short page ("Page not found") shows it floating mid-screen with empty page below it. Research found the cause is the height chain (`min-h-full` with no height on `#root`), not the container query, so the fix lands with D-01. Content is never hidden behind the bar (bottom padding covers its height plus `env(safe-area-inset-bottom)`), and a test pins it to the viewport bottom on a short page and a long page at 320-767 px.
- **D-37 No shadcn:** After research (Radix Dialog and DropdownMenu inject `<style>` tags that the strict CSP blocks, the copied classes fail the theme's class gate, tailwind-merge corrupts theme classes, and the cost is about 35-40 KB gz of the admin first load), the owner ruled **no shadcn** and no new UI package in Phase 5. The CLAUDE.md "Forbidden: any UI kit" rule stays as written. The in-house drawer, user menu, Modal, ConfirmDialog and Tabs get the motion.
- **D-38 Tailwind first:** Motion and styling use Tailwind utilities and variants as far as possible (`transition-*`, `duration-*`, `ease-*`, `motion-safe:`/`motion-reduce:`, `data-*`/`aria-*` variants, `starting:` where it fits). Custom CSS is used only where Tailwind cannot express it, for example a `@keyframes` block inside `@theme` in `web/src/ui/app.css`. Motion is 150-250 ms, causes no layout shift (CLS < 0.05), and nothing moves under `prefers-reduced-motion`. No animation library.
- **D-39 Dialogs and modals animate:** Every Modal (centered and `variant="slideover"`) and ConfirmDialog animates on open and close at all widths, mobile or not: the scrim fades, a centered dialog fades and scales, and a slide-over slides in from its edge and back out. Close finishes before unmount, focus return and the focus-trap stack still work, and later phases inherit this from the shared components.
- **D-40 Audit detail without personal data:** The audit log stores field names and role values only, never names or emails. The viewer shows "Name changed", "Email changed" and "Role: Admin to Manager". This replaces the UI-SPEC lines "Name: {old} to {new}" and "Email: {old} to {new}" and keeps `docs/operations/audit-log.md` intact.
- **D-41 Research defaults accepted:** For the remaining open questions in 05-RESEARCH.md, the contract defaults apply: scenario demo data ships inside the lazy showcase chunk while the parity entry, `visual/`, `AdminPreviewPage` and `/dev/*` routes stay out (Q3); `DELETE /api/v1/users/{id}` takes no row version, recorded as a SEC-06 wording deviation like `DELETE /api/v1/sessions/{id}` (Q4); a Manager-locked user gets no reset link and the same neutral response as a deactivated one (Q5); the `env()` safe-area padding goes in now and `viewport-fit=cover` is deferred to the PWA work (Q6); a wrong current password on profile changes counts toward the per-account lockout and rate limit (Q9).

### UI-SPEC owner rulings (owner, execute-phase 2026-10-17)
- **D-42 OQ-1 Account actions:** Contract default A. Each roster row keeps Edit, the Deactivate/Activate toggle (`user-x` / `user-check`) and Delete. Resend Invitation, Send Reset Link, Set Temporary Password and Lock/Unlock sit in the Edit panel's "Account access" section.
- **D-43 OQ-2 Audit Log nav:** Contract default A. A Sidebar item "Audit Log" (`history`, Manager tag) after Users, in the drawer too, not in the phone tab bar.
- **D-44 OQ-3 Deactivate confirm:** Contract default. Deactivate from the row opens a confirm dialog with "Keep Active" focused first; Activate stays one tap.
- **D-45 OQ-4 Manager changes a colleague's email (CHANGES the contract default):** The Manager chooses how it applies, each time they change someone else's email:
  - **Confirm by link** (the C-9 way, as planned in 05-40/05-30): a confirmation link to the new address, a notice to the old one, and the change applies on confirmation.
  - **Save at once:** the email changes immediately; a notice goes to the old address saying a Manager changed it; all of the person's sessions are revoked (same path as USER-05 role/status changes) so they sign in again with the new email; audited as "Email changed" (field name only, D-40). Uniqueness and the email rules still apply.
  - For an invited person with no password yet, the address moves at once and the invitation is replaced by a fresh 7-day one to the new address, whichever option is chosen (as planned).
  - The UI default selection is "Confirm by link". The API carries the choice explicitly; the server never infers it. The "changed by a Manager" notice is a new email in the P4 look, added to the 05-31 owner email review.
- **D-46 OQ-6:** Contract default. "Your current password is incorrect" shows under the Current password field with focus moved there; no danger toast.
- **D-47 OQ-8 / OQ-10:** Contract defaults. "{name} (former staff)" with a muted suffix; Add User's access choice is a RadioGroup of two rows with one-line descriptions.
- **D-48 OQ-7 / OQ-11 wording:** Build the UI-SPEC wording as written, but it is **not approved**: the owner reviews every new or amended string (screens and emails) before release. Parked in deferred-items.md for the 05-31 and 05-37 reviews.
- OQ-5 was already ruled by D-23; OQ-9 (six icons) shipped in 05-03.

### Gap-closure rulings (owner, 2026-10-19, after 05-VERIFICATION gaps_found)
- **D-49 WR-03 Temporary-password email is unproved until first sign-in:** An account created with a temporary password keeps `EmailConfirmed = false`. The first emailed sign-in code the person enters correctly proves the mailbox and sets it confirmed. Until then, forgot-password and any reset-link path send nothing for that account (same neutral response). Sign-in with the temporary password must still reach the code step. The Add User flow is unchanged for the Manager.
- **D-50 Security D-1 Keyed idempotency hash, fix now:** `IdempotencyRecords.RequestHash` becomes HMAC-SHA256 keyed from the existing required secret (`Auth:CodeMacKey`) with a purpose label, still 32 bytes (no schema change). Expired idempotency rows are deleted so the 24-hour lifetime is real before Phase 9 JOB-01. A test proves the stored hash changes under a different key.
- **D-51 WR-20 row-action spacing (owner, 2026-10-19): space.** Row actions (Edit, Deactivate, Delete) get 8 px between them and a full 44 x 44 px tap area each. The 6 px wider spacing is an accepted change to the approved row layout, recorded in the look-equality rulings.
- **D-53 WR-22 deferred (owner, 2026-10-19):** the 500 on two concurrent first-code submits goes to the next phase (a retry on conflict in `UserAccounts.ConfirmEmailAsync`).
- **D-54 IN-27 tell the Manager (owner, 2026-10-19):** when Send Reset Link does nothing because the person's address is unproved (D-49), the Manager sees a plain note that no link was sent and to set a temporary password instead, not "Reset link sent". This refines D-49's "same neutral response" for the Manager route only; forgot-password stays neutral. To implement next phase.
- **D-55 IN-28 end old-address reset links (owner, 2026-10-19):** confirming one's own email change also revokes open reset links, the same rule as WR-01. To implement next phase.
- **D-52 SEC-06 wording (owner, 2026-10-19): update.** With D-50, the SEC-06 text in REQUIREMENTS.md changes "a SHA-256 hash of the request body" to "a keyed HMAC-SHA256 of the request target and body (05 D-50)" and states that later POSTs remove expired keys in small batches before the Phase 9 JOB-01 purge.

### Claude's Discretion
- The exact deleted-marker shape (a nullable `DeletedAtUtc` vs a status enum value), as long as D-07..D-11 hold and the roster's status filter stays Active, Inactive, Locked.
- The scrambled-email format, which must be unique, non-deliverable and pass Identity validation.
- How the full-bleed height chain is built (`html`, `body`, `#root`, `min-h-dvh` and so on), and whether sticky uses `position: sticky` or a fixed-height grid with an inner scroll area, as long as D-01..D-05 hold and the skip link and focus order still work.
- Triage order of IN-01..IN-19, which is test-first where behavior changes, per the roadmap.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § "Phase 5: Profile & User Management": goal, success criteria 1-7, carry-overs from Phase 4
- `.planning/REQUIREMENTS.md`: PROF-01..04, USER-01..08, AUDIT-02, SEC-06 (idempotency on the new POSTs), SEC-07, SEC-08, WEB-10
- `.planning/PROJECT.md`: owner-decision and conflict tables (C-4, C-9, C-17, C-35, C-41, OD-14). Move these rulings into Key Decisions at transition.
- `CSPS-PRD.md`: user management, profile, audit and security behavior
- `CSPS-UI-SPEC.md`: Users, Add user and My profile screens, plus the `.s-rt` table and toolbar pattern for the audit log

### Prior rulings this phase builds on
- `.planning/phases/04-identity-authentication/04-CONTEXT.md`: D-02, D-05, D-06, D-13, D-19, D-21..D-25, D-28, D-29 (onboarding, temporary passwords, lockout, sessions)
- `.planning/phases/04-identity-authentication/04-REVIEW.md` and `04-REVIEW-DISPOSITION.md`: IN-01..IN-19 to triage
- `.planning/phases/04-identity-authentication/deferred-items.md`: the flaky resend-code test
- `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md`: D-02..D-05 (C-35 contrast, focus-visible actions), D-20 (dev code out of server builds; D-33 here is the narrow exception)
- `.planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md`: D-32 (append-only audit log, 8-month retention)

### Project rules
- `CLAUDE.md` and `.claude/CLAUDE.md`: OR-1..OR-6, D-08 merges, free-only, forbidden packages, perf budgets. Add the D-06 no-triggers rule to both.
- `docs/operations/branch-rules.md`: merge only through `tools/scripts/Merge-PullRequest.ps1`, on the owner's instruction

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/layouts/AdminLayout.tsx` (`adminClasses`, `adminSideClasses`, `adminMainClasses`, `adminBodyClasses`) and `web/src/components/layout/layout.recipe.ts` (`pageRootClasses` uses `min-h-full`, which doesn't reach the viewport unless the parent chain has a height). This is where D-01..D-05 land.
- `web/src/modules/admin/pages/SessionsPage.tsx` and `services/sessionsService.ts`: the Signed-in devices page that Security links to.
- `web/src/modules/admin/services/inviteService.ts`, `passwordService.ts` and `AcceptInvitePage.tsx`: Phase 4 invitation and password flows to reuse for Manager invites and temporary passwords.
- `src/Csps.Application/Users/BootstrapManagerHandler.cs`: creating an invitation token (`AccountToken.Create(..., AccountTokenPurpose.Invitation, ...)`) and enqueuing `InviteEmail` through the outbox.
- `src/Csps.Application/Auth/AuthSettings.cs`: `InviteLinkLifetime` (72 h, which becomes 7 days per D-13) and `PasswordLockoutDuration`.
- `web/src/dev/ComponentShowcase.tsx`, `ShowcaseDemos.tsx`, `showcaseSections.ts`: the showcase to promote (D-30..D-33). It's wired in `web/src/modules/admin/routes.tsx` under `devRoutes` (`__DEV_ROUTES__`).
- The shared component barrel `@/components` (data, lists, overlays incl. ConfirmDialog, feedback/banners, status badges, `EmptyValue`).

### Established Patterns
- `RowVersion` with `.IsRowVersion()` already exists on AccountToken, EmailOutboxMessage, SiteSettings, TwoFactorChallenge and UserSession. Users need the same (via Identity's `ConcurrencyStamp`, or a dedicated rowversion; the planner decides) for D-20.
- Audit: `AuditLogAppendOnlyInterceptor` plus `TR_AuditLog_AppendOnly` (`AuditEntryConfiguration.TriggerName`). That trigger is the only one allowed (D-06).
- Controllers: one `[ApiController]` per resource, an explicit `[Authorize(Policy=...)]` or `[AllowAnonymous]`, and authorization-matrix tests over every action × {anonymous, Admin, Manager}.
- Every state-changing POST needs an `Idempotency-Key` (SEC-06), unless it's on the written allow-list.
- Web: zod schemas mirror the API validators (OR-3), services go per module (OR-5), and the URL holds list state through nuqs (WEB-10).

### Integration Points
- New controllers: Users (roster), Profile (me), AuditLog. They map under `/api/v1`, with the Manager policy on Users, AuditLog and the showcase route.
- Session revocation on role or status change reuses the Phase 4 session and refresh-family revocation.
- SEC-08 columns (`CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt`) on users first. Existing rows show "System".

</code_context>

<specifics>
## Specific Ideas

- The owner's screenshots: `/admin/sessions` on the live site shows the peach strip under a short page (D-01), and `/dev/components` locally shows clipped sidebar labels (D-05).
- The showcase is for the owner's own demo to someone from their day job. That person is not a user of this app.
- The temporary password looks like `Tela-Sukat-7381` (04 D-21), never the design's fixed `Csp-tahi-4821`.

</specifics>

<deferred>
## Deferred Ideas

- **Audit-log CSV export** of the current filter (itself audited): a later phase, possibly Phase 14 release readiness or a reporting phase.
- **Theme saved on the account across devices:** declined for now (D-22). Revisit if staff ask for it.

</deferred>

---

*Phase: 05-profile-user-management*
*Context gathered: 2026-10-17*
