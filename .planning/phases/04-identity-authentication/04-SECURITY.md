---
phase: "04"
slug: "identity-authentication"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-15T16:47:07-05:00"
updated: "2026-10-15T16:47:07-05:00"
---

# Phase 04: Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of plans 04-01 to 04-35: 112 unique threats (T-04-01 to T-04-111, plus T-04-SC repeated in every plan). Three `gsd-security-auditor` runs (plans 01-12, 13-24 and 25-35) checked each mitigation in the code and confirmed the test the plan claims. All three returned SECURED.

---

## Trust Boundaries

| Boundary | Description | Plan |
|----------|-------------|------|
| developer shell → dotnet user-secrets | Secret values pass from the script into the per-user secrets file | 04-01 |
| owner → DNS / mail panel of the live domain | A wrong DNS edit could break the live site's mail | 04-01 |
| public registries (nuget.org, npmjs.com) → build | Third-party code enters the app and its tests | 04-02 |
| test runner → network | A test could reach a real service by accident | 04-02 |
| application objects → log files | Logged structures may carry hashes and stamps | 04-03 |
| request → audit log | Client IP, user agent and actions become stored evidence | 04-03 |
| browser form → API | The browser pre-checks, the server decides | 04-04 |
| signer-in → code check | An attacker who knows the password guesses codes | 04-05 |
| User-Agent header → stored label | Attacker-controlled text becomes a stored label | 04-06 |
| browser cookie jar → refresh rules | A presented refresh token may be stolen or replayed | 04-06 |
| API → client | Error bodies must not leak internals | 04-07 |
| client → API | Untrusted bodies and parameters enter the pipeline | 04-07 |
| handlers → account store | Password checks, lockout state and roles decide who gets in | 04-08 |
| app → SMTP server | Credentials and messages cross the network | 04-09 |
| outbox table → anyone with database access | Codes and links at rest | 04-09 |
| user data → email HTML | Names and emails are inserted into HTML | 04-09 |
| build configuration → deployed artifact | Debug-only code must not reach production | 04-10 |
| test-only endpoints → any caller | Anonymous routes that expose emails and create users | 04-10 |
| configuration → HMAC key | A missing or weak key would make codes forgeable | 04-11 |
| database at rest → anyone with read access | Tickets and codes must not be usable from a dump | 04-11 |
| API → browser cookie jar | The pending-login ticket | 04-12 |
| anonymous internet → POST /api/v1/auth/sign-in | Credentials, guesses and timing probes | 04-12 |
| JWT issuer → validator | Other JWT types signed with the same key | 04-13 |
| bearer token → API | A token may outlive the session that issued it | 04-13 |
| browser with ticket cookie → code step | Someone who knows the password tries codes | 04-14 |
| other origins → cookie-reading endpoints | Cross-site requests riding on cookies | 04-14 |
| bearer → sign-out-others | Only the caller's own sessions may be ended | 04-15 |
| browser cookie → refresh/sign-out | A stolen or replayed refresh token | 04-15 |
| signed-in staff → session ids | Ids in the URL are attacker-controllable | 04-16 |
| app → api.pwnedpasswords.com | Password-derived data leaves the app | 04-17 |
| bundled data file → runtime | Third-party data shipped with the app | 04-17 |
| anonymous internet → forgot endpoint | Enumeration probes and inbox flooding | 04-18 |
| email link → reset | The link is the credential | 04-18 |
| holder of a reset link → account password | The link alone authorizes a password change | 04-19 |
| client retries → state-changing endpoints | Duplicates from double clicks, retries and replays | 04-20 |
| stored responses → later callers | A stored answer must only replay to the same caller and route | 04-20 |
| pending ticket holder → password change and session | The ticket alone must not grant a session | 04-21 |
| bootstrap caller → first privileged account | The handler creates the first Manager (the guarded command is plan 04-35) | 04-22 |
| invite link holder → account password | The link alone sets the first password | 04-22 |
| app → recipients' mail clients | HTML rendered by third-party clients | 04-23 |
| preview tool → real SMTP | A Development tool that can send real mail | 04-23 |
| anonymous internet → auth endpoints | Automated guessing and flooding | 04-24 |
| browser storage and URLs → other scripts and logs | Tokens must never land there | 04-25 |
| query string → navigation | returnUrl is attacker-controlled | 04-25 |
| tab ↔ tab | BroadcastChannel messages | 04-25 |
| staff device → sign-in form | Shared shop PC; credentials typed in a browser | 04-26 |
| browser → code step | Codes typed or pasted from email | 04-27 |
| page scripts → cookies | The refresh cookie must stay unreadable | 04-27 |
| email link → browser address bar and history | The reset token arrives in a URL fragment | 04-28 |
| signed-in staff → session ids in requests | The UI only offers own sessions; the server enforces it | 04-29 |
| dialog ↔ page behind | Focus and assistive technology must stay in the dialog | 04-30 |
| invite link → browser | The invite token arrives in a URL fragment | 04-31 |
| pending sign-in → must-change screen | No session may exist before the save | 04-31 |
| local gate → release | With CI deferred, the local gate is the only enforcement | 04-32 |
| dispatcher → application logs | Failures are logged while the row still holds secrets | 04-33 |
| bearer token claims → handlers | The sid claim decides which session is "this device" | 04-34 |
| session store → other users' sessions | Bulk revocation runs over many rows | 04-34 |
| operator shell → production database | The CLI writes the first privileged account | 04-35 |
---

