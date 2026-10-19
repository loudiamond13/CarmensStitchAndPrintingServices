---
phase: "05"
slug: "profile-user-management"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-10-18T20:30:33-05:00"
updated: "2026-10-18T20:30:33-05:00"
---

# Phase 05: Security

*Created: 2026-10-18T20:30:33-05:00 · Updated: 2026-10-18T20:30:33-05:00*

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of plans 05-01 to 05-43: 107 unique threats (T-05-01 to T-05-106, plus T-05-SC repeated in every plan). One `gsd-security-auditor` run (ASVS level 1, static inspection, no tests run) checked each mitigation in the code and the test the plan claims, and returned SECURED with 0 open threats. The phase test run on the same day (.NET 3,250 passed, 1 skipped) backs the cited tests.

---

## Trust Boundaries

| Boundary | Description | Plan |
|----------|-------------|------|
| browser rendering | Pure CSS and markup changes; no data crosses a boundary | 05-01 |
| browser UI state | Overlay state only; no data crosses a boundary | 05-02 |
| server session response → browser shell | The role string from `/api/v1/auth/*` drives navigation and route guards | 05-03 |
| URL → route loaders | `/admin/users`, `/admin/audit-log` and the return path are attacker-typable | 05-03 |
| migrations → production database | Every schema object reaches production through the reviewed idempotent script | 05-04 |
| anonymous → sign-in | Attackers probe whether an email belongs to a locked or deleted account | 05-05 |
| migration → production data | The script runs once on the live database through the owner's reviewed script | 05-05 |
| email inbox → invite link | A 7-day bearer link reaches the new staff member's mailbox | 05-06 |
| HIBP range API → server | Untrusted response bodies from an external service | 05-07 |
| host configuration → email links | Operator-supplied base URL becomes every link staff click | 05-07 |
| operator CLI → database | The bootstrap command decides whether a target is local | 05-07 |
| browser UI state | Overlay and menu state only; no data crosses a boundary | 05-08 |
| signed-in staff → /api/v1/profile | Body fields are untrusted; the target is always the token's user | 05-09 |
| anonymous → auth endpoints | Any of the auth steps may be called by a locked or deleted person or an attacker holding an old cookie or link | 05-10 |
| request body → entity | Clients may send any JSON member, including attribution names | 05-11 |
| access token → actor | The actor comes only from the validated token's sub | 05-11 |
| signed-in session → password change | A stolen or unattended session could try to take over the account | 05-12 |
| server → HIBP | The breach range lookup leaves the network (k-anonymity prefix only) | 05-12 |
| URL → tab state | `tab` is attacker-typable (CWE-20) | 05-13 |
| server → profile view | Names and emails are rendered from the API | 05-13 |
| signed-in session → email change | A stolen session tries to move the account to an attacker's inbox | 05-14 |
| email inbox → anonymous confirm | Bearer tokens arrive by email; mail scanners may open links | 05-14 |
| signed-in session → resend and cancel | A session controls its own pending change | 05-15 |
| anonymous → check and confirm | Bearer links from email | 05-15 |
| email link → browser | The token arrives in the URL fragment of an anonymous page | 05-16 |
| Manager browser → /api/v1/users | Query strings (q, role, status, page) are untrusted | 05-17 |
| Admin session → Manager resource | A lower role probing the roster | 05-17 |
| browser form → profile API | Passwords and email addresses typed by the user | 05-18 |
| Manager browser → POST /api/v1/users | Names, email, role and a temporary password cross here | 05-19 |
| email → new staff member | A 7-day invitation link | 05-19 |
| URL → roster state | q, role, status, page and size are attacker-typable | 05-20 |
| API → roster cells | Names and emails rendered in the table | 05-20 |
| Manager browser → lifecycle actions | Target ids in the URL; two Managers may act at once | 05-21 |
| revoked session → API | A deactivated person still holds an access token for up to 15 minutes | 05-21 |
| browser → clipboard | The temporary password is copied out of the app | 05-22 |
| Manager form → POST /api/v1/users | A temporary password travels once to the server | 05-22 |
| Manager browser → PUT /api/v1/users/{id} | Role and names for another account; the version | 05-23 |
| Manager browser → lock and unlock | Target ids in the URL; simultaneous Managers | 05-24 |
| API → Edit panel | Names, emails and actor names rendered from the server | 05-25 |
| Manager form → PUT | The version and the edited fields | 05-25 |
| Manager browser → DELETE | Target id in the URL; no version (D-21) | 05-26 |
| deleted account → auth endpoints | Old cookies, tokens and links of the deleted person | 05-26 |
| Manager browser → account-access actions | Target ids; a temporary password in one request body | 05-27 |
| email → staff member | Invitation and reset links | 05-27 |
| Manager UI → lifecycle API | Destructive actions on other accounts | 05-28 |
| Manager browser → audit-log API | Filter values are untrusted | 05-29 |
| audit data → viewer | Stored entries, truncated IPs and device families | 05-29 |
| Manager UI → account-access API | Immediate actions on another account; a temporary password typed or generated in the browser | 05-30 |
| preview tool → SMTP or disk | Development-only tool that can send real mail | 05-31 |
| browser rendering | Shared components only; no data boundary | 05-32 |
| URL → audit filters | range, from, to, actor, action, target are attacker-typable | 05-33 |
| API → audit rows | Names, IP prefixes and device families rendered | 05-33 |
| server → HIBP | An external call made during reset and invite acceptance | 05-34 |
| application → logs | Records may be logged by framework code | 05-34 |
| public static assets → anyone | JS chunks are downloadable without signing in even when the route is guarded | 05-35 |
| Manager session → showcase | The page runs inside the real admin shell | 05-35 |
| URL → sign-in return path | `returnTo` is attacker-typable | 05-36 |
| refresh responses → session state | Network failures and peer tabs change the session | 05-36 |
| review tooling → local host | The review pack signs in seeded test staff on the E2E host | 05-37 |
| repo → public | Docs and records are public | 05-37 |
| profile save → append-only audit log | Entries are kept 8 months and cannot be scrubbed | 05-38 |
| signed-in session → email-change request | A stolen session tries to move the account to another inbox | 05-39 |
| email inbox → anonymous check | Bearer links from email; mail scanners may open them | 05-39 |
| Manager browser → PUT /api/v1/users/{id} | A new email for another account | 05-40 |
| email inbox → confirmation link | The new owner of an address confirms a Manager-started change | 05-40 |
| Manager browser → audit people list | Names of every staff member ever recorded | 05-41 |
| public static assets → anyone | The showcase chunk is downloadable without signing in | 05-42 |
| handlers → append-only audit log | Detail words become a permanent record | 05-43 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|----------|-------------|------------|--------|----------|
| T-05-01 | Tampering | Strict CSP (style-src 'self') regressed by layout work | medium | mitigate | Utilities only, no style attribute or injected style; the e2e guard's CSP listener and zero-console rule fail any violation | closed | `src/Csps.Server/Http/SecurityHeadersMiddleware.cs:17` (`style-src 'self'`); e2e CSP listener `web/e2e/fixtures.ts:50-55,172-178`; no `style=`, injected style or HTML sink added |
| T-05-02 | Denial of Service | Content hidden behind the pinned tab bar or clipped by a sticky sidebar (users cannot reach controls) | low | mitigate | Geometry tests assert the last main element clears the bar and Logout is reachable at short heights | closed | `web/e2e/shell.spec.ts:74-98` (last content clears the tab bar), `:191-208` (Logout in view on short screens) |
| T-05-03 | Tampering | Strict CSP regressed by motion code (an injected style element, as Radix does) | high | mitigate | Keyframes live in the bundled stylesheet; no style attribute, no injected style element; e2e CSP listener and zero-console guard; no new package (D-37) | closed | Keyframes in `web/src/ui/app.css:59-110`; same CSP guard as T-05-01; no manifest change |
| T-05-04 | Elevation of Privilege | A closing dialog still trapping focus or leaving the page inert, so a destructive action's dialog could be re-triggered blindly | low | mitigate | Trap, inert and scroll lock released at close start; closing layer has pointer-events none; Esc and scrim ignored while closing (tests) | closed | `web/src/components/overlays/Modal.tsx:123-128,223`; `overlays.recipe.ts:47`; `Modal.test.tsx:409-480` |
| T-05-05 | Elevation of Privilege | Shell role mapping (IN-17: unknown role became Manager) | medium | mitigate | Exact two-value mapping; anything else ends the session; tests for casing drift, unknown and empty roles; the server's Manager policy stays the real guarantee (403) | closed | `web/src/modules/admin/services/session.ts:85-89` (exact two-value `toRole`); `session.test.ts:124-171` |
| T-05-06 | Information Disclosure | Manager-only pages rendered to Admins | medium | mitigate | requireManagerLoader redirect before any page chunk loads; API 403 matrix rows land with each endpoint plan | closed | `web/src/modules/admin/guard.ts` `requireManagerLoader` on `users` and `audit-log`; API 403 rows `AuthorizationMatrix.cs:121-147` |
| T-05-07 | Spoofing | Open redirect through the sign-in return path (CWE-601) | low | mitigate | Existing safeReturnUrl reused unchanged; the Manager redirect target is the constant /admin | closed | `guard.ts` `safeReturnUrl`; Manager redirect is the constant `/admin`; `guard.test.ts:28-65` |
| T-05-08 | Tampering | Hidden business logic in a new trigger (OR-7) | medium | mitigate | TriggerInventoryTests fails on any trigger other than TR_AuditLog_AppendOnly and on any extra CREATE TRIGGER in the production script | closed | `tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs:14-76` |
| T-05-09 | Repudiation | Weakened rate-limit proof (resend cap) hiding a regression | low | mitigate | Cap, 429 code and no-Retry-After assertions kept; fix targets the wait only | closed | `tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs:155`; `05-04-SUMMARY.md` |
| T-05-10 | Information Disclosure | Sign-in revealing Manager-locked or deleted state (CWE-204) | medium | mitigate | Same generic 401 and ResponseFloor timing as a wrong password; audit detail only server-side | closed | `src/Csps.Application/Auth/SignInHandler.cs:73-76,108-110`; `InactiveAccountTests.cs:101` |
| T-05-11 | Tampering | Migration damaging production rows | high | mitigate | Additive columns only, idempotent backfill reading AuditLog only, applied twice in MigrationScriptTests, owner applies the reviewed script (Prime Directive 11) | closed | `Migrations/20261018012015_AddUserManagement.cs:67-78` (additive, backfill reads `AuditLog` only); `MigrationScriptTests.cs:50`; `UserManagementMigrationTests.cs:51` |
| T-05-12 | Elevation of Privilege | A blocked account still signing in because a path forgot the new columns | high | mitigate | One IsBlocked rule; sign-in here, every other auth path in 05-10 with a table-driven test | closed | One rule `UserAccount.cs:35`, used in `SignInHandler.cs:73`, `RefreshHandler.cs:65`, `VerifyCodeHandler.cs:70`, `ResendCodeHandler.cs:58`, `AccountLinkLookup.cs:49`, `PendingPasswordChangeLookup.cs:36` |
| T-05-13 | Spoofing | Longer-lived invite link exposure window | low | accept | Owner ruled 7 days (D-13); the token stays hashed, single-use, fragment-only, and a resend replaces it (05-27); the breach check is fail-closed on acceptance (04 D-29) | closed | Accepted: `05-06-PLAN.md` register (owner ruled 7 days, D-13); `05-06-SUMMARY.md` |
| T-05-14 | Repudiation | Copy and real lifetime drifting apart | low | mitigate | The email wording is computed from the token's ExpiresAt; tests pin 7 days, 24 hours and minutes | closed | `src/Csps.Infrastructure/Email/EmailRenderer.cs:99-105,175`; `EmailRendererTests.cs:88-98` |
| T-05-15 | Denial of Service | HIBP answer read without a size cap on a 256 MB pool (CWE-400) | medium | mitigate | 1 MB MaxResponseContentBufferSize; oversized answers become the existing unavailable outcome | closed | `PasswordCheckRegistration.cs:21,58` (1 MB buffer cap); `HibpPwnedPasswordsTests.cs:158` |
| T-05-16 | Spoofing | Email links built from a base URL with user info (phishing-shaped links, CWE-601) | medium | mitigate | IsValid refuses user info and sub-paths at start-up without echoing the value | closed | `AppLinksOptions.cs:44-52`; `EmailRegistration.cs:34-35` (`ValidateOnStart`); `AppLinksOptionsTests.cs:40-50` |
| T-05-17 | Tampering | Bootstrap CLI treating a local server as remote, skipping the CSPS_* allow-list | low | mitigate | Bracket trimming and pipe parsing with tests; protected names still refused by name | closed | `BootstrapTargetGuard.cs:75,113-136`; `BootstrapManagerTests.cs:24-59` |
| T-05-18 | Information Disclosure | Staff addresses kept forever in closed outbox rows (IN-08) | low | transfer | Retention rule documented; purge owned by Phase 9 JOB-01; delete-time scrub in 05-26 | closed | Transferred: `docs/operations/mail-setup.md:122-129` (30-day retention, purge by Phase 9 JOB-01); delete-time scrub `DeleteUserHandler.cs:99-102` |
| T-05-19 | Tampering | CSP regression from motion code | medium | mitigate | Theme keyframes and utilities only; e2e CSP listener; no package | closed | Same CSP and e2e guard as T-05-01; keyframes in `app.css`; no package |
| T-05-20 | Elevation of Privilege | A closing user menu still accepting a click on "Logout" or "Sign Out Other Devices" after it visually closed | low | mitigate | Closing popover has pointer-events none and ignores keys; tests cover clicks during close | closed | `UserMenu.tsx:228` (inert while closing); `navigation.recipe.ts:234`; `UserMenu.test.tsx` |
| T-05-21 | Elevation of Privilege | Profile acting on another account (CWE-639) | high | mitigate | No id in the route; handlers use IRequestContext.UserId only; tests prove a second user's profile is untouched | closed | `ProfileController.cs:26-27` (no id in route); handler uses `requestContext.UserId`; `ProfileEndpointTests.cs:350` |
| T-05-22 | Tampering | Lost update between two tabs or two people (SEC-07) | high | mitigate | EditVersion as the EF concurrency token in the UPDATE's WHERE; 409 edit.stale; 20-run two-writer test | closed | `ApplicationUserConfiguration.cs:23`; `UserAccounts.cs:366,413`; `ProfileConcurrencyTests.cs:14-40` (20 rounds) |
| T-05-23 | Information Disclosure | Names written into the append-only audit log (D-40) | medium | mitigate | Detail holds field names only; unit and integration tests assert the exact detail string | closed | `UpdateProfileNameHandler.cs:86` (field names only); `ProfileEndpointTests.cs:283,303` |
| T-05-24 | Tampering | Stored XSS through names (CWE-79) | low | mitigate | Names stored as text; the web renders text nodes only (lint bans dangerouslySetInnerHTML) | closed | No `innerHTML`/`dangerouslySetInnerHTML` in non-test `web/src`; ESLint ban `web/eslint.config.mjs:105,129` |
| T-05-25 | Elevation of Privilege | An auth path that forgets the Manager lock or the delete (CWE-285) | high | mitigate | One IsBlocked rule at every site; table-driven test over every endpoint and three block states | closed | `IsBlocked` sites as T-05-12; `InactiveAccountTests.cs:149-268` |
| T-05-26 | Information Disclosure | Forgot-password revealing a Manager lock (CWE-204) | medium | mitigate | Same neutral 202 and response floor; nothing sent; detail only in the audit log | closed | `ForgotPasswordHandler.cs:52,67-70`; `ForgotPasswordHandlerTests.cs:73-87` |
| T-05-27 | Spoofing | Forged CreatedBy or UpdatedBy (CWE-915 mass assignment) | high | mitigate | DTOs have no attribution members; the interceptor overwrites from the token and the clock; forged-fields integration test | closed | Request records have no attribution members; `RecordStampInterceptor.cs:46-52`; forged-field test in `CreateUserEndpointTests.cs`; `ProfileAttributionTests.cs:17` |
| T-05-28 | Repudiation | Bookkeeping writes misattributing changes to staff | medium | mitigate | Stamp only when EditVersion changed; test with a failed-password write | closed | `RecordStampInterceptor.cs:68-77`; `ProfileAttributionTests.cs:45`; `RecordStampInterceptorTests.cs:67` |
| T-05-29 | Tampering | Singleton actor leaking one request's user into another | medium | mitigate | Actor read per call from IHttpContextAccessor (AsyncLocal per request), never cached; no-actor default outside requests | closed | `src/Csps.Server/Http/HttpCurrentActor.cs:15-16`; `RecordStampInterceptorTests.cs:86` |
| T-05-30 | Information Disclosure | Attribution exposing deleted users' emails | low | mitigate | Reads show names only (D-08, D-11); emails of deleted rows are scrambled (05-26) | closed | `UserDirectory.cs:142`; `UserAccounts.cs` `SoftDeleteAsync`; `DeletedAddress.cs` |
| T-05-31 | Spoofing | Account takeover through an unattended session (CWE-620) | high | mitigate | Current password required; wrong ones count to the 5-try lockout with email; per-address Reset rate limit; other sessions revoked on success | closed | `CurrentPasswordCheck.cs:28-52`; `ChangePasswordHandler.cs:115`; `ProfileController.cs:76`; `ChangePasswordTests.cs:29,189,222` |
| T-05-32 | Information Disclosure | Passwords in logs, audit or idempotency storage (CWE-532) | high | mitigate | 204 with no body is what the idempotency record stores; masking enricher; audit details are fixed words | closed | `ProfileController.cs:75-100` (204, no body stored); `SensitiveDataMasking.cs:15-52`; `ChangePasswordTests.cs:88-117`. Residual: deferred item 1 |
| T-05-33 | Tampering | Unvalidated `tab` param | low | mitigate | Literal parser with a default and one replace on invalid input (WEB-10) | closed | `useProfileTab.ts:10` (`literalParser`); `useProfileTab.test.tsx` |
| T-05-34 | Tampering | Stored XSS via names (CWE-79) | medium | mitigate | React text nodes only; ESLint bans dangerouslySetInnerHTML | closed | Text nodes only; no HTML sink (see T-05-24) |
| T-05-35 | Tampering | Lost edit after a conflict (SEC-07) | medium | mitigate | ConflictBanner keeps values; Load Latest is explicit; e2e two-page test | closed | `ConflictBanner` in `ProfilePage.tsx`; `ProfilePage.test.tsx:647`; `web/e2e/profile.spec.ts:166` |
| T-05-36 | Information Disclosure | Theme or profile data in a shared URL | low | mitigate | Only the tab name is in the URL; no personal data in params (WEB-10 privacy rule) | closed | `createListParams.ts:60-80` (`assertAllowedUrlKey`); profile URL carries only `tab` |
| T-05-37 | Spoofing | Account takeover by email change (CWE-640) | high | mitigate | Current password with lockout counting; notice to the old address; change applies only on confirmation at the new address; one live link | closed | `RequestEmailChangeHandler.cs:63,95-124`; `ConfirmEmailChangeHandler.cs:57-89`; `EmailChangeTests.cs:184,333` |
| T-05-38 | Information Disclosure | Token leaks via query string, logs or referrers (CWE-598) | high | mitigate | Fragment-only links; SHA-256 at rest; masking; the check takes the token in the body | closed | `AppLinksOptions.cs:60-63` (`#token=` fragment); `TokenHash.Compute` at rest; token in POST body; masking suffix `Token` |
| T-05-39 | Tampering | Mail scanner auto-confirming by opening the link | medium | mitigate | The check is read-only; confirm is an explicit POST from the page's button (05-16) | closed | `CheckEmailChangeHandler.cs:25-55` (read-only); confirm is a separate POST, `ConfirmEmailPage.tsx:80-121` |
| T-05-40 | Spoofing | Several live links for one change (replay of an older link) | medium | mitigate | Resend revokes before issuing; tests prove the older link dies | closed | `ResendEmailChangeHandler.cs:55-63`; `EmailChangePendingTests.cs:17`; `EmailChangeTests.cs:333` |
| T-05-41 | Information Disclosure | The taken answer revealing that an address now has an account | low | accept | Only the holder of the token (the person who owns the new inbox) sees it; the same text is shown for any conflict; owner-approved copy (UI-SPEC P3) | closed | Accepted: `05-15-PLAN.md` register (token holder only; owner-approved copy UI-SPEC P3) |
| T-05-42 | Denial of Service | Resend used to flood the pending inbox | low | mitigate | Per-address Reset rate limit; staff-only; only to the pending address the user typed | closed | `ProfileController.cs:184` (Reset limit); `RateLimitTests.cs:58` |
| T-05-43 | Information Disclosure | Token left in the address bar, history or a referrer (CWE-598) | medium | mitigate | Fragment removed at once with replaceState; the token goes only in a POST body; Referrer-Policy strict-origin-when-cross-origin | closed | `web/src/utils/urlFragment.ts:11-14`; `ConfirmEmailPage.tsx:146`; `SecurityHeadersMiddleware.cs:76` (Referrer-Policy) |
| T-05-44 | Tampering | A scanner or prefetch confirming the change | medium | mitigate | Confirm only on the explicit button press; the check is read-only | closed | `ConfirmEmailPage.tsx:117-121`; `ConfirmEmailPage.test.tsx:140-176` |
| T-05-45 | Tampering | Address text injected into the page (CWE-79) | low | mitigate | Rendered as text nodes only | closed | Text nodes only; no HTML sink |
| T-05-46 | Denial of Service | Network failure shown as an expired link, so people give up | low | mitigate | Shared banner and Try Again for no answer (04-28 rule) | closed | `ConfirmEmailPage.test.tsx:344-354` |
| T-05-47 | Elevation of Privilege | Roster readable by Admins (CWE-862) | high | mitigate | Manager policy on the controller; matrix rows for anonymous, Admin and Manager | closed | `UsersController.cs:29` (Manager policy); `AuthorizationMatrix.cs:121-123` |
| T-05-48 | Tampering | LIKE wildcard injection or oversize search (CWE-20, SEC-03) | medium | mitigate | Escaped LIKE pattern; q capped at 100; size capped at 100; tests with '%', '_', '[' | closed | `UserDirectory.cs:12-13,187-199` (escaped LIKE); `ListQueryRules.cs:10-13`; `ListUsersEndpointTests.cs:128-146` |
| T-05-49 | Information Disclosure | Deleted users' scrambled data or emails exposed | medium | mitigate | Deleted rows excluded; actors shown by name only with formerStaff | closed | `UserDirectory.cs:19,47,100,142` |
| T-05-50 | Denial of Service | Unbounded list queries | low | mitigate | Page size cap, indexed sort columns, AsNoTracking, one count query | closed | `UserDirectory.cs:18,47-55`; `ListQueryRules.cs:10` |
| T-05-51 | Information Disclosure | Passwords kept in memory, URL or logs | medium | mitigate | RHF state cleared on success; no password in query strings, toasts or console; zero-console guard | closed | `ProfilePage.test.tsx:1315`; zero-console guard in `web/e2e/fixtures.ts` |
| T-05-52 | Spoofing | Double submission changing the password twice or sending two links | low | mitigate | WEB-09 pending state and one Idempotency-Key per submission | closed | `ProfilePage.test.tsx:1315` (one Idempotency-Key); `IdempotencyMiddleware.cs:56-90` |
| T-05-53 | Elevation of Privilege | Admins creating Managers or any staff (CWE-269) | high | mitigate | Manager policy; matrix rows; role limited to Admin or Manager by the validator | closed | `UsersController.cs:29`; `AuthorizationMatrix.cs:125`; `CreateUserRequestValidator.CanonicalRole` |
| T-05-54 | Information Disclosure | Temporary password in a response, log, audit or idempotency record (CWE-532) | high | mitigate | Response is only the id; the idempotency record stores the response, not the body; masking; tests assert absence | closed | `CreateUserResponse.cs` (Id only); `CreateUserEndpointTests.cs:186-197`. Residual: deferred item 1 |
| T-05-55 | Spoofing | Forged CreatedBy (CWE-915) | high | mitigate | Interceptor from the token; forged-field test | closed | `RecordStampInterceptor.cs:46-52`; forged-field test in `CreateUserEndpointTests.cs` |
| T-05-56 | Tampering | Two accounts for one email by a race | medium | mitigate | Unique normalized-email index; mapped to the field error; 20-run race test | closed | `ApplicationUserConfiguration.cs:30-33` (unique `EmailIndex`); `CreateUserEndpointTests.cs:287-300` (20 runs) |
| T-05-57 | Tampering | Unvalidated URL params reaching queries (CWE-20) | medium | mitigate | Allow-list parsers with one replace; parsed values only in query keys; search capped at 100 | closed | `useUsersListParams.ts:10-16` (allow-list parsers); search cap 100 |
| T-05-58 | Information Disclosure | Personal data as a URL param (WEB-10 privacy) | medium | mitigate | Only q (free text), role, status, page, size; assertAllowedUrlKey refuses email or name keys | closed | `createListParams.ts:60-80` refuses email and name keys |
| T-05-59 | Tampering | XSS through names or emails (CWE-79) | medium | mitigate | Text nodes only; wrap-anywhere for long values | closed | Text nodes only; no HTML sink |
| T-05-60 | Denial of Service | Race removing the last active Manager (CWE-362) | high | mitigate | Transaction-owned sp_getapplock before reading and counting; 20-run two-writer test | closed | `ManagerRosterLock.cs:15-26` (`sp_getapplock`); lock before read in `DeactivateUserHandler.cs:66`, `LockUserHandler.cs:67`, `DeleteUserHandler.cs:68`, `UpdateUserHandler.cs:119`; `LastManagerGuardTests.cs:103,183,299` (20 runs) |
| T-05-61 | Elevation of Privilege | Deactivated person keeps using a live access token | high | mitigate | Revoke all sessions plus evict the cache after commit; the per-request sid check answers 401 (SessionRevocationTests pattern) | closed | `DeactivateUserHandler.cs` (`RevokeAllAsync`, `EvictUserAsync`); `SecurityRegistration.cs:96-110`; `UserLifecycleTests.cs:18-40` |
| T-05-62 | Elevation of Privilege | Admin calling lifecycle actions (CWE-862) | high | mitigate | Manager policy; matrix rows | closed | `UsersController.cs:29`; `AuthorizationMatrix.cs:131-135` |
| T-05-63 | Information Disclosure | Temporary password lingering in state, storage, history or logs (CWE-312) | high | mitigate | Component state only, cleared on close; never in a URL, storage, toast or console; tests assert the reopened panel holds a new value | closed | `AddUserPanel.tsx:170-182`; `AddUserPanel.test.tsx:605-624` |
| T-05-64 | Spoofing | Predictable temporary passwords (CWE-338) | medium | mitigate | crypto.getRandomValues with rejection sampling; at least 32 words squared times 10,000 combinations; must change at first sign-in and still needs the emailed code (04 D-22) | closed | `web/src/utils/temporaryPassword.ts:6-90` (`getRandomValues`, rejection sampling); `temporaryPassword.test.ts:49-82` |
| T-05-65 | Tampering | Lost update between two Managers (SEC-07) | high | mitigate | EditVersion in the UPDATE's WHERE; 20-run two-writer test; 409 with the shared text | closed | `UserAccounts.cs:366,413`; `UserEditConcurrencyTests.cs:18-31` (20 rounds) |
| T-05-66 | Elevation of Privilege | Self-promotion or self-demotion through the user PUT (CWE-269) | high | mitigate | Any PUT on the caller's own id answers 422 users.own-account | closed | `UpdateUserHandler.cs:66-69` (`users.own-account`); `UpdateUserEndpointTests.cs:134-145` |
| T-05-67 | Elevation of Privilege | A demoted Manager keeps Manager powers on live tokens | high | mitigate | Revoke all sessions with AccountChanged and evict; the role claim dies with the session | closed | `UpdateUserHandler.cs` (`RevokeAllAsync` on role change, eviction); `UpdateUserEndpointTests.cs:221-228` |
| T-05-68 | Spoofing | A Manager silently redirecting a colleague's account to another inbox | medium | mitigate | C-9: confirmation at the new address plus a notice to the old one; audit user.email-change-started by the Manager | closed | `UpdateUserHandler.cs:241-267`; "Save at once" is owner decision D-45 (`05-CONTEXT.md`), compensated by old-address notice, session revocation and audit |
| T-05-69 | Elevation of Privilege | A locked person regaining access by password reset (D-17) | high | mitigate | IsBlocked on every link and reset path (05-10); end-to-end test here | closed | `LockUserTests.cs:20-85`; `AccountLinkLookup.cs:49` |
| T-05-70 | Denial of Service | Locking the last active Manager (CWE-362) | high | mitigate | Roster applock and ManagerGuard; 20-run race test | closed | `LockUserHandler.cs:67,75` (roster lock plus `ManagerGuard`); `LastManagerGuardTests.cs` |
| T-05-71 | Tampering | Lost edits on conflict (SEC-07) | medium | mitigate | ConflictBanner keeps values; e2e two-page test | closed | `ConflictBanner` in `EditUserPanel.tsx`; `web/e2e/users.spec.ts:537` |
| T-05-72 | Tampering | XSS through actor or user names (CWE-79) | medium | mitigate | Text nodes only; no HTML from the API | closed | `RecordMeta.test.tsx:65-70` |
| T-05-73 | Elevation of Privilege | A deleted person keeping access through a session or a link | high | mitigate | Revoke every session and token of every purpose in the same transaction; evict; IsBlocked everywhere (05-10) | closed | `DeleteUserHandler.cs:36-37,91-95`; `DeleteUserTests.cs` |
| T-05-74 | Information Disclosure | A deleted person's address kept in the outbox (IN-08) | medium | mitigate | Scrub on delete; .invalid guard; retention rule in mail-setup.md | closed | `DeleteUserHandler.cs:99-102`; `OutboxEmailSender.cs:85`; `mail-setup.md:129` |
| T-05-75 | Denial of Service | Deleting the last active Manager (CWE-362) | high | mitigate | Roster applock and ManagerGuard; 20-run race test | closed | `DeleteUserHandler.cs:68,76`; `LastManagerGuardTests.cs` |
| T-05-76 | Repudiation | Delete without a trace | low | mitigate | user.deleted audit entry by the Manager; the row is kept | closed | `DeleteUserHandler.cs` (`UserDeleted` audit); soft delete keeps the row |
| T-05-77 | Information Disclosure | Reset or invite token visible to the Manager (CWE-640) | high | mitigate | Links only in email; responses are 204; tests assert no token in bodies | closed | `UsersController.cs` (204); `ManagerResetLinkTests.cs:40-56`; `ResendInvitationTests.cs:39-40` |
| T-05-78 | Denial of Service | Mail flooding a colleague with reset links | medium | mitigate | Shared hourly cap with forgot-password (429); one live link | closed | `SendResetLinkHandler.cs:75-77` and `ForgotPasswordHandler.cs:86` share `ResetEmailCap` |
| T-05-79 | Elevation of Privilege | A temporary password left usable with old sessions alive (04 D-24) | high | mitigate | All sessions revoked and evicted; must-change at next sign-in; still needs the emailed code (04 D-22) | closed | `SetTemporaryPasswordHandler.cs:81,103-113` |
| T-05-80 | Information Disclosure | Temporary password in logs or idempotency storage (CWE-532) | high | mitigate | 204 with no body is what is stored; masking; audit details are fixed words | closed | `UsersController.cs` (204); `TemporaryPasswordTests.cs:105-119`; null audit detail. Residual: deferred item 1 |
| T-05-81 | Tampering | Accidental deactivation or delete from close 36px icons on phones | medium | mitigate | Confirm dialogs with a specific dismiss focused first (OQ-3), danger styling for Delete | closed | `ConfirmDialog.tsx:166` (`initialFocus` on cancel); `DeactivateUserDialog.tsx`; `UsersPage.tsx:172-173` |
| T-05-82 | Repudiation | Double submission of a destructive action | low | mitigate | WEB-09 pending, one Idempotency-Key per POST submission, DELETE naturally idempotent (404 on repeat) | closed | `useUserAction.ts` (`useSubmission`, one key per intent); DELETE answers 404 on repeat |
| T-05-83 | Information Disclosure | Audit log readable by Admins (CWE-862) | high | mitigate | Manager policy; matrix rows | closed | `AuditLogController.cs:18`; `AuthorizationMatrix.cs:146` |
| T-05-84 | Information Disclosure | Personal data in audit rows (D-24 minimization, D-40) | medium | mitigate | Only names from user rows, /24 and /48 prefixes, browser family; details are fixed words | closed | `AuditLogResponse.cs:23-39` |
| T-05-85 | Denial of Service | Unbounded scans of an 8-month table | low | mitigate | Date floor, default 7 days, page size cap, the OccurredAtUtc index | closed | `ListAuditLogHandler.cs:17,56`; `ListAuditLogRequestValidator.cs`; `AuditEntryConfiguration.cs:41` |
| T-05-86 | Tampering | Viewer writing to the append-only log | low | mitigate | Read-only reader (AsNoTracking); interceptor and trigger still guard (01 D-32) | closed | `AuditLogReader.cs` (`AsNoTracking`); `AuditLogAppendOnlyInterceptor.cs` |
| T-05-87 | Information Disclosure | Temporary password retained after the dialog closes (CWE-312) | high | mitigate | Component state only, cleared on close; never in URL, storage, toast or console; test reopens with a fresh value | closed | `TemporaryPasswordDialog.tsx:48-57,108-120`; `TemporaryPasswordDialog.test.tsx:262-297` |
| T-05-88 | Tampering | Immediate actions racing an open edited form | low | mitigate | Actions aria-disabled while dirty (D-21); the server's EditVersion still yields 409 if it happens | closed | `EditUserPanel.tsx:394-396,595`; `EditUserPanel.test.tsx:649-694` |
| T-05-89 | Information Disclosure | Preview output or real data committed to the public repo | medium | mitigate | Fixed sample values only; output under git-ignored artifacts/; Development-only refusal | closed | `tools/Csps.EmailPreview/Program.cs:61-66` (Development only); `.gitignore:61` |
| T-05-90 | Information Disclosure | Audit Log nav shown to Admins | low | mitigate | manager flag filter with tests; the route guard (05-03) and the API 403 (05-29) stay the real controls | closed | `Sidebar.tsx` manager flag; `AdminLayout.test.tsx:183-193`; `Sidebar.test.tsx:211` |
| T-05-91 | Tampering | Unvalidated URL params (CWE-20, CWE-601) | medium | mitigate | Allow-list and GUID parsers with one replace; presets by name; no param reaches a link or redirect unvalidated | closed | `useAuditListParams.ts:24-40` |
| T-05-92 | Information Disclosure | An email in the audit URL or detail text (AUDIT-02, D-40) | medium | mitigate | actor and target are ids only; describeAuditDetail uses fixed words; test asserts no "@" in rendered detail | closed | `useAuditListParams.ts` (ids only); `auditCopy.test.ts:136` |
| T-05-93 | Tampering | XSS through names or stored detail (CWE-79) | medium | mitigate | Text nodes only; unknown details render nothing | closed | `AuditDetail.test.tsx:89-94` |
| T-05-94 | Denial of Service | Transaction and pooled connection held during a slow breach call (IN-05) | medium | mitigate | Breach check before the transaction; ordering and retry unit tests | closed | Breach check before the handler transaction: `ResetPasswordHandler.cs:71/86`, `SetNewPasswordHandler.cs:75/89`, `AcceptInviteHandler.cs:65/84`. See note on the idempotency transaction below |
| T-05-95 | Information Disclosure | Emails or names printed by record ToString in logs (IN-06, CWE-532) | medium | mitigate | ToString overrides return the type name; tests | closed | `ToString` overrides on `UserAccount.cs:39` and the password/token request records; tests in `SignInHandlerTests`, `SetNewPasswordHandlerTests` |
| T-05-96 | Information Disclosure | Secrets or real data in the public showcase chunk (CWE-200) | high | mitigate | Demo data only; build-output secret scan; no service imports in demos | closed | `web/src/test/build-output.node.test.ts:216-245` |
| T-05-97 | Information Disclosure | Dev tooling (parity entry, previews, /dev routes) shipped to production (CWE-489) | medium | mitigate | DEV_ONLY prefixes kept; showcase-only modules allowed only in its lazy chunks; budget build and build-output test | closed | `web/scripts/budget.ts:109-131`; `build-output.node.test.ts:181-214` |
| T-05-98 | Spoofing | Demo records mistaken for real ones | low | mitigate | Demo data badge and banner on every showcase page (D-32) | closed | `ComponentShowcasePage.tsx:5-7` ("Demo data") |
| T-05-99 | Spoofing | Open redirect through returnTo (CWE-601, IN-14) | medium | mitigate | Literal single-slash /admin paths only; returns exactly what was validated; tests for encoded and protocol-relative forms | closed | `guard.ts` `safeReturnUrl`; `guard.test.ts:46-65`; `SignInPage.tsx:73`, `VerifyCodePage.tsx:111-116`, `NewPasswordPage.tsx:55` |
| T-05-100 | Elevation of Privilege | A tab kept on a dead session after a stale failure state (IN-13) | low | mitigate | Reset on every refresh; test for the 503 then 401 sequence | closed | `session.ts:233`; `session.test.ts:545-553` |
| T-05-101 | Information Disclosure | Screenshots or seeded credentials committed to the public repo | medium | mitigate | Output under git-ignored artifacts/; seeded staff use csps.test addresses on CSPS_E2E only; git status check | closed | `.gitignore:61`; `TestingFixturesController.cs:50,117-120` (only `@csps.test`, `CSPS_TESTING` builds) |
| T-05-102 | Repudiation | Review notes closed without a record | low | mitigate | Every IN row gets a plan and commit reference or a deferral reason | closed | `04-REVIEW-DISPOSITION.md` (IN-01 to IN-19 each with outcome) |
| T-05-103 | Spoofing | Guessing the current password through the email-change request | high | mitigate | One CurrentPasswordCheck with lockout counting and the per-address Reset rate limit, shared with the password change | closed | `CurrentPasswordCheck` in `RequestEmailChangeHandler.cs:63` and `ChangePasswordHandler.cs`; `EmailChangeTests.cs:184-205` |
| T-05-104 | Information Disclosure | Staff and former-staff names listed to non-Managers (CWE-862) | medium | mitigate | Manager policy on the controller; matrix row for anonymous, Admin and Manager; names only, no emails | closed | `AuditLogController.cs:18`; `AuthorizationMatrix.cs:147`; `ListAuditPeopleHandler.cs:17-20` |
| T-05-105 | Information Disclosure | A demo calling a live service and showing real records (D-32) | medium | mitigate | Demos hold local state only; tests assert no request; grep gate against service imports | closed | `Phase5Demos.tsx` imports no service or client; `Phase5Demos.test.tsx:156` |
| T-05-106 | Repudiation | A mistyped audit detail word breaking the documented audit catalogue | low | mitigate | Constants with an AuditActionsTests check that every written word is listed; the full integration suite proves stored entries are unchanged | closed | `AuditActionsTests.cs:133,148` |
| T-05-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs in this plan (D-37) | closed | No change across the phase to `web/package.json`, `web/package-lock.json`, `Directory.Packages.props`, `Directory.Build.props`, `global.json`, any `*.csproj`, `packages.lock.json` or `docs/license-exceptions.json` |

