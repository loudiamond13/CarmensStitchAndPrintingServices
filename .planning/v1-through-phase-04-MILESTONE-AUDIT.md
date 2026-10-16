---
milestone: v1 (through Phase 4)
created: 2026-10-15T17:57:00-05:00
updated: 2026-10-15T18:25:00-05:00
audited: 2026-10-15T23:25:00Z
scope: "Phases 1, 2 and 4. ROADMAP defines no named milestones, so the argument `4` is read as everything delivered through Phase 4. Phase 3 (CI/CD) is deferred by the owner (2026-10-14) and out of scope; its OPS-01..05 stay Pending."
status: tech_debt
rerun_of: "first run 2026-10-15T22:57Z (gaps_found: 04-VERIFICATION.md missing)"
scores:
  requirements: 57/57
  phases: 3/3
  integration: 14/14
  flows: 6/6
gaps:
  requirements: []
  integration: []
  flows: []
human_verification:
  - phase: 04-identity-authentication
    file: 04-UAT.md
    status: "human_needed (scheduled for the Phase 3 first deploy)"
    items:
      - "Live SMTP send from the app (sender, no Reply-To, branded HTML, SPF/DKIM/DMARC pass, TLS)"
      - "Production Set-Cookie for __Secure-csps_rt and __Secure-csps_2fa on the real HTTPS host"
      - "Live HIBP run with CSPS_LIVE_HIBP=1"
tech_debt:
  - phase: 01-hosting-verification-backend-foundation
    items:
      - "WR-07 HSTS includeSubDomains, IN-05 HTTPS redirection, IN-06 AllowedHosts: routed to Phase 3 deploy"
      - "WR-08 log retention vs flood, WR-09 vacuous health content-type assertions, IN-01/03/07/08: routed to Phase 14"
      - "Testcontainers SQL 2025 backend never exercised; host probe facts and FND-07 two-process append: Phase 3"
      - "SqlCompatibility.Level provisional at 160: re-pin at Phase 17"
      - "FND-04 entity seed steps grow per entity phase"
  - phase: 02-web-foundation-design-system
    items:
      - "02-43 review WR-02 (docs/web/e2e.md @dialog-fit wording) and IN-01..05 test hygiene: owner ruled 'fix in a follow-up quick task' (UAT 201); no quick task has run"
      - "g199 review WR-03 (phone dialog animation scrollbar flash), WR-04 (Users slide-over clash), IN-01..04: owner-deferred"
      - "Owner decisions still open in deferred-items.md: ErrorState 'Try Again' label colour; Users cell name size/colour"
      - "Lighthouse LCP 1884 ms against the 2000 ms budget (thin margin)"
      - "Firefox page-load setup flake in the heavy /dev/components showcase"
  - phase: 04-identity-authentication
    items:
      - "Three live-environment checks in 04-UAT.md wait for the Phase 3 first deploy, so Phase 4 is not marked complete in ROADMAP"
      - "REQUIREMENTS.md still shows AUTH-08..13, SEC-03, SEC-06, AUDIT-01 as [ ] / Pending; phase.complete updates them when Phase 4 closes"
      - "SEC-03 and SEC-06 are satisfied for Phase 4's scope only: idempotency-key purge job (Phase 9, JOB-01), beacon exemption (Phase 12) and public-endpoint rate limits (Phase 13) follow later"
      - "AUDIT-01 covers the auth subset; user CRUD, order and content events belong to later phases"
      - "04-REVIEW-DISPOSITION.md is stale: lists WR-04/05/09/11/12/14 as open, but 04-REVIEW-FIX.md shows 16/17 fixed and D-46 accepted WR-04"
      - "WR-06 skipped (HasDefaultValue(true) on IsActive, not reproducible; verifier accepts); IN-01..19 open (out of fix scope)"
      - "30 of 35 Phase 4 SUMMARYs have empty requirements-completed"
      - "Flaky ResendCodeEndpointTests.TheSixthCodeInAnHourIsRefusedWithNoWaitTime (seen once; passed in both runs today)"
      - "Integration warning: __Secure- cookies over the http://localhost:5115 dev proxy may be dropped by Firefox/Safari in dev (AUTH-02, AUTH-05); Playwright on HTTPS 5199 is unaffected"
      - "Phase 4 has a UI-SPEC but no UI-REVIEW yet; /gsd-ui-review 4 is due before /gsd-ship 4 (project workflow)"
nyquist:
  compliant_phases: ["01", "02", "04"]
  partial_phases: []
  not_validated_phases: []
  missing_phases: []
  overall: compliant
