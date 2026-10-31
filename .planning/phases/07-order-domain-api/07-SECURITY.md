---
phase: "07"
slug: "order-domain-api"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-10-29T05:45:00-05:00"
updated: "2026-10-29T05:45:00-05:00"
---

# Phase 07: Security

*Created: 2026-10-29T05:45:00-05:00 · Updated: 2026-10-29T05:45:00-05:00*

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of plans 07-01 to 07-20: 61 unique threats (T-07-01 to T-07-60, plus T-07-SC repeated in every plan). All 20 `## Threat Flags` sections say "None" or map to existing ids. One `gsd-security-auditor` run (ASVS level 1, static inspection, no tests run by the auditor) checked each mitigation at its cited file and line and returned SECURED with 0 open threats. The phase test run in `07-REVIEW-DISPOSITION.md` reports 5,915 tests, 0 failed.

Severity mix: 23 high, 24 medium, 14 low. Dispositions: 61 mitigate, 0 accept, 0 transfer.

---

## Trust Boundaries

| Boundary | Description | Plan |
|----------|-------------|------|
| Staff browser → `/api/v1/orders` and child routes | Either role reads and writes orders; anonymous is refused; restore and permanent delete are Manager only | 07-06 to 07-15 |
| Staff browser → order list routes (product types, payment methods, expense categories) | Either role reads; writes and GET by id are Manager only | 07-01, 07-17 |
| Order number allocator → database lock row | Numbers are taken under a lock so concurrent creates never collide or skip | 07-06, 07-07, 07-18 |
| Legacy import → `ImportOrderHandler` | No Release route; the only caller is the Testing-only seed route | 07-18, 07-20 |
| Audit log → audit viewer | Order entries store field names and figures, never customer text | 07-06 to 07-19 |
| Dev seed tool → database | Allowed only on `CSPS_Dev` and `CSPS_E2E` on LocalDB or loopback | 07-20 |
| Migration → production database | Order tables, checks and the legacy holder row, through the reviewed idempotent script | 07-03, 07-05, 07-09 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | EoP | List routes open to anonymous callers | medium | mitigate | `Policies.Staff` on the three list controllers; matrix asserts 401 | closed |
| T-07-02 | Tampering | Unstable seeds | low | mitigate | Literal GUIDs and timestamp in `OrderListSeed.cs`; `ModelHasNoPendingChanges` | closed |
| T-07-03 | Repudiation | Audit format not fixed | medium | mitigate | 43 Phase 7 codes in `AuditActions.cs`; `AuditActionsTests`; `docs/operations/audit-log.md` | closed |
| T-07-04 | Tampering | Wrong money figures | high | mitigate | `OrderMath.cs` pinned order; golden vectors (220 ids); coverage gate in CI | closed |
| T-07-05 | Tampering | Server and web previews drift | medium | mitigate | Golden vector fixture unchanged on this branch; v3 follow-up in `deferred-items.md` | closed |
| T-07-06 | Tampering | Completing an order with a balance | high | mitigate | `OrderStatusRules.Check` refuses a non-zero balance; 49-pair table test | closed |
| T-07-07 | Tampering | Undefined status reaches storage | medium | mitigate | `Enum.IsDefined` guard; `CK_Orders_Status` | closed |
| T-07-08 | Repudiation | Scope text changed without owner approval | medium | mitigate | Blocking human gate; `07-AMENDMENTS.md` records D-39 | closed |
| T-07-09 | Tampering | Mass assignment on create | high | mitigate | Request has no number, totals or attribution; `RecordStampInterceptor`; `OrderAttributionTests` | closed |
| T-07-10 | Tampering | Duplicate or skipped numbers | high | mitigate | Lock then read in `OrderNumberAllocator`; `IX_Orders_Number`; 20-way race test | closed |
| T-07-11 | Tampering | Invalid quantities, prices, dates, lengths | medium | mitigate | `OrderRules.cs` limits; field validators; database check constraints | closed |
| T-07-12 | Info disclosure | PII in create audit | medium | mitigate | `OrderAuditDetail` writes number, status, dates, count and total only; endpoint test | closed |
| T-07-13 | DoS | Oversized aggregate | low | mitigate | Request body limit; `MaxItems` 100 | closed |
| T-07-14 | Tampering | Duplicate order on double submit | medium | mitigate | Idempotency gate covers the POST; same key twice gives one order | closed |
| T-07-15 | Tampering | Duplicate numbers under load | high | mitigate | `OrderNumberingTests` (20-way, 10 rounds, contiguous); rollback leaves no gap | closed |
| T-07-16 | DoS | Held lock gives 500s | medium | mitigate | 10 s wait, timeout maps to 409 `OrderErrors.Busy` | closed |
| T-07-17 | Tampering | Lost update on edit | high | mitigate | Rowversion on `Order`; 409 on conflict; `OrderConcurrencyTests` | closed |
| T-07-18 | Info disclosure | Customer text in edit audit | medium | mitigate | `DetailsChanged` writes field names only | closed |
| T-07-19 | Tampering | Forged attribution on edit | medium | mitigate | No attribution members; stamp only on a real change | closed |
| T-07-20 | EoP | Another order's item by id | medium | mitigate | Items found inside the loaded order only; 404 test | closed |
| T-07-21 | Tampering | Child-only lost update | high | mitigate | `Order.Touch` on every child change; `LockAsync`; race test | closed |
| T-07-22 | Tampering | No items or above the cap | medium | mitigate | Item cap and last-item guard in `Order.cs` | closed |
| T-07-23 | Spoofing | Legacy holder activated or given a role | high | mitigate | `UserAccounts.FindUserAsync` hides the holder; `LegacyHolderHiddenTests` | closed |
| T-07-24 | EoP | Holder named as payer or receiver | medium | mitigate | `StaffState.CanPay`; `StaffDirectory` excludes the holder | closed |
| T-07-25 | Tampering | Holder migration does more than one insert | medium | mitigate | `AddLegacyHolder` is one insert and one delete; migration test | closed |
| T-07-26 | Tampering | Discount above subtotal gives negative total | high | mitigate | `Order.DiscountsFit` on all six paths; table-level check deferred (AR-07-01) | closed |
| T-07-27 | Info disclosure | Discount reason in audit | low | mitigate | Field names only | closed |
| T-07-28 | Tampering | Double spend on payments | high | mitigate | Balance cap on add and update; lock, rowversion and race test | closed |
| T-07-29 | Spoofing | Ineligible or holder receiver | medium | mitigate | `OrderReferenceChecks.CanPay`; 7 blocked states tested | closed |
| T-07-30 | EoP | Another order's payment by id | medium | mitigate | Found inside the loaded order only; 404 test | closed |
| T-07-31 | Info disclosure | Payment reference or notes in audit | low | mitigate | Field names only | closed |
| T-07-32 | Spoofing | Ineligible or holder payer | medium | mitigate | `OrderReferenceChecks.CanPay`; `OrderPeopleTests` | closed |
| T-07-33 | EoP | Another order's expense by id | medium | mitigate | Found inside the loaded order only; 404 test | closed |
| T-07-34 | Info disclosure | Expense description in audit | low | mitigate | Field names only | closed |
| T-07-35 | Tampering | Completing while money is owed or held | high | mitigate | `ChangeStatus` inside `ConflictRetry`; complete versus discount race test | closed |
| T-07-36 | Tampering | Closed order changed without reopen | medium | mitigate | `EnsureEditable` first in all 17 mutators; `OrderLockTests` | closed |
| T-07-37 | Repudiation | Status move with no trail | medium | mitigate | `OrderStatusChange` row and audit entry in the same save | closed |
| T-07-38 | Tampering | Refund above paid or credit | high | mitigate | `RefundCapMessage` on add and update | closed |
| T-07-39 | Tampering | Two refunds pass the cap together | high | mitigate | Same lock and rowversion flow; race test | closed |
| T-07-40 | Spoofing | Ineligible or holder refunder | medium | mitigate | `OrderReferenceChecks`; 7 blocked states tested | closed |
| T-07-41 | Tampering | Refund exception used to change a closed order | medium | mitigate | `EnsureRefundEditable` used by the refund methods only | closed |
| T-07-42 | EoP | Admin restores or purges | high | mitigate | `Policies.Manager`; matrix asserts Admin 403 | closed |
| T-07-43 | Tampering | Purge by accident | medium | mitigate | Confirm must equal the order number; audit before remove | closed |
| T-07-44 | Info disclosure | Customer data in the purge audit | medium | mitigate | Number, money and user ids only | closed |
| T-07-45 | Tampering | Deleted order's money still counts | high | mitigate | `SoftDelete` filter on all seven order tables | closed |
| T-07-46 | Tampering | Search injection or wildcard abuse | high | mitigate | `EF.Functions.Like` with escaped `LikePattern`; `NoInlineSqlTests` | closed |
| T-07-47 | DoS | Huge pages, deep pages, slow scans | medium | mitigate | `ListQueryRules` caps; indexes; count and timing tests | closed |
| T-07-48 | Info disclosure | Deleted orders in the list | medium | mitigate | Default filter kept (review fix `d779f35b`); list tests | closed |
| T-07-49 | EoP | Admin changes shared lists | high | mitigate | `Policies.Manager` on list writes; matrix asserts Admin 403 | closed |
| T-07-50 | Tampering | Deleting an entry money rows use | medium | mitigate | Use count; `NoAction` foreign keys; in-use exception | closed |
| T-07-51 | DoS | Unique or FK races as 500s | medium | mitigate | `OrderListStore.TranslateSaveFailure`; race tests; busy code per D-78 | closed |
| T-07-52 | Repudiation | List changes unaudited | low | mitigate | `audit.Record` in all six list write handlers | closed |
| T-07-53 | EoP | HTTP caller uses the lenient import | high | mitigate | No route in Release; the only caller is the Testing-only route (T-07-59) | closed |
| T-07-54 | Tampering | Legacy numbers collide with new ones | high | mitigate | Number check and reserve under the lock; 422 `orders.number-taken` | closed |
| T-07-55 | Tampering | Money changed or truncated on import | high | mitigate | `Order.Import` recalculates from children; over-length text refused | closed |
| T-07-56 | Info disclosure | Customer text via the audit viewer | medium | mitigate | `AuditChangeLines` parses names only; snapshot test | closed |
| T-07-57 | DoS | Unknown detail keys crash the viewer | low | mitigate | Unknown keys ignored; malformed value test | closed |
| T-07-58 | Tampering | Seeding a non-dev database | high | mitigate | `DevSeedTargetGuard` allow-list; seed step skips a non-empty table | closed |
| T-07-59 | EoP | Testing seed route reachable in Release | high | mitigate | `#if CSPS_TESTING` (Debug only); feature provider; Release build scan test | closed |
| T-07-60 | Info disclosure | Real-looking personal data in fixtures | medium | mitigate | `@example.com` emails, asserted by test; sample phone per AR-07-02 | closed |
| T-07-SC | Tampering | Package installs (repeated in all 20 plans) | high | mitigate | No package, project or tool manifest changed on this branch | closed |

