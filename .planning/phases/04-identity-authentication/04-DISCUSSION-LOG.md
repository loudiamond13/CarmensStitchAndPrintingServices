---
created: "2026-10-14T07:56:00-05:00"
updated: "2026-10-14T07:56:00-05:00"
phase: 04-identity-authentication
kind: discussion-log
---

# Phase 4: Identity & Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-14
**Phase:** 04-identity-authentication
**Areas discussed:** Sign-in screens & sessions, Passwords & recovery, Email sender & dev mail, Security limits & tech approvals

Options marked (R) were the recommended choice.

---

## Sign-in screens & sessions

| Question | Options presented | Selected |
|---|---|---|
| C-6 code screen | Same look, own page (R) · Second step on same page | Same look, own page |
| C-8 deactivated account | Same generic error (R) · Tell them after the code · Banner as designed | Same generic error |
| C-19 Keep me signed in default | Unticked (R) · Ticked, as designed | Unticked |
| C-17 sign-out-all placement | User menu now (R) · Wait for Phase 5 | User menu now |
| C-17 missing screens | Build from existing parts (R) · I'll design them first | Build from existing parts |
| Landing after sign-in | Page they were trying to open (R) · Always the dashboard | Page they were trying to open |
| Code in email subject | Code only in body (R) · Code in the subject | **Code in the subject** (owner override) |
| Remember last email | Never prefill (R) · Remember on this browser | Never prefill |
| Resend cap message | Plain message + wait (R) · Show exact wait time | Plain message + wait |

## Passwords & recovery

| Question | Options presented | Selected |
|---|---|---|
| C-5 password rule | 12+ NIST (R) · 8+ with number & symbol | **8+ with number & symbol** (owner override) |
| Extra checks kept (multi) | Breach check · No name/email inside · Strength meter · Allow up to 128 | Breach check, name/email, strength meter |
| Max length | 64 (R) · 128 · 20 | 64 |
| AD-6 name check | Can't contain it (R) · Can't be exactly it | Can't contain it |
| C-7 forgot password | Email reset link (R) · Ask a Manager | Other: "Both, email reset link and a manager can do it too" |
| Manager reset method | Manager sends reset link (R) · Manager types temp password · Both | Both |
| C-33 HIBP down | Allow + local list (R) · Refuse until back · Allow, no list | Allow + local list |
| C-4 onboarding | Emailed invite (R) · Manager temp password · Both | Both |
| Temp password expiry | 24 hours (R) · 7 days · Never | **Never expires** |
| Temp + emailed code | Yes, code still required (R) · No code first time | Yes |
| Which phase builds forced change | Phase 4 (R) · Phase 5 | Phase 4 |
| Temp password source | System random (R) · Manager types · Random, Manager may edit | Random, Manager may edit |
| After reset | Back to sign-in (R) · Signed in automatically | Back to sign-in |
| Reset unlocks lockout | Yes (R) · No | Yes |
| Late breach finding | Must change at next sign-in (R) · Just warn | Must change |
| Edited temp password checks | Same checks (R) · Basic rule only | **Basic rule only** |
| Temp password → sessions | Sign out everywhere (R) · Leave sessions | Sign out everywhere |
| Deactivated + forgot password | Email: ask a Manager (R) · Nothing | Email: ask a Manager |
| Lockout email | Reset link + "not you?" (R) · Notice only | Reset link + "not you?" |

**Notes:** The owner knowingly chose the design's password rule over NIST, so AUTH-11 needs amending. Not keeping "allow up to 128" led to the max-length question.

## Email sender & dev mail

| Question | Options presented | Selected |
|---|---|---|
| OD-12 sender | New no-reply mailbox (R) · accounts@ · Reuse shop mailbox | no-reply@cspstailoring.com |
| From name | Carmen's Stitch & Printing (R) · CSPS Staff Portal | Carmen's Stitch & Printing |
| AD-4 dev mail | Files default, real optional (R) · Always real mail · Files only | **Always real mail** (owner override) |
| C-9 email change | Confirm new address (R) · Change immediately | Confirm new address |
| Reply-To | Shop's main address · No Reply-To | No Reply-To |
| Mail setup timing | Before execution (R) · During execution | Before execution |
| Email look | Simple branded + text (R) · Plain text · With logo | Other: "With logo image and make it look good and fancy" |
| Language | English only (R) · English + Filipino | English only |
| Sign-in info in code email | Time + browser/device (R) · Time only · Nothing | Time + browser/device |
| Mail server down | Retry quietly (R) · Tell them it failed | Retry quietly |
| Logo delivery | Inline attachment (R) · From website | Inline attachment |
| Email design review | In /gsd-ui-phase 4 (R) · Just make it nice | In /gsd-ui-phase 4 |

## Security limits & tech approvals

| Question | Options presented | Selected |
|---|---|---|
| AD-1 .NET security update | Apply now (R) · Wait 14 days | Apply now |
| AD-2 packages | Approve all (R) · Show details first | Approve all |
| C-23 cookie | `__Secure-` auth path only (R) · `__Host-` whole site | `__Secure-csps_rt`, `/api/v1/auth` |
| AD-3 test inbox | Separate Testing mode (R) · Also in Development | Testing mode |
| AD-5 limits | Proposed numbers (R) · Looser · Stricter | Proposed numbers |
| AD-7 replays | Successes + input errors (R) · Successes only | Successes + input errors |
| Bootstrap first Manager | Typed at the command (R) · Invite email | **Invite email** (owner override) |
| Sign out of all devices | Including this one (R) · All others, keep this one | **All others, keep this one** (owner override) |
| OD-14 a11y clashes | Rule each in /gsd-ui-phase 4 (R) · Accessibility always wins | Rule each in UI phase |

**Notes:** The invite-email bootstrap pulls invite acceptance into Phase 4.

## Claude's Discretion

- Names (tables, routes, audit codes)
- Invite-link lifetime (suggested 72 h)
- Temp-password word list
- User-Agent parse granularity
- Outbox retry schedule
- 401 vs 400 for bad credentials
- Final idempotency allow-list

## Deferred Ideas

- Manager temp-password, invite and reset buttons (Phase 5)
- Email-change flow (Phase 5)
- Sign-out-all on the profile page (Phase 5)
- Host SMTP/HIBP/cookie checks (Phase 3)
- Purge jobs (JOB-01)
- SMS or authenticator-app second factor (AUTH-V2-01)