---

# Milestone audit: v1 through Phase 4 (re-run)

**Audited:** 2026-10-15 · **Status:** tech_debt · **Scope:** Phases 1, 2, 4 (Phase 3 deferred by the owner)

## What changed since the first run

The first run found one blocker: Phase 4 had no verification report. This session then ran the Phase 4 gates and the verifier:
- **TDD review gate:** 3 TDD plans, 0 violations.
- **Regression gate:** `dotnet build` 0 warnings; .NET suite 2132 total, 2131 passed, 1 skipped (opt-in live HIBP), 0 failed; `npm --prefix web run verify` exit 0.
- **Verifier:** `04-VERIFICATION.md` is `human_needed` with 6/6 success criteria verified, every requirement satisfied and no gaps. The verifier's own runs included a Chromium E2E slice (10/10). The three remaining checks need a live host and are in `04-UAT.md`.

No blocker remains, so the audit moves from gaps_found to tech_debt.

## Phases

| Phase | VERIFICATION | SECURITY | VALIDATION (Nyquist) | Result |
|---|---|---|---|---|
| 01 Hosting & Backend Foundation | passed (UAT 11/11) | verified, 0 open | validated, compliant | ✓ |
| 02 Web Foundation & Design System | passed (51/51; UAT closed) | verified, 0 open | validated, compliant | ✓ |
| 03 CI/CD & Staging Deploy | out of scope (deferred) | n/a | n/a | n/a |
| 04 Identity & Authentication | human_needed (6/6, 3 live checks pending) | verified, 0 open | validated, compliant | ✓ code, ◷ live checks |

## Requirements (3-source cross-reference)

| Group | Phase | Count | VERIFICATION | SUMMARY | REQUIREMENTS.md | Final |
|---|---|---|---|---|---|---|
| FND-01..13, QUAL-01/03/06, SEC-01/02/04 | 1 | 19 | passed | listed | Complete | **satisfied** |
| WEB-01..10, ORD-09, QUAL-02/04, A11Y-01/02/04, PERF-01/02/03/05 | 2 | 20 | passed | listed | Complete | **satisfied** |
| AUTH-01..07, AUTH-13, QUAL-05, A11Y-03 | 4 | 10 | SATISFIED (human_needed report) | listed | Complete | **satisfied** |
| AUTH-08..12, SEC-03, SEC-06, AUDIT-01 | 4 | 8 | SATISFIED (human_needed report) | not listed | Pending | **satisfied** (the verifier checked code and tests directly; checkboxes update at phase close) |

**Score: 57/57.** No orphans. AUTH-13 rests partly on the live SMTP check. SEC-03, SEC-06 and AUDIT-01 are satisfied for Phase 4's scope, and later phases add to them.

## Cross-phase integration

No blockers (gsd-integration-checker, static read). Every Phase 4 action is in the authorization matrix, and auth events go through `IAuditTrail` with IP truncation. The `Idempotency-Key` and CSRF header contracts match between web and server, the OpenAPI types have no drift, `/admin` is guarded, and Testing-only controllers are compiled out of Release. All six E2E flows are wired. The verifier then exercised flows 1 to 6 through integration tests, with E2E for sign-in, cookies, multi-tab, reset and invite.

| # | Flow | Status |
|---|---|---|
| 1 | Sign-in → code → admin portal | ✓ wired + E2E |
| 2 | Multi-tab refresh + replay revokes family | ✓ wired + integration + E2E |
| 3 | Forgot → reset → sessions revoked | ✓ wired + integration + E2E |
| 4 | Invite accept → set password → sign in | ✓ wired + E2E |
| 5 | Sessions page → sign out others | ✓ wired + integration |
| 6 | bootstrap-manager on empty DB → sign in | ✓ wired + integration (`BootstrapSignInTests`) |

## Tech debt

21 items across the 3 phases are listed in the frontmatter. Highlights:
- **Phase 4:** 3 live checks wait for the Phase 3 deploy, the traceability checkboxes lag, the review disposition file is stale, WR-06 was skipped, there are 19 open info findings and one flaky resend test, `__Secure-` cookies may not work in dev on Firefox/Safari, and the UI review hasn't run.
- **Phase 2:** the owner-requested 02-43 follow-up quick task hasn't run, and two look decisions are still open.
- **Phase 1:** items are routed to Phase 3, Phase 14 and Phase 17.

## Nyquist coverage

| Phase | VALIDATION.md | Compliant | Action |
|---|---|---|---|
| 01 | exists | true | none |
| 02 | exists | true | none |
| 04 | exists | true | none |
