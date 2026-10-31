---
milestone: v1 (through Phase 7.1)
created: 2026-10-29T13:14:00-05:00
updated: 2026-10-29T13:14:00-05:00
audited: 2026-10-29T18:14:00Z
scope: "Phases 1, 2, 3, 4, 5, 6, 7 and 7.1. ROADMAP defines no named milestones, so a bare run audits everything delivered so far (same reading as v1-through-phase-04). Phases 8 to 17 are not started and their requirements are out of scope."
status: tech_debt
previous_audit: v1-through-phase-04-MILESTONE-AUDIT.md
scores:
  requirements: 95/95
  phases: 8/8
  integration: 14/14
  flows: 5/5
gaps:
  requirements: []
  integration: []
  flows: []
human_verification:
  - phase: 03-ci-cd-staging-deploy
    items:
      - "Weekly all-engine run on main has never passed: 2026-10-17 failure (web vitest, admin routes test), 2026-10-17 and 2026-10-18 cancelled at the 1 hour job limit, 2026-10-25 failed at 'setup dotnet'. 03-VERIFICATION truth 7 is still UNCERTAIN (OPS-02)."
      - "LCP report-only override in CI until Phase 11 (owner, 2026-10-16)"
  - phase: 05-profile-user-management
    items:
      - "Owner real-world checks in deferred-items.md: feel on a real device, real SMTP delivery for email change (PROF-02), first HTTPS production check"
  - phase: 06-company-expenses
    items:
      - "Live p95 under 300 ms for the expense list and KPIs after release (06-UAT test 6, D-58, Phase 999.4)"
  - phase: 07-order-domain-api
    items:
      - "07-UAT test 1: owner reads the DOM-WR-04 legacy edit code after Phase 8 ships"
      - "07-UAT test 4: order audit lines (APX-IN-01) ruled at the Phase 8 UI review"
      - "07-UAT test 5: refunds on a soft-deleted order vs money on hand (D-39) ruled before Phase 10 planning"
tech_debt:
  - phase: process
    items:
      - "05-REVIEW-DISPOSITION.md: 15 warnings (WR-02, 04, 06, 07, 10 to 13, 15 to 19, 21) and 25 info findings (IN-01 to IN-25) are still 'open' with no recorded outcome. WR-02 (Identity concurrency failures answer 500 where 409 is promised) and WR-04 (scrubbing a deleted person's pending address can expire another account's mail) touch behaviour."
      - "03-REVIEW-DISPOSITION.md: WR-01, WR-02 and IN-01 to IN-06 are 'open' with no outcome. WR-02: a killed process leaves the Data Protection private key on the host, with no sweep. IN-01: docs still say compatibility level 160 after the re-pin to 170."
      - "REQUIREMENTS.md ORD-06 reads 'Phase 8 | Complete' and its checkbox is ticked; the API landed in Phase 7 but the screen is Phase 8 (owner question already parked in the STATE.md backlog)"
      - "Phase 4 SUMMARYs list no requirements-completed for AUTH-08 to AUTH-12, SEC-03, SEC-06 and AUDIT-01 (verified directly in 04-VERIFICATION; frontmatter only)"
      - "Phases 7 and 7.1 not shipped yet: the work is on branch gsd/phase-07.1-legacy-fit-check-read-only; joint ship is next (07.1-12 hand-off)"
  - phase: 01-hosting-verification-backend-foundation
    items:
      - "Carried from the Phase 4 audit: WR-08 log retention vs flood, WR-09 health content-type assertions and IN-01/03/07/08 routed to Phase 14"
      - "Compatibility level re-pin is a Phase 17 cutover item"
  - phase: 02-web-foundation-design-system
    items:
      - "02-43 review WR-02 (docs/web/e2e.md @dialog-fit wording) and IN-01 to IN-05: owner asked for a follow-up quick task; still listed under STATE.md Blockers/Concerns and no quick task has run"
      - "LCP is above budget on the public entry (2187 ms after 261016-lcp; fonts are the main cost); waived to report-only until Phase 11"
  - phase: 04-identity-authentication
    items:
      - "SEC-03, SEC-06 and AUDIT-01 are Partial by design: inquiry/analytics rate limits (Phases 12 to 13), JOB-01 idempotency-key purge (Phase 9), and audit events for later features"
  - phase: 05-profile-user-management
    items:
      - "WR-22 deferred by the owner (D-53): a concurrent double submit of the first sign-in code can end in 500"
  - phase: 06-company-expenses
    items:
      - "B-IN-02, B-IN-04, B-IN-05 deferred (lease window, save-failure translator, retryable error code in four form handlers)"
      - "Owner backlog: quick task to log a cancelled request as cancelled, not as a server error (D-59)"
      - "Owner backlog: duplicate-request guard after a crash (06-21, D-50, ClaimLease 2 minute window)"
      - "Owner backlog: Phase 6 release-day migration step and the 261026-89i visual check"
      - "Carry to Phase 17: imported staff need the first sign-in mark (EmailConfirmed) to be chosen as Paid by (D-49)"
  - phase: 07-order-domain-api
    items:
      - "DOM-IN-01, APO-IN-02, APX-IN-01 deferred (form error paths and audit lines to Phase 8, low-risk check-to-save gap)"
  - phase: 07.1-legacy-fit-check-read-only
    items:
      - "IN-01 to IN-04 deferred to Phase 15 (owner ruling 07.1 D-43): failure wording, staff name split, description null handling, pure tests only in CI full mode"
      - "Owner backlog: delete the refused run's full list by hand"