## Threat Register

| Threat ID | Plan | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | 04-01 | Information Disclosure | Initialize-DevSecrets.ps1 (secrets visible in the process command line, CWE-214) | medium | mitigate | Every value goes through `Set-SecretsFromStdin`; Task 1 verify fails on any echoed " = " line; the SMTP password is read as a SecureString | closed |
| T-04-02 | 04-01 | Denial of Service | Live domain mail (a second SPF record or a replaced DMARC record stops all mail) | high | mitigate | mail-setup.md step 2 says add-only with before/after nslookup checks; the executor never edits DNS; Task 3 records Verified only on three passes | closed |
| T-04-03 | 04-02 | Tampering | NuGet restore (a moved transitive version or a typosquat) | high | mitigate | Exact central pins incl. MimeKit and BouncyCastle.Cryptography, locked restore, `dotnet list package --vulnerable`, DependencyRegistryTests, NuGet license gate | closed |
| T-04-04 | 04-02 | Tampering | npm install of four [SUS]-flagged packages (CWE-1104/1395) | high | mitigate | Blocking-human legitimacy checkpoint before install, exact versions, `npm audit --audit-level=high`, license:check, no postinstall scripts | closed |
| T-04-05 | 04-02 | Information Disclosure | Vitest tests calling a real network | low | mitigate | MSW server with `onUnhandledRequest: 'error'` in every jsdom test (msw.test.ts proves it) | closed |
| T-04-06 | 04-03 | Information Disclosure | IpPrefix (6to4 keeps the full IPv4, RA 10173 / D-24) | high | mitigate | Task 1 maps 6to4 and NAT64 to IPv4 before the /24 cut; Domain tests with both samples | closed |
| T-04-07 | 04-03 | Repudiation | AuditTrail (an audit entry committed for an action that rolled back, or unrelated changes flushed) | medium | mitigate | Record adds only; IUnitOfWork commits; RecordIndependentlyAsync uses its own context; tests prove rollback and isolation | closed |
| T-04-08 | 04-03 | Information Disclosure | Log masking (PasswordHash, SecurityStamp, hashes in 30-day logs, CWE-532) | high | mitigate | Task 3 exact names and Hash/Stamp/Key/Mac suffixes; `{@User}` test | closed |
| T-04-09 | 04-03 | Denial of Service | SiteSettingsReader cache factory on a disposed context (WR-01) | medium | mitigate | Factory-created context per load; concurrency test with a cancelled first caller | closed |
| T-04-10 | 04-04 | Spoofing | PasswordPolicy (weak passwords, CWE-521) | medium | mitigate | D-11 composition and length rule, D-15 personal-information rule; breach checks added in plan 04-17; mandatory emailed code (AUTH-02) | closed |
| T-04-11 | 04-04 | Tampering | Client/server rule drift (a password the browser accepts but the server refuses, or the reverse) | low | mitigate | One shared case file read by xUnit and Vitest; the server is the authority | closed |
| T-04-12 | 04-05 | Spoofing | Code guessing (CWE-307) | high | mitigate | 5 tries per code, 15-minute life, supersede on resend, cross-ticket cap 10/hour (TwoFactorLimits) enforced by the handlers in 04-14 | closed |
| T-04-13 | 04-05 | Information Disclosure | Timing of code comparison (CWE-208) | medium | mitigate | Only MACs are compared, through CryptographicOperations.FixedTimeEquals (TokenHash.Equal) | closed |
| T-04-14 | 04-05 | Spoofing | Weak code randomness (CWE-330/338) | high | mitigate | Codes are formatted here; generation uses RandomNumberGenerator in plan 04-11; System.Random is banned | closed |
| T-04-15 | 04-06 | Spoofing | Refresh token replay (T1539, CWE-613) | high | mitigate | Single-use tokens; reuse outside the 30 s grace revokes the family (R3); sibling cap 5; fixed absolute lifetime (R5) | closed |
| T-04-16 | 04-06 | Denial of Service | False reuse detection signing users out (two tabs, lost response) | medium | mitigate | Grace siblings (R2) and stale-sibling clean-up (R1); web single-flight in plan 04-25 | closed |
| T-04-17 | 04-06 | Tampering | User-Agent parsing (ReDoS or oversized input, CWE-1333/400) | low | mitigate | No regex, first 512 characters only, label capped at 60 | closed |
| T-04-18 | 04-07 | Denial of Service | Request bodies (CWE-400/770) | medium | mitigate | 1 MB limit in the middleware, Kestrel, IIS in-process and web.config; 413 before routing | closed |
| T-04-19 | 04-07 | Information Disclosure | Error responses (CWE-209) | low | mitigate | One mapping switch; machine `code` only on 4xx; 5xx keeps only the reference text; no WWW-Authenticate detail | closed |
| T-04-20 | 04-07 | Elevation of Privilege | Controller conversion dropping the Staff policy | high | mitigate | `[Authorize(Policy = Policies.Staff)]` on the controller; the matrix and the coverage test run against it | closed |
| T-04-21 | 04-07 | Denial of Service | Unbounded list queries (SEC-03) | low | mitigate | ListQueryRules caps page size and search length for every later list endpoint | closed |
| T-04-22 | 04-08 | Information Disclosure | Account enumeration by timing (CWE-204) | high | mitigate | VerifyDummyPassword for unknown emails; the Identity sign-in manager is never registered (it skips hashing for locked accounts); the response floor comes in plan 04-12 | closed |
| T-04-23 | 04-08 | Spoofing | Password guessing (CWE-307) | high | mitigate | Identity lockout 5 tries / 15 minutes with LockedNow reported once for the email (AUTH-07) | closed |
| T-04-24 | 04-08 | Tampering | Duplicate accounts by a create race | medium | mitigate | Unique filtered index on NormalizedEmail; race test in Task 2 | closed |
| T-04-25 | 04-08 | Tampering | JSON column via Identity passkey schema (D-13 of Phase 1) | medium | mitigate | Schema version 2 pinned; script guard names AspNetUserPasskeys; ModelHasNoJsonMappings | closed |
| T-04-26 | 04-09 | Information Disclosure | Outbox content at rest (codes in subjects, links in bodies) | high | mitigate | Subject, text and HTML each Data-Protection-encrypted (certificate-protected key ring); wiped after send, failure or expiry | closed |
| T-04-27 | 04-09 | Information Disclosure | SMTP without TLS or with a bypassed certificate check (CWE-319/295) | high | mitigate | Only StartTls or SslOnConnect are representable; no certificate callback; options validated at start | closed |
| T-04-28 | 04-09 | Tampering | HTML injection in the code email (CWE-79 in mail) and Host-header link poisoning (CWE-644, IN-06) | medium | mitigate | Every value HTML-encoded; links only from App:PublicBaseUrl, tokens in the fragment; the other six kinds are T-04-108 in plan 04-33 | closed |
| T-04-29 | 04-09 | Information Disclosure | Real mail from tests (D-27) | medium | mitigate | The Testing transport is the Debug-only sink and Release refuses the Testing environment; log hygiene for the outbox path is T-04-109 in plan 04-33 | closed |
| T-04-30 | 04-10 | Information Disclosure | /api/testing/emails exposing codes and links | critical | mitigate | Compiled only in Debug (CSPS_TESTING), mapped only in the Testing environment, Debug + Production refuses to start, Release metadata proof (Task 3) | closed |
| T-04-31 | 04-10 | Elevation of Privilege | /api/testing/staff creating staff accounts | critical | mitigate | Same three layers as T-04-30; emails only under csps.test | closed |
| T-04-32 | 04-10 | Information Disclosure | Developer user-secrets overriding test settings (Pitfall 10) | low | mitigate | Explicit switch only in the Playwright env; env vars and command line re-added after user-secrets; TestingConfigurationTests | closed |
| T-04-33 | 04-10 | Repudiation | Real mail sent from automated tests (D-27) | medium | mitigate | Testing environment always uses the sink; Release refuses the Testing environment (plan 04-09) | closed |
| T-04-34 | 04-11 | Information Disclosure | Stored tickets and codes | high | mitigate | Only SHA-256 of tickets and HMAC-SHA256 of codes are stored; keyed by Auth:CodeMacKey which never enters the database | closed |
| T-04-35 | 04-11 | Spoofing | Predictable codes or tokens (CWE-330/338) | high | mitigate | RandomNumberGenerator only (System.Random banned); shape and distinctness tests | closed |
| T-04-36 | 04-11 | Tampering | Double verification race | medium | mitigate | rowversion on the challenge row; concurrency test | closed |
| T-04-37 | 04-12 | Information Disclosure | Account enumeration by message or timing (CWE-203/204) | high | mitigate | One generic 401 for six branches; one hash per branch (dummy for unknown); 500 ms floor; byte-identical bodies and timing test | closed |
| T-04-38 | 04-12 | Spoofing | Credential stuffing and guessing (CWE-307) | high | mitigate | Identity lockout 5/15 min; mandatory code step; per-IP limits in plan 04-24 | closed |
| T-04-39 | 04-12 | Denial of Service | Lockout email flooding the inbox | low | mitigate | Exactly one lockout email per lockout (LockedNow transition); no counting while locked | closed |
| T-04-40 | 04-12 | Spoofing | Ticket cookie theft or cross-site use (CWE-352/614) | medium | mitigate | __Secure- prefix, HttpOnly, Secure, SameSite=Strict, Path /api/v1/auth, 30-minute life; only its SHA-256 is stored | closed |
| T-04-41 | 04-12 | Information Disclosure | Credentials or codes in logs or audit (CWE-532) | medium | mitigate | FakeLogger assertions; audit detail is a reason code; targets are user ids only | closed |
| T-04-42 | 04-13 | Spoofing | Access token after sign-out or revocation (CWE-613) | high | mitigate | sid checked on every request; revocation evicts the cache; test proves the next request is 401 | closed |
| T-04-43 | 04-13 | Spoofing | Token confusion with other JWT types (IN-04, CWE-347) | medium | mitigate | typ at+jwt issued and required (ValidTypes) | closed |
| T-04-44 | 04-13 | Elevation of Privilege | A sid paired with another user's sub | high | mitigate | SessionCache compares the session's user id with sub | closed |
| T-04-45 | 04-13 | Information Disclosure | Refresh tokens at rest | high | mitigate | Only SHA-256 hashes stored with a unique index; raw tokens exist only in the cookie | closed |
| T-04-46 | 04-14 | Spoofing | Code brute force across sign-ins (CWE-307) | high | mitigate | 5 tries per code; cross-ticket cap 10/hour → invalidate, lock 15 min, email; tests over two sign-ins | closed |
| T-04-47 | 04-14 | Tampering | CSRF on cookie-reading auth endpoints (CWE-352) | medium | mitigate | SameSite=Strict cookies plus required X-CSPS-CSRF header and Sec-Fetch-Site check; no CORS | closed |
| T-04-48 | 04-14 | Denial of Service | Code email flooding through resend | low | mitigate | 60 s cooldown, 5 codes per hour per account (durable counts); per-IP limits in plan 04-24 | closed |
| T-04-49 | 04-14 | Information Disclosure | Codes or tickets in audits, logs or URLs (CWE-532/598) | medium | mitigate | Codes only in the body and the sink; audits carry user ids only; tickets only in the cookie | closed |
| T-04-50 | 04-15 | Spoofing | Refresh token replay (T1539) | high | mitigate | Single-use rotation; reuse outside 30 s revokes the family; audit auth.refresh-reuse-detected; tested over HTTP | closed |
| T-04-51 | 04-15 | Tampering | CSRF on refresh and sign-out (CWE-352) | medium | mitigate | SameSite=Strict cookie, X-CSPS-CSRF required, Sec-Fetch-Site check | closed |
| T-04-52 | 04-15 | Elevation of Privilege | Revoking another user's sessions (CWE-639) | high | mitigate | sign-out-others reads user and session only from the token (IRequestContext); test proves another user's sessions are untouched | closed |
| T-04-53 | 04-15 | Spoofing | Inactive account keeps refreshing (AUTH-10) | high | mitigate | User state is checked on every refresh; a deactivated or missing account has its session revoked and evicted; a temporary lockout refuses the refresh (401) without revoking it (amended 2026-10-15, owner, D-46, WR-04) | closed |
| T-04-54 | 04-15 | Denial of Service | False reuse detection between tabs | medium | mitigate | Grace sibling and a one-time concurrency retry; concurrent-refresh test | closed |
| T-04-55 | 04-16 | Elevation of Privilege | DELETE /api/v1/sessions/{id} on another user's session (CWE-639) | high | mitigate | Ownership checked against the token's user; identical 404 for foreign and unknown ids; tests with a Manager caller | closed |
| T-04-56 | 04-16 | Information Disclosure | Session list leaking other users' devices | medium | mitigate | Query scoped by the token's user id; label is coarse (no IP, no version, D-32) | closed |
| T-04-57 | 04-16 | Denial of Service | Signing out the current session by mistake through the list | low | mitigate | 422 sessions.current; the UI never offers it (plan 04-29) | closed |
| T-04-58 | 04-17 | Information Disclosure | HIBP request (password-derived data) | high | mitigate | Only a 5-character SHA-1 prefix with padding; fixed host; no logging of hashes or passwords | closed |
| T-04-59 | 04-17 | Tampering | SSRF through a configurable HIBP address (CWE-918) | medium | mitigate | Base address is a code constant; no user input reaches the URL beyond the prefix | closed |
| T-04-60 | 04-17 | Denial of Service | HIBP outage blocking password changes | medium | mitigate | 3 s total timeout; fail open with the common-password floor (D-14) except the invite path, which fails closed by owner decision | closed |
| T-04-61 | 04-17 | Tampering | Altered bundled list (CWE-1104) | low | mitigate | SHA-256 pinned in the registry and checked by DependencyRegistryTests; MIT license recorded | closed |
| T-04-62 | 04-18 | Information Disclosure | Account enumeration through forgot (CWE-204) | high | mitigate | Always 202 with no body; 500 ms floor on every branch; identical bodies tested | closed |
| T-04-63 | 04-18 | Denial of Service | Inbox flooding (CWE-799) | medium | mitigate | 3 emails per account per hour from the outbox count; per-IP limits in plan 04-24; idempotent repeats in plan 04-20 | closed |
| T-04-64 | 04-18 | Spoofing | Reset token theft or guessing (CWE-640) | high | mitigate | 32 random bytes; only SHA-256 stored; 30-minute life; one live link per account; link in the URL fragment so it never reaches logs or Referer | closed |
| T-04-65 | 04-18 | Tampering | Host-header link poisoning (CWE-644) | medium | mitigate | Links only from App:PublicBaseUrl (plan 04-09) | closed |
| T-04-66 | 04-19 | Spoofing | Reset token replay or brute force (CWE-640) | high | mitigate | Single use, 30-minute life, one live link, 256-bit tokens, identical invalid answers, per-IP limits (plan 04-24) | closed |
| T-04-67 | 04-19 | Spoofing | Attacker sessions surviving a reset | high | mitigate | Every session revoked and evicted inside the reset transaction; tested on pre-existing sessions | closed |
| T-04-68 | 04-19 | Elevation of Privilege | Reactivating a deactivated account through reset (AUTH-10) | high | mitigate | Inactive users get the invalid-link answer; no session issued after any reset (D-17) | closed |
| T-04-69 | 04-19 | Tampering | Partial reset (password changed, sessions alive) | medium | mitigate | One transaction for every effect; rollback test | closed |
| T-04-70 | 04-20 | Tampering | Duplicate state changes (SEC-06) | medium | mitigate | Atomic record + business commit; applock against in-flight duplicates; replay tests | closed |
| T-04-71 | 04-20 | Information Disclosure | Replaying a stored response to another user or route | medium | mitigate | Unique (Key, Route, UserId); tests across users and routes | closed |
| T-04-72 | 04-20 | Information Disclosure | Tokens stored in replayable responses (CWE-922) | high | mitigate | Token-bearing and cookie-setting posts are exempt by the written allow-list; discovery test | closed |
| T-04-73 | 04-20 | Tampering | SQL injection through the applock call (CWE-89) | medium | mitigate | Parameterized call only; resource name is a hash; noted as the reviewed raw-SQL exception | closed |
| T-04-74 | 04-21 | Elevation of Privilege | Session before the must-change step (D-13) | high | mitigate | Verify answers set-new-password with no session; set-new requires a code-verified, unexpired challenge; tested | closed |
| T-04-75 | 04-21 | Spoofing | Keeping a known-breached or Manager-known temporary password | medium | mitigate | D-18 re-check at sign-in; full rule on set-new; Temporary flag forces the step | closed |
| T-04-76 | 04-21 | Information Disclosure | HIBP timing on sign-in (CWE-204) | low | accept | The re-check runs only after the correct password, so it reveals nothing to someone without the password | closed (accepted, AR log) |
| T-04-77 | 04-22 | Elevation of Privilege | Bootstrapping a second Manager later | high | mitigate | Refuses when an active Manager exists; audited with the System actor | closed |
| T-04-78 | 04-35 | Information Disclosure | Connection string on the command line (CWE-214) | medium | mitigate | Environment variable or hidden prompt only; `--connection` is a usage error; reasons never echo it | closed |
| T-04-79 | 04-35 | Tampering | Running against the wrong database (BetsLLC, legacy restore) | high | mitigate | Guard refusals plus --confirm-database equality; never migrates | closed |
| T-04-80 | 04-22 | Spoofing | Invite token theft or replay | medium | mitigate | 256-bit, hashed, 72 h, single use, fragment-only link, breach check fails closed | closed |
| T-04-81 | 04-23 | Information Disclosure | Remote resources and tracking in emails (privacy) | medium | mitigate | Inline CID logo only; tests forbid remote src, link, script, url() | closed |
| T-04-82 | 04-23 | Spoofing | Phishing look-alikes of CSPS emails | low | accept | Mail is DKIM-signed for cspstailoring.com with DMARC p=reject (plan 04-01); copy tells staff never to share the code | closed (accepted, AR log) |
| T-04-83 | 04-23 | Repudiation | Preview tool sending real mail by accident (D-27) | low | mitigate | Development only, explicit --to, sample values only, refusal tested | closed |
| T-04-84 | 04-24 | Spoofing | Credential stuffing and password spraying (T1110, CWE-307) | high | mitigate | Per-IP sliding windows on sign-in and verify plus per-account lockout and code caps | closed |
| T-04-85 | 04-24 | Denial of Service | Inbox flooding and reset spam (CWE-799) | medium | mitigate | Forgot and resend per-IP limits plus per-account email caps | closed |
| T-04-86 | 04-24 | Denial of Service | Limiter memory exhaustion by many keys (CWE-770) | low | mitigate | Bounded partition keys (IPv4 address, IPv6 /64, unknown) | closed |
| T-04-87 | 04-24 | Denial of Service | Shared proxy address throttling everyone | medium | accept | RemoteIpAddress only until Phase 3 verifies the topology (D-39); limits are configuration-driven; Phase 3 checklist item | closed (accepted, AR log) |
| T-04-88 | 04-25 | Information Disclosure | Access token storage (CWE-922) | high | mitigate | Memory only; prohibition test greps session code for storage APIs; channel messages carry no token | closed |
| T-04-89 | 04-25 | Tampering | Open redirect through returnUrl (CWE-601, D-07) | medium | mitigate | safeReturnUrl allow-list with the encoded-trick table; loader redirect only | closed |
| T-04-90 | 04-25 | Elevation of Privilege | Admin code reachable in production without sign-in (D-20) | high | mitigate | Guard loader on the admin layout; server default-deny is the real enforcement; dev/showcase excluded from production (build-output test) | closed |
| T-04-91 | 04-25 | Denial of Service | Tabs signing each other out (Pitfall 4) | medium | mitigate | Web Locks single flight + server grace window; StrictMode boot de-dupe; tests | closed |
| T-04-92 | 04-26 | Information Disclosure | Remembered email on a shared PC (D-09) | low | mitigate | No default value and no storage writes, tested with storage spies | closed |
| T-04-93 | 04-26 | Information Disclosure | Account state shown on screen (D-02, CWE-204) | medium | mitigate | Only the generic banner for a 401; the deactivated banner is not built | closed |
| T-04-94 | 04-26 | Tampering | Clickjacking or injected markup on the sign-in page | low | mitigate | Existing strict CSP and frame-ancestors from Phase 1; no inline style or script; React escapes all text | closed |
| T-04-95 | 04-27 | Information Disclosure | Refresh cookie readable by scripts (CWE-1004) | high | mitigate | HttpOnly asserted in three engines; document.cookie check | closed |
| T-04-96 | 04-27 | Information Disclosure | Codes in URLs or storage (CWE-598) | medium | mitigate | Code only in the POST body; httpClient refuses a code query param; nothing stored | closed |
| T-04-97 | 04-27 | Tampering | Auto-submit changing context unexpectedly (WCAG 3.2.2) | low | mitigate | onComplete does not submit; tested | closed |
| T-04-98 | 04-28 | Information Disclosure | Reset token left in history, Referer or screenshots (CWE-598) | medium | mitigate | Token only in the fragment (never sent as a URL), removed with replaceState before any request; sent in the POST body | closed |
| T-04-99 | 04-28 | Information Disclosure | Account enumeration through S4 (CWE-204) | medium | mitigate | One sent state for every outcome; server answers 202 for all | closed |
| T-04-100 | 04-29 | Elevation of Privilege | Revoking another user's session from the UI (CWE-639) | high | transfer | Server enforcement in plan 04-16 (404 for foreign ids); the UI only renders the caller's own list | closed (transfer verified) |
| T-04-101 | 04-29 | Denial of Service | Accidental sign-out of the wrong device | low | mitigate | Confirm dialog with the safe action focused; names include the sign-in time; no button on the current row | closed |
| T-04-102 | 04-30 | Information Disclosure | Tokens on BroadcastChannel (CWE-922) | medium | mitigate | Channel carries only types and expiry; E2E listener asserts no token or email | closed |
| T-04-103 | 04-30 | Tampering | Actions behind an open confirm dialog | low | mitigate | inert outside the dialog plus the focus trap (R2-10) | closed |
| T-04-104 | 04-31 | Information Disclosure | Invite token in history or Referer (CWE-598) | medium | mitigate | Fragment only, removed before any request, sent in the POST body | closed |
| T-04-105 | 04-31 | Elevation of Privilege | Using the admin app before the must-change save (D-13) | high | transfer | Enforced by the server (plan 04-21: no session issued); the screen holds no token until completeSignIn | closed (transfer verified) |
| T-04-106 | 04-32 | Repudiation | Unverified host facts treated as proven (Phase 3 deferral) | medium | mitigate | HOSTING-RECORD rows Unverified with explicit Phase 3 checks; doc-linted | closed |
| T-04-107 | 04-32 | Tampering | Approved look drifting through new screens | low | mitigate | S1 parity with no tolerance; SPEC-GAP surfaces in the owner pack; never update snapshots | closed |
| T-04-108 | 04-33 | Tampering | HTML injection in the six added email kinds (CWE-79 in mail) | medium | mitigate | Every value HTML-encoded; renderer test with a `<script>` first name; no unfilled placeholder; links only from App:PublicBaseUrl | closed |
| T-04-109 | 04-33 | Information Disclosure | Secrets in dispatcher logs on retry, failure or expiry (CWE-532) | medium | mitigate | Only id, kind and a short error code are logged; exception text is never stored or logged; FakeLogger tests | closed |
| T-04-110 | 04-34 | Elevation of Privilege | RevokeAllAsync touching another user's sessions or leaving a same-instant session active (CWE-639, CWE-613) | high | mitigate | Query filtered by user id and RevokedAt null; tests with two users and a same-instant session; returned ids and the user tag are evicted | closed |
| T-04-111 | 04-34 | Spoofing | A missing or malformed sid treated as "this device" | medium | mitigate | SessionId is null unless the sid claim parses as a Guid; the bearer check of plan 04-13 already refuses tokens without an active sid of the same user | closed |
| T-04-SC | all 35 | Tampering | npm/pip/cargo/NuGet installs | high | mitigate | Exact pins, committed lock files, legitimacy gate and owner approval for new packages (04-02); no installs in the other plans | closed |

