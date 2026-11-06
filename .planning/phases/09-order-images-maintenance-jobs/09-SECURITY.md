---
phase: "09"
slug: "order-images-maintenance-jobs"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-11-05T23:20:00-06:00"
updated: "2026-11-05T23:20:00-06:00"
---

# Phase 09: Security

*Created: 2026-11-05T23:20:00-06:00 · Updated: 2026-11-05T23:20:00-06:00*

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of plans 09-01 to 09-33 and the SUMMARY threat flags. The security auditor read the cited code on branch `gsd/phase-09-order-images-maintenance-jobs` after the code review fixes, at ASVS level 1, with a boundary check on every high row. gitleaks over 272 phase commits found no leaks.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser to API (staff) | Staff upload, move, describe and delete order photos | Photo bytes (up to 10 MB), descriptions, order versions |
| API to Cloudinary | Upload, delete, list and usage calls over HTTPS | Photo bytes without metadata, API key and secret |
| GitHub Actions to API | Monthly and Run now maintenance call | `X-Maintenance-Key` header, run answer (counts and fixed sentences) |
| API to browser (delivery) | Named-size photo addresses in staff answers only | Unguessable addresses (128-bit ids) |
| Developer machine to Cloudinary | The setup tool creates the named sizes | API key and secret from user-secrets or env |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Tampering | file disguised as photo | high | mitigate | Magic-byte sniff only (ImageSniffer.cs:27-34), checked before storage | closed |
| T-09-02 | Elevation | photo written to another order | high | mitigate | OrderChildWrite on the route's order, Staff policy, matrix row | closed |
| T-09-03 | DoS | spill to disk or memory | medium | mitigate | In-memory bounded buffer; UploadNoDiskTests | closed |
| T-09-04 | Info disclosure | id or address in logs or audit | high | mitigate | Audit holds number and position only; logs hold codes | closed |
| T-09-05 | Tampering | hostile JPEG | medium | mitigate | Segment caps and bounded ChunkReader | closed |
| T-09-06 | DoS (cost) | ad-hoc sizes | medium | mitigate | 13 fixed named sizes; strict mode on | closed |
| T-09-07 | Tampering | dev job touching live photos | high | mitigate | Root folder validator with ValidateOnStart | closed |
| T-09-08 | Info disclosure | address shape | low | accept | See accepted risks | closed |
| T-09-09 | Tampering | renamed SVG or AVIF (browser) | medium | mitigate | Browser byte sniff, server repeats | closed |
| T-09-10 | Info disclosure | bytes in browser storage | medium | mitigate | Memory only; no storage API or object URLs | closed |
| T-09-11 | Tampering | full-size link opener | low | mitigate | rel="noopener noreferrer" | closed |
| T-09-12 | Info disclosure | images from another host | low | mitigate | CSP img-src limited, no unsafe-inline | closed |
| T-09-13 | Tampering | AVIF or animated files | medium | mitigate | Brand checks, WebP animation refused | closed |
| T-09-14 | DoS | huge or looping boxes | high | mitigate | Entry and box caps; 2000-round fuzz tests | closed |
| T-09-15 | Elevation | SVG stored then served | high | mitigate | Byte sniff plus Cloudinary AllowedFormats | closed |
| T-09-16 | Spoofing | run without key | high | mitigate | SHA-256 + FixedTimeEquals, 32-char minimum, closed when unset | closed |
| T-09-17 | DoS | overlapping runs | medium | mitigate | Run lease (10 minutes after review fix WR-G1B-02), 409 | closed |
| T-09-18 | Info disclosure | run answer leaks data | high | mitigate | Fixed sentences and counts only | closed |
| T-09-19 | Tampering | purge removes rows in use | medium | mitigate | Expiry plus margin, same test as the gate | closed |
| T-09-20 | Repudiation | anonymous endpoint without audit | low | accept | See accepted risks | closed |
| T-09-21 | Info disclosure | addresses outside staff answers | high | mitigate | Built only in Staff readers | closed |
| T-09-22 | Tampering | wrong root folder | high | mitigate | As T-09-07 | closed |
| T-09-23 | DoS | slower list from cover join | medium | mitigate | Covering index IX_OrderImages_OrderId_Position | closed |
| T-09-24 | Tampering | file names in UI | low | mitigate | React text nodes only | closed |
| T-09-25 | Info disclosure | previews outside memory | low | mitigate | As T-09-10 | closed |
| T-09-26 | DoS | large bodies | high | mitigate | 1 MiB default, raised only for upload; IIS backstop | closed |
| T-09-27 | DoS | concurrent uploads | high | mitigate | UploadSlotsMiddleware after authorization (WR-G1B-01), per-address limit | closed |
| T-09-28 | Tampering | replay with altered bytes | medium | mitigate | Multipart hash in idempotency key, 422 on mismatch | closed |
| T-09-29 | Info disclosure | temp files | medium | mitigate | As T-09-03 | closed |
| T-09-30 | Tampering | multipart parser abuse | low | mitigate | Boundary and part caps | closed |
| T-09-31 | Info disclosure | GPS in stored photos | high | mitigate | Metadata stripper refuses when it cannot clean; Cloudinary strip second | closed |
| T-09-32 | DoS | crafted metadata | medium | mitigate | Bounded reader, caps | closed |
| T-09-33 | Tampering | strip corrupts image | medium | mitigate | Re-sniff must match original facts | closed |
| T-09-34 | Tampering | duplicate uploads on retry | medium | mitigate | One idempotency key per file, reused by Try Again | closed |
| T-09-35 | Info disclosure | pending photos persisted | medium | mitigate | Module memory only | closed |
| T-09-36 | Elevation | Testing routes in production | high | mitigate | `#if CSPS_TESTING`, Debug only, Release scan tests | closed |
| T-09-37 | DoS | pick flooding | low | mitigate | One upload in flight, 5-photo limit | closed |
| T-09-38 | Info disclosure | cover addresses on list | low | accept | See accepted risks | closed |
| T-09-39 | Tampering | purge removes live tokens | high | mitigate | Margins per token type | closed |
| T-09-40 | Info disclosure | emails kept too long | medium | mitigate | 30 days after close | closed |
| T-09-41 | DoS | long deletes | low | mitigate | 500-row batches within the budget | closed |
| T-09-42 | Info disclosure | API secret leak | high | mitigate | Log masking, exposure tests, gitleaks clean | closed |
| T-09-43 | Tampering | overwriting another asset | medium | mitigate | Overwrite false, random ids | closed |
| T-09-44 | Spoofing | SSRF through upload | low | mitigate | Stream upload only, Secure = true | closed |
| T-09-45 | DoS | hung Cloudinary calls | medium | mitigate | 60 s timeout under a 2-minute claim lease | closed |
| T-09-46 | Tampering | malicious package | high | mitigate | Only CloudinaryDotNet 1.29.3 added, checked and approved (D-37), NuGetAudit | closed |
| T-09-47 | Tampering | stale reorders | medium | mitigate | Version check, 409 | closed |
| T-09-48 | Elevation | editing another order's photo | high | mitigate | Found on the route's order only | closed |
| T-09-49 | Repudiation | unrecorded photo changes | low | mitigate | Audit entries | closed |
| T-09-50 | Tampering | photos to the wrong order | medium | mitigate | Enqueue on save success with the server's id | closed |
| T-09-51 | Info disclosure | drafts kept after leaving | low | mitigate | Memory only, discard guard | closed |
| T-09-52 | Elevation | write controls on locked orders | low | mitigate | Read-only card, server refuses | closed |
| T-09-53 | Info disclosure | viewer link opener | low | mitigate | As T-09-11 | closed |
| T-09-54 | Info disclosure | key or bodies in public logs | high | mitigate | maintenance.mjs fixed sentences, env-only key | closed |
| T-09-55 | Tampering | script injection in workflow | medium | mitigate | Expressions only in env; pinned by test; zizmor | closed |
| T-09-56 | Elevation | workflow token rights | medium | mitigate | permissions {}, pinned SHAs, branch guard | closed |
| T-09-57 | DoS | schedule stops silently | medium | mitigate | Runbook covers the 60-day pause and red runs | closed |
| T-09-58 | Spoofing | calls to a wrong host | low | mitigate | https origin check before any call | closed |
| T-09-59 | Tampering | removal lost on rollback | medium | mitigate | Queue row in the same transaction | closed |
| T-09-60 | Tampering | soft-deleted order photos removed | high | mitigate | Only 4 enqueue sites, none on soft delete | closed |
| T-09-61 | Elevation | deleting another order's photo | high | mitigate | Found on the route's order only | closed |
| T-09-62 | Info disclosure | orphan files | medium | mitigate | Undo queue (incl. lost reply, WR-G1A-06), stray sweep | closed |
| T-09-63 | Tampering | overwriting a coworker's change | medium | mitigate | Version sent, reload on 409 | closed |
| T-09-64 | Tampering | double move submission | low | mitigate | Busy rule | closed |
| T-09-65 | Tampering | silent change of a live size | medium | mitigate | Setup creates only missing sizes | closed |
| T-09-66 | Info disclosure | keys printed by setup tool | high | mitigate | Names and counts only | closed |
| T-09-67 | DoS (cost) | credits run out unnoticed | medium | mitigate | 80 percent red line | closed |
| T-09-68 | Tampering | sweep removes soft-deleted orders' photos | high | mitigate | Inventory ignores the soft-delete filter | closed |
| T-09-69 | Tampering | dev run destroys live photos | high | mitigate | Folder prefix checks, 2-day age, D-52 cap of 50 per run | closed |
| T-09-70 | Repudiation | removals failing silently | medium | mitigate | Red line for 1 to 4 failures, "needing attention" line and log after 5 (D-55) | closed |
| T-09-71 | DoS | Admin API limit | low | mitigate | 500 per page, budget, saved cursor (D-54) | closed |
| T-09-72 | Tampering | accidental photo delete | medium | mitigate | Confirm dialog, focus on Cancel, audit | closed |
| T-09-73 | Repudiation | permanent delete hides count | low | mitigate | Dialog shows photo count | closed |
| T-09-74 | Info disclosure | real photos or keys in git | high | mitigate | gitleaks clean, outputs ignored | closed |
| T-09-75 | Tampering | regressions slip past checks | medium | mitigate | Full build and test runs in 09-REVIEW-FIX.md | closed |
| T-09-76 | Spoofing | key brute force | high | mitigate | 12 per 10 minutes, 32-char key | closed |
| T-09-77 | Info disclosure | key in logs or docs | high | mitigate | Masking and tests | closed |
| T-09-78 | Info disclosure | cover addresses to non-staff | medium | mitigate | As T-09-21 | closed |
| T-09-79 | Info disclosure | rules endpoint anonymous | low | mitigate | Staff policy, matrix row | closed |
| T-09-80 | Tampering | delete on a closed order | medium | mitigate | EnsureEditable first | closed |
| T-09-81 to T-09-89, T-09-91 | various | database backup (09-31, 09-32) | medium to high | mitigate | Not built or removed, deferred by D-51 (probe removed in 75d575e6; 09-32 never built). Re-audit when CUT-01 plans backups. | closed |
| T-09-90 | Info disclosure | backup at rest not encrypted | medium | accept | Not built, deferred by D-51; moot until backups are planned | closed |
| T-09-92 | Info disclosure | e2e screenshots, photo checks | low | mitigate | Outputs ignored, no binaries tracked | closed |
| T-09-93 | Tampering | viewer class change | low | accept | See accepted risks | closed |
| T-09-SC | Tampering | package installs (each plan) | high | mitigate | One package added (CloudinaryDotNet 1.29.3, approved); web lockfiles unchanged | closed |

