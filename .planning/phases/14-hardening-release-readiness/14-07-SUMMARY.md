---
phase: 14-hardening-release-readiness
plan: 07
subsystem: docs
tags: [runbooks, legal-06, data-requests, breach-response, lockout, staff-app-install]
created: "2026-11-27T21:03:00-06:00"
updated: "2026-11-27T21:03:00-06:00"
status: complete
requires: []
provides:
  - "docs/operations/data-requests.md: Manager steps to see, fix or delete a person's data, what is kept and why, reply templates, two-Managers note"
  - "docs/operations/breach-response.md: Manager first steps, owner-only steps, the 72-hour clock, evidence, points to confirm with the NPC or an adviser"
  - "docs/operations/break-glass-mail.md, lockout.md, install-staff-app.md"
  - "OperationsRunbookTests: timestamp line, 'the owner', ruling phrases, and email, Philippine phone and user path detectors, each proven by paired samples"
affects: [14-10, 14-14]
actuals:
  tokens: 7700
  tasks: 3
  commits: 3
plan_head_before: dad4349c1a79ae5ce1703bbaf80b8e374e8314fe
plan_head_after: 766846b7662f119c6b6a8573e71e8922ef8c1f70
tech-stack:
  added: []
  patterns:
    - "Runbook doc test: a path plus the phrases its ruling needs, with the personal-detail detectors checked against samples first"
key-files:
  created:
    - docs/operations/data-requests.md
    - docs/operations/breach-response.md
    - docs/operations/break-glass-mail.md
    - docs/operations/lockout.md
    - docs/operations/install-staff-app.md
    - tests/Csps.ArchitectureTests/OperationsRunbookTests.cs
  modified:
    - web/src/modules/public/legalPrivacy.ts
key-decisions:
  - "No ruling made. The runbooks write down 14 D-16 to D-21, D-28 and D-37 as ruled. Two gaps found in today's screens are left for the owner (see Open items)."
requirements-completed: []
coverage:
  - id: D1
    description: "A Manager can answer an access, correction or deletion request step by step, with a reply that explains what was kept and why"
    requirement: LEGAL-06
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class *OperationsRunbookTests"
        status: pass
  - id: D2
    description: "Breach first steps are split between Manager actions on existing screens and owner-only steps, with the 72-hour rule and each legal point marked for confirmation"
    requirement: LEGAL-06
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class *OperationsRunbookTests"
        status: pass
  - id: D3
    description: "Broken mail, lockouts and installing the staff app have their own pages; none describes a bypass of the emailed code"
    requirement: LEGAL-06
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class *OperationsRunbookTests"
        status: pass
      - kind: other
        ref: "judgment: no bypass described (read lockout.md and break-glass-mail.md)"
        status: pass
---

# Phase 14 Plan 07: Manager runbooks for data requests, breaches, mail, lockouts and the staff app Summary

*Created: 2026-11-27T21:03:00-06:00 · Updated: 2026-11-27T21:03:00-06:00*

**Five runbooks in `docs/operations/` cover LEGAL-06, plus one doc test that keeps them free of names, emails, phone numbers and local paths.**

## What was built

- **data-requests.md** follows 14 D-16, D-17, D-18 and D-37. It names the owner as Data Protection Officer, the 15-day answer time, and the rule to act only on the email or phone already on record (one polite question otherwise, no ID photo). It lists how to find a person's quote requests and orders, what each screen can fix, and the deletion steps: Delete Request per quote request (Manager only), a converted request stays with its order, the quote alert emails are deleted by hand from the shop mailbox, outbox copies clear within 30 days, and the audit entry holds no customer details. It has three reply templates and a "two people at once" note.
- **breach-response.md** follows D-19. Manager steps use Deactivate and Set Temporary Password and tell the owner at once. Owner-only steps list the secrets to change (each linked to its existing runbook), the holding page and any notice. It states the 72-hour rule (RA 10173, NPC Circular 16-03) and marks each legal point "confirm with the NPC or an adviser".
- **break-glass-mail.md**, **lockout.md** and **install-staff-app.md** follow D-20, D-21 and D-28. There is never a way around the emailed code. The one-off Manager unlock is prepared on request, after the owner's yes, through the ORM and not built in advance. The install page covers Chrome and Edge "Install app" and iPhone Share then "Add to Home Screen", and says the iPhone app asks to sign in again.
- **OperationsRunbookTests** (4 tests): the timestamp line, "the owner", the phrases each ruling needs, and the personal-detail detectors (email, Philippine phone, user path) each proven by a sample.
- **legalPrivacy.ts**: the header comment no longer calls the policy a draft and says version 1.1 is the owner-approved policy. Comment only. No policy text changed (12.1 D-73).

