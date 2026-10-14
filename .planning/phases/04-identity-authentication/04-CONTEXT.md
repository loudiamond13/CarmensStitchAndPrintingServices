---
created: "2026-10-14T07:55:00-05:00"
updated: "2026-10-14T07:55:00-05:00"
phase: 04-identity-authentication
kind: context
---

# Phase 4: Identity & Authentication - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning (after the owner's mail-setup prerequisite, D-34)

<domain>
## Phase Boundary

Staff (Admin, Manager) sign in with email + password + a mandatory 6-digit code sent by email. They stay signed in the way they chose, recover a forgotten password by email, are forced to set a new password when required, and can sign out of this device or all other devices. A first Manager is bootstrapped on an empty database. Auth emails go through an outbox from `no-reply@cspstailoring.com`. Every auth event is audited, every state-changing POST is idempotent (SEC-06), and auth endpoints are rate-limited (SEC-03).

Requirements: AUTH-01..13, QUAL-05, SEC-03, SEC-06, A11Y-03, AUDIT-01. The Phase 4 roadmap entry is the scope anchor. The owner ruled every open decision for this phase in this discussion (OD-12, OD-14, C-4, C-5, C-6, C-7, C-8, C-9, C-17, C-19, C-23, C-33, AD-1..AD-7). Phase 3 (CI/staging) is still deferred, so Phase 4 ships on local gates only (see RESEARCH "Phase 3 Deferral").

Two rulings below **pull small pieces into Phase 4** that were not in the original phase text, because they sit inside the sign-in flow: the "must set a new password" step (D-13) and invite-link acceptance for the bootstrap Manager (D-29). The Manager-facing buttons (set a temporary password, send an invite or a reset link) stay in Phase 5.
</domain>

<decisions>
## Implementation Decisions

