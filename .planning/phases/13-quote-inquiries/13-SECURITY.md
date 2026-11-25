---
phase: "13"
slug: "quote-inquiries"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-11-24T04:07:00-06:00"
updated: "2026-11-25T01:55:00-06:00"
---

# Phase 13: Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Visitor browser to public API | Anonymous quote form create, ticket and photo uploads | Name, phone, email, message, photos (personal data) |
| Public API to Cloudinary | Quote photos stored as private assets under `quotes/{id}` | Visitor photos (personal data) |
| Server to email transport | Staff alert and test email to the saved Quote alerts address | Visitor details in the alert (D-08 trade-off) |
| Staff browser to staff API | Inbox, detail, status, notes, delete, prefill, conversion | Visitor details, staff notes |
| GitHub Actions to maintenance endpoint | Daily keyed call runs the 6-month retention purge | None beyond the key |
| Dev and test tooling to LocalDB | Migrations, seed and e2e databases | Test data only; CSPS_* databases only |

---

## Threat Register

Evidence for each row (file:line, test names) is in the auditor's verdict recorded in the audit trail below (2026-11-24; 13-27 rows 2026-11-25).

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-13-01 | Tampering | Quote create body | high | mitigate | No stamp, status or order members; forged-stamp test | closed |
| T-13-02 | Tampering | Quote field values | medium | mitigate | Validator limits, mobile and email rules; React text rendering | closed |
| T-13-03 | DoS | Create before 13-06 | medium | accept | Superseded by the 13-06 limits | closed |
| T-13-04 | Tampering | Client photo type check | low | mitigate | Magic-byte sniff in the browser; server repeats it | closed |
| T-13-05 | DoS | Photo previews | low | mitigate | Size and pixel caps, one preview at a time | closed |
| T-13-06 | Info disclosure | Preview URLs | low | mitigate | `data:` previews only; test asserts no object URL | closed |
| T-13-07 | Info disclosure | Data kept too long | medium | mitigate | Daily maintenance cron, pinned by an architecture test | closed |
| T-13-08 | EoP | Maintenance key guessing | low | accept | Main-only workflow guard, key and rate limit | closed |
| T-13-09 | Repudiation | Policy vs code | medium | mitigate | 6 months in policy and code; page stays DRAFT | closed |
| T-13-10 | Info disclosure | Draft indexed | low | mitigate | noindex and sitemap exclusion for a draft, tested | closed |
| T-13-11 | Tampering | Malicious upload | high | mitigate | Server magic-byte check, size and pixel caps, metadata strip, private storage | closed |
| T-13-12 | EoP | Upload to someone else's request | high | mitigate | Hashed key, fixed-time compare, expiry, status and slot checks, one 404 | closed |
| T-13-13 | DoS | Upload memory and storage | high | mitigate | Rate limit, upload slots, body and form limits, 10 MB cap, 5 photos | closed |
| T-13-14 | Info disclosure | Id probing | medium | mitigate | Every miss answers the same 404, tested | closed |
| T-13-15 | DoS | Inbox flood | high | mitigate | Ticket minimum time, honeypot, per-address, site-wide and per-sender limits | closed |
| T-13-16 | Spoofing | Cross-site post | medium | mitigate | Idempotency-Key header on every POST; no CORS | closed |
| T-13-17 | Info disclosure | Bot catch logging | medium | mitigate | Reason code only, tested | closed |
| T-13-18 | DoS | Carrier NAT blocks real visitors | medium | accept | Owner rulings D-26, D-37; numbers are settings; 429 copy offers Messenger | closed |
| T-13-19 | Tampering | Sender limit race | medium | mitigate | Count and insert under a lock row; parallel test | closed |
| T-13-20 | Info disclosure | Alerts address | medium | mitigate | Staff DTO only; public endpoints tested for absence | closed |
| T-13-21 | Tampering | Email header injection | medium | mitigate | Contact-email rule, 254 limit, MailboxAddress.Parse | closed |
| T-13-22 | Repudiation | Settings change | low | mitigate | `site-settings.changed` audit with field label | closed |
| T-13-23 | Info disclosure | Kept past 6 months | medium | mitigate | Retention job purges and queues photos in one transaction, tested | closed |
| T-13-24 | Info disclosure | Orphan photos | medium | mitigate | Stray sweep covers `quotes/`; inventory includes quote photos | closed |
| T-13-25 | Tampering | Wrong deletes | high | mitigate | Converted excluded in select and delete; budgeted batches; prefix test | closed |
| T-13-26 | Tampering | CSP and zod | medium | mitigate | `jitless` zod; e2e CSP violation listener | closed |
| T-13-27 | Spoofing | Honeypot | medium | mitigate | Hidden field, no tab stop, no autocomplete; expired ticket resent | closed |
| T-13-28 | DoS | Bundle growth | medium | mitigate | Budget script limits (quote form 45 KB, public 150 KB) | closed |
| T-13-29 | Tampering | HTML in email | medium | mitigate | Every value encoded; subject CRLF test | closed |
| T-13-30 | DoS | Alert storm | medium | mitigate | 20 an hour cap under the lock; parallel test | closed |
| T-13-31 | Spoofing | Emailing strangers | high | mitigate | Alerts only to the saved staff address; visitor never mailed, tested | closed |
| T-13-32 | Info disclosure | Alert inbox and logs | low | accept | Owner ruling D-08; dispatcher logs hold ids and codes only | closed |
| T-13-33 | EoP | Anonymous lead read | high | mitigate | Staff policy on the controller; matrix 401 rows | closed |
| T-13-34 | DoS | Unbounded search | low | mitigate | 100-char search, page size allow-list, index | closed |
| T-13-35 | Info disclosure | `q` in URLs | low | accept | WEB-10 design; request logs drop the query string | closed |
| T-13-36 | Info disclosure | Upload key | medium | mitigate | Key held in a ref only; no storage or cookie | closed |
| T-13-37 | Tampering | Double send | low | mitigate | One Idempotency-Key per form; double-press test | closed |
| T-13-38 | Info disclosure | Bot learns it was caught | low | accept | Owner ruling D-25 | closed |
| T-13-39 | EoP | Test email | medium | mitigate | Manager policy; matrix 401 and 403 rows | closed |
| T-13-40 | DoS | Test email flood | low | mitigate | 3 per 10 minutes; saved address only | closed |
| T-13-41 | Info disclosure | Test email audit and logs | low | mitigate | No address in audit or logs, tested | closed |
| T-13-42 | Spoofing | `?product=` preselect | medium | mitigate | Line key checked against shown lines; never navigates | closed |
| T-13-43 | Tampering | Admin table XSS | medium | mitigate | No HTML-injection API anywhere in web/src | closed |
| T-13-44 | Info disclosure | Titles and URLs | low | mitigate | Fixed title; e2e checks personal data only in `q` | closed |
| T-13-45 | EoP | Detail and status | high | mitigate | Staff policy; matrix rows | closed |
| T-13-46 | Tampering | Lost updates | medium | mitigate | Row version 409, tested | closed |
| T-13-47 | Tampering | Setting Converted or stamps | medium | mitigate | Validator and domain refuse Converted; stamps from the token | closed |
| T-13-48 | Info disclosure | Public photo URLs | medium | mitigate | Private delivery path; no publicId in answers, tested | closed |
| T-13-49 | Repudiation | Status changes | low | mitigate | History row and audit entry | closed |
| T-13-50 | DoS | Count polling | low | mitigate | 60 s poll, not in background, one shared key | closed |
| T-13-51 | Repudiation | Stale badge | low | mitigate | No number on error; non-integer rejected | closed |
| T-13-52 | EoP | Admin delete | high | mitigate | Manager policy; matrix 403 row; test | closed |
| T-13-53 | Tampering | Note edit | medium | mitigate | Add-only route; route-table test | closed |
| T-13-54 | Info disclosure | Audit details and stored answers | medium | mitigate | Ids, statuses and counts only; slim write answers, tested | closed |
| T-13-55 | Repudiation | Who deleted | low | mitigate | `quote-request.deleted` audit | closed |
| T-13-56 | Tampering | Stored XSS | high | mitigate | No HTML injection; `tel:` digits only; `mailto:` reserved characters encoded | closed |
| T-13-57 | Info disclosure | Name in page title | low | mitigate | Fixed title; unit and e2e tests | closed |
| T-13-58 | Tampering | Photo loss on Spam | medium | mitigate | Confirm before Spam with photos | closed |
| T-13-59 | Tampering | Two orders per request | high | mitigate | Conditional lock in the order transaction; filtered unique index; tests | closed |
| T-13-60 | EoP | Linking an order to a request | medium | mitigate | Staff policy; 404 for a missing request; prefill matrix row | closed |
| T-13-61 | Info disclosure | Orphan photos on order delete | medium | mitigate | Photos queued in the same save | closed |
| T-13-62 | EoP | UI hiding as the control | medium | mitigate | Server Manager policy is the control | closed |
| T-13-63 | Tampering | Accidental delete | medium | mitigate | Confirm naming the visitor, Cancel focused first | closed |
| T-13-64 | Tampering | Crafted `fromRequest` | low | mitigate | GUID check, bad value dropped; server rechecks | closed |
| T-13-65 | Tampering | Lost work on a race | medium | mitigate | 409 box keeps values and offers Save as New | closed |
| T-13-66 | Info disclosure | Demo and dev code in production | low | mitigate | Dev routes guard; fake data; PublicDataScope; build-output check (30 of 30 on 2026-11-24); link guards | closed |
| T-13-67 | Tampering | Wrong database | high | mitigate | Seed and bootstrap guards allow CSPS_Dev/CSPS_E2E only; BetsLLC_* refused | closed |
| T-13-68 | Info disclosure | Beacon and titles | low | mitigate | Beacon sends the path only, e2e tested | closed |
| T-13-69 | Repudiation | Approval nobody gave | high | mitigate | 13-25 parked; page stays not approved and DRAFT | closed |
| T-13-70 | DoS | Collision with TheBETSLLC | low | mitigate | Playwright run lock, busy-port refusal, preflight | closed |
| T-13-71 | Info disclosure | Real addresses in the repo | medium | mitigate | Scan found placeholders only | closed |
| T-13-72 | Repudiation | Unrun live check marked done | medium | mitigate | 13-26 parked; no verification claimed | closed |
| T-13-73 | Info disclosure | Queued quote and content photos left in Cloudinary | high | mitigate | Removal job accepts the three own folders through `PublicIds.IsInOwnFolder`; quotes, content and stuck-row unit tests; end-to-end Spam and content run tests (13-27) | closed |
| T-13-74 | Tampering | Removal reaching another root or a lookalike folder | high | mitigate | Slash-ended prefixes, ordinal match, root shape checked at startup; lookalike, live-root and letter-case tests | closed |
| T-13-75 | Tampering | Live photo removed by a stale queue row | medium | mitigate | Named-by-photo drop runs before the folder check; inventory covers all five photo tables; quotes drop test | closed |
| T-13-76 | Tampering | Sweep and removal job drift on folders | medium | mitigate | One source in `PublicIds`; pin test `TheSweepListsExactlyTheFoldersTheRemovalJobAccepts` | closed |
| T-13-SC | Tampering | Package installs | high | mitigate | No package or version change on the branch | closed |

