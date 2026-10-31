---
phase: "06"
slug: "company-expenses"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-10-26T03:20:00-05:00"
updated: "2026-10-26T03:20:00-05:00"
---

# Phase 06: Security

*Created: 2026-10-26T03:20:00-05:00 · Updated: 2026-10-26T03:20:00-05:00*

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of plans 06-01 to 06-21: 74 unique threats (T-06-01 to T-06-73, plus T-06-SC repeated in every plan; 94 rows before dedupe). Plans 06-20 and 06-21 implement owner rulings D-49 and D-50. One `gsd-security-auditor` run (ASVS level 1, static inspection, no tests run by the auditor) checked each mitigation at its cited file and line and returned SECURED with 0 open threats. The phase test runs back the cited tests: .NET 4,093 total, 0 failed, 1 opt-in skip; web 5,959 passed; e2e `@expenses|@settings` 140 passed. No production or test code changed between those runs and the audit (only `web/e2e`, re-run afterwards).

Severity mix: 16 high, 40 medium, 18 low. Dispositions: 71 mitigate, 3 accept, 0 transfer.

---

## Trust Boundaries

| Boundary | Description | Plan |
|----------|-------------|------|
| Staff browser → `/api/v1/expense-categories`, `/api/v1/staff` | Either role reads; anonymous is refused | 06-01 |
| Migration → production database | Seed, schema and the lock table, through the reviewed idempotent script | 06-01, 06-21 |
| Staff browser → POST `/api/v1/company-expenses` | Untrusted JSON: dates, amounts, ids, free text | 06-02, 06-12 |
| Staff browser → GET `/api/v1/company-expenses/{id}` | Any id can be probed | 06-02 |
| Staff browser → GET `/api/v1/company-expenses` | q, category, dates, page, size | 06-03 |
| E2E runner → `/api/testing/expenses` | Anonymous, Debug Testing builds only | 06-03 |
| API → browser | Descriptions, names, category names and KPI figures rendered as text | 06-04, 06-09 |
| URL → list state | page, size, q, category, from, to | 06-04, 06-07, 06-16 |
| Staff browser → GET `/api/v1/company-expenses/kpis` | Company totals | 06-05 |
| Test runner → database | Bulk fake data in a throwaway `CSPS_Test_<guid>` only | 06-06 |
| Staff browser → PUT `/api/v1/company-expenses/{id}` | Body with version and payer id | 06-08, 06-14 |
| Admin or Manager browser → delete, restore, purge, deleted list | Managers only | 06-10, 06-16 |
| Developer machine → dev seed target | `CSPS_Dev` / `CSPS_E2E` only | 06-11 |
| Admin or Manager browser → category writes | Managers only | 06-13, 06-17 |
| Audit table → Manager browser; "Done to" filter | Id used in a LIKE | 06-15 |
| Admin session → `/admin/settings` | Managers only | 06-17 |
| Shipped showcase chunk → public static files | Made-up demo data | 06-18 |
| Local review pack → git or the internet | Git-ignored, never uploaded | 06-19 |
| Manager → temporary-password account | Mailbox not yet proved | 06-20 |
| Client → state-changing POSTs; concurrent requests → shared rows | Idempotency-Key and the EF-only locks | 06-21 |

---

## Threat Register

