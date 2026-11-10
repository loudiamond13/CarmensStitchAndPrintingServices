---
milestone: v1 (through Phase 10)
created: 2026-11-10T08:12:00-06:00
updated: 2026-11-10T09:00:00-06:00
audited: 2026-11-10T14:12:00Z
scope: "Phases 1, 2, 3, 4, 5, 6, 7, 7.1, 8, 9 and 10 (argument '10'). ROADMAP defines no named milestones, so this audits everything delivered through Phase 10, the same reading as the two earlier audits. Phases 11 to 17 are not started and their requirements are out of scope."
status: tech_debt
previous_audit: v1-through-phase-07.1-MILESTONE-AUDIT.md
scores:
  requirements: 126/126
  phases: 11/11
  integration: 14/14
  flows: 9/9
gaps:
  requirements: []
  phases: []
  integration: []
  flows: []
resolved_gaps:
  - "Phase 9 unverified: closed 2026-11-10 by 09-VERIFICATION.md (human_needed, 5/5 must-haves, 8/8 requirements in code, 0 gaps). ORD-04, JOB-02, IMG-01 to IMG-05 and SEC-06 ticked in REQUIREMENTS.md. JOB-01 marked Partial: its analytics and inquiry jobs belong to Phases 12 and 13."
human_verification:
  - phase: 03-ci-cd-staging-deploy
    items:
      - "Weekly all-engine run on main has still never passed. Six runs: 2026-10-17 failed, 10-18 cancelled, 10-25 failed at 'setup dotnet', 11-01 cancelled at 1 h, 11-08 cancelled at 1 h 30 m (OPS-02, 03-VERIFICATION truth 7 UNCERTAIN)."
  - phase: 05-profile-user-management
    items:
      - "Owner real-world checks in deferred-items.md: real-device feel, real SMTP delivery for email change (PROF-02), first HTTPS production check"
  - phase: 06-company-expenses
    items:
      - "Live p95 under 300 ms after release (06-UAT test 6, Phase 999.4)"
  - phase: 07-order-domain-api
    items:
      - "07-UAT tests 1, 4, 5 still read 'skipped'. Test 1 (DOM-WR-04) passed in 08-UAT test 6. Test 5 (refunds on soft-deleted orders) is consistent in code: payments and refunds share the Order.DeletedAtUtc query filter. Test 4 (APX-IN-01 audit lines) STATE.md item is still unticked."
  - phase: 09-order-images-maintenance-jobs
    items:
      - "UAT 19: real Android and iPhone photo (GPS removed, upright) on release day (owner ruling 2026-11-05)"
      - "UAT 20: Maintenance 'Run now' from GitHub after deploy (release-day item 6)"
      - "P9-BL-06: owner sign-off of accepted risks AR-09-01 to AR-09-05 in 09-SECURITY.md"
      - "P9-BL-01: GitHub environment to limit MAINTENANCE_KEY to main (owner choice); P9-BL-02 and P9-BL-03: confirm the 10 minute run lock and the 100 megapixel refusal wording"
  - phase: 10-admin-dashboard
    items:
      - "UAT 18: CI parity snapshot job green on the phase PR (ship gate D-1)"
      - "UAT 19: one clean full CI run on the phase PR"
      - "P10-BL-20: owner sign-off, then go-ahead to ship"
      - "Quick look at the Transfer window when the date read fails (D-112)"