*Status: open · closed · open: below high threshold (non-blocking)*
*Severity: critical > high > medium > low. Only open threats at or above `block_on` count toward `threats_open`.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No threat has disposition `accept`. These residual risks are kept on owner rulings.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-26 | No table-level database check for the discount cap. The domain cap runs on all six paths. A direct database write could bypass it. Revisit after Phase 7.1 measures the legacy rows, because such a check could fail imported rows. | Owner (D-40) | 2026-10-28 |
| AR-07-02 | T-07-60 | The dev seed uses the UI spec's sample phone number `0917 123 4567`. | Owner (IWB-IN-04) | 2026-10-28 |
| AR-07-03 | T-07-03, T-07-12 | A full create body keeps one `order.created` audit entry, with no per-child entries. | Owner (D-49c, APO-WR-02) | 2026-10-28 |
| AR-07-04 | T-07-51 | List writes that lose a race twice reuse the shared `auth.session-busy` code. | Owner (D-78, APX-IN-04) | 2026-10-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Related items outside the register

- **APO-IN-02 (deferred, low):** a person deactivated between the eligibility check and the save can still be named on one payment, expense or refund row (T-07-29, T-07-32, T-07-40). No foreign key can fail. Recorded in `07-REVIEW-DISPOSITION.md`.
- **APX-IN-01 (deferred to the Phase 8 UI review):** the audit lines leave out the current payer, receiver, refunder and created total. This exposes nothing.
- **T-07-53 and T-07-59 wording:** plan 07-18 said no route calls the import handler; plan 07-20 later added the Testing-only seed route. The Release build test (`ReleaseHasNoEmailSinkTests`) is the proof that it is absent from Release.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-29 | 61 | 61 | 0 | gsd-security-auditor (ASVS L1, static) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-29