Evidence for every row (file and line) is in the audit verdict summarised under the audit trail; the main controls are named here.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | I (CWE-200) | Staff lookup leaking emails or states | medium | mitigate | `StaffMember(Id, Name)` only; `StaffLookupEndpointTests` | closed |
| T-06-02 | E (CWE-862) | Anonymous read of staff or categories | high | mitigate | Staff policy on both controllers; default-deny fallback; authorization matrix | closed |
| T-06-03 | T (OR-7) | Seed or schema outside migrations, or a trigger | medium | mitigate | HasData from literals; `TriggerInventoryTests`; `MigrationScriptTests` | closed |
| T-06-04 | S | Invited or blocked person offered as payer | medium | mitigate | Single `StaffState.CanPay`; SQL filter; settled by D-49 | closed |
| T-06-05 | I (CWE-532) | Audit detail carrying description or notes | medium | mitigate | `ExpenseAuditDetail` names fields only; `AuditDetailFormatTests` | closed |
| T-06-06 | S (CWE-915) | Forged attribution members on create | high | mitigate | Request has no attribution members; `RecordStampInterceptor` | closed |
| T-06-07 | T (CWE-20) | Invalid amounts, dates or lengths | medium | mitigate | Validator plus domain re-check; DB check `Amount > 0`; decimal(18,2) | closed |
| T-06-08 | T | Duplicate expense from double submit or replay | medium | mitigate | Default-on `IdempotencyMiddleware` for POST | closed |
| T-06-09 | E | Paying with a blocked or non-staff account | medium | mitigate | `CanPay` check on create and edit | closed |
| T-06-10 | I (CWE-532) | Description or notes in audit | medium | mitigate | Text-free snapshot | closed |
| T-06-11 | T (CWE-943) | LIKE wildcard injection in search | medium | mitigate | `LikePattern` escapes `\ % _ [` | closed |
| T-06-12 | D (CWE-400) | Oversized page, page number or search | medium | mitigate | Caps: size 100, search 100, page 1 to 100000; two-command reader; indexes | closed |
| T-06-13 | I | Notes text exposed or searchable (D-19) | medium | mitigate | List projections never select Notes; search excludes notes | closed |
| T-06-14 | E | Testing endpoint reachable in Release | high | mitigate | `#if CSPS_TESTING` plus `[TestingOnly]`; Debug-only symbol | closed |
| T-06-15 | I | Admin seeing rows they should not | low | accept | AR-06-01 | closed |
| T-06-16 | T (CWE-79) | Stored XSS through text fields | medium | mitigate | Lint bans HTML sinks; React text only | closed |
| T-06-17 | T (CWE-20) | Crafted page or size in the URL | low | mitigate | `pageParser` 1 to 100000; fixed size set; server caps | closed |
| T-06-18 | I | Dev preview shadowing the guarded page | low | mitigate | No `expenses` dev route; routes test | closed |
| T-06-19 | T | Wrong money figures from a device or server clock | medium | mitigate | `IBusinessCalendar` only; Manila midnight tests | closed |
| T-06-20 | I (CWE-862) | Anonymous read of company totals | medium | mitigate | Staff policy; matrix anon 401 | closed |
| T-06-21 | D (CWE-400) | Slow list or N+1 under volume | medium | mitigate | Compiled queries; command-count guards; p95 timing test (D-28) | closed |
| T-06-22 | T | Fake data reaching a shared or live database | high | mitigate | `CspsDatabase` only `CSPS_Test_<guid>`, re-checked on drop | closed |
| T-06-23 | T (CWE-20, CWE-601) | Crafted URL params | medium | mitigate | Trimmed, capped and typed parsers; no param reaches a redirect | closed |
| T-06-24 | I | Search text in the URL reaching analytics or logs | low | accept | AR-06-02 | closed |
| T-06-25 | E (CWE-639, CWE-862) | Admin editing another person's expense | high | mitigate | `ExpenseAccess.CanEdit` before any change; role from the database | closed |
| T-06-26 | T (CWE-362) | Lost update between two editors | high | mitigate | Rowversion byte compare plus EF token; 409; concurrency tests | closed |
| T-06-27 | S (CWE-915) | Forged attribution members on update | high | mitigate | Request has no attribution members; interceptor | closed |
| T-06-28 | R | Payer change without a trace | medium | mitigate | Separate payer-changed audit entry in the same transaction | closed |
| T-06-29 | I | Text in the change audit | medium | mitigate | Field names only | closed |
| T-06-30 | T | Browser totals drifting from the server | low | mitigate | Web formats server fields only | closed |
| T-06-31 | E (CWE-862) | Admin calling Manager-only actions | high | mitigate | Manager policy on four routes; matrix Admin 403 | closed |
| T-06-32 | R | Delete or restore without a trace | medium | mitigate | One audit entry per action; D-31 stamp | closed |
| T-06-33 | I | Text kept after permanent delete (D-06) | medium | mitigate | Text-free snapshot recorded before `Remove` | closed |
| T-06-34 | T | Double delete or replayed restore | low | mitigate | 404 on second delete; restore no-op; Idempotency-Key | closed |
| T-06-35 | T | Demo data written to a shared or live database | high | mitigate | `DevSeedTargetGuard`; seed creates no accounts | closed |
| T-06-36 | T (CWE-89) | SQL injection through hand-written SQL | medium | mitigate | Superseded by T-06-71 (D-50 removed the three sites) | closed |
| T-06-37 | T (SEC-06) | Duplicate expense from a double click | medium | mitigate | `useSubmission` one key per attempt | closed |
| T-06-38 | S | Arbitrary payer through a crafted value | low | mitigate | Picker offers the lookup plus saved payer; server `CanPay` decides | closed |
| T-06-39 | T (CWE-681) | Float rounding of amounts | medium | mitigate | Whole-centavo text check; server PrecisionScale(18,2) | closed |
| T-06-40 | E (CWE-862) | Admin changing the category list | high | mitigate | Manager policy on six routes; matrix Admin 403 | closed |
| T-06-41 | T | Deleting a category in use (D-10) | high | mitigate | Count includes soft-deleted rows; FK NoAction; 547 → 422 | closed |
| T-06-42 | T | Duplicate names through a race | low | mitigate | Pre-check plus unique index; 2601/2627 mapped | closed |
| T-06-43 | T (SEC-07) | Stale category save | medium | mitigate | Rowversion compare; 409 | closed |
| T-06-44 | T (CWE-79) | Stored XSS through category names | low | mitigate | Percent-encoded audit names; text-only rendering | closed |
| T-06-45 | E | Edit offered where an Admin may not edit (D-26) | medium | mitigate | Edit only when `canEdit`; server is the authority | closed |
| T-06-46 | T (SEC-07) | Stale form overwriting newer data | high | mitigate | Opened version sent; ConflictBanner with Load Latest; e2e | closed |
| T-06-47 | I | Notes shown to Admins in View (D-19, OQ-8) | low | accept | AR-06-03 | closed |
| T-06-48 | I (CWE-200) | Raw detail or personal text on screen | medium | mitigate | `AuditChangeLines` reads known, type-checked keys only | closed |
| T-06-49 | T (CWE-943) | LIKE injection through "Done to" | low | mitigate | Dashed GUID required; escaped LIKE | closed |
| T-06-50 | T | Audit rows changed while adding viewer features | high | mitigate | No change to the append-only path; reader AsNoTracking | closed |
| T-06-51 | E | Admin reaching the Deleted page or delete actions | medium | mitigate | Manager-only UI and loader; server 403 | closed |
| T-06-52 | T | Accidental permanent loss (D-05) | medium | mitigate | ConfirmDialog focuses Cancel; "can't be undone" copy | closed |
| T-06-53 | T | Replayed restore | low | mitigate | One key per attempt; server no-op | closed |
| T-06-54 | E | Admin reaching Settings (D-14) | medium | mitigate | Manager-only nav item and loader; server policy | closed |
| T-06-55 | T (SEC-07) | Stale category save from Settings | medium | mitigate | Opened version sent; ConflictBanner | closed |
| T-06-56 | T (CWE-79) | Stored XSS through a category name | low | mitigate | Text nodes only; lint ban | closed |
| T-06-57 | I | Real-looking personal data in shipped demo data | low | mitigate | No email in demos; build-output scan | closed |
| T-06-58 | T | CSP violations from new components | medium | mitigate | No inline style; e2e CSP listener; `style-src 'self'` | closed |
| T-06-59 | I | Review pack committed or uploaded | medium | mitigate | `artifacts/` git-ignored; script refuses otherwise | closed |
| T-06-60 | R | Ruling recorded as approved without the owner | medium | mitigate | Test refuses "approved" in the rulings list | closed |
| T-06-61 | S (CWE-287) | Payer whose mailbox was never proved (D-49) | medium | mitigate | `EmailConfirmed` plus password in all four clauses | closed |
| T-06-62 | T (CWE-697) | List, server check and detail flag drifting | medium | mitigate | One `CanPay` rule; consistency test | closed |
| T-06-63 | D | Long-time staff hidden after a reset | low | mitigate | `EmailConfirmed` never cleared; test | closed |
| T-06-64 | I | Lookup revealing account state | low | mitigate | `(Id, Name)` only; refusal text unchanged | closed |
| T-06-65 | E (CWE-362) | Two Managers removing each other | high | mitigate | EF-only roster lock held to commit; race tests | closed |
| T-06-66 | S (CWE-362, CWE-640) | Two usable sign-in links at once | medium | mitigate | Per-person stripe lock; 30-round race test | closed |
| T-06-67 | T (CWE-362) | Double-submitted POST saved twice | high | mitigate | Committed claim row; one-winner takeover; unique index; race tests | closed |
| T-06-68 | T (CWE-667) | Lock taken outside a transaction | medium | mitigate | `DatabaseLocks` throws with no transaction | closed |
| T-06-69 | D (CWE-833) | Lock waits piling up or undetected deadlock | medium | mitigate | 10 s wait, rounded up; timeout and deadlock mapped; lock order | closed |
| T-06-70 | D (CWE-667) | Key stuck "in progress" after a crash | low | mitigate | 2-minute lease, purge and takeover; lease length parked for the owner | closed |
| T-06-71 | T (CWE-89) | SQL injection through hand-written SQL | medium | mitigate | `NoInlineSqlTests` allows no file (D-50); 0 hits in `src` | closed |
| T-06-72 | I (CWE-532) | Request data stored in claim rows | low | mitigate | Name is a SHA-256 hash; no payload columns | closed |
| T-06-73 | T (OR-7, D-50) | Schema change beyond the ruling, or a trigger | medium | mitigate | Additive `DatabaseLocks` table only; trigger inventory test | closed |
| T-06-SC | T | Package installs | high | mitigate | No package, project or lock file change since `942a838` | closed |

