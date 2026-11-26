---
phase: 13-quote-inquiries
plan: 25
subsystem: legal
tags: [privacy-policy, owner-review, draft, parked, away-mode]
created: "2026-11-23T22:42:49-06:00"
updated: "2026-11-23T22:42:49-06:00"
requires:
  - phase: 13-quote-inquiries
    provides: "plan 13-04 Privacy Policy 1.1 draft; plan 13-09 form privacy notice (D-27)"
provides:
  - "The owner's review package for the Privacy Policy 1.1 draft and the quote form notice, parked while the owner is away"
affects: [13-26, phase 13 ship, Privacy Policy approval]
plan_head_before: fb2c9913e073fcba7b4dd7ff1754cafa080d6d6a
plan_head_after: fb2c9913e073fcba7b4dd7ff1754cafa080d6d6a
actuals:
  tokens: 4500
  tasks: 0
  commits: 0
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/13-quote-inquiries/13-25-SUMMARY.md
  modified: []
key-decisions:
  - "Nothing was approved. The owner is away, so the D-28 review is parked and the Privacy Policy stays DRAFT 1.1 (approved false, noindex, out of the sitemap)."
requirements-completed: []
coverage:
  - id: D1
    description: "The owner approves the Privacy Policy 1.1 wording and the quote form notice, or asks for exact changes"
    requirement: INQ-08
    verification: []
    human_judgment: true
    rationale: "Legal wording is the owner's own call (D-28, Phase 12 D-14). No test can approve it."
duration: 5min
completed: 2026-11-23
status: parked
---

# Phase 13 Plan 25: Owner review of the Privacy Policy 1.1 draft (PARKED)

*Created: 2026-11-23T22:42:49-06:00 · Updated: 2026-11-23T22:42:49-06:00*

**Parked, checkpoint pending the owner.** The owner is away, so nobody approved anything. The Privacy Policy stays a DRAFT at version 1.1: it shows the DRAFT notice, is hidden from search engines, and is left out of `sitemap.xml`. Task 2 (the flip to approved) was not run. No code changed.

13-D28 outcome (2026-11-23): PARKED, owner away; see STATE.md Phase 13 owner backlog

(The orchestrator adds the STATE.md item; this run did not edit STATE.md. The text to add is under "For the orchestrator" below.)

## What the owner needs to do

1. When you are back, open the Privacy page and the Contact page form on the local site: `http://localhost:5180/privacy` and `http://localhost:5180/contact` (the executor starts the site for you; no server was started in this run).
2. Read the changes below. Each one is quoted word for word.
3. Pick A or B in "The decision", and answer the two related items.
4. Reply "approve A", "approve B", or the exact changes, for example "Privacy: change X to Y."

## What changed from the approved 1.0 (all in `web/src/modules/public/legalPrivacy.ts`)

The full text is in `web/src/modules/public/legalPrivacy.ts`. The facts (version, date, approved) are in `web/src/modules/public/legalPages.ts`, `src/Csps.Domain/Content/LegalPages.cs` and `tests/fixtures/legal-pages.json`. Today they read: version 1.1, last updated 2026-11-22, approved false.

### Added

| Section | New text (word for word) |
|---|---|
| What we collect | "When you send a quote request: the details you type into the form (name, team, mobile number, email, product, quantity and message) and any photos you attach." |
| Why we use it: Quote requests | "Only to reply to your request and prepare your quote. Our basis is that you asked us to, as a step before a contract." |
| How long we keep it | "Quote requests that didn't become an order, and their photos": "Deleted 6 months after we receive them." |
| How long we keep it | "Quote requests that became an order, and their photos": "Kept as long as the order." |
| How long we keep it | "Photos sent with a request we mark as spam": "Deleted within a day." |

### Reworded

| Section | Was (1.0) | Now (1.1 draft) |
|---|---|---|
| Who else handles it | "Cloudinary, which stores and shows our photos." | "Cloudinary, which stores and shows our photos, including the photos you attach to a quote request." |
| Who else handles it | "The email sender, which delivers the emails we send." | "The email sender, which delivers the emails we send, including the alert our staff get about a quote request." |
| How long we keep it: Daily page counts | "Kept for about 3 years; removed at the next monthly cleanup." | "Deleted about 3 years after the day they count." |
| How long we keep it: Staff account activity log | "Kept for about 8 months; removed at the next monthly cleanup." | "Deleted about 8 months after it is recorded." |

The cleanup now runs every day (D-34), which is why "monthly cleanup" is gone.

### The quote form notice (`web/src/modules/public/copy.ts`, D-27)

Shown under the form on the Contact page, with "Privacy Policy" as a link to /privacy:

> "We use your details only to reply to this request and prepare your quote. We keep requests that don't become orders for 6 months. See our Privacy Policy."

## Does every line match what the site does?

- 6 months for requests that do not become orders: yes. The daily cleanup deletes them and their photos (plan 13-08).
- Kept with the order when they do: yes. Orders are kept for good; if an order is deleted for good, its request goes with it (D-22).
- Photos stored with Cloudinary: yes.
- Staff alert email: yes. It carries the visitor's name, team, phone, product and the start of the message.
- Spam photos "Deleted within a day": true in nearly every case, but not always. See the next point.

**One rare gap.** If a photo finishes uploading at the very moment a request is marked as spam, or a request or its order is deleted, that one photo is not caught by the daily run. A separate sweep removes it after about 2 to 3 days. This is parked as P13-BL-16 item 7, P13-BL-21 item 3 and P13-BL-24 item 2, where the recommended fix is one added sentence in the policy.

## The decision

**A (recommended): approve the draft with one added sentence about the rare stray photo.** Why: it keeps every line true, including the rare case above.
The sentence would go at the end of "How long we keep it". Suggested wording (yours to change):
> "Rarely, a photo that finishes uploading at the moment its request is marked as spam or deleted, or its order is deleted, can stay in storage for up to 3 days before it is removed."

**B: approve the draft exactly as written.** The rare stray photo is not mentioned.

Or reply with your own changes. The page stays DRAFT until you approve the final words.

## Related parked items for the same answer

These come from `.planning/phases/999.9-owner-items-parked-during-phase-13-execution/DECISIONS.md`. That file was not changed.

1. **P13-BL-07: the staff alert line.** The draft says the email sender delivers "the alert our staff get about a quote request", because that alert carries visitor details. A (built, recommended): keep the line. B: remove or reword it.
2. **The stray photo sentence (P13-BL-21 item 3, P13-BL-24 item 2).** Recommended, as option A above. Answering A above also settles these two.
3. **The 24-hour repeat-press copy (P13-BL-18, P13-BL-21 item 1): no sentence needed now.** The saved copy of a status change or a new note holds only ids, statuses, times and versions, not visitor details. A sentence is needed only if you later switch either item to B (answer the whole request).

## What the code change would be on a yes

Only after your own approval, and in this order:

1. If you ask for wording changes (including the stray photo sentence), they go in first, word for word, in their own commit: `web/src/modules/public/legalPrivacy.ts` for the policy and `web/src/modules/public/copy.ts` for the form notice, plus the text tests that pin them.
2. Then the flip: privacy set to approved true, version 1.1, last updated the approval date, in all three copies: `tests/fixtures/legal-pages.json`, `src/Csps.Domain/Content/LegalPages.cs` and `web/src/modules/public/legalPages.ts`. The tests that pin the draft state change with it: `web/src/test/legal-pages.node.test.ts`, `tests/Csps.Domain.UnitTests/Content/LegalPagesTests.cs`, `web/src/modules/public/pages/LegalPages.test.tsx`, `tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs` and `tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs`.
3. After that, /privacy shows no DRAFT notice, loses noindex and is back in `sitemap.xml`.

## For the orchestrator

The plan's Task 1 check needs this item in STATE.md under Pending Todos, in a "Phase 13 owner backlog" list. This run did not edit STATE.md, as instructed. Add:

```
- 13 D-28 Privacy Policy approval (parked 2026-11-23): open http://localhost:5180/privacy and the Contact form; read the changes listed in .planning/phases/13-quote-inquiries/13-25-SUMMARY.md (added: what the quote form collects, used only to reply and prepare a quote, Cloudinary stores the photos, three keep-time rows; reworded: the staff log and page count rows now match the daily cleanup). Question: approve A (with one sentence about the rare stray photo, recommended), approve B (as written), or give exact changes? Also settles P13-BL-07, P13-BL-21 item 3 and P13-BL-24 item 2. The page stays DRAFT until then.
```

## Deviations from Plan

1. **No servers started.** The plan says to start the API and Vite so the owner can open the page. The owner is away and the orchestrator's gate is running, so this run started nothing. The links above work once the site is started.
2. **STATE.md not edited.** The plan lists it; the orchestrator owns STATE.md in this run. The exact item is given above.
3. **Task 2 not run.** Its precondition (the owner's yes) is not met, so nothing was flipped.

## Self-Check: PASSED

- `.planning/phases/13-quote-inquiries/13-25-SUMMARY.md` exists with exactly one outcome line.
- No code file changed; the privacy facts still read version 1.1, 2026-11-22, approved false.
