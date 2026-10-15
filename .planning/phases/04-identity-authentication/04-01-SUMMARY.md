---
phase: 04-identity-authentication
plan: 01
subsystem: auth
tags: [smtp, dkim, spf, dmarc, user-secrets, powershell, dotnet-runtime, auth-13, d-34, d-35, in-02]
status: complete
created: "2026-10-14T19:55:00-05:00"
updated: "2026-10-14T19:55:00-05:00"

requires: []
provides:
  - "docs/operations/mail-setup.md: plain-words owner checklist for the mailbox, DKIM (add-only), SMTP secrets, the Gmail check and the runtime install"
  - "Initialize-DevSecrets.ps1 creates Jwt:SigningKey, Auth:CodeMacKey and (with -Smtp) the five Smtp:* values, all through standard input only"
  - "HOSTING-RECORD D2 rows Verified 2026-10-14 (DKIM, SPF/DKIM/DMARC pass in Gmail), plus new rows Sender mailbox and Dev runtime"
affects: [04-02, 04-09, 04-11, every Phase 4 plan that sends email]

requirements-completed: [AUTH-13]

actuals:
  tokens: 2980
  tasks: 3
  commits: 4
plan_head_before: 14dd7f5c41809924c0cbfd339f92d1909e467323
plan_head_after: 6be79dad3d226d159a5228d59d8033ee98cd6c6d

tech-stack:
  added: []
  patterns:
    - "Every local secret is written through Set-SecretsFromStdin; no value on a command line or on screen (CWE-214, CWE-532)"

key-files:
  created:
    - docs/operations/mail-setup.md
  modified:
    - tools/scripts/Initialize-DevSecrets.ps1
    - docs/development.md
    - .planning/HOSTING-RECORD.md

key-decisions:
  - "Mail results recorded as public facts only: domain, DKIM selector and pass results; the Gmail recipient address and message ids are left out"
  - "The app sets its own From display name; the mailbox's webmail display name (Carmens Stitch and Printing Services) is not used by the app"

patterns-established:
  - "Owner-run prerequisites are recorded as Verified rows in HOSTING-RECORD, doc-linted by HostingRecordTests"
---

# Phase 4 Plan 1: Mail Prerequisite and Dev Secrets Summary

Owner mail sender `no-reply@cspstailoring.com` passes SPF, DKIM and DMARC at Gmail, the machine runs ASP.NET Core 10.0.13 (SDK 10.0.402), and the secrets script now creates the code MAC key and SMTP credentials through standard input only.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Tracer: owner checklist and secrets script (Auth:CodeMacKey, IN-02 fixed, `-Smtp` prompt) | 4cf676c, 6b7e664 (full script path in the checklist) |
| 2 | Owner mail prerequisite and runtime install (blocking-human checkpoint) | Done by the owner 2026-10-14, no commit |
| 3 | Record the D2 Gmail results and the runtime fact in HOSTING-RECORD | 6be79da |

`commits: 4` is the measured count from the plan ledger base. It includes the orchestrator's `c4cba29` (sequential-run setup), which is not plan work.

## Owner results (public values only)

Gmail "Show original" for a message from `no-reply@cspstailoring.com`, sent 2026-10-14:

- `dkim=pass header.i=@cspstailoring.com header.s=8DF2A53DE38DCC0`
- `spf=pass` (sender permitted, via site4now.net)
- `dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=cspstailoring.com`

DNS: the DKIM TXT record is published at `8DF2A53DE38DCC0._domainkey.cspstailoring.com` (checked against 8.8.8.8). Exactly one SPF record remains (`v=spf1 a mx include:_spf.site4now.net -all`) and the `_dmarc` record is unchanged, so the merge-never-replace rule (D-26) held.

Runtime (D-35): `dotnet --list-runtimes` shows `Microsoft.AspNetCore.App 10.0.13`; `dotnet --list-sdks` shows `10.0.402`.

User-secrets names present in `src/Csps.Server` (names only): Smtp:Host, Smtp:Port, Smtp:Security, Smtp:UserName, Smtp:Password, Jwt:SigningKey, DataProtection:CertificatePassword, DataProtection:CertificateBase64, Auth:CodeMacKey.

## Verification

- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HostingRecordTests"`: 4 of 4 passed after the rows were set.
- `| Verified |` rows in HOSTING-RECORD grew from 22 to 26 (DKIM, Gmail pass, Sender mailbox, Dev runtime).
- The Task 1 script checks (idempotent run prints no value, `Auth:CodeMacKey` present by name, at least 4 `Set-SecretsFromStdin` uses) were run in the earlier session; the secret names above were re-listed by the orchestrator.

## Deviations from Plan

### Environment finding (no code change)

**1. [Environment] MSIX-packaged Claude desktop app saw a private copy of user-secrets**
- **Found during:** Task 1 to Task 2 hand-off.
- **Issue:** The Claude desktop app is MSIX-packaged, so processes started inside it saw a private LocalCache copy of `%APPDATA%` user-secrets, created when Task 1 wrote `Auth:CodeMacKey`. The real secrets file and the in-app view could differ.
- **Fix:** The orchestrator renamed the private copy to `secrets.json.claude-copy.bak` so in-app processes read the real file. No repo file changed.
- **Rule for later plans:** do not write user-secrets from an in-app session (re-running `Initialize-DevSecrets.ps1` would recreate the private copy); check names only with `dotnet user-secrets list ... | sed 's/ = .*//'`. Secret-writing steps are run by the owner in their own terminal.

### Minor

- **Sender display name:** the plan says display name "Carmen's Stitch & Printing". The mailbox's webmail display name is "Carmens Stitch and Printing Services". The app sets its own From display name, so the HOSTING-RECORD row records the mailbox address and notes both names.
- **Doc wording:** the "Email (Phase 4, D-12)" bullet in HOSTING-RECORD's consequences section said D2 was "still due"; updated to say it passed.

No auth gates, no packages installed, no stubs, no new security surface.

## Known Stubs

None.

## Threat Flags

None. T-04-01 (secrets on command lines) is mitigated by the stdin-only script; T-04-02 (live-domain mail) held: DKIM was added alongside the existing SPF and DMARC records, and the executor never touched DNS.

## Self-Check: PASSED

- docs/operations/mail-setup.md, tools/scripts/Initialize-DevSecrets.ps1, .planning/HOSTING-RECORD.md exist.
- Commits 4cf676c, 6b7e664 and 6be79da are ancestors of HEAD.