*Status: open · closed · open: below high threshold (non-blocking)*
*Severity: critical > high > medium > low; only open threats at or above `block_on: high` count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-15 | Admins see every expense; `canEdit` only governs editing | Owner (D-25) | 2026-10-25 |
| AR-06-02 | T-06-24 | Search text sits in the URL by owner choice. Analytics sends the path only (ANL-05), the server log keeps the path without the query (FND-07), Referrer-Policy limits leaks, and search is capped at 100 characters | Owner (WEB-10) | 2026-10-07 |
| AR-06-03 | T-06-47 | Admins can read notes in View on any expense; notes never appear in the list or search. The owner's choice on narrowing this (A-IN-03, option 1 recommended) is still open in the STATE.md Owner backlog | Owner (D-25) | 2026-10-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Related items outside the register

Tracked in `06-REVIEW-DISPOSITION.md` and `deferred-items.md`, not counted here: A-IN-03 (notes visibility, parked for the owner), A-IN-02 (Paid by wording, parked), B-IN-02 and B-IN-05 (deferred, no data risk), B-IN-06 (documented with the lease item), a browser-cancelled request logged as a 500 (observability only), and test staff accumulating in `CSPS_E2E` (test database only).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-26 | 74 | 74 | 0 | gsd-security-auditor (ASVS 1, static) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-26 (automated audit; the owner is away and reviews on return)
