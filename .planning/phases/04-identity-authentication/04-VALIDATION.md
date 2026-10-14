---
phase: "04"
slug: "identity-authentication"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-14T12:40:00-05:00"
updated: "2026-10-14T12:40:00-05:00"
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

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| AUTH-01 | Generic 401 for unknown/wrong/locked/deactivated; hasher called once per branch; same fake completion time | unit + integration timing | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*SignInHandlerTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SignInTimingTests"` | ❌ W0 | ⬜ pending |
| AUTH-02/03/04 | Challenge state machine; HMAC/fixed-time; resend cooldown/cap; cross-ticket cap | unit (Domain 100%) + integration | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*TwoFactorChallengeTests"` | ❌ W0 | ⬜ pending |
| AUTH-05/06 | Rotation, grace siblings, reuse revokes family, absolute expiry, persistent vs session cookie, immediate revocation via `sid` | unit + integration + E2E (two tabs) | `--filter-class "*RefreshRotationTests"`, `"*SessionRevocationTests"` | ❌ W0 | ⬜ pending |
| AUTH-07 | 5 failures lock 15 min; one lockout email | integration + sink | `"*LockoutTests"` | ❌ W0 | ⬜ pending |
| AUTH-08/09 | Same response known/unknown; hashed single-use 30-min token; reset revokes sessions; "changed" email | integration | `"*PasswordResetTests"` | ❌ W0 | ⬜ pending |
| AUTH-10 | Deactivated/locked can't sign in/refresh/reset into a session | integration | `"*InactiveAccountTests"` | ❌ W0 | ⬜ pending |
| AUTH-11 | Code-point length, NFC, contains name/email, HIBP parser, fail mode | unit | `"*PasswordPolicyTests"`, `"*HibpResponseParserTests"` | ❌ W0 | ⬜ pending |
| AUTH-12 | Bootstrap on empty migrated DB then full sign-in; refuses when users exist / wrong DB | integration (LocalDB) | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*BootstrapManagerTests"` | ❌ W0 | ⬜ pending |
| AUTH-13 | Outbox row in same txn; protected body; scrubbed after send; StartTls; expired mail not sent; no secrets in logs | unit + integration | `"*EmailOutboxTests"`, `"*MailKitTransportOptionsTests"` | ❌ W0 | ⬜ pending |
| QUAL-05 | Sink only in Testing+Debug; Release has no sink types/routes | architecture | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*ReleaseHasNoEmailSinkTests"` | ❌ W0 | ⬜ pending |
| SEC-03 | 429 + Retry-After per IP prefix; JSON > 1 MB → 413; account counters | integration | `"*RateLimitTests"`, `"*RequestBodyLimitTests"` | ❌ W0 | ⬜ pending |
| SEC-06 | 400/409/422 idempotency rules, replay returns stored response, 24 h expiry, discovery + allow-list | integration + discovery | `"*IdempotencyTests"`, `"*IdempotencyCoverageTests"` | ❌ W0 | ⬜ pending |
| A11Y-03 | autocomplete attrs, paste into password/OTP, no auto-submit, axe clean | component + E2E | `npm --prefix web run test -- --run src/modules/admin`; `npm --prefix web run e2e -- --grep @auth` | ❌ W0 | ⬜ pending |
| AUDIT-01 | Each auth event writes exactly its action code, no PII/secrets | unit + integration | `--filter-class "*AuthAuditTests"`, `"*IpPrefixTests"` | partial | ⬜ pending |
| SEC-02 (ongoing) | Every new endpoint in matrix × 3 callers | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] AD-1 security bump; `dotnet list package --vulnerable --include-transitive` clean
- [ ] Controllers bootstrap test (IResult → ProblemDetails; empty body → 400 via validator; matrix key format)
- [ ] Matrix fixture: seeded Admin/Manager users + sessions; `TestTokens` with `sid`/`typ`
- [ ] Identity model test: Version2, no JSON columns, no `AspNetUserPasskeys`, unique `NormalizedEmail`
- [ ] Respawn ignore list includes `AspNetRoles`
- [ ] `tests/Csps.Server.IntegrationTests/Auth/*`, `Idempotency/*`, `RateLimiting/*`
- [ ] `tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs`
- [ ] Web: MSW 3 setup in `src/test/setup.ts` (`onUnhandledRequest: 'error'`), auth feature tests, E2E `auth.spec.ts` with per-worker users and sink polling
- [ ] Cookie spike spec (chromium/firefox/webkit on 5199)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real SMTP delivery from the legacy domain (SPF/DKIM/DMARC merged) | AUTH-13 | Needs the live mail host and DNS | Owner sends a test code to a real inbox after the Phase 3 staging deploy and pastes the headers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
