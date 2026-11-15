---
milestone: v1 (through Phase 11)
created: 2026-11-15T06:42:00-06:00
updated: 2026-11-15T07:05:00-06:00
audited: 2026-11-15T12:42:00Z
scope: "Phases 1, 2, 3, 4, 5, 6, 7, 7.1, 8, 9, 10 and 11 (argument '11'). ROADMAP defines no named milestones, so this audits everything delivered through Phase 11, the same reading as the three earlier audits. Phases 12 to 17 are not started and their requirements are out of scope. Phases 1 to 10 are carried from v1-through-phase-10-MILESTONE-AUDIT.md; this pass re-checked Phase 11 in full and its wiring into earlier phases."
status: tech_debt
previous_audit: v1-through-phase-10-MILESTONE-AUDIT.md
scores:
  requirements: 140/140
  phases: 12/12
  integration: 23/23
  flows: 14/14
gaps:
  requirements: []
  phases: []
  integration: []
  flows: []
resolved_since_last_audit:
  - "Phase 10 shipped: PR #24 merged to main (25bd3431). DASH-01 to 06 and MONEY-01 to 08 are Complete in REQUIREMENTS.md."
  - "Phase 11 verified: 11-VERIFICATION.md human_needed, 6/6 truths, 14/14 requirements in code, 0 code gaps."
human_verification:
  - phase: 11-public-site-content-management
    items:
      - "UAT 19 (G-11-19): the code fix (plan 11-39, D-P11-BL-65) is verified, but 11-UAT.md still reads 'issue'. D-126 rules out an automated GPS strip test, so only a manual re-test with a real phone photo can close it."
      - "UAT 21: run tools/Csps.CloudinarySetup once on the live account after the deploy (P11-BL-21, D-44). Until then og:image and the new photo sizes fail live."
      - "UAT 22: enter real Business Info, hours, phones, Messenger link, six prices and the share picture (D-123, docs/operations/go-live-public-site.md)."
      - "UAT 23: Facebook Sharing Debugger on /, /products, /gallery and /contact (P11-BL-40 item 4)."
      - "Accept or reject the e2e flakes recorded in 11-E2E-PHASE-END.md (2264 of 2438 passed in the full run; failures passed on re-run apart from listed flakes; P11-BL-55 to 58)."
      - "Open owner question from 11-39: the PNG size edge (keep the limit on the redrawn file, or turn an over-limit PNG into a JPEG)."
  - phase: 03-ci-cd-staging-deploy
    items:
      - "Weekly all-engine run on main has still never passed. No new run since 2026-11-08 (cancelled at 1 h 30 m). OPS-02."
  - phase: carried
    items:
      - "Phase 5, 6, 7, 9 and 10 items from the Phase 10 audit, not re-checked in this pass (real-device and SMTP checks, live p95, 07-UAT skipped tests, Phase 9 release-day items and P9-BL-01 to 06)."