*Status: open · closed · open, below high threshold (non-blocking)*
*Severity: critical > high > medium > low. Only open threats at or above workflow.security_block_on count toward threats_open.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-03 | Create flooding before plan 13-06; superseded once the limits shipped | Plan 13-01 threat model (superseded) | 2026-11-21 |
| AR-13-02 | T-13-08 | A daily keyed maintenance call adds no new guessing surface | Plan 13-03 threat model; owner confirmed 2026-11-25 (D-47) | 2026-11-21 |
| AR-13-03 | T-13-18 | Shared carrier addresses may hit the per-address limit; numbers are settings and the 429 copy offers Messenger | Owner rulings D-26, D-37 | 2026-11-21 |
| AR-13-04 | T-13-32 | Visitor details sit in the staff alert inbox | Owner ruling D-08 | 2026-11-21 |
| AR-13-05 | T-13-35 | Inbox search text `q` may hold personal data in the address bar; request logs drop the query string | Plan 13-11 threat model (WEB-10); owner confirmed 2026-11-25 (D-47) | 2026-11-21 |
| AR-13-06 | T-13-38 | A caught bot gets a normal success answer and may notice missing photos | Owner ruling D-25 | 2026-11-21 |

*Accepted risks do not resurface in future audit runs.*

### Warning outside the register (not counted in threats_open)