tech_debt:
  - phase: process
    items:
      - "05-REVIEW-DISPOSITION.md: still 15 warnings and 25 info findings 'open' with no outcome (unchanged since the 7.1 audit). WR-02 and WR-04 change behavior."
      - "03-REVIEW-DISPOSITION.md: WR-01, WR-02, IN-01 to IN-06 still 'open' (unchanged)."
      - "09-REVIEW-FIX.md: the 25 info findings were 'out of scope and recorded only'. That is not a fixed, deferred or owner-accepted outcome."
      - "REQUIREMENTS.md: DASH-01 to 06 and MONEY-01 to 08 stay Pending until Phase 10 closes. ROADMAP.md ticks 09-31 and 09-32 though both are deferred (D-51). 999.5 P9-BL-09 (merge the Phase 9 PR) is stale: PR #23 merged 2026-11-06."
      - "Branch gsd/phase-10-admin-dashboard is 691 commits ahead of main and nothing is pushed; the Phase 10 PR waits on P10-BL-20."
  - phase: 01-hosting-verification-backend-foundation
    items:
      - "Carried: WR-08, WR-09, IN-01/03/07/08 routed to Phase 14; compat level re-pin is a Phase 17 item"
  - phase: 02-web-foundation-design-system
    items:
      - "02-43 follow-up quick task (WR-02, IN-01 to IN-05) has still not run"
      - "LCP above budget on the public entry, report-only until Phase 11"
  - phase: 04-identity-authentication
    items:
      - "SEC-03 and AUDIT-01 Partial by design (Phases 12 to 13 and later features)"
  - phase: 05-profile-user-management
    items:
      - "WR-22 deferred by the owner (D-53)"
  - phase: 06-company-expenses
    items:
      - "B-IN-02, B-IN-04, B-IN-05 deferred; owner backlog items D-59, 06-21 lease guard, release-day migration step"
      - "ExpenseListTimingTests (300 ms p95) fails on this shared machine (D-76, D-103); owner question in STATE backlog '09-01 timing tests' still open"
  - phase: 07-order-domain-api
    items:
      - "DOM-IN-01, APO-IN-02 deferred"
  - phase: 07.1-legacy-fit-check-read-only
    items:
      - "IN-01 to IN-04 deferred to Phase 15 (07.1 D-43)"
  - phase: 08-order-screens
    items:
      - "08-REVIEW-DISPOSITION: 3 findings deferred with reasons; 08-REVIEW-FIX: 1 skipped"
  - phase: 09-order-images-maintenance-jobs
    items:
      - "CUT-01 backup job (09-31, 09-32) deferred by owner D-51; the host has no scheduled backups, so backups stay manual until Phase 17. Four TO DISK probe commits wait to be reverted with the chosen option."
      - "P9-BL-07: rare JPEG and WebP extra metadata blocks still pass the strip (info-level hardening, parked)"
      - "STATE backlog: 09-01 wording for images.file-missing and images.storage-failed still waits on the owner"
  - phase: 10-admin-dashboard
    items:
      - "IN-03 (WebKit cancelled-request guard matched on wording) deferred within D-111; needs a run that can execute the WebKit e2e"
      - "P10-BL-01 imported orders and this month's figures carried into Phase 16"
nyquist:
  compliant_phases: ["01", "02", "04", "05", "07.1", "08", "09", "10"]
  partial_phases: []
  not_validated_phases: ["03", "06", "07"]
  missing_phases: []
  overall: partial
---

# Milestone audit: v1 through Phase 10

*Created: 2026-11-10T08:12:00-06:00 · Updated: 2026-11-10T09:00:00-06:00*

**Audited:** 2026-11-10 · **Status:** tech_debt (was gaps_found until 09-VERIFICATION ran the same day) · **Scope:** Phases 1 to 10 (Phases 11 to 17 not started)

## Summary

There are no blockers. The first pass found one: Phase 9 had shipped in PR #23 without a VERIFICATION.md. The verifier then ran on 2026-11-10. It verified 5 of 5 must-haves and found all 8 requirements met in the code, with no gaps or stubs. The phase reads `human_needed` only for release-day checks and owner sign-offs. CI on PR #23 was fully green.

All 11 phases now have a verification. Their wiring and all nine end-to-end flows hold. The status is tech_debt because the debt carried from the 7.1 audit is mostly unchanged: untriaged review findings, the weekly CI run, and three draft Nyquist files.

## Phases

| Phase | VERIFICATION | SECURITY | VALIDATION (Nyquist) | UAT | Result |
|---|---|---|---|---|---|
| 01 Hosting & Backend Foundation | passed (19/23, 4 owner-accepted) | verified, 0 open | compliant | complete | ✓ |
| 02 Web Foundation & Design System | passed (51/51) | verified, 0 open | compliant | complete | ✓ |
| 03 CI/CD & Deploy | passed (6/7, weekly run UNCERTAIN) | verified, 0 open | draft | complete | ✓ code, ◷ weekly run |
| 04 Identity & Authentication | passed (6/6) | verified, 0 open | compliant | complete | ✓ |
| 05 Profile & User Management | passed (12/12) | verified, 0 open | compliant | complete | ✓ code, ◷ review triage |
| 06 Company Expenses | passed (6/6) | verified, 0 open | draft | complete | ✓ |
| 07 Order Domain & API | passed (7/7) | verified, 0 open | draft | complete, 3 skipped | ✓ |
| 07.1 Legacy Fit Check | passed (10/10) | verified, 0 open | compliant | n/a | ✓ |
| 08 Order Screens | passed (8/8) | verified, 0 open | compliant | complete | ✓ |
| 09 Order Images & Maintenance Jobs | human_needed (5/5, 8/8 reqs; added 2026-11-10) | verified, 0 open | compliant | partial: 93 pass, 1 skipped, 2 blocked | ✓ code, ◷ release day |
| 10 Admin Dashboard | human_needed (6/6, 14/14 reqs) | verified, 0 open | compliant | partial (ship-gated items) | ✓ code, ◷ sign-off and CI |

## Requirements (3-source cross-reference)