tech_debt:
  - phase: 11-public-site-content-management
    items:
      - "D-39-1 fixed 2026-11-15 after this audit (fix commit on the Phase 11 branch); recorded here for history. It was: Prettier failed on nine web files (e2e/gallery.spec.ts, link-preview.spec.ts, public-sweep.spec.ts, site-content-sweep.spec.ts, auditCopy.ts, auditCopy.test.ts, PhotoSlot.tsx, Phase11Demos.tsx, Phase11Demos.test.tsx), so `npm --prefix web run verify` is not clean. Re-checked 2026-11-15."
      - "11-REVIEW second pass: 16 info findings (IN-A2-01 to IN-D2-03) were 'out of scope' with no fixed, deferred or owner-accepted outcome. Same pattern as the Phase 9 info findings."
      - "11-REVIEW first pass: 12 deferred with reasons (fine); 7 owner items parked as P11-BL-47 to 54, still open."
      - "999.7 DECISIONS.md: 57 of 67 items open. Most were built as option A and only need a yes. Notable: P11-BL-43 font subsetting (needs a package check), P11-BL-44 CLS 0.041 and 0.043 near the 0.05 limit, P11-BL-24 Contact bundle at 149.09 of 150 KB, P11-BL-51 consent checked only in code (a CHECK constraint is recommended), P11-BL-57 full e2e suite takes 3.8 h."
      - "P11-BL-35 fix takes effect only when the next production script is applied (deploy.md)."
      - "Deferred items D-28-1 (test order dependency), D-28-2, D-31-1 and D-34-1 (e2e failures in some projects) are recorded in deferred-items.md."
      - "Branch gsd/phase-11-public-site-content-management is 487 commits ahead of main and has no upstream; the Phase 11 PR is not open yet."
  - phase: 02-web-foundation-design-system
    items:
      - "PERF-02 reads Complete under Phase 2, but the public pages miss it: LCP 2.1 to 2.6 s (report-only by D-29) and the performance score fell to 0.94 on some runs (D-P11-BL-42: keep 0.95, re-run). Re-audit in Phase 14. The tracking row should say this."
      - "02-43 follow-up quick task (WR-02, IN-01 to IN-05) carried, not re-checked."
  - phase: 09-order-images-maintenance-jobs
    items:
      - "ROADMAP.md still shows Phase 9 unchecked, though PR #23 merged 2026-11-06, and ticks 09-31 and 09-32 though both are deferred (D-51)."
      - "CUT-01 backup job deferred (D-51); backups stay manual until Phase 17. P9-BL-07 and the images.file-missing wording carried."
  - phase: process
    items:
      - "05-REVIEW-DISPOSITION.md (15 warnings, 25 info) and 03-REVIEW-DISPOSITION.md (8 findings) still have findings with no outcome, carried from the Phase 10 audit."
      - "09-REVIEW-FIX.md: 25 info findings 'recorded only', carried."
  - phase: carried
    items:
      - "Phases 1, 4, 5, 6, 7, 7.1, 8 and 10 tech debt as listed in v1-through-phase-10-MILESTONE-AUDIT.md, not re-checked here (ExpenseListTimingTests on this machine, IN-03 WebKit guard, P10-BL-01 imported orders, and the rest)."
nyquist:
  compliant_phases: ["01", "02", "04", "05", "07.1", "08", "09", "10", "11"]
  partial_phases: []
  not_validated_phases: ["03", "06", "07"]
  missing_phases: []
  overall: partial
---

# Milestone audit: v1 through Phase 11

*Created: 2026-11-15T06:42:00-06:00 · Updated: 2026-11-15T07:05:00-06:00*

**Audited:** 2026-11-15 · **Status:** tech_debt · **Scope:** Phases 1 to 11 (Phases 12 to 17 not started)

## Summary

There are no blockers. Phase 11 has a verification (6 of 6 truths, 14 of 14 requirements in code, no code gaps), a validated Nyquist file, a security review with 0 open threats, a UI re-review and a UAT at 259 of 263. The integration check found every Phase 11 connection wired to earlier phases. Phase 10 has shipped since the last audit.

The status is tech_debt because of items that need you or a small chore. Nine files fail the format check, so `verify` is not clean. 16 review findings have no outcome. 57 parked owner items are open. Four UAT items wait on the go-live. The debt carried from earlier audits is mostly unchanged.

## Phases

| Phase | VERIFICATION | SECURITY | VALIDATION (Nyquist) | UAT | Result |
|---|---|---|---|---|---|
| 01 to 10 | as in the Phase 10 audit | verified, 0 open | 03, 06, 07 draft; rest compliant | as before | ✓ (carried) |
| 11 Public Site & Content Management | human_needed (6/6, 14/14 reqs) | verified, 0 open | compliant (validated 2026-11-15) | partial: 259 pass, 1 issue (test 19, fixed in code), 3 blocked on go-live | ✓ code, ◷ go-live and test 19 |

## Requirements (3-source cross-reference)

| Group | Phase | Count | VERIFICATION | SUMMARY | REQUIREMENTS.md | Final |
|---|---|---|---|---|---|---|
| Phases 1 to 10 (see the Phase 10 audit) | 1 to 10 | 126 | passed | listed | Complete (JOB-01 Partial by design) | **satisfied** |
| PUB-01 to 06 | 11 | 6 | SATISFIED | listed | Complete | **satisfied** |
| GAL-01 to 03 | 11 | 3 | SATISFIED | listed | Complete | **satisfied** |
| CONT-01 to 05 | 11 | 5 | SATISFIED | listed | Complete | **satisfied** |