nyquist:
  compliant_phases: ["01", "02", "04", "05", "07.1"]
  partial_phases: []
  not_validated_phases: ["03", "06", "07"]
  missing_phases: []
  overall: partial
---

# Milestone audit: v1 through Phase 7.1

*Created: 2026-10-29T13:14:00-05:00 · Updated: 2026-10-29T13:14:00-05:00*

**Audited:** 2026-10-29 · **Status:** tech_debt · **Scope:** Phases 1 to 7.1 (Phases 8 to 17 not started)

## Summary

There are no blockers. Every phase has a passed verification and a verified security report. All 95 requirements mapped to these phases are satisfied, and the cross-phase wiring and the five end-to-end flows hold. The status is tech_debt for three reasons:
- Two phases have review findings that were never given an outcome. This breaks the "nothing dropped silently" rule.
- The weekly all-engine CI run has never passed.
- Three phases' Nyquist validation was never reconciled.

## Phases

| Phase | VERIFICATION | SECURITY | VALIDATION (Nyquist) | UAT | Result |
|---|---|---|---|---|---|
| 01 Hosting & Backend Foundation | passed (19/23, 4 owner-accepted) | verified, 0 open | compliant | complete | ✓ |
| 02 Web Foundation & Design System | passed (51/51) | verified, 0 open | compliant | complete | ✓ |
| 03 CI/CD & Deploy | passed (6/7, weekly run UNCERTAIN) | verified, 0 open | draft (not validated) | complete, 2 skipped | ✓ code, ◷ weekly run |
| 04 Identity & Authentication | passed (6/6) | verified, 0 open | compliant | complete | ✓ |
| 05 Profile & User Management | passed (12/12) | verified, 0 open | compliant | complete | ✓ code, ◷ review triage |
| 06 Company Expenses | passed (6/6) | verified, 0 open | draft (not validated) | complete, 1 skipped (live p95) | ✓ |
| 07 Order Domain & API | passed (7/7) | verified, 0 open | draft (not validated) | complete, 3 deferred | ✓ |
| 07.1 Legacy Fit Check | passed (10/10) | verified, 0 open | compliant | n/a | ✓ |

## Requirements (3-source cross-reference)

| Group | Phase | Count | VERIFICATION | SUMMARY | REQUIREMENTS.md | Final |
|---|---|---|---|---|---|---|
| FND-01..13, QUAL-01/03/06, SEC-01/02/04 | 1 | 19 | passed | listed | [x] Complete | **satisfied** |
| WEB-01..10, ORD-09, QUAL-02/04, A11Y-01/02/04, PERF-01/02/03/05 | 2 | 20 | passed | listed | [x] Complete | **satisfied** |
| OPS-01..05 | 3 | 5 | passed | listed | [x] Complete | **satisfied** (OPS-02 weekly run still red) |
| AUTH-01..07, AUTH-13, QUAL-05, A11Y-03 | 4 | 10 | passed | listed | [x] Complete | **satisfied** |
| AUTH-08..12 | 4 | 5 | SATISFIED | not listed | [x] Complete | **satisfied** (verifier checked code and tests directly) |
| SEC-03, SEC-06, AUDIT-01 | 4 | 3 | SATISFIED for Phase 4 scope | not listed | [ ] Partial | **satisfied for scope** (later parts in Phases 9, 12, 13) |
| PROF-01..04, USER-01..08, AUDIT-02, SEC-07, SEC-08 | 5 | 15 | passed | listed | [x] Complete | **satisfied** |
| CEXP-01..05, PERF-04 | 6 | 6 | passed | listed | [x] Complete | **satisfied** (live p95 deferred) |
| ORD-03/05/08/13/14/16/17/18/20/21/22/23 | 7 | 12 | passed | listed | [x] Complete | **satisfied** |