| Group | Phase | Count | VERIFICATION | SUMMARY | REQUIREMENTS.md | Final |
|---|---|---|---|---|---|---|
| Phases 1 to 7 (see the 7.1 audit) | 1 to 7 | 95 | passed | listed | as before | **satisfied** |
| ORD-01, 02, 06, 07, 10, 11, 12, 15, 19 | 8 | 9 | passed | listed | [x] Complete | **satisfied** |
| ORD-04, JOB-02, IMG-01..05 | 9 | 7 | SATISFIED | listed | [x] Complete (ticked 2026-11-10) | **satisfied** |
| JOB-01 | 9 | 1 | SATISFIED (Phase 9 part) | listed | [ ] Partial | **satisfied for scope** (analytics Phase 12, inquiry Phase 13) |
| DASH-01..06, MONEY-01..08 | 10 | 14 | SATISFIED in code | listed | [ ] Pending | **satisfied** (tick at phase close) |

**Score: 126/126 satisfied, 0 orphaned.** SEC-06 is now Complete, because its JOB-01 purge is built. Phase 9 SUMMARYs also list CUT-01. It belongs to Phase 17 and is only partly started (backup job deferred, D-51).

## Cross-phase integration

The gsd-integration-checker ran a static read of Phases 8 to 10 against earlier phases. It found 0 blockers. I closed two of its three unconfirmed items directly:
- **Matrix discovers every action:** `AuthorizationCoverage.cs:59` collects the live endpoints, and `AuthorizationMatrixTests.DiscoveredEndpointsAreFullyCovered` fails on any action that has no row.
- **Dashboard reads expenses:** `DashboardReader.cs` reads both `CompanyExpense` and `OrderExpense`.
- The third item (rowversion on the Phase 8 screens) was checked by 08-VERIFICATION and its tests. The checker did not trace it line by line.

| Connection | Status |
|---|---|
| Every new controller declares a policy; Manager-only actions marked; maintenance is key-protected | ✓ |
| Authorization matrix discovers and covers all actions | ✓ |
| Admin screens call per-module services (OR-5) | ✓ |
| Generated OpenAPI types include Phase 9 and 10 endpoints (maintenance hidden on purpose) | ✓ |
| Order screens use the Phase 7 API: idempotency keys on POST, 409 on stale edits | ✓ |
| Photos attach to orders; the cover reaches the Orders list | ✓ |
| Photo removals queue to the maintenance job (JOB-02) | ✓ |
| JOB-01 purges idempotency records (SEC-06) and the 30-day mail outbox (05-07) | ✓ |
| GitHub maintenance workflow to the key-protected endpoint | ✓ |
| Money on hand sums payments, transfers, expenses and refunds per person | ✓ |
| Soft-deleted orders drop payments and refunds together (07 UAT test 5) | ✓ |
| Transfers and hand-overs write audit events that the Audit Log screen renders | ✓ |
| Dashboard uses `IBusinessCalendar`; no `DateTime.Now` in src | ✓ |
| New pages routed and guarded (Manager-only where required) | ✓ |

| # | Flow | Status |
|---|---|---|
| 1 to 5 | Flows from the 7.1 audit (users, profile, expenses, order API, CI and deploy) | ✓ (weekly run still red) |
| 6 | New order with photos, then order page, then cover on the Orders list | ✓ |
| 7 | Payment, then staff money on hand, then transfer or hand-over, then ledger and audit log | ✓ |
| 8 | Dashboard KPIs and chart for a Manila period | ✓ |
| 9 | Monthly maintenance run from GitHub through the purge and photo jobs | ✓ wired (live run is a release-day item) |

## Tech debt

The full list is in the frontmatter. These need attention first:
1. **Phase 9 owner items.** Sign off the five accepted risks (P9-BL-06) and answer P9-BL-01 to 03. Fix the stale ROADMAP ticks for 09-31 and 09-32.
2. **Review findings with no outcome (owner rule).** Phase 5 has 40, Phase 3 has 8, and Phase 9 has 25 info findings that were "recorded only". None of these changed since the last audit.
3. **Weekly all-engine CI run (OPS-02).** It has run six times and never passed. The last two runs were cancelled for time.
4. **Backups (CUT-01).** There is no automatic backup and the host makes none. It stays manual until Phase 17.
5. **Nyquist.** Phases 03, 06 and 07 still have draft VALIDATION.md files.
6. **Phase 10 ship.** It needs the owner sign-off (P10-BL-20), then the PR and its CI.

## Nyquist coverage

| Phase | VALIDATION.md | Compliant | Action |
|---|---|---|---|
| 01, 02, 04, 05, 07.1, 08, 09, 10 | exists | true | none |
| 03 | exists (draft) | not validated | `/gsd-validate-phase 3` |
| 06 | exists (draft) | not validated | `/gsd-validate-phase 6` |
| 07 | exists (draft) | not validated | `/gsd-validate-phase 7` |