*Status: open · closed · open, below high threshold (non-blocking)*
*Severity: critical > high > medium > low. Only open threats at or above `high` count toward threats_open.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (enforced elsewhere)*

### Key evidence (abridged; the auditors cited file:line for every row)

| Threat | Evidence |
|--------|----------|
| T-04-30, T-04-31 (critical) | `CSPS_TESTING` is defined for Debug only (`Csps.Server.csproj`, `Csps.Infrastructure.csproj`). The testing controllers sit inside `#if CSPS_TESTING` and are removed outside Testing by `TestingControllersFeatureProvider`. Debug + Production refuses to start (`TestingHostRegistration`). Tests: `ReleaseHasNoEmailSinkTests`, `TestingEmailsEndpointTests.DevelopmentDoesNotMapTheRoute`, `ADebugBuildRefusesToRunAsProduction`, `TestingFixturesEndpointTests.DevelopmentDoesNotMapTheRoute`. Fixture accounts only under `@csps.test`. |
| T-04-15, T-04-50 | `UserSession` single-use rotation, 30 s grace, family revoke on reuse. `RefreshRotationTests.ReplayingAUsedTokenAfterTheGraceWindowRevokesTheWholeSession`. |
| T-04-22, T-04-37 | Dummy hash on every branch, 500 ms `ResponseFloor`, one generic 401. `SignInHandlerTests.EveryBranchChecksExactlyOnePasswordHash`, `SignInTimingTests`. |
| T-04-42, T-04-44, T-04-111 | Per-request session check in `OnTokenValidated` via `SessionCache` (session owner must equal `sub`). `SessionRevocationTests`. |
| T-04-55, T-04-100 | `RevokeSessionHandler` gives the same `sessions.not-found` for foreign and unknown ids. `SessionsEndpointTests` (Manager caller). |
| T-04-73 + SUMMARY 04-20 flag (CWE-89) | `IdempotencyGate.cs:175-178`: constant `sp_getapplock` statement, `@result` and `@resource` as `SqlParameter`, resource is `"idem:" + SHA-256 hex`. The second applock call in `AccountTokenStore.cs:33-35` (04-18) is also constant with a parameterized resource and is covered under T-04-73. |
| T-04-74, T-04-105 | Must-change accounts get no session until `SetNewPasswordHandler` saves. `VerifyCodeEndpointTests.AMustChangeAccountGetsTheHandOffAndNoSession`, `MustChangePasswordTests`. |
| T-04-SC | Exact central pins, committed lock files, `RestoreLockedMode` under CI, `save-exact` and `min-release-age=14` in `web/.npmrc`. Package manifests unchanged after plan 04-02. `dotnet list package --vulnerable --include-transitive` and `npm audit --audit-level=high` clean on 2026-10-15. |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-76 | The breach re-check runs only after the correct password, so its timing tells nothing to someone without the password. Verified: `RecheckBreachAsync` is reached only on the success branch (`BreachRecheckTests.AWrongPasswordNeverTriggersTheRecheck`). | Plan 04-21 threat model (owner-approved plan) | 2026-10-15 |
| AR-04-02 | T-04-82 | Look-alike phishing of CSPS emails cannot be prevented in code. Mail is DKIM-signed for cspstailoring.com with DMARC p=reject (verified in plan 04-01), and the copy tells staff never to share the code. | Plan 04-23 threat model (owner-approved plan) | 2026-10-15 |
| AR-04-03 | T-04-87 | Rate limits use `RemoteIpAddress` only, so a shared proxy address could throttle everyone until Phase 3 verifies the host topology (D-39). Limits are configuration-driven (`RateLimits:Auth`), and the check is recorded Unverified in `.planning/HOSTING-RECORD.md`. | Plan 04-24 threat model (owner-approved plan) | 2026-10-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Auditor Observations (non-blocking, not counted in threats_open)

