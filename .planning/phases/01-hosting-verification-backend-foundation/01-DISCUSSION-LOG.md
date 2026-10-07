# Phase 1: Hosting Verification & Backend Foundation - Discussion Log

> **Audit trail only.** Don't use this as input to planning, research or execution agents.
> CONTEXT.md holds the decisions. This log keeps the alternatives that were considered.

**Date:** 2026-10-07
**Phase:** 01-hosting-verification-backend-foundation
**Areas discussed:** Locale & business clock, Local & test databases, Hosting record & email, Security & tooling rulings, Logs on shared hosting, /health exposure, Audit log details, Error wording

---

## Locale & business clock

| Question | Options | Selected |
|---|---|---|
| OD-1 currency/locale | PHP ₱ en-PH (rec) · PHP ₱ fil-PH | PHP ₱, en-PH |
| OD-2 time zone | Asia/Manila config only (rec) · Asia/Manila Manager-editable | **Manager-editable** |
| Year definition | Calendar Jan–Dec (rec) · Custom fiscal year | Calendar year |
| SiteSettings seed | Real name + placeholder contacts (rec) · Real contacts now | Real name, placeholders |

## Local & test databases

| Question | Options | Selected |
|---|---|---|
| C-20/C-30 local DB | Dedicated `CSPS` LocalDB (rec) · Shared MSSQLLocalDB · Docker locally | Dedicated `CSPS` instance |
| C-28 restore name | `CSPS_Legacy_Restore` (rec) · Keep `CSPS_Dev` | `CSPS_Legacy_Restore` |
| C-29 container ports | CI only, LocalDB locally (rec) · Fixed port 5190 locally | CI only |
| Dev seed | Explicit guarded command (rec) · Auto on startup | Explicit command |

## Hosting record & email

| Question | Options | Selected |
|---|---|---|
| C-45 verification | Owner has access, Claude writes checklist (rec) · Access later · No plan yet | Owner has access; checklist |
| Hosting plan | Advance+ (rec) · Basic · Premium · Not sure | **Basic** |
| Staging on Basic | Upgrade before Phase 3 (rec) · No staging, prod with approval · Second Basic account | **No staging; prod with approval** |
| OD-12 sender | Own domain · Buy one · Legacy site's domain | Own domain → same as legacy site (name TBD) |
| C-31 compat | No JSON, pin 160, re-pin after spike (rec) · Pin 170 now | Pin 160, re-pin |

## Security & tooling rulings

| Question | Options | Selected |
|---|---|---|
| OD-13 OpenAPI | Dev only (rec) · Prod Managers only · Prod JSON only | Dev only (owner asked for **Scalar**) |
| C-32 DP keys | Encrypt with certificate (rec) · Accept unencrypted | Certificate |
| C-32 dev cert | Dev PFX in user-secrets (rec) · Ephemeral keys | Dev PFX in user-secrets |
| S-3 arch tests | ArchUnitNET (rec) · NetArchTest 1.3.2 · eNhancedEdition | ArchUnitNET |
| S-5 licenses | Approve MPL-2.0 + OFL-1.1 (rec) · Fonts only | Approve both |
| S-10 cool-down | 7 days (rec) · 14 days · None | **14 days** |
| S-4 + S-11 | Confirm both (rec) · Discuss | Free text: "I don't want to get any licenses for anything; all resources/packages must be free". Both are free (MIT/Apache) → confirmed; recorded as D-00 |
| CLAUDE.md | Root only (rec) · Root + trim `.claude/CLAUDE.md` | Root + trim |

## Logs on shared hosting

| Question | Options | Selected |
|---|---|---|
| Location/retention | Files outside wwwroot, 30 days (rec) · 14 days · 90 days | 30 days |
| Alerts | Not in Phase 1 (rec) · Email digest later | Not in Phase 1 |

## /health exposure

| Question | Options | Selected |
|---|---|---|
| Visibility | Public minimal body (rec) · Public liveness + secret detail | Public minimal |
| Uptime monitor | Free one later (rec) · None | **None** |

## Audit log details

| Question | Options | Selected |
|---|---|---|
| IP storage | Truncated /24 and /48 (rec) · Full IP | Truncated |
| Retention | 2 years (rec) · Forever · Decide in hardening | 2 years |

## Error wording

| Question | Options | Selected |
|---|---|---|
| Language | Plain English (rec) · Taglish | Plain English |
| 500 detail | Generic + traceId (rec) · Generic only | Generic + traceId |

## Claude's Discretion

- Correlation-id header and propagation, the `/health` JSON shape, SiteSettings cache invalidation, project naming within PRD §3.1.

## Deferred Ideas

- Error alerting, uptime monitor, audit purge job, SiteSettings edit UI, staging (if the plan is upgraded), and the final sender domain and DNS records.
