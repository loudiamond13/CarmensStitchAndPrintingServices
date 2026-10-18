---
created: 2026-10-17T20:55:00-05:00
updated: 2026-10-18T05:14:00-05:00
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
- **Same for `/admin/users` (found in plan 05-20):** plan 05-20 made Users a real, Manager-only page and removed `users` from the `devRoutes`, so `owner-review.mjs` (`admin-users`) and `design-side-by-side.mjs` (`/admin/users`) now meet the sign-in page on the e2e host. Plan 05-37 gives them the signed-in capture path. `web/e2e/users.spec.ts` (`@users`) covers the real page with axe and the 320 px width meanwhile.

## Idempotency records keep an unsalted hash of password bodies (found in plan 05-12)

- **What:** `IdempotencyRecords.RequestHash` is SHA-256 over the request target and body, with no salt. For `POST /api/v1/profile/password` (and the reset and invite accept calls) the body holds the passwords, so someone who could read that table could test guesses offline against the hash. The plan's T-05-32 says only the 204 answer is stored; the hash is stored too, for 24 hours.
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`). A fix is to key the hash with a server secret (HMAC) or to skip body bytes for password routes.
- **Covered meanwhile:** the record expires after 24 hours, the table is not exposed by any endpoint, and the passwords themselves are never stored, logged or audited.

## Email-change routes store the same unsalted body hash (found in plan 05-14)

- **What (1):** `POST /api/v1/profile/email-change` has the current password in its body, and `.../confirm` has the link token, so `IdempotencyRecords.RequestHash` holds an unsalted SHA-256 of each for 24 hours. This is the same exposure as the password routes above (the token is also hashed in `AccountTokens`, so only the password body matters).
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`), together with the password-route item above (HMAC the hash or skip body bytes for these routes).
- **Note for 05-16:** `ApplyPendingEmailAsync` records the account itself as the last changer with a second, unstamped save, so the result is right whether or not a session of someone else rides along on the anonymous confirm call. The web confirm page (05-16) need not send an Authorization header for this to hold.
- **Covered meanwhile:** the record expires after 24 hours and no endpoint exposes the table; `TheLastChangerIsTheAccountItselfEvenAfterAnEarlierSelfEdit` pins the attribution.


## Firefox "font preloaded but not used" console warning under parallel Playwright load (found in plans 05-08 and 05-18)

- **What:** With 4 Playwright workers and a long Firefox test on a page that preloads the Archivo font (for example `/admin/profile`), Firefox writes "The resource ... archivo-latin-wght-normal ... preloaded with link preload was not used within a few seconds". The e2e guard fails the test on any console warning. In the 05-18 full `@profile` run it failed four Firefox tests, two of them in the untouched `profile.spec.ts`; the same tests pass with `--workers=2` or alone. Nothing in the 05-18 code loads fonts.
- **Deferred to:** the Phase 5 close-out test review. Options: run Firefox with fewer workers, or ignore exactly this Firefox warning for the app's own preloaded woff2 in `web/e2e/fixtures.ts`, as the WebKit module-preload warning already is.
- **Covered meanwhile:** the failing runs pass at `--workers=2`; no product behavior is affected.

## Add User with a temporary password stores the same unsalted body hash (found in plan 05-19)

- **What:** `POST /api/v1/users` with access `temporary-password` has the temporary password in its body, so `IdempotencyRecords.RequestHash` holds an unsalted SHA-256 of the target and body for 24 hours. This is the same exposure as the password and email-change routes above. The password itself is never stored in plain text, returned, logged, audited or emailed (a test reads the record and checks the response, location and route), and it is single-use: the person must replace it at their first sign-in.
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`), together with the items above (HMAC the hash or skip body bytes for these routes).
- **Covered meanwhile:** the record expires after 24 hours, no endpoint exposes the table, and the value stops working as soon as the person sets their own password.

## Session cache is evicted just before the idempotency transaction commits (found in plan 05-21)

- **What:** `DeactivateUserHandler` and `ActivateUserHandler` evict the person from `ISessionCache` after their own unit of work returns, but the idempotency gate's outer transaction (which holds the state change, the revoked sessions and the stored answer) commits a moment later. A request by the deactivated person that reads the session in that few-millisecond window sees the old committed state and could cache "active" for up to 60 seconds. `SignOutOthersHandler`, `RevokeSessionHandler` and the password handlers have the same ordering.
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`). A fix is to evict from the idempotency middleware after the commit, or to drop the cache entry's lifetime for revoked sessions.
- **Covered meanwhile:** the window needs a request from the person at that exact moment, the cache lifetime is 60 seconds, and the refresh route and a new sign-in re-check the account against the database, so a deactivated person cannot renew or start a session.