## Verification (evidence)

- RED seen first for each task: 2 of 4 tests failed with "is missing" before each runbook was written.
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*OperationsRunbookTests"`: total 4, failed 0, succeeded 4, no warnings.
- Whole `Csps.ArchitectureTests` project: total 342, failed 0, succeeded 342, skipped 0.
- `npm --prefix web run test -- --run src/test/legal-pages.node.test.ts src/test/no-long-dash.node.test.ts`: 2 files, 8 tests passed.
- Acceptance greps: "became an order" 4 and "15 days" 2 in data-requests.md; "72 hours" and "confirm with the NPC or an adviser" present in breach-response.md; "mail-setup.md" 2 in break-glass-mail.md; "Add to Home Screen" 1 in install-staff-app.md.
- No em dash or en dash in any new file. gitleaks found no leaks on all three commits. No email, phone, name or local path in any runbook.
- Not run: `build:budget`. The only web change is a comment in `legalPrivacy.ts`, which a build strips, so no bundle byte changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Inaccurate plan text] The Deploy workflow has no "offline" action**
- **Found during:** Task 2
- **Issue:** The plan says to take the site to the holding page "with the deploy workflow's offline action". `.github/workflows/deploy.yml` has only `deploy`, `online` and `hostprobe`. The "back in a minute" page shows only while a deploy runs, and `online` removes it.
- **Fix:** breach-response.md says plainly that there is no action that puts the page up on its own, links the existing `online` recovery, and leaves the choice of how to go offline to the owner. Nothing was built.
- **Files modified:** docs/operations/breach-response.md
- **Commit:** 9995645c

**2. [Rule 2 - Missing detail] Ending someone's sessions has no separate button**
- **Found during:** Task 2
- **Issue:** D-19 lists "deactivate, end sessions, temporary password" as three actions, but today's Users screen ends sessions only as part of Deactivate, Lock and Set Temporary Password.
- **Fix:** the runbook says so, and names Signed-in Devices (Sign Out Other Devices) for a person's own account.
- **Commit:** 9995645c

**Total deviations:** 2, both documentation accuracy. No code changed beyond one header comment.

## Open items for the owner (input for the D-26 review pack, plan 14-10)

1. **A quote request's name, phone, email and message cannot be corrected on any screen.** Only status and notes change. The runbook offers a note, or delete and resend the form with the person's yes. Recommendation: leave as is. Quote requests are rare to correct, and the workaround is safe. Building a Manager edit would be its own change.
2. **No way to put the holding page up on its own.** Recommendation: add a small `offline` action to the Deploy workflow, because a breach is the one time it is needed and it should not be improvised. Alternative: write down the host panel steps once the owner has checked them.
3. **The one-off Manager unlock (D-20) and the existing `bootstrap-manager` command overlap** when the only Manager is locked, since the bootstrap command also runs when no active Manager exists. lockout.md names both and leaves the choice to the owner. The owner may want to rule which is preferred.
4. The NPC points in breach-response.md come from secondary sources (RESEARCH A14). They stay marked "confirm with the NPC or an adviser" until the owner confirms them.

## Notes

- install-staff-app.md describes the install the owner ruled (D-28, UI-SPEC W1). The install choice appears only once the app manifest and icons from the other Phase 14 plans are on the live site.
- Auth gates: none. Checkpoints: none. Known stubs: none.
- Threat flags: none. T-14-12 to T-14-14 are mitigated as planned (identity rule, detector tests, 72-hour and owner-only steps). No package was added (T-14-SC).

## Self-Check: PASSED

- Created files present: data-requests.md, breach-response.md, break-glass-mail.md, lockout.md, install-staff-app.md, OperationsRunbookTests.cs.
- Commits present: 20c7c2c2, 9995645c, 766846b7.