*Status: open · closed · open, below high threshold (non-blocking)*
*Severity: critical > high > medium > low. Only open threats at or above `block_on` count toward threats_open.*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-08 | Addresses carry only a random id and the order folder, and appear only in Staff answers | owner (D-01, plan 09-02) | 2026-10-31 |
| AR-09-02 | T-09-20 | The anonymous maintenance endpoint is a machine action with server logs and GitHub run history; it changes no business data | owner (plan 09-06) | 2026-10-31 |
| AR-09-03 | T-09-38 | Cover addresses on the Staff-only list are unguessable | owner (D-01, plan 09-18) | 2026-10-31 |
| AR-09-04 | T-09-93 | The viewer layout change adds no input path and no inline style | plan 09-33 | 2026-11-05 |
| AR-09-05 | T-09-90 | Backup files at rest not encrypted: moot while backups are deferred (D-51) | owner (D-51) | 2026-11-05 |

---

## Notes (non-blocking)

- **Hardening follow-up (IN-G1A-02):** the JPEG stripper keeps APP0 (which can carry a JFXX thumbnail) and the WebP stripper keeps unknown chunks. Exif and XMP, where GPS lives, are removed, and Cloudinary strips again on delivery.
- **Real-world checks not done yet:** UAT item 19 (GPS removed from a real Android JPEG and iPhone HEIC) is on the release-day list, and UAT item 20 (Run now in production) waits for the deploy.
- **WR-R2-01 (owner backlog):** the maintenance workflow's `main` guard only stops accidental runs; limiting `MAINTENANCE_KEY` to `main` needs a GitHub environment.
- **Memory headroom (IN-G1B-04):** an upload holds about four copies of the file in memory; bounded by the 2-slot cap.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-05 | 93 + T-09-SC | 94 | 0 | gsd-security-auditor (Sonnet 5.5), orchestrated by Claude Opus 5.5 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-05 by the audit; owner sign-off pending (owner away).
