---
created: 2026-10-17T20:55:00-05:00
updated: 2026-10-18T00:36:00-05:00
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

## Review scripts still list /admin/profile as a dev preview (found in plan 05-13)

- **What:** `web/scripts/owner-review.mjs` (REVIEW_TARGETS) and `web/scripts/design-side-by-side.mjs` (the admin pages list) screenshot `/admin/profile` on the e2e host with no sign-in, as the dev preview with the placeholder user. Plan 05-13 made My Profile a real, guarded page and removed `profile` from the `devRoutes`, so on the e2e host that path now sends a visitor without a session to the sign-in page. Their unit tests only check the lists, so nothing fails today; a real run would wait for an h1 that never shows.
- **Deferred to:** plan 05-37 (screen review), which already owns the `owner-review.mjs` page list. The same applies to `users` and `audit-log` when 05-20 and 05-33 replace their previews, so 05-37 needs a signed-in capture path (the E2E staff helper) rather than another unsigned list.
- **Covered meanwhile:** `web/e2e/profile.spec.ts` (`@profile`) proves the real page on every tab, with axe and no sideways scrolling, in all five projects.

## Idempotency records keep an unsalted hash of password bodies (found in plan 05-12)

- **What:** `IdempotencyRecords.RequestHash` is SHA-256 over the request target and body, with no salt. For `POST /api/v1/profile/password` (and the reset and invite accept calls) the body holds the passwords, so someone who could read that table could test guesses offline against the hash. The plan's T-05-32 says only the 204 answer is stored; the hash is stored too, for 24 hours.
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`). A fix is to key the hash with a server secret (HMAC) or to skip body bytes for password routes.
- **Covered meanwhile:** the record expires after 24 hours, the table is not exposed by any endpoint, and the passwords themselves are never stored, logged or audited.