*Status: open · closed · open, below high threshold (non-blocking)*
*Severity: critical > high > medium > low. Only open threats at or above `workflow.security_block_on` (high) count toward threats_open.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-13 | Invitation links last 7 days, a longer exposure window than 24 hours; the wording states the expiry from the token's `ExpiresAt` | Owner (D-13) | Phase 5 planning |
| AR-05-02 | T-05-41 | The email-change check page reveals the pending address only to the holder of the link token; owner-approved copy (UI-SPEC P3) | Owner (05-15 plan) | Phase 5 planning |
| AR-05-03 | T-05-18 (transfer) | Sent-mail rows keep recipient addresses for 30 days and are purged by Phase 9 JOB-01; a deleted person's pending address is scrubbed at delete time | Owner (mail-setup.md) | Phase 5 planning |

*Accepted risks do not resurface in future audit runs.*

---

## Deferred Security Items (from deferred-items.md): auditor verdicts, owner decision pending

These three items were parked during execution for this review. They sit outside the plan threat register, so they do not change `threats_open`. The auditor's recommendation is recorded here. The owner decides.

| # | Item | Verdict | Severity | Recommendation |
|---|------|---------|----------|----------------|
| D-1 | `IdempotencyRecords.RequestHash` is an unsalted SHA-256 over request bodies that carry passwords (`profile/password`, `profile/email-change`, `POST /users`, `users/{id}/temporary-password`; the reset and invite routes also carry a 256-bit token, so they are not practically crackable) | Real weakness | medium | **Mitigate before the first production deploy.** Switch `IdempotencyMiddleware.HashRequestAsync` to HMAC-SHA256 keyed from the existing required secret (`Auth:CodeMacKey`) with a purpose label. The hash stays 32 bytes, so there is no schema change. Add a test that the stored hash changes under a different key. Note: no code deletes expired idempotency rows until Phase 9 JOB-01, so these hashes stay longer than the 24 hours the note assumed. Exploiting this needs database read access. If the owner reads T-05-32, T-05-54 and T-05-80 as covering derived password data, they would be open at high until fixed. |
| D-2 | `IdempotencyOutcome.KeepChanges` opt-in on 429 `profile.password-locked` (password and email-change) and 409 `email-change.taken` | Accept | low | A replay while locked returns before any count or second email. After the lock expires, a replay counts as a fresh attempt, as Phase 4 D-39 intends. A replayed confirm gets a stored 404 because the link is spent. Optional: add an architecture test pinning `KeepChanges` to these three call sites. |
| D-3 | The session cache is evicted before the idempotency transaction commits, a window of up to 60 s | Accept (window closed under READ COMMITTED) | low | Revocation locks the session rows before eviction, and `SessionCache.LoadAsync` waits for the commit under READ COMMITTED. The live database has RCSI off (01-13). **Re-open if READ_COMMITTED_SNAPSHOT or snapshot isolation is ever enabled.** The "after the commit" comments in the lifecycle handlers and `ChangePasswordHandler` are inaccurate and should be corrected. |

