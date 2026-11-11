---
phase: "10"
slug: "admin-dashboard"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-11-09T21:50:00-06:00"
updated: "2026-11-10T09:30:00-06:00"
---

# Phase 10: Security

*Created: 2026-11-09T21:50:00-06:00 · Updated: 2026-11-10T09:30:00-06:00*

> Per-phase security contract: threat register, accepted risks, and audit trail.

All 68 register rows from the 21 plans are closed (47 threat ids plus T-10-SC, which every plan repeats). 67 are mitigated in code and 1 is an accepted risk. The auditor read each mitigation in the code it names and the tests that pin it. It did not run the test suites, because another project was using the shared machine; ASVS level 1 asks for this depth.

**Re-audit 2026-11-10:** 16 commits landed after the first audit (D-111 fixes and the code review fixes WR-01, IN-01, IN-02, IN-04). No package manifest, lockfile or license exception changed. The changed money and audit code was read again: a normal transfer now writes its own audit entry, with ids and `note=yes/no` only, in the same save. Every row stays closed; T-10-20, T-10-38 and T-10-44 now carry the new evidence.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser to API | Staff call 13 new endpoints: 2 dashboard, 5 staff money, 6 money transfers | Business figures, staff balances, transfer amounts and notes (confidential staff data) |
| Admin to Manager role | Managers see every person's money, deleted transfers, hand-overs, delete and remove; Admins see only their own money | Other staff members' balances and ledgers |
| Signed-in user to their own record | The sender of a transfer and the owner of "me" come from the token, never from the request | User ids, money on hand |
| API to database | Transfers are written under a database lock; audit rows are append-only | Money transfer rows, audit entries |
| Dev showcase | `/dev/components` demos use fixed demo values only and are dev-route only | No real data |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Information disclosure | Staff ledger query | medium | mitigate | No query filter is lifted, so deleted orders and expenses never reach a ledger (`StaffLedgerQuery.cs`; `StaffLedgerQueryTests` DeletedOrder and DeletedExpense) | closed |
| T-10-02 | Tampering | Business date rules | low | mitigate | `BusinessClock` takes the instant as input; `DateTime.Now` and `Today` are banned build-wide (`BuildConfigTests`) | closed |
| T-10-03 | Tampering | MoneyTransfer factories | high | mitigate | Private constructor and setters; only `Record` and `RecordHandover` create a transfer; reflection test allows only `EnsureRemovable` and `SoftDelete` | closed |
| T-10-04 | Information disclosure | Refusal text (D-49) | low | mitigate | A Manager sees the figure, an Admin does not (`MoneyRules.cs`; `MoneyTransferEndpointTests`) | closed |
| T-10-05 | Tampering | Strict CSP in the chart | medium | mitigate | Clip ids from `useId`, one custom-property style only, no `dangerouslySetInnerHTML`; e2e fails on any CSP violation | closed |
| T-10-06 | Information disclosure | GET dashboard/summary | medium | mitigate | `[Authorize(Policy = Staff)]`; matrix row 401/200/200 | closed |
| T-10-07 | Information disclosure | Stale figures after a write | low | mitigate | Dashboard answers `no-store` (`DashboardSummaryEndpointTests`) | closed |
| T-10-08 | Spoofing | First name in the greeting | low | mitigate | Read from the token user; the action takes no input | closed |
| T-10-09 | Denial of service | dashboard/chart `months` | medium | mitigate | Validator allows only 6 or 12, before any read (`DashboardChartEndpointTests`) | closed |
| T-10-10 | Spoofing | Dev /admin preview | low | mitigate | Dev routes hold only `dev` and `dev/public` (`routes.test.tsx`) | closed |
| T-10-11 | Tampering | First name in the h1 | low | mitigate | Rendered as React text; an `<img onerror>` name renders no image (`DashboardPage.test.tsx`) | closed |
| T-10-12 | Tampering | Money on hand | high | mitigate | Summed on the server on every read; one `MoneyOnHand.Of` caller; no balance in any request or column | closed |
| T-10-13 | Information disclosure | GET staff-money/me | medium | mitigate | No id in the route; the handler uses the token user; a query id is ignored (`StaffMoneyBalanceTests`) | closed |
| T-10-14 | Tampering | AddMoneyTransfers schema | medium | mitigate | CHECK constraints for a positive amount and different from and to; additive migration; no trigger (`TriggerInventoryTests`) | closed |
| T-10-15 | Tampering | Client figures and bar width | low | mitigate | Bar width by custom property only; order links use the server id | closed |
| T-10-16 | Spoofing | Sender of a transfer | high | mitigate | The request has no sender; the sender comes from the token; forged fields are ignored (`MoneyTransferAttributionTests`) | closed |
| T-10-17 | Tampering | Double spend by concurrent transfers | high | mitigate | Exclusive database lock taken before any read (`DatabaseLocks`); race tests in `MoneyTransferConcurrencyTests` | closed |
| T-10-18 | Tampering | Replayed or double-clicked POST | medium | mitigate | `IdempotencyMiddleware` covers both money POSTs; a reused key with another body gives 422 | closed |
| T-10-19 | Information disclosure | Recipient or leaver figures | medium | mitigate | The answer carries the sender's balance only; recipients carry no figure | closed |
| T-10-20 | Repudiation | Who recorded a transfer | low | mitigate | `IAttributedRecord` stamped from the token and clock by `RecordStampInterceptor`; since D-111 a normal transfer also writes a `money-transfer.added` audit entry with the sender as actor, in the same save (`CreateMoneyTransferHandlerTests`, `MoneyTransferEndpointTests`) | closed |
| T-10-21 | Tampering | `range` URL parameter | low | mitigate | Allow-list parser (`6m`, `12m`); the server re-checks (T-10-09) | closed |
| T-10-22 | Information disclosure | Stale figures after a write | low | mitigate | `staleTime 0` and `refetchOnMount: 'always'`; the dashboard key is invalidated after order, expense and money writes | closed |
| T-10-23 | Elevation of privilege | POST handovers | high | mitigate | `Policies.Manager`; matrix 401/403/400; an active sender is refused; the Manager is re-read under the lock | closed |
| T-10-24 | Repudiation | Who handed money over | medium | mitigate | `money-transfer.handed-over` audit in the same save; append-only audit log | closed |
| T-10-25 | Tampering | Two hand-overs overdrawing a leaver | high | mitigate | Lock taken first; race test in `MoneyTransferConcurrencyTests` | closed |
| T-10-26 | Information disclosure | Recipient list and audit detail | medium | mitigate | Recipients carry name, status and isYou only; audit detail holds ids and `note=yes/no` | closed |
| T-10-27 | Information disclosure | Strip and My Money | low | mitigate | The client calls `staff-money/me` with no id (`moneyService.test.ts`) | closed |
| T-10-28 | Information disclosure | Deleted transfers to an Admin | medium | mitigate | An Admin's `deleted=true` is refused before any read (`MoneyTransferListEndpointTests`) | closed |
| T-10-29 | Denial of service | Large page size or deep page | medium | mitigate | Page size 1 to 100, page 1 to 100,000 (`StaffLedgerEndpointTests`) | closed |
| T-10-30 | Tampering | Client validation bypass | low | accept | See AR-10-01 | closed |
| T-10-31 | Tampering | Double submit | medium | mitigate | `useSubmission`: one key per submission, in-flight re-entry returns the same promise | closed |
| T-10-32 | Information disclosure | IDOR on staff-money/{userId} | high | mitigate | `StaffMoneyAccess` decides before any lookup; a random id and a real coworker give the same 403 (`StaffMoneyAccessEndpointTests`) | closed |
| T-10-33 | Elevation of privilege | GET staff-money (all balances) | high | mitigate | `Policies.Manager`; matrix 401/403/200 | closed |
| T-10-34 | Information disclosure | Legacy holder in lists | low | mitigate | The legacy holder is excluded and treated as not staff (`StaffBalancesEndpointTests`) | closed |
| T-10-35 | Tampering | Ledger URL parameters | low | mitigate | Allow-list parsers; Manager-only values dropped for an Admin; the server re-checks | closed |
| T-10-36 | Tampering | Stale delete over a newer state | medium | mitigate | Version compared, 409 on conflict; race test with one winner and one audit entry | closed |
| T-10-37 | Repudiation | Delete and remove unaudited | high | mitigate | Audit recorded in the same save as the delete or remove | closed |
| T-10-38 | Information disclosure | Note text in the audit log | medium | mitigate | Audit writes `note=yes/no` only, for the new `money-transfer.added` entry too (`MoneyAuditDetailTests`, `CreateMoneyTransferHandlerTests` note=yes and note=no cases) | closed |
| T-10-39 | Elevation of privilege | Admin deleting or removing | high | mitigate | `Policies.Manager` on both; matrix 401/403/404 | closed |
| T-10-40 | Tampering | An edit path | medium | mitigate | No PUT or PATCH route; the store has no update (`MoneyTransferRoutesTests`) | closed |
| T-10-41 | Elevation of privilege | Person page for an Admin | medium | mitigate | Route loader redirects an Admin with zero person requests; the API gives 403 anyway | closed |
| T-10-42 | Tampering | `:userId` route parameter | low | mitigate | GUID parser with a not-found state; the query runs only for a valid id | closed |
| T-10-43 | Information disclosure | Staff figures in an Admin's page | medium | mitigate | The Admin branch mounts Mine only; no staff request (`MoneyPage.test.tsx`) | closed |
| T-10-44 | Tampering | Misleading delete warning | low | mitigate | Built from server balances read fresh on open, labelled, replaced by server figures after the delete; the owner approved this labelled preview in D-111 (P10-BL-18 A) | closed |
| T-10-45 | Information disclosure | Delete actions or deleted rows for an Admin | medium | mitigate | Hidden in the UI for an Admin; the API refuses anyway (T-10-28, T-10-39) | closed |
| T-10-46 | Information disclosure | Real data in demos or sweeps | low | mitigate | Showcase demos make no request; dev routes only | closed |
| T-10-47 | Tampering | CSP violations on new pages | medium | mitigate | The e2e guard fails on any CSP finding; dashboard and money sweeps cover light and dark | closed |
| T-10-SC | Tampering | NuGet and npm installs (all 21 plans) | high | mitigate | No package manifest, lockfile, tool manifest or license exception changed since the phase's first commit | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low. Only open threats at or above `block_on: high` count toward threats_open.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-30 | The browser checks (zod) can be bypassed. They are there for the person's convenience only (OR-3). The server validator and the domain rules re-check every rule, so a bypass is refused there. | Plan 10-15 threat model (accept disposition, under OR-3) | 2026-11-09 |

**Residual risks recorded under owner ruling D-49 (on mitigated rows, not separate threats):**

- **T-10-04:** an Admin who keeps probing learns only a bound on a coworker's money, and each success moves real money.
- **T-10-26:** leavers who still hold money appear in the recipient list, without amounts.

**Owner items from the first audit, now ruled (D-111, owner, 2026-11-09):**

- **P10-BL-08 (fixed):** a normal staff transfer now writes a `money-transfer.added` audit entry (commit 3bea5c9e).
- **P10-BL-18 (accepted, option A):** the Delete Transfer warning keeps its one browser subtraction as a labelled preview built only from server balances. The server's figures win after the delete.
- **P10-BL-09 (accepted, option A):** a status change in the same second as a hand-over can use the status from just before it. No money can be overdrawn, and a second hand-over fixes it.
- **Code comment fix (done):** the `moneyService.ts` comment on `GET /money-transfers` now says an Admin gets their own transfers and a 403 only for deleted ones.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-09 | 68 | 68 | 0 | gsd-security-auditor (code read at ASVS L1; tests read, not run) |
| 2026-11-10 | 68 | 68 | 0 | orchestrator re-audit of the 16 commits after 36c64501 (diffs and tests read at ASVS L1; tests not run) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
