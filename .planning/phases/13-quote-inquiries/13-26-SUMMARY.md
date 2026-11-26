---
phase: 13-quote-inquiries
plan: 26
subsystem: operations
tags: [live-checks, owner-only, email, cloudinary, csp, parked, away-mode]
created: "2026-11-24T02:17:44-06:00"
updated: "2026-11-24T02:17:44-06:00"
requires:
  - phase: 13-quote-inquiries
    provides: "Quote alerts card with Send Test Email (D-07, D-11); plans 13-24 and 13-25"
  - phase: 11
    provides: "Gallery admin and public Gallery page (D-133)"
provides:
  - "The owner's steps for the two live-site checks, parked because nothing is deployed and the owner is away"
affects: [phase 13 ship, phase 13 deploy, INQ-04]
plan_head_before: 555d0a214812271f4538bf559029473993dac9fd
plan_head_after: 555d0a214812271f4538bf559029473993dac9fd
actuals:
  tokens: 3500
  tasks: 0
  commits: 0
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/13-quote-inquiries/13-26-SUMMARY.md
  modified: []
key-decisions:
  - "Nothing was checked or approved. Phase 13 is not deployed and the owner is away, so both live checks are parked as open owner items. This is not a pass."
requirements-completed: []
coverage:
  - id: D1
    description: "The Quote alerts test email reaches the shop's Quote alerts address from the live site"
    requirement: INQ-04
    verification: []
    human_judgment: true
    rationale: "Needs the real mail account, the real inbox and the live site. Only the owner can do it (13-VALIDATION.md Manual-Only)."
  - id: D2
    description: "The first public Gallery photo loads on a phone from res.cloudinary.com with no CSP error (carry-over Phase 12 D-49, Phase 11 D-133)"
    verification: []
    human_judgment: true
    rationale: "Needs the live image host, the live site and a real phone. Only the owner can do it."
duration: 5min
completed: 2026-11-24
status: parked
---

# Phase 13 Plan 26: Owner live checks after the deploy (PARKED)

*Created: 2026-11-24T02:17:44-06:00 · Updated: 2026-11-24T02:17:44-06:00*

**Parked, checkpoint pending the owner.** Phase 13 is not deployed yet: a deploy happens only after the owner merges through `tools/scripts/Merge-PullRequest.ps1`. The owner is also away. So nobody ran either check, and nothing is marked done. No one signed in to, uploaded to or changed the live site. No code changed.

13-live-checks outcome (2026-11-24): PARKED; see STATE.md Phase 13 owner backlog

(The orchestrator adds the STATE.md item. This run did not edit STATE.md. The text to add is under "For the orchestrator" below.)

## When to do this

Only after Phase 13 is merged and deployed to the live site. Before that, the live site does not have the Quote alerts card yet.

## What the owner needs to do

### Check 1: the Quote alerts address and its test email (INQ-04, D-07, D-11)

1. On the live site, sign in with a Manager account.
2. Open **Site Content**, then the **Business info** tab.
3. Find the **Quote alerts** card. Type the inbox that should get an email for each new quote request. It can be the shop's own email.
4. Press **Save Business Info** at the bottom of the tab. Wait for the saved message.
5. Press **Send Test Email** on the Quote alerts card.
6. Open that inbox. Within a few minutes an email titled **"Test: quote alerts work"** should arrive. Check the spam folder too.

**Pass:** the email arrives (in the inbox or in spam). If it lands in spam, say so, because then real alerts may land there too.
**Fail:** nothing arrives after 10 minutes, or the page shows an error. Note the error words.

### Check 2: the first public Gallery photo on a phone (carry-over Phase 12 D-49, Phase 11 D-133)

1. Still signed in as a Manager, open **Site Content**, then the **Gallery** tab.
2. Add one photo and make it public. Use a photo you are happy for visitors to see.
3. On your phone, open the live site's **Gallery** page (the `/gallery` address).
4. Check that the photo shows.
5. Check that the photo comes from `res.cloudinary.com`, and that the browser shows no security error (a "CSP" or "Content Security Policy" error). On a phone this is hard to see on its own. Ask Claude and it will walk you through it, for example by connecting the phone to a computer's browser tools.

**Pass:** the photo shows on the phone, it loads from `res.cloudinary.com`, and there is no CSP error.
**Fail:** a broken image or a blank space, or a CSP error.

### Then reply

Reply with what you saw for Check 1 step 6 and Check 2 steps 4 and 5, in your own words. For example: "Test email arrived in the inbox. Gallery photo shows on my phone, no errors." Please do not paste the real email address or the site address; Claude masks them anyway.

Claude then records your words in this file as the one outcome line, in the form `13-live-checks outcome (<date>): owner answered: <your words>`, and replaces the PARKED line.

## For the orchestrator

The plan's Task 1 check needs this item in STATE.md under Pending Todos, in the existing "Phase 13 owner backlog" list. This run did not edit STATE.md, as instructed. Add this line to that list:

```
- 13 live checks (parked 2026-11-24): after the Phase 13 deploy, (1) on the live site sign in as a Manager, open Site Content, Business info, type the shop's Quote alerts address in the Quote alerts card and press Save Business Info; (2) press Send Test Email and check that "Test: quote alerts work" arrives at that inbox within a few minutes, spam folder too; (3) add the first public Gallery photo in Site Content, Gallery; (4) on a phone open the public Gallery page, check the photo loads from res.cloudinary.com and that the browser shows no CSP error (ask Claude how to check this on a phone); (5) reply with what you saw for steps 2 and 4. Full steps and what counts as a pass: .planning/phases/13-quote-inquiries/13-26-SUMMARY.md. Open owner item, not a pass (INQ-04; Phase 12 D-49, Phase 11 D-133).
```

Until that line is in STATE.md, the plan's automated check exits 1. That is expected: the check passes on a PARKED line only when the backlog item exists.

## Deviations from Plan

1. **STATE.md not edited.** The plan lists STATE.md in its files. The orchestrator owns STATE.md in this run, so the exact line is given above instead.
2. **Branch.** The plan says to stay on `gsd/phase-13-quote-inquiries`. This run committed on its own worktree branch, which the orchestrator merges into the phase branch. Nothing was merged, pushed or deployed.

## Threat model notes

- T-13-71 (real address or domain in a public file): this file names no real email address, live domain, server or account id. It says "the shop's Quote alerts address" and "the live site". gitleaks runs on the commit.
- T-13-72 (a check marked done that nobody ran): the outcome line says PARKED, and both coverage items stay `human_judgment: true` with no verification.
- T-13-SC (package installs): no package added or bumped.

## Self-Check: PASSED

- `.planning/phases/13-quote-inquiries/13-26-SUMMARY.md` exists with exactly one outcome line, in the PARKED form the plan's check expects.
- No code file changed. No server, test, deploy, merge or push was run.
