---
phase: "04"
slug: "identity-authentication"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-14T12:40:00-05:00"
updated: "2026-10-15T11:32:16-05:00"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `04-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 4.0.1 on MTP, Shouldly 4.3.0, NSubstitute 6.2.0, FakeTimeProvider, Respawn 7.0.0, ArchUnitNET 0.13.4, coverlet.MTP 10.0.1. Web: Vitest 5.0.1 + RTL + jsdom + in-house axe matcher, MSW 3.0.1 (new), Playwright 1.63.0 + @axe-core/playwright. |
| **Config file** | `global.json` (MTP runner), `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project <touched test project> --filter-class "*<Class>"` (.NET); `npm --prefix web run test -- --run src/modules/admin` (web) |
| **Full suite command** | Preflight, then `dotnet test --solution Csps.slnx` (with `CSPS_TEST_SQL=localdb` set per process), `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |
| **Estimated runtime** | ~60 s per-task loop; full suite several minutes (E2E on 3 engines + phones) |

---

## Sampling Rate

- **After every task commit:** the quick command of the touched project, plus the targeted `--filter-class`.
- **After every plan wave:** `dotnet test --solution Csps.slnx` + `npm --prefix web run verify` (preflight first).
- **Before `/gsd-verify-work`:** full suite + coverage gate + `npm --prefix web run e2e` (three engines + phones), all green, zero warnings.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

Requirement-level map from research. The planner fills task IDs; execution updates status.