### Sign-in screens & sessions
- **D-01 (C-6):** The code step uses the sign-in card's look on **its own route, `/admin/login/verify`**, so Back and refresh behave predictably. Contents: "Check your email", the 6-box `OtpInput` (`autocomplete="one-time-code"`, paste works), a Verify button, "Resend code in 0:42", and "Use a different account". It **never auto-submits** on the 6th digit.
- **D-02 (C-8):** Deactivated, locked, unknown email and wrong password all get the **same generic error** ("Email or password is incorrect.") with similar timing (CWE-204). The UI spec's "This account is deactivated." banner is not built (SPEC-DEVIATION).
- **D-03 (C-19):** "Keep me signed in" is **unticked by default** (SPEC-DEVIATION from the design). Ticked: 90-day absolute session. Unticked: a session cookie that ends when the browser closes, with a hard 12-hour cap (the real limit, because browsers may restore sessions).
- **D-04 (C-17):** "Sign out of all devices" goes in the **admin user menu now**, next to Sign out, behind a confirm dialog. Phase 5 may also show it on the profile page.
- **D-05 (owner, sign-out-all scope):** "Sign out of all devices" signs out **every other device and keeps the current one** signed in (revoke every refresh family except the caller's; other access tokens die within their 15-minute life or sooner through revocation). The confirm dialog and success message must say "other devices". A password reset (D-19) and a Manager-set temporary password (D-24) still end **all** sessions, including the current one.
- **D-06 (C-17):** Screens the design doesn't draw are built from existing parts (login layout, Field, PasswordField, OtpInput, Button, banners) and marked `// SPEC-GAP:`. That covers the code step, forgot password, reset password, "set your new password" (D-13), invite acceptance (D-29), the "session ended" message (R2-09) and the sign-out-all confirm. The owner reviews them and their wording in `/gsd-ui-phase 4`.
- **D-07:** After sign-in, staff return to the **page they were trying to open**. The return path must be a same-origin relative path under `/admin` (CWE-601 allow-list; reject absolute URLs, `//`, backslashes and encoded tricks). Otherwise they land on the dashboard. The return path never carries tokens or codes.
- **D-08 (owner override of the recommendation):** The code email's **subject contains the code**, e.g. "482913 is your CSPS sign-in code", so staff can read it from the notification. The owner accepts that the code shows on lock-screen notifications. The code still lasts 15 minutes and is single-use (AUTH-03), and the subject never contains anything else secret.
- **D-09:** The sign-in page **never pre-fills or remembers** an email (no localStorage/cookie). Browser and password-manager autofill still work (`autocomplete="username"`).
- **D-10:** When the resend cap (5 per hour) is hit, the code screen shows a plain message ("You've asked for too many codes. Try again in a little while."), disables Resend and **gives no exact wait time**.

### Passwords & recovery
- **D-11 (C-5, owner override of NIST, AMENDS AUTH-11):** The password rule is **at least 8 characters with at least one number and one symbol**, and **at most 64 characters**. Any printable characters, including spaces, are allowed. The help text follows the design's wording ("Use 8+ characters with a number and a symbol."). The owner ruled this against the NIST recommendation after seeing the trade-off. REQUIREMENTS.md AUTH-11 (and the AUTH-09 "policy" reference, roadmap success criterion 4) must be updated to this rule. Server validator and client zod schema mirror each other, and the server is the authority. — **Reversibility:** costly — tightening later forces existing users through a change flow; the stored hashes are unaffected.
- **D-12 (C-5 extras):** These checks **stay** on top of D-11:
  - the breached-password check (HIBP k-anonymity, 5-char SHA-1 prefix only), with D-14's fallback
  - "can't contain your email or name" (D-15)
  - a strength meter (weak/fair/strong from length and variety; in-house, no zxcvbn)
  
  The "up to 128 characters" option was **not** kept (D-11 caps at 64).
- **D-13 (owner):** **Phase 4 builds a "must set a new password" gate.** A per-user flag (relational column), when set, makes sign-in go password → emailed code → a "Set your new password" screen, and **no full session is issued** until a valid new password is saved. The flag is set by (a) a Manager-set temporary password (D-21; the Manager button is Phase 5, so Phase 4 tests it through a test-made temporary password), and (b) the late breach finding (D-18). Saving the new password clears the flag, enforces the full rule (D-11, D-12, D-15) and sends the "password changed" email.
- **D-14 (C-33):** If HIBP is unreachable, **fail open with a local floor**. First check a bundled list of the ~10,000 most common passwords (SecLists top-10k, MIT, approved in D-36; record its license and legitimacy in RESEARCH/`docs/dependencies.md`). If the password passes, accept it, write an audit entry ("breach check unavailable"), and mark the password for a re-check. The `bootstrap-manager` path **fails closed**.
- **D-15 (AD-6):** The name check is **"can't contain"**: refuse a password that contains (case-insensitive) the email's local part, the first name or the last name. Parts shorter than 3 characters are ignored, so a name like "Al" doesn't block everything.
- **D-16 (C-7):** Forgotten passwords have **two routes**:
  1. A self-service email reset (AUTH-08): request → "If an account exists, we sent a link" → a hashed, single-use 30-minute link → set a new password.
  2. Manager help in Phase 5: a Manager can **send a reset link** (USER-07) **or set a temporary password** (D-21).
- **D-17:** After a reset, the person goes **back to sign-in** with "Your password was changed. Sign in with your new password." They sign in normally (password + code). There is no auto sign-in.
- **D-18:** A password accepted while HIBP was down (D-14) is re-checked at the next successful password verification. If it is found in a breach, the **must-change flag** (D-13) is set, and after the code step the person sees "Your password appeared in a data breach. Set a new one."
- **D-19:** A successful reset **revokes all sessions** (AUTH-09), sends the "password changed" email, and **clears an active lockout** (AUTH-07). It never reactivates a deactivated account (AUTH-10).
- **D-20:** A **deactivated** user who requests a reset sees the same generic on-screen response. Their inbox gets **"Your account is deactivated. Ask a Manager if you need access."** with no link. Unknown emails get no email. Both paths keep the same timing (the D-33 floor).
- **D-21 (C-4/C-7 temporary passwords; built in Phase 5, contract fixed now):** A Manager-set temporary password is **prefilled with a random, readable value** (e.g. `Tela-Sukat-7381`; never the design's fixed `Csp-tahi-4821`), which the **Manager may edit**. An edited value must meet **only the basic rule** (D-11 length and composition), not the breach or name checks, because the person must replace it at first sign-in (D-13), where the full checks apply. It **never expires** while unused (owner choice). It still requires the emailed code at sign-in (D-22).
- **D-22:** Signing in with a temporary password **still requires the emailed 6-digit code**, then the D-13 "Set your new password" step.
- **D-23 (C-4):** New staff onboarding (Phase 5) offers **both**: an emailed invitation link (the person sets their own password; same `AccountTokens` machinery, Purpose=Invitation) or a Manager-set temporary password (D-21). USER-02 ("without the Manager ever seeing or setting their password") must be amended in Phase 5 to allow the temporary-password route.
- **D-24:** When a Manager sets a temporary password (Phase 5), **all of that person's sessions are revoked** and they get a "your password was reset by a Manager" email.
- **D-25:** The **lockout email** explains the 15-minute lock and when it ends, and says "If this wasn't you, reset your password", linking to the Forgot-password **page** (not a ready-made reset token).

### Email
- **D-26 (OD-12):** The sender is a **new dedicated mailbox `no-reply@cspstailoring.com`**, used only by the app, with display name **"Carmen's Stitch & Printing"** and **no Reply-To**. The body says replies aren't read. Mail goes through SmarterASP.NET's SMTP over TLS (`SecureSocketOptions.StartTls` or SSL, never `None`), and DKIM is aligned to `cspstailoring.com`. SPF and DMARC are **merged, never replaced** (HOSTING-RECORD D-12: SPF `-all`, DMARC `p=reject`).
- **D-27 (AD-4, owner override of the recommendation):** Local development **always sends real email** through SMTP, with credentials in `dotnet user-secrets` (never in git or appsettings). There is no Debug file-drop default. Automated tests never send real mail: integration and E2E tests use the Testing-only sink (D-37).
- **D-28 (C-9; built in Phase 5):** An email change sends a confirmation link to the new address and a notice to the old one, and applies only after confirmation.
- **D-29 (owner, AUTH-12):** The `bootstrap-manager` CLI creates the first Manager and **sends an invite email** (Purpose=Invitation, hashed single-use token) instead of taking a typed password. So **Phase 4 builds invite acceptance**: the token-validated "Set your password" screen (D-06 SPEC-GAP), the full password checks with HIBP **fail-closed** for this path (D-14), and then a normal sign-in with the code. AUTH-12's test: a freshly migrated empty `CSPS_Test_<guid>` → bootstrap → invite read from the sink → set password → full sign-in. The invite link lifetime is planner's discretion (suggest 72 hours, since the Manager may not act at once; the CLI can re-send). The CLI refuses to run when an active Manager already exists. Real production bootstrap needs working SMTP on the host (Phase 3 first deploy).
- **D-30:** Emails are **"fancy" branded HTML** with the **logo embedded as an inline (CID) attachment** (not a remote image, so it shows without "load images" and before the site is live), plus a **plain-text alternative** for deliverability. No tracking pixels or remote resources. Design follows the site's colors and fonts within email-safe limits. The owner reviews mockups of every auth email (code, lockout, reset, password changed, reset-by-Manager, deactivated notice, invite) in **`/gsd-ui-phase 4`**.
- **D-31:** Emails are **English only**.
- **D-32:** The code email states **when and from what browser/device** the sign-in was requested, e.g. "Requested Oct 14, 2026, 3:42 PM from Chrome on Android". Time is in business time (Asia/Manila, en-PH). The browser and device come from a coarse User-Agent parse (in-house, no package). No IP and no location.
- **D-33 (mail outage):** If SMTP fails, the code screen still appears normally. The outbox retries quietly for about 10 minutes, the person can press Resend after 60 s, and lasting failures are logged (no secrets in logs, CWE-532). Nothing on screen reveals account state.
- **D-34 (owner prerequisite, BEFORE execution starts):** The owner, following a step-by-step checklist the plan provides:
  1. creates `no-reply@cspstailoring.com` in the SmarterASP mail panel
  2. enables DKIM there and **adds** its TXT record to DNS without touching the existing SPF and DMARC
  3. puts the SMTP credentials in local user-secrets
  4. sends a test message to Gmail and pastes the SPF/DKIM/DMARC result lines into HOSTING-RECORD (D2)
  
  Execution starts after that paste, because dev sign-in always uses real mail (D-27). If the owner is away, interaction needs go to the backlog (user memory "Away-mode backlog") and are never auto-approved.

### Security limits & technical approvals
- **D-35 (AD-1):** Apply the **2026-10-13 .NET security release now**: runtime 10.0.13, SDK 10.0.402, `Microsoft.*` 10.0.13 pins, and `System.Security.Cryptography.Pkcs`/`Xml` 10.0.13. Record it as a security exception to the 14-day cool-down.
- **D-36 (AD-2):** The owner **approved these exact versions**:
  - Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.13
  - FluentValidation 12.1.1
  - MailKit 4.18.1 and MimeKit 4.18.1 (pinned), with BouncyCastle.Cryptography 2.7.0
  - Microsoft.Extensions.Http.Resilience 10.10.0
  - Microsoft.Extensions.Diagnostics.Testing 10.10.0 (tests)
  - react-hook-form 7.89.0, zod 4.6.5, @hookform/resolvers 5.9.1
  - msw 3.0.1 (dev)
  - the SecLists top-10k common-password list (MIT, data file)
  
  If a newer version is ≥14 days old with no advisories at install time, ask the owner before switching (user memory "Package approval").
- **D-37 (AD-3):** The E2E API host runs in a dedicated **`Testing` environment**, where the code/link sink exists. User-secrets load for Testing only behind an explicit switch set in Playwright `webServer.env`. The sink is **compiled out of Release**, and an ArchitectureTests check builds Release and proves it's absent (QUAL-05).
- **D-38 (C-23):** The refresh cookie is **`__Secure-csps_rt`**, `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, plus the anti-CSRF header (AUTH-05). The owner expects no other apps on `*.cspstailoring.com` subdomains. — **Reversibility:** costly — renaming or rescoping later signs everyone out once.
- **D-39 (AD-5):** These limits are approved, all configurable:
  - refresh grace window: 30 s
  - minimum response time for sign-in and forgot-password: 500 ms
  - cross-ticket cap: 10 wrong codes per hour → 15-minute lock + email
  - forgot-password: at most 3 emails per hour per account
  - per-IP sign-in: 10/min
  - per-IP 2FA verify: 10/min
  - per-IP resend: 5/min
  - per-IP forgot: 5 per 15 min
  - per-IP reset: 10 per 15 min
  - per-IP refresh: 60/min
  
  Per-IP limits use `RemoteIpAddress` only until Phase 3 verifies the proxy topology.
- **D-40 (AD-7):** Idempotency stores and replays **successes and input-error answers (400, 404, 422)**. 401, 403, 409, 429 and 5xx are not stored, so they may run again with the same key, matching the Phase 2 client rule R2-08. Allow-listed (no key, responses never stored): sign-in, 2FA verify, resend, refresh, sign-out and sign-out-all, each with a written reason. The planner confirms the final allow-list. Forgot-password and reset **are** covered (a repeated forgot post queues one email).
- **D-41 (OD-14):** Design-vs-WCAG clashes on these screens (e.g. the small "Forgot password?" target, countdown announcements, error-banner focus) are **ruled item by item in `/gsd-ui-phase 4`** with before/after, as in Phase 2.

### Claude's Discretion
- Table, column, route and audit action-code names, and the port/interface names (within the AuditEntry rules and the no-JSON-columns rule).
- The invite-link lifetime (D-29; suggest 72 h), the readable temporary-password word list (D-21; Phase 5), the User-Agent parse granularity (D-32), and the outbox retry schedule within about 10 minutes (D-33).
- Whether bad-credential answers are 401 or 400 (RESEARCH Open Question 4).
- The final idempotency allow-list (D-40), with a written reason per entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase research and scope
- `.planning/phases/04-identity-authentication/04-RESEARCH.md` — patterns 1–14, pitfalls 1–13, Wave 0 blockers (incl. WR-02 IpPrefix fix before any audit write), package audit, Phase 3 deferral table, validation map. Where its "Owner Decision Briefs" differ from this file, **this CONTEXT wins**.
- `.planning/ROADMAP.md` — Phase 4 entry (goal, success criteria 1–6, research flags).
- `.planning/REQUIREMENTS.md` — AUTH-01..13, SEC-03, SEC-06, QUAL-05, A11Y-03, AUDIT-01, WEB-09. **AUTH-11 must be amended per D-11**, and USER-02 is flagged for amendment in Phase 5 per D-23.

### Product and design specs
- `CSPS-PRD.md` §6.1 (AUTH), §8 (Authentication & Session Design: 8.1 token model, 8.2 second factor, 8.3 Identity config, 8.4 password policy, which D-11 overrides), §11 (security, CWE map, HTTP hardening, audit log).
- `CSPS-UI-SPEC.md` — login screen and layout, PasswordInput/OtpInput, the "Keep me signed in" checkbox (D-03 deviation) and the password help copy (D-11 matches the design).
- `.planning/PROJECT.md` — owner-decision and conflict tables (OD-12, C-4..C-9, C-17, C-19); move the rulings into Key Decisions at transition.

### Hosting, email, prior decisions
- `.planning/HOSTING-RECORD.md` §D and the email consequences — sender domain `cspstailoring.com`, SPF `-all`, DMARC `p=reject`, merge-never-replace, D2 Gmail check still due (D-34).
- `.planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md` — D-12 (email sender), D-13 (no JSON columns), D-15 (Data Protection), D-24/D-25 (audit), D-08 (no startup seeding).
- `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md` — R2-08 (idempotency key reuse), R2-09 (session-ended copy), R2-10 (inert behind dialog), D-20 (admin routes excluded from production builds until sign-in exists).
- `docs/license-exceptions.json`, `docs/dependencies.md` — record D-35/D-36 approvals and the SecLists data file.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/ui/entry/OtpInput.tsx`: the 6-box code entry for D-01.
- `web/src/ui/forms/PasswordField.tsx`: password field with reveal, for sign-in, reset, set-new-password and invite acceptance. The strength meter (D-12) is added next to it.
- `web/src/lib/http/httpClient.ts`: has the `refresh`, `onUnauthorized` and `skipAuthRefresh` hooks plus the secret-query-param guard (rejects `code`). Phase 4 wires the real single-flight refresh.
- `web/src/lib/forms/useSubmission.ts`: one `Idempotency-Key` per submission, reused on retry (WEB-09, R2-08). It pairs with D-40.
- `web/src/app/admin/AdminLayout.tsx`, `web/src/app/router.tsx`: route guard, `/admin/login` and `/admin/login/verify`, and the user-menu "Sign out of all devices" item (D-04).
- `src/Csps.Application/Ports/IAuditTrail.cs`, `src/Csps.Domain/Auditing/AuditEntry.cs`, `src/Csps.Infrastructure/Auditing/AuditTrail.cs`: the audit write path for AUDIT-01 auth events.
- `src/Csps.Domain/Auditing/IpPrefix.cs`: /24 and /48 truncation. **WR-02 must be fixed first** (RESEARCH Wave 0).
- `src/Csps.Domain/Common/Result.cs`, `src/Csps.Application/Ports/IRequestContext.cs`: handler results → ProblemDetails, and the current user/IP.

### Established Patterns
- Controllers: one per resource under `/api/v1`, thin actions, explicit `[Authorize(Policy)]` or `[AllowAnonymous]`, `SuppressModelStateInvalidFilter`, FluentValidation in handlers.
- Default-deny plus a discovery-driven authorization-matrix test. The SEC-06 discovery test joins it.
- EF Core code-first with Fluent config, no JSON columns, compat 160, migrations only, nothing at startup. `TimeProvider` everywhere.
- Tests: xunit.v3 on MTP, LocalDB `CSPS_Test_<guid>` with Respawn (beware it wiping migration-seeded roles, Pitfall 7), `FakeTimeProvider`. Web: Vitest + RTL + MSW, Playwright on 5199.

### Integration Points
- `src/Csps.Infrastructure/DependencyInjection.cs`: Identity (`AddIdentityCore`), the outbox `BackgroundService`, MailKit `IEmailSender`, the HIBP `HttpClient` with resilience, and HybridCache revocation.
- Server `Program.cs`: JWT bearer, rate limiter, idempotency filter, the Testing-only sink registration (D-37), the request body limit.
- `tools/`: the new `bootstrap-manager` command (D-29), next to the dev seed tool, with the same DB-name guard style.
</code_context>

<specifics>
## Specific Ideas

- Code email subject: "482913 is your CSPS sign-in code" (D-08). Body includes "Requested {date, time} from {browser} on {device}" (D-32).
- Sender: "Carmen's Stitch & Printing" <no-reply@cspstailoring.com>, no Reply-To (D-26).
- Password help text: "Use 8+ characters with a number and a symbol." (design wording, D-11).
- Generic sign-in error: "Email or password is incorrect." Reset request: "If an account exists, we sent a link". After reset: "Your password was changed. Sign in with your new password." Resend cap: "You've asked for too many codes. Try again in a little while." Late breach: "Your password appeared in a data breach. Set a new one." Deactivated reset email: "Your account is deactivated. Ask a Manager if you need access." All final wording goes through `/gsd-ui-phase 4`.
- Temporary password example style: `Tela-Sukat-7381` (random, readable; Phase 5).
- The owner wants the emails to "look good and fancy", with the logo.
</specifics>

<deferred>
## Deferred Ideas

- Manager UI to set a temporary password, send an invite or send a reset link: **Phase 5** (USER-02, USER-07; contracts D-21, D-23, D-24).
- The email-change flow: **Phase 5** (D-28).
- "Sign out of all devices" on the profile page: **Phase 5** (D-04).
- Real SMTP and HIBP reachability from the host, `Set-Cookie` on production HTTPS, real bootstrap on the hosted DB: **Phase 3** first deploy.
- Purging expired idempotency, outbox and token rows: JOB-01 (later phase).
- SMS or authenticator-app second factor: AUTH-V2-01 (keep the `ISecondFactorDelivery` seam only).
</deferred>

---

*Phase: 04-identity-authentication*
*Context gathered: 2026-10-14*