**Score: 95/95.** No orphans. Phase 7.1 maps no requirement IDs; it is a read-only fit check that feeds Phases 15 and 16.

One traceability oddity: **ORD-06** is mapped to Phase 8 and is out of scope here. It already reads Complete with a ticked box, because its API landed in Phase 7 (07-15). The owner question about it is parked in the STATE.md backlog.

## Cross-phase integration

The gsd-integration-checker ran a static read and found 0 blockers. It could not confirm two items, and I closed both directly:
- **SEC-07 409 on stale data:** `OrderConcurrencyTests.cs` and `CompanyExpenseConcurrencyTests.cs` assert `HttpStatusCode.Conflict`, and the item, payment, discount and expense endpoint tests do too.
- **OPS-04/05 deploy:** `deploy.yml` runs only when the owner presses Run, which is the approval. `web/scripts/deploy.mjs` carries the smoke check (`smoke.mjs`, tested) and the rollback path.

| Connection | Status |
|---|---|
| Every Phase 5/6/7 controller declares a policy; Manager-only actions marked | ✓ |
| Authorization-matrix and coverage tests present | ✓ |
| Testing-only controllers compiled out of Release (`#if CSPS_TESTING`) | ✓ |
| Idempotency middleware on every POST, allow-list with reasons (SEC-06) | ✓ |
| Rowversion 409 on orders and expenses (SEC-07) | ✓ |
| `IAuditTrail` in user, profile, expense and order handlers; viewer renders their change lines | ✓ |
| Admin screens call per-module services (OR-5) | ✓ |
| `/admin` guarded; Manager-only pages use the Manager loader | ✓ |
| Generated OpenAPI types include order endpoints, no Testing endpoints; CI drift check | ✓ |
| Server `OrderMath` and web `csps.ts` share one golden-vector fixture | ✓ |
| `IBusinessCalendar`/clock in order and expense handlers, no `DateTime.Now` | ✓ |
| CI runs every test project, including LegacyFitCheck.Tests | ✓ |
| Phase 7.1 tool isolated from CSPS_Dev and production data | ✓ |
| Phase 7 order API ready for Phase 8 (list, search, delete, restore, import) | ✓ server side |

| # | Flow | Status |
|---|---|---|
| 1 | Invite → accept → roster → deactivate → audit viewer | ✓ wired |
| 2 | Own profile, email change, password, theme | ✓ wired |
| 3 | Company expense create, edit, delete, Manila-month KPIs | ✓ wired |
| 4 | Order via API: totals server-side, 409 on stale edit, one record per duplicate POST, soft delete | ✓ wired + integration tests (no web consumer until Phase 8) |
| 5 | PR → CI → owner-run deploy → smoke → rollback | ✓ wired (weekly all-engine run still red) |

Non-blocking warning from the checker: each Users, Profile and order-child mutation should emit an audit event. Handler-level use is confirmed. A per-handler audit test would make it certain.

## Tech debt

The full list is in the frontmatter. These items need attention first:
1. **Untriaged review findings (process rule).** `05-REVIEW-DISPOSITION.md` has 15 warnings and 25 info findings still "open". `03-REVIEW-DISPOSITION.md` has 8. Each one needs fixed, deferred with a reason, or accepted by the owner. Phase 5 WR-02 (a 500 where a 409 is promised) and WR-04 (a mail scrub that can hit another account) change behaviour.
2. **Weekly all-engine CI run (OPS-02).** It has run 4 times and never passed. The latest run (2026-10-25) failed at "setup dotnet". The two before it hit the 1 hour job limit.
3. **Nyquist.** Phases 03, 06 and 07 still have draft VALIDATION.md files.
4. **Still open from the Phase 4 audit:** the 02-43 follow-up quick task has not run.
5. **Ship.** Phases 7 and 7.1 are still on the phase branch, waiting for the joint ship.

## Nyquist coverage

| Phase | VALIDATION.md | Compliant | Action |
|---|---|---|---|
| 01 | exists | true | none |
| 02 | exists | true | none |
| 03 | exists (draft) | not validated | `/gsd-validate-phase 3` |
| 04 | exists | true | none |
| 05 | exists | true | none |
| 06 | exists (draft) | not validated | `/gsd-validate-phase 6` |
| 07 | exists (draft) | not validated | `/gsd-validate-phase 7` |
| 07.1 | exists | true | none |