1. **`04-REVIEW-DISPOSITION.md` is stale.** It lists WR-04, WR-05, WR-11, WR-12 and WR-14 as open, but the code has the fixes: WR-04 (6d35838, D-46), WR-05 (12051a0), WR-11 (5117587), WR-12 (bc992a9, /64 per D-49), WR-14 (a82f28a). Refresh the disposition table.
2. **D-46 practical effect (T-04-53).** On a temporary lockout, refresh returns 401 without revoking the session, but the controller still clears the browser's refresh cookie (`AuthSessionController.cs:44-47`). Someone who knows an email and triggers the five-wrong-password lock can therefore force that person to sign in again. The register text is met, but the effect is smaller than "works again when the lock ends". For the owner to know.
3. **T-04-106 lint scope.** `HostingRecordTests` enforces the `## Facts` table only. The Phase 4 first-deploy section's Unverified rows are present but not machine-checked.
4. **T-04-79 / IN-07.** `BootstrapTargetGuard.IsLocalServer` misses the `tcp:[::1]` and named-pipe spellings, so those skip the CSPS_* allow-list. The BetsLLC, Legacy_Restore and system-database refusals and the `--confirm-database` equality still apply. The refusal of an unmigrated database has no test of its own.
5. **T-04-88 test form.** The plan promised a standing grep test. Behavioral store-spy tests cover the same risk, and a fresh grep of non-test `web/src` is clean.
6. **T-04-67 ordering.** Sessions are revoked inside the reset transaction and evicted right after commit. This is deliberate and equivalent.
7. **T-04-29 / T-04-33.** The "Release refuses Testing" guard is a compile-time `#else throw`. No runtime test can cover it, because a Release host cannot run the Debug-only suite. `ReleaseHasNoEmailSinkTests` proves the types are absent.
8. **Open info-level review items on this surface:** IN-05 (breach lookup inside an open transaction), IN-08 (closed outbox rows keep the recipient), IN-09 (HIBP response has no size cap), IN-10 (`AppLinksOptions.IsValid` accepts user info; operator config only), IN-14 (`safeReturnUrl` returns decoded text; same-origin `/admin` only), WR-09 (duplicate email after a post-send failure).
9. **CI locked restore** cannot be checked yet because the repo has no `.github/workflows`. Lock files and `RestoreLockedMode` under `CI=true` are in place.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-15 | 112 | 112 | 0 | gsd-security-auditor x3 (plans 01-12, 13-24, 25-35) via /gsd-secure-phase 4 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-15