| Requirement | Behavior | Test Type | Automated Command | Plan · Task | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|-------------|--------|
| AUTH-01 | Generic 401 for unknown/wrong/locked/deactivated; one hash per branch; same fake completion time; timing medians | unit + integration timing | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*SignInHandlerTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SignInTimingTests"` | 04-12 T1-T3; UI 04-26 T3 | ✅ | ✅ green |
| AUTH-02/03/04 | Challenge state machine; HMAC/fixed-time; resend cooldown/cap; cross-ticket cap | unit (Domain 100%) + integration + E2E | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*TwoFactorChallengeTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*VerifyCodeEndpointTests"`; `"*CrossTicketCapTests"`; `"*ResendCodeEndpointTests"` | 04-05 T1-T3; 04-11 T1-T3; 04-12 T1; 04-14 T1-T3; UI 04-27 T1-T2 | ✅ | ✅ green |
| AUTH-05/06 | Rotation, grace siblings, reuse revokes family, absolute expiry, persistent vs session cookie, immediate revocation via `sid`, sessions list/revoke | unit + integration + E2E (two tabs, cookie spike) | `--filter-class "*UserSessionTests"`, `"*SessionRevocationTests"`, `"*SessionStoreTests"`, `"*RefreshRotationTests"`, `"*SignOut*"`, `"*SessionsEndpointTests"`; `npm --prefix web run e2e -- --grep "@auth-cookies|@auth-multitab|@sessions|@session-menu"` | 04-06 T1-T3; 04-13 T1-T2; 04-34 T1-T2; 04-15 T1-T3; 04-16 T1-T2; UI 04-25, 04-27 T3, 04-29, 04-30 | ✅ | ✅ green |
| AUTH-07 | 5 failures lock 15 min; one lockout email | integration + sink | `"*LockoutTests"` | 04-08 T3; 04-12 T3 | ✅ | ✅ green |
| AUTH-08/09 | Same response known/unknown; hashed single-use 30-min token; reset revokes sessions; "changed" email; same-key replay sends one email | integration + E2E | `"*ForgotPasswordTests"`, `"*PasswordResetTests"`, `"*IdempotencyTests"`; `npm --prefix web run e2e -- --grep @auth-reset` | 04-18 T1-T2; 04-19 T1-T2; 04-20 T1; UI 04-28 | ✅ | ✅ green |
| AUTH-10 | Deactivated/locked can't sign in/refresh/reset into a session | integration | `"*InactiveAccountTests"` | 04-12 T3; 04-15 T2; 04-19 T2 | ✅ | ✅ green |
| AUTH-11 | Code-point length, NFC, contains name/email (D-11, D-15), HIBP parser, fail modes, shared cases with the browser | unit | `"*PasswordPolicyTests"`, `"*HibpPwnedPasswordsTests"`, `"*PasswordRulesTests"`; `npm --prefix web run test -- --run src/utils/passwordRules.golden.test.ts` | 04-04 T1-T3; 04-17 T1-T3; 04-19 T2; 04-21 T2; 04-22 T2 | ✅ | ✅ green |
| AUTH-12 | Bootstrap on empty migrated DB then invite, accept, full sign-in; refuses when an active Manager exists / wrong DB | integration (LocalDB) + E2E | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*BootstrapManagerTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*BootstrapSignInTests"`; `npm --prefix web run e2e -- --grep @auth-invite` | 04-22 T1-T2; 04-35 T1-T2; UI 04-31 T1 | ✅ | ✅ green |
| AUTH-13 | Outbox row in same txn; protected content; scrubbed after send; StartTls/SSL only; expired mail not sent; no secrets in logs; branded HTML with CID logo | unit + integration + owner review | `"*EmailOutboxTests"`, `"*EmailDispatcherTests"`, `"*EmailRendererTests"`, `"*MailKitTransportTests"`, `"*EmailHtmlLayoutTests"` | 04-01 T1-T3; 04-09 T1-T2; 04-33 T1-T2; 04-23 T1-T3 | ✅ | ✅ green |
| QUAL-05 | Sink only in Testing+Debug; Release has no sink types/routes | architecture | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*ReleaseHasNoEmailSinkTests"` | 04-09 T2; 04-10 T1-T3 | ✅ | ✅ green |
| SEC-03 | 429 + Retry-After per IPv4 address / IPv6 /64; JSON > 1 MB → 413; list caps; account counters | integration | `"*RateLimitTests"`, `"*RateLimitPartitionTests"`, `"*RequestBodyLimitTests"`, `"*ListQueryRulesTests"` | 04-07 T3; 04-24 T1-T2 | ✅ | ✅ green |
| SEC-06 | 400/409/422 idempotency rules, replay returns stored response, 24 h expiry, discovery + allow-list | integration + discovery | `"*IdempotencyTests"`, `"*IdempotencyCoverageTests"` | 04-20 T1-T3 | ✅ | ✅ green |
| A11Y-03 | autocomplete attrs, paste into password/OTP, no auto-submit, axe clean, overflow sweep | component + E2E | `npm --prefix web run test -- --run src/modules/admin`; `npm --prefix web run e2e -- --grep "@auth|@auth-overflow"` | 04-26 T3; 04-27 T2; 04-28 T2; 04-31 T3; 04-32 T2 | ✅ | ✅ green |
| AUDIT-01 | Each auth event writes exactly its action code, no PII/secrets; WR-02/03/06 fixed | unit + integration | `--filter-class "*AuditActionsTests"`, `"*IpPrefixTests"`, `"*AuditTrailTests"`, `"*LockoutTests"` | 04-03 T1-T3; audits asserted in 04-12 to 04-22 | ✅ | ✅ green |
| SEC-02 (ongoing) | Every new endpoint in matrix × 3 callers on real sessions | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"` | 04-07 T1; 04-13 T2; every endpoint plan | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] AD-1 security bump; `dotnet list package --vulnerable --include-transitive` clean
- [x] Controllers bootstrap test (IResult → ProblemDetails; empty body → 400 via validator; matrix key format)
- [x] Matrix fixture: seeded Admin/Manager users + sessions; `TestTokens` with `sid`/`typ`
- [x] Identity model test: Version2, no JSON columns, no `AspNetUserPasskeys`, unique `NormalizedEmail`
- [x] Respawn ignore list includes `AspNetRoles`
- [x] `tests/Csps.Server.IntegrationTests/Auth/*`, `Idempotency/*`, `RateLimiting/*`
- [x] `tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs`
- [x] Web: MSW 3 setup in `src/test/setup.ts` (`onUnhandledRequest: 'error'`), auth feature tests, E2E `auth.spec.ts` with per-worker users and sink polling
- [x] Cookie spike spec (chromium/firefox/webkit on 5199)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real SMTP delivery from the legacy domain (SPF/DKIM/DMARC merged) | AUTH-13 | Needs the live mail host and DNS | Owner sends a test code to a real inbox after the Phase 3 staging deploy and pastes the headers |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved by the plan 04-32 full local gate on 2026-10-15 (see 04-32-SUMMARY.md)
