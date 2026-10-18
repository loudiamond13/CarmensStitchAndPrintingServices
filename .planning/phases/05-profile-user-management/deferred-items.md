---
created: 2026-10-17T20:55:00-05:00
updated: 2026-10-17T21:18:00-05:00
---

# Phase 5: deferred items

Things found while executing Phase 5 that are out of scope for the plan that found them. Each one names where it will be handled.

## IN-08: purge of closed email-outbox rows (found in plan 05-07)

- **What:** Closed outbox rows keep the recipient address and metadata after the subject and bodies are cleared. The written retention rule is in `docs/operations/mail-setup.md`, section "Outbox retention": delete closed rows 30 days after they close.
- **Deferred to:** Phase 9 maintenance job, requirement JOB-01.
- **Why deferred:** The app has no host scheduler on the Basic hosting plan. Scheduled jobs run from GitHub Actions calling a secret-protected endpoint, and that endpoint and its job runner are built in Phase 9. Building a one-off purge now would create a second, unscheduled path to the same table.
- **Covered meanwhile:** A deleted user's outbox rows are scrubbed at delete time (plan 05-26), so a removed staff address does not wait for the purge.

## Slow first test in the admin route suite (found in plan 05-07)

- **What:** In `web/src/modules/admin/routes.test.tsx`, the first test of the guarded-routes group ("opening /admin/orders without a session refreshes once and lands on the sign-in page with the return path") and, in one run, the dev-routes test ("with the dev routes added, /dev/components and the section previews render without a session or a refresh") timed out at the 5 s default in each of four full `npm --prefix web run test -- --run src/modules/admin` runs with 24 parallel workers. The file passes every time when it runs with only a few others.
- **Cause (likely):** the first lazy route import is slow while many workers start at once. The plan 05-07 change was type-only in the web app, so it did not cause this.
- **Deferred to:** the Phase 5 close-out test review, which can raise that one test's timeout or reduce worker load.

## Owner wording review: OQ-7 and OQ-11 (owner, 2026-10-17)

- **What:** The owner wants to review every new or amended string before it is approved: the UI-SPEC Copywriting section (OQ-7 amended App. E.12/E.13 wording, OQ-11 SPEC-GAP strings) and the Phase 5 email additions, including the new "email changed by a Manager" notice (D-45).
- **Status:** Executors build the UI-SPEC wording as written (D-48), but it is not approved. Present it in the 05-31 email review and the 05-37 screen review; wording changes become follow-ups for `/gsd-verify-work 5`.