A photo that finishes uploading at the moment its request is marked Spam, deleted by a Manager, or its order is deleted for good can stay in Cloudinary for about 2 to 3 days until the stray sweep removes it. The Privacy Policy draft, one confirm text and the API doc still say "within a day". This waits on the owner: P13-BL-21 item 3, P13-BL-24 item 2 and the Privacy Policy approval P13-BL-27 (A: add one sentence, recommended; B: lock the request in the upload and the deletes). The policy stays DRAFT until then.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-24 | 73 | 73 | 0 | gsd-security-auditor (ASVS L1, block_on high), orchestrator in away mode |
| 2026-11-24 (re-check) | 73 | 73 | 0 | orchestrator, L1 short-circuit: only `quoteRequests.recipe.ts` class strings changed since the audit, no new attack surface |
| 2026-11-25 (13-27) | 77 | 77 | 0 | gsd-security-auditor (ASVS L1, block_on high): gap plan 13-27, T-13-73 to T-13-76 added and closed, T-13-SC re-checked; unit tests 94 of 94; post-merge full suite green (orchestrator, away mode) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-24 by the audit. The owner confirmed AR-13-02 and AR-13-05 on 2026-11-25 (D-47) and chose to add the stray-photo sentence to the Privacy Policy (D-45).

## Security Audit 2026-11-24

| Metric | Count |
|---|---|
| Threats found | 73 |
| Closed | 73 |
| Open | 0 |