**Score: 140/140 satisfied, 0 orphaned.** PERF-02 (Phase 2) is the one tracking problem: it reads Complete, but the public pages miss its LCP and sometimes its performance score. That is waived in part (D-29, D-P11-BL-42) and re-audited in Phase 14, so it is debt, not a blocker.

## Cross-phase integration

The gsd-integration-checker did a static read of Phase 11 against Phases 1 to 10. It found 0 blockers and 4 info notes. I closed note F3 directly: no Phase 11 content write uses `ExecuteUpdate` or `ExecuteDelete`, so the cache-clearing interceptor sees every content write. The only order `ExecuteUpdate` (`OrderStore.cs:109`) changes the edit version alone. The other notes (a combined CSP and JSON-LD test, gallery audit detail readers) are info items.

| Connection (Phase 11 to earlier phases) | Status |
|---|---|
| Every new controller declares a policy; content writes are Manager only; the matrix has rows for the new routes | ✓ |
| The old Minimal API `GET /site-settings` is now a controller | ✓ |
| Public reads are anonymous and rate limited; the SPA shell does not shadow /api, /health, /openapi, /scalar | ✓ |
| Admin routes and the 404 are noindex; the CSP stays strict with the JSON-LD block | ✓ |
| Content uploads use the Phase 9 metadata strip and deletion queue; the stray sweep knows the new image columns | ✓ |
| Show-on-website uses the Order aggregate; delete turns it off and restore keeps it off (D-P11-BL-29) | ✓ |
| Every content write, including order show, delete and restore, clears the public cache on commit | ✓ |
| Content edits write audit events with Audit Log labels | ✓ |
| Site Content is routed Manager only and in the sidebar; per-module services; no stray fetch; no `DateTime.Now` | ✓ |

Earlier connections: 14 of 14 from the Phase 10 audit. **Total 23/23.**

| # | Flow | Status |
|---|---|---|
| 1 to 9 | Flows from the Phase 10 audit | ✓ (weekly run still red) |
| 10 | Manager edits Business Info and hours, then Contact shows them and Open now in Manila | ✓ |
| 11 | Manager edits a product line price or photo, then Products and the server head | ✓ |
| 12 | Order shown with consent, then Gallery and Home; deleted, it leaves; restored, it stays off | ✓ |
| 13 | Visitor from Facebook: the first HTML has OG and JSON-LD per page; an unknown path is a real 404 | ✓ (live check is UAT 23) |
| 14 | Maintenance jobs with the Phase 11 image tables | ✓ |

## Tech debt

The full list is in the frontmatter. These need attention first:
1. **Format check (D-39-1): fixed 2026-11-15.** Nine web files failed Prettier, which would have failed CI step "4 web prettier". They are formatted now and `format:check` passes.
2. **Review findings with no outcome (owner rule).** Phase 11's second review has 16 info findings marked out of scope. Phase 5 (40), Phase 3 (8) and Phase 9 (25) are unchanged.
3. **UAT test 19.** The fix is in the code, but the UAT still reads "issue". A manual re-test with a real phone photo closes it.
4. **999.7 owner items.** 57 of 67 are open. Most only need a yes on what was built. P11-BL-51 (a database check for customer consent) and P11-BL-43 (font subsetting) need a real choice.
5. **PERF-02 tracking.** Mark the row as not met on public pages, waived in part and re-audited in Phase 14.
6. **Roadmap ticks.** Phase 9 is shipped but still unchecked. 09-31 and 09-32 are ticked but deferred.
7. **Weekly CI run (OPS-02).** It has still never passed.
8. **Nyquist.** Phases 03, 06 and 07 still have draft VALIDATION.md files.
9. **Ship.** The Phase 11 branch is 487 commits ahead of main with no upstream. The PR comes after your sign-off.

## Nyquist coverage

| Phase | VALIDATION.md | Compliant | Action |
|---|---|---|---|
| 01, 02, 04, 05, 07.1, 08, 09, 10, 11 | exists | true | none |
| 03 | exists (draft) | not validated | `/gsd-validate-phase 3` |
| 06 | exists (draft) | not validated | `/gsd-validate-phase 6` |
| 07 | exists (draft) | not validated | `/gsd-validate-phase 7` |