## Related code-review findings (05-REVIEW.md, security-relevant, outside the register)

The security audit verifies the planned mitigations and does not hunt for new threats. The phase code review raised these security-relevant warnings. They are tracked in `05-REVIEW-DISPOSITION.md`, not here:

- **WR-01:** open password-reset links stay valid after a temporary password is set, after a profile password change, and after an at-once email move.
- **WR-03:** an account created with a temporary password starts with `EmailConfirmed = true` for an address nobody has proved.
- **WR-05/WR-14:** two definitions of "active Manager". Bootstrap ignores locked and deleted Managers.
- **WR-06:** the idempotency transaction holds a connection and app lock across slow calls (the same root as the auditor's T-05-94 note).
- **WR-08:** two BootstrapManager tests use a real LocalDB connection string naming `BetsLLC_Dev`, guarded only by the code under test.
- **WR-09:** no 429 test for `POST /api/v1/profile/password`. The auditor noted the same gap.
- **IN-04:** an anonymous caller can exhaust the shared reset-email cap and block a Manager's "send reset link".

## Unregistered flags

- `stored-body-hash` (05-12, 05-14, 05-19): no register row. Judged as D-1 above.
- `public-static-sample-addresses` (05-35): resolved. Showcase samples use example.com, and the build-output scan enforces the allow-list.
- `manager-immediate-email-move` (05-40): maps to T-05-68. The relaxation is owner decision D-45.
- `new-manager-cancel-route` (05-40, `DELETE /api/v1/users/{id}/email-change`): Manager policy, matrix row `AuthorizationMatrix.cs:129`, account lock, link revocation and an audit entry.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-18 | {COUNT} | {COUNT} | 0 | gsd-security-auditor (ASVS L1, static) via /gsd-execute-phase 5 verify gates |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [ ] Owner decision on deferred items D-1 to D-3

**Approval:** verified 2026-10-18 (register). Deferred items D-1 to D-3 await the owner.
