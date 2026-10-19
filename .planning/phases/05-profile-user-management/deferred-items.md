---
created: 2026-10-17T20:55:00-05:00
updated: 2026-10-19T03:30:00-05:00
---

# Phase 5: deferred items

Things found while executing Phase 5 that are out of scope for the plan that found them. Each one names where it will be handled.

## IN-08: purge of closed email-outbox rows (found in plan 05-07)

- **What:** Closed outbox rows keep the recipient address and metadata after the subject and bodies are cleared. The written retention rule is in `docs/operations/mail-setup.md`, section "Outbox retention": delete closed rows 30 days after they close.
- **Deferred to:** Phase 9 maintenance job, requirement JOB-01.
- **Why deferred:** The app has no host scheduler on the Basic hosting plan. Scheduled jobs run from GitHub Actions calling a secret-protected endpoint, and that endpoint and its job runner are built in Phase 9. Building a one-off purge now would create a second, unscheduled path to the same table.
- **Covered meanwhile:** A deleted user's outbox rows are scrubbed at delete time (plan 05-26), so a removed staff address does not wait for the purge.

## Security items for /gsd-secure-phase 5 (found in Phase 5; not fixed here)

These are the Phase 5 findings that belong to the security review, kept together on purpose. Plan 05-37 recorded them and fixed none of them. Each names the plan that found it, the exposure, what covers it meanwhile and a likely fix.

### Idempotency records keep an unsalted hash of password bodies (found in plan 05-12)

- **What:** `IdempotencyRecords.RequestHash` is SHA-256 over the request target and body, with no salt. For `POST /api/v1/profile/password` (and the reset and invite accept calls) the body holds the passwords, so someone who could read that table could test guesses offline against the hash. The plan's T-05-32 says only the 204 answer is stored; the hash is stored too, for 24 hours.
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`). A fix is to key the hash with a server secret (HMAC) or to skip body bytes for password routes.
- **Covered meanwhile:** the record expires after 24 hours, the table is not exposed by any endpoint, and the passwords themselves are never stored, logged or audited.
- **Resolved by plan 05-49 (owner ruling D-50, 2026-10-19):** keyed HMAC-SHA256, expired rows removed in batches.

### Email-change routes store the same unsalted body hash (found in plan 05-14)

- **What (1):** `POST /api/v1/profile/email-change` has the current password in its body, and `.../confirm` has the link token, so `IdempotencyRecords.RequestHash` holds an unsalted SHA-256 of each for 24 hours. This is the same exposure as the password routes above (the token is also hashed in `AccountTokens`, so only the password body matters).
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`), together with the password-route item above (HMAC the hash or skip body bytes for these routes).
- **Note for 05-16:** `ApplyPendingEmailAsync` records the account itself as the last changer with a second, unstamped save, so the result is right whether or not a session of someone else rides along on the anonymous confirm call. The web confirm page (05-16) need not send an Authorization header for this to hold.
- **Covered meanwhile:** the record expires after 24 hours and no endpoint exposes the table; `TheLastChangerIsTheAccountItselfEvenAfterAnEarlierSelfEdit` pins the attribution.
- **Resolved by plan 05-49 (owner ruling D-50, 2026-10-19):** keyed HMAC-SHA256, expired rows removed in batches.

### Add User with a temporary password stores the same unsalted body hash (found in plan 05-19)

- **What:** `POST /api/v1/users` with access `temporary-password` has the temporary password in its body, so `IdempotencyRecords.RequestHash` holds an unsalted SHA-256 of the target and body for 24 hours. This is the same exposure as the password and email-change routes above. The password itself is never stored in plain text, returned, logged, audited or emailed (a test reads the record and checks the response, location and route), and it is single-use: the person must replace it at their first sign-in.
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`), together with the items above (HMAC the hash or skip body bytes for these routes).
- **Covered meanwhile:** the record expires after 24 hours, no endpoint exposes the table, and the value stops working as soon as the person sets their own password.
- **Resolved by plan 05-49 (owner ruling D-50, 2026-10-19):** keyed HMAC-SHA256, expired rows removed in batches.

### Session cache is evicted just before the idempotency transaction commits (found in plan 05-21)

- **What:** `DeactivateUserHandler` and `ActivateUserHandler` evict the person from `ISessionCache` after their own unit of work returns, but the idempotency gate's outer transaction (which holds the state change, the revoked sessions and the stored answer) commits a moment later. A request by the deactivated person that reads the session in that few-millisecond window sees the old committed state and could cache "active" for up to 60 seconds. `SignOutOthersHandler`, `RevokeSessionHandler` and the password handlers have the same ordering.
- **Deferred to:** the Phase 5 security review (`/gsd-secure-phase 5`). A fix is to evict from the idempotency middleware after the commit, or to drop the cache entry's lifetime for revoked sessions.
- **Covered meanwhile:** the window needs a request from the person at that exact moment, the cache lifetime is 60 seconds, and the refresh route and a new sign-in re-check the account against the database, so a deactivated person cannot renew or start a session.

### The idempotency gate lets three answers keep their changes without storing the answer (found in plans 05-12, 05-14 and 05-37)

- **What:** The gate normally stores only 2xx, 400, 404 and 422 answers and rolls everything else back, so the same key may run again. Three endpoint branches opt out of the rollback with `IdempotencyOutcome.KeepChanges`: `POST /api/v1/profile/password` and `POST /api/v1/profile/email-change` when the answer is `429 profile.password-locked` (the wrong password that locked the account must stay counted), and `POST /api/v1/profile/email-change/confirm` when the answer is `409 email-change.taken` (the spent link and the cleared pending address must stay). The answer is not stored, so a retry with the same key runs the handler again instead of replaying.
- **Why it needs the security review:** it is an opt-in that skips the gate's own safety net. A new endpoint that calls it by copy and paste would commit changes on a failure answer. The review should confirm that the three call sites are the only ones, that a retry of the same key cannot double a side effect (a second email, a second counted failure beyond the intended one), and whether an `ArchUnit` or coverage test should pin the list of call sites.
- **Covered meanwhile:** only the three branches above call it (`grep KeepChanges`), each has an integration test for its 429 or 409 answer, and the lockout counter is the behaviour the owner asked for (Phase 4 D-39).

### Where the Phase 5 security items are handled

- All four items above and the one before this line go to `/gsd-secure-phase 5`. None of them blocks `/gsd-verify-work 5` or `/gsd-ship 5` on its own; the security gate decides.

## Slow first test in the admin route suite (found in plan 05-07)

- **What:** In `web/src/modules/admin/routes.test.tsx`, the first test of the guarded-routes group ("opening /admin/orders without a session refreshes once and lands on the sign-in page with the return path") and, in one run, the dev-routes test ("with the dev routes added, /dev/components and the section previews render without a session or a refresh") timed out at the 5 s default in each of four full `npm --prefix web run test -- --run src/modules/admin` runs with 24 parallel workers. The file passes every time when it runs with only a few others.
- **Cause (likely):** the first lazy route import is slow while many workers start at once. The plan 05-07 change was type-only in the web app, so it did not cause this.
- **Deferred to:** the Phase 5 close-out test review, which can raise that one test's timeout or reduce worker load.
- **Resolved in plan 05-37:** `routes.test.tsx` waits 15 s (the poll for the sign-in page in the first test, the showcase heading in the dev-routes test) and the file runs with a 15 s test timeout, set for that file only with `vi.setConfig`. The same cold-start wait is in `ResetPasswordPage.test.tsx` and `VerifyCodePage.test.tsx`. Three consecutive runs of `routes.test.tsx` passed 20 of 20 under load; the global 5 s default is unchanged.

## Owner wording review: OQ-7 and OQ-11 (owner, 2026-10-17)

- **What:** The owner wants to review every new or amended string before it is approved: the UI-SPEC Copywriting section (OQ-7 amended App. E.12/E.13 wording, OQ-11 SPEC-GAP strings) and the Phase 5 email additions, including the new "email changed by a Manager" notice (D-45).
- **Status:** Executors build the UI-SPEC wording as written (D-48). **Phase 5 email wording: owner-approved 2026-10-18 (plan 05-31).** The owner reviewed all seven Phase 5 emails (invite-by-manager, manager-reset-link, email-change-confirm, email-change-confirm-by-manager, email-change-notice, password-changed-other-devices, manager-changed-email) against Phase 4's password-changed email and typed "approved", with no copy or look changes; the previews are in `artifacts/email-preview-phase5` (git-ignored). **Screen wording: owner-approved as built on 2026-10-18 in the 05-37 review (typed "approved", no wording changes), so this review is closed.**
- **Added by plan 05-40 (email wording approved by the owner 2026-10-18 in plan 05-31; the error text below was approved with the screens in 05-37 on 2026-10-18):** the new notice email "A Manager changed your CSPS sign-in email" (heading "Your sign-in email was changed", preheader "Sign in with your new email from now on.", body: "{Manager} changed your sign-in email to {new}.", "Changed {time}.", "From now on, sign in with {new}. This address, {old}, no longer signs in to CSPS.", the signed-out line, "If you didn't expect this, tell a Manager."), sent to the old address when a Manager saves an email at once (D-45). It is in the email preview tool as `manager-changed-email`, so 05-31 shows it; the tool now has eight samples, so 05-31's expected counts are one higher than that plan states. The error text "Choose how the email change applies." (field `emailChange`) was approved in the 05-37 screen review (2026-10-18).

## Review scripts still list /admin/profile as a dev preview (found in plan 05-13)

- **What:** `web/scripts/owner-review.mjs` (REVIEW_TARGETS) and `web/scripts/design-side-by-side.mjs` (the admin pages list) screenshot `/admin/profile` on the e2e host with no sign-in, as the dev preview with the placeholder user. Plan 05-13 made My Profile a real, guarded page and removed `profile` from the `devRoutes`, so on the e2e host that path now sends a visitor without a session to the sign-in page. Their unit tests only check the lists, so nothing fails today; a real run would wait for an h1 that never shows.
- **Deferred to:** plan 05-37 (screen review), which already owns the `owner-review.mjs` page list. The same applies to `users` and `audit-log` when 05-20 and 05-33 replace their previews, so 05-37 needs a signed-in capture path (the E2E staff helper) rather than another unsigned list.
- **Covered meanwhile:** `web/e2e/profile.spec.ts` (`@profile`) proves the real page on every tab, with axe and no sideways scrolling, in all five projects.
- **Same for `/admin/users` (found in plan 05-20):** plan 05-20 made Users a real, Manager-only page and removed `users` from the `devRoutes`, so `owner-review.mjs` (`admin-users`) and `design-side-by-side.mjs` (`/admin/users`) now meet the sign-in page on the e2e host. Plan 05-37 gives them the signed-in capture path. `web/e2e/users.spec.ts` (`@users`) covers the real page with axe and the 320 px width meanwhile.
- **Resolved in plan 05-37:** `owner-review.mjs` now signs a seeded Manager in through the Testing staff fixture and the code in the mail sink (the review host runs in the Testing environment like the E2E host) and photographs `/admin/users`, `/admin/profile` and the new `/admin/audit-log` signed in. `design-side-by-side.mjs` reads the same `shots/` files, so its Users and My Profile pairs are now the real pages with no change to its list. The Broken Windows ledger entry 3 is marked fixed.

## Firefox "font preloaded but not used" console warning under parallel Playwright load (found in plans 05-08, 05-18 and 05-28)

- **What:** With 4 Playwright workers and a long Firefox test on a page that preloads the Archivo font (for example `/admin/profile`), Firefox writes "The resource ... archivo-latin-wght-normal ... preloaded with link preload was not used within a few seconds". The e2e guard fails the test on any console warning. In the 05-18 full `@profile` run it failed four Firefox tests, two of them in the untouched `profile.spec.ts`; the same tests pass with `--workers=2` or alone. Nothing in the 05-18 code loads fonts.
- **Deferred to:** the Phase 5 close-out test review. Options: run Firefox with fewer workers, or ignore exactly this Firefox warning for the app's own preloaded woff2 in `web/e2e/fixtures.ts`, as the WebKit module-preload warning already is.
- **Covered meanwhile:** the failing runs pass at `--workers=2`; no product behavior is affected.
- **Seen again in 05-28:** with 4 workers the long Firefox `@users-actions` journey (1.3 min) failed on this warning; the same test passes alone and at `--workers=2`. In the `@users` run at `--workers=2` it hit the untouched first `@users` roster test (passes alone). 05-28 code loads no fonts.
- **Resolved in 05-33:** the `@audit` journeys on `/admin/audit-log` hit the warning in Firefox even with one worker (the warning follows the time a document stays open, not the load). `web/e2e/fixtures.ts` now ignores exactly this warning (the page's own `/assets/archivo-latin-wght-normal-*.woff2` and Firefox's wording), the way it already ignores WebKit's module-preload warning. The fonts spec still proves the font preloads once and loads from the same origin. The close-out test review can confirm or revert that guard change.

## Owner ruling: pending email change hides Change Email (owner, 2026-10-18)

- **Ruled:** keep 05-18's behavior. While an email change waits, My Profile shows Resend Link and Cancel Change and hides Change Email; replacing a pending change means Cancel Change first. Wording review stays on the rendered screens and emails in 05-31 and 05-37 (D-48).

## Owner wording review: Edit User email choice (added by plan 05-25, D-45, D-48)

- **What:** The Edit User panel (U3) shows a choice under Email when a Manager changes the email of a person who already has a password. The wording was built from D-45 and is not approved.
- **Strings (web/src/modules/admin/usersCopy.ts, `edit.emailChange`):** the group label "How this email change applies"; the row "Confirm by link" with "The new address must confirm first, and the old address is told."; the row "Save at once" with "The email changes now. The old address is told and they are signed out everywhere."; the message "Choose how the email change applies." (the same text the server sends under `emailChange`, also listed under plan 05-40).
- **Status:** "Confirm by link" is preselected. Approved as built by the owner in the 05-37 screen review, 2026-10-18 (no changes).
- **Left for plan 05-30:** the Email notes (invited person, pending change), the pending-change note with Cancel Email Change and the pending-aware toast. The choice sits in its own block under the Email field, so those notes can go beside it.

## Owner wording review: Edit User account actions, email notes and refusals (added by plan 05-30, D-45, D-48)

- **What:** Plan 05-30 finished the Edit User panel. UI-SPEC wording was built as written; the strings below were built from D-45 or from the plan's pattern and are not approved. They all live in `web/src/modules/admin/usersCopy.ts`.
- **Email notes under Email (`edit.emailNote`):** invited person "We'll send the invitation to the new address instead. The old link stops working." (UI-SPEC); person with a password and "Confirm by link" "We'll email a confirmation link to the new address. The change applies when they open it." (UI-SPEC); with "Save at once" (new, D-45) "The email changes as soon as you save. The old address gets a notice and {first} is signed out on every device." The note follows the radio choice live.
- **Save toasts (`edit.toast`):** link sent "{First Last} · {Role}. Their email changes when they open the link sent to {new email}." (UI-SPEC); saved at once (new, D-45) "{First Last} · {Role}. Their email is now {new email} and they are signed out everywhere."
- **Pending change (`edit.pendingEmail`):** "Waiting for confirmation at {new email}." and "Cancel Email Change" (UI-SPEC); the toast "Email change canceled" / "{first} keeps signing in with {email}." and the failure line "Couldn't cancel the email change" are new.
- **Account access (`edit.accountAccess`):** the heading, button names, the hint "Save or discard your changes first." and the success toasts (Invitation sent, Reset link sent, User locked, User unlocked) are UI-SPEC wording; the failure toast titles "Couldn't send the email" and "Couldn't unlock {First Last}" follow the UI-SPEC pattern.
- **Refusals (`edit.guards`, new):** users.blocked "This account is locked or deactivated. / Unlock or activate this person first."; users.already-set-up "They already have a password. / Send a reset link instead."; users.no-password "They haven't set a password yet. / Resend the invitation instead."; users.reset-link-capped "Too many reset links for this person. / Wait an hour, then try again."
- **Lock and Set a temporary password:** `lock` (Lock {First Last}?, body, Keep Unlocked, Lock User, Locking) and `temporary` (Set a temporary password, For {First Last}, the Note, Set Password, Setting, Temporary password set) follow the UI-SPEC rows.
- **Status:** approved as built by the owner in the 05-37 screen review, 2026-10-18 (no changes).

## Owner wording review: Audit Log screen (added by plan 05-33, D-26..D-29, D-40, D-48)

- **What:** The Audit Log page was built from the UI-SPEC wording as written (header, subline, toolbar, result bar, chips, columns, toggle names, empty and error states, the date messages, the action labels). The strings below are new: the UI-SPEC lines for "What changed" ("Name: {old} to {new}" and so on) could not be built, because the log keeps field names and role values only (D-40), so the executor chose the sentences. None is approved yet. They all live in `web/src/modules/admin/auditCopy.ts`.
- **"What changed" sentences (`describeAuditDetail`):** "Name changed", "Email changed" (both together read "Name changed. Email changed"), "Role: Admin to Manager" and "Role: Manager to Admin" (UI-SPEC form), "Link sent again", "That address was taken"; for sign-in failures "No account with that email", "Wrong password", "The account was locked", "The account is deactivated", "The account is not confirmed yet", "No password set yet", "A Manager locked the account", "The account was deleted"; for lockouts "Too many wrong passwords", "Too many wrong sign-in codes"; for signed-out devices "Signed out of other devices", "After a password reset", "After a password change", "The account was changed", "After a temporary password was set"; for reset requests "Reset link emailed", "Notice emailed, the account is deactivated", "Nothing sent, a Manager locked the account", "Nothing sent, no account with that email", "Too many requests this hour"; "Changed in My Profile", "First Manager setup", "Invited by a Manager". A stored word the viewer does not know shows no "What changed" line.
- **Other new strings:** "Unknown person" (a Done by or Done to chip whose person the staff list no longer names, for example a stale link), the no-match sentence "No audit entries with range Last 30 days and done by {name}. Try another search or clear the filters." (built from the shared list wording), the custom range chip "Range: Custom range" (it names the range, not the two dates), and the table noun "audit entries" for "Loading audit entries…" and "Couldn't load audit entries.".
- **Status:** approved as built by the owner in the 05-37 screen review, 2026-10-18 (no changes).

## Parity matrix: 28 `@lists` cases differ on `min-width` of the user cell text (found in plan 05-35)

- **What:** `npm --prefix web run parity -- --grep @parity` passes 443 of 471 and fails 28 `@lists` cases (the `rt-users-populated` and `rt-long-name` scenarios, light and dark, 390 and 1440 px rest and hover, in chromium, firefox and webkit; the 320 and 820 px ones in chromium). Every difference is the same line: `td > span > span style min-width: reference auto | implementation 0px`.
- **Cause (likely):** plan 05-20 added `min-w-0` to `cellUserTextClasses` (`web/src/components/lists/lists.recipe.ts`) so a long name or email wraps inside its column. The frozen reference fragment has `min-width: auto` there. Plan 05-35 touched no list code; it changed only the showcase files, the route table, the build rules and two shell previews, none of which the `@lists` scenarios render.
- **Deferred to:** the Phase 5 close-out test review. Options: record a parity exception for `min-width` on that span (the 05-20 wrapping is a deliberate difference), or move the wrapping to a wrapper the reference does not have.
- **Covered meanwhile:** the other 443 parity cases pass, including the shell layouts and the previews plan 05-35 changed; `UserCell` wrapping is pinned by the 05-20 unit tests and the `@users` E2E at 320 px.
- **Resolved in plan 05-37 (choice recorded):** the smallest change that kept long-name wrapping and made the matrix green was a documented parity ruling, not a code change. Removing `min-w-0` from the user cell fixed the 390 and 1440 px rows but changed the 820 px table layout (the narrower minimum width of `overflow-wrap: anywhere` lets the table shrink), so two new Chromium rows failed. Moving the wrapping to a wrapper element would have been a structural difference from the approved markup. So the rulings layer gives the frozen reference's name column the same two declarations the app uses (`min-width: 0` and `overflow-wrap: anywhere`, ruling `P5 long-text`, `web/visual/reference/rulings.css`, listed in `docs/web/parity.md` section 6). All 48 `@lists` rows pass in Chromium, Firefox and WebKit and the matrix passes in full.

## Owner ruling: Firefox Archivo font-preload warning (owner, 2026-10-18)

- **Ruled:** ignore it. The 05-33 e2e console-guard exception for Firefox's "preloaded but not used" warning on the Archivo font stays; no preload change is needed. Archivo is the body font (base.css `--font-sans`), so the warning is a timing artifact of short test page loads.
- **Confirmed in plan 05-37:** the ruling stands. The exception in `web/e2e/fixtures.ts` (exactly Firefox's wording for the page's own `/assets/archivo-latin-wght-normal-*.woff2`) is kept, and the full E2E run in plan 05-37 shows it still needs no other exception.

## Flaky under load: AdminLayout "shows the new name in the Sidebar chip" (found in plan 05-42)

- **What:** In one full `npm --prefix web run verify` run (186 files), `src/layouts/AdminLayout.test.tsx > AdminLayout session user (PROF-01) > shows the new name in the Sidebar chip and the user menu button after the session user changes, without a reload` failed with "Unable to find an element with the text: Ana Cruz". Run alone it passed 3 of 3 times, and the next full `verify` run passed all 5432 tests. Plan 05-42 touched no layout or session code.
- **Likely cause:** a timing race in the test under a loaded machine (the name update is awaited with a short timeout).
- **Deferred to:** the Phase 5 close-out test review.
- **Resolved in plan 05-37:** the test waited for the new name synchronously after `act`. It now waits for the sidebar chip and the user menu button with `findBy` (5 s), so a loaded machine cannot fail it. The same close-out fixed the other load-flaky tests listed under "Other load-flaky tests" below.

## Stale build output makes `build-output.node.test.ts` fail until the next build (found in plan 05-42)

- **What:** `verify` runs `test:coverage` before `build`, and `src/test/build-output.node.test.ts` reads `src/Csps.Server/wwwroot`. After a change to shipped showcase data (the owner's example.com ruling), the first `verify` fails on the address check until `npm --prefix web run build` has refreshed the output. Running `build` once, then `verify`, passes.
- **Deferred to:** the Phase 5 close-out test review (option: order the build before the node build-output tests).
- **Still deferred, with a reason:** `verify` runs `test:coverage` before `build`, and `web/scripts/verify.test.ts` pins that order. Reordering would move the build ahead of the type, lint and unit gates and make a broken build mask a test failure, so the step order is left as it is. The failure only happens after the shipped showcase data changes (the owner's example.com ruling) and `npm --prefix web run build` followed by `verify` passes. Plan 05-37 changed no shipped data and the gate ran after a fresh build.

## Other load-flaky tests fixed in plan 05-37

- **`EditUserPanel` "shows Saving while the request runs and sends one request":** the mocked save answered after a fixed 400 ms, and two user-event clicks on a loaded machine can take longer than that, so the Saving label was gone before the test looked for it. The request now waits on a gate that the test opens after it has seen "Saving". It has no timing left in it.
- **`AdminLayout` sidebar-name test:** see the entry above.
- **`routes.test.tsx`, `ResetPasswordPage.test.tsx`, `VerifyCodePage.test.tsx` cold starts:** see "Slow first test in the admin route suite".
- **How they were checked:** each fixed file was run several times together; the whole web suite was run twice in plan 05-37 (`npm --prefix web run verify`, then again) and the result is in the plan's SUMMARY.

## Duplicate audit words (05-43 follow-up), fixed in plan 05-37

- **What:** `SignOutOthersHandler`, `ChangePasswordHandler`, `CurrentPasswordCheck`, the six Users handlers that end sessions, `SetTemporaryPasswordHandler`, `CreateUserHandler`, `ConfirmEmailChangeHandler` and `ResendEmailChangeHandler` held their own copies of audit detail words.
- **Fixed:** they now write `AuditActions.Detail*`. Four constants were added (`DetailProfile`, `DetailManager`, `DetailTaken`, `DetailResent`). The strings are the same, so no behaviour changed; the Domain and Application unit tests pass.

## Audit Log "Done by" and "Done to" lists everyone, which WebKit cannot render at thousands of people (found in plan 05-37)

- **What:** `GET /api/v1/audit-log/people` lists every person ever recorded as staff, and the Audit Log fills two native selects with all of them (UI-SPEC A1, D-47). The long-lived `CSPS_E2E` database had grown to 2,891 staff (every E2E run makes hundreds), so each select held about 2,900 options. With that many, the `@audit` journey "a Manager finds a deactivation by Action and Done to" timed out at 180 s in WebKit and on the iPhone profile (32 s in Chromium, 44 s in Firefox), and the page froze while it rendered. After `dotnet run --project tools/Csps.DevSeed -- --reset --database CSPS_E2E` (the documented way to rebuild that database) it passes in all five projects.
- **Why it is only recorded:** production will have tens of staff, so the page is fine there. The gap is a design limit, not a bug in a plan: a native select does not scale to thousands of options.
- **Suggestions:** a searchable combobox (or a type-ahead) for the two selects once the list passes a few hundred people, for `/gsd-ui-review 5` or a later UI pass; and a periodic reset of `CSPS_E2E` (or a cleanup of E2E staff) so the shared test database does not grow without limit. Plan 05-37 reset `CSPS_E2E` once with the guarded tool before the last E2E runs.
- **Also found and fixed in plan 05-37:** the `@audit` link-state journey assumed earlier runs had left more than ten sign-in entries in the shared database, so it failed on a fresh one; it now makes its own entries.

## Phase 5 close-out: the owner's rulings (plan 05-37, owner, 2026-10-18)

The owner reviewed Phase 5 with the pack at `artifacts/owner-review/index.html` (git-ignored; section "Profile, users and audit log (Phase 5)") and typed "approved", with no wording changes. OQ-1 to OQ-11 were already ruled (CONTEXT D-42 to D-48) and are unchanged.

1. **Screen wording (D-48): approved as built, no changes.** Closed as owner-approved 2026-10-18. Emails were already approved 2026-10-18 in plan 05-31.
2. **The four flagged edge assumptions (PROF-02, PROF-03, USER-05, USER-07): approved as the planner stated them.**
3. **The 40 temporary-password words (plan 05-22): approved.**

No ruling changed a contract default, so there is no wording follow-up for `/gsd-verify-work 5` from this review.

## Owner checks still to do (for /gsd-verify-work 5)

The owner did **not** report doing these three in the 2026-10-18 review, so they are **not done**. They are real-world checks that no test can make. The pack is `artifacts/owner-review/index.html` (git-ignored). Plan 05-37 Task 3 gave these steps:

1. **Motion and the tab bar on a real phone.** Open and close the navigation drawer, the user menu and a dialog. Turn on reduced motion and repeat (nothing should move). Check the tab bar sits at the bottom on a short page.
2. **The email-change mail in a real inbox.** Change your own email on a dev account with SMTP configured and confirm both emails arrive: the new-address link and the old-address notice.
3. **The refresh cookie after the next deploy (Phase 4 carry-over).** Sign in on the live site with and without "Keep me signed in" and check the refresh cookie carries `Expires` only when it is ticked.

`/gsd-verify-work 5` should ask the owner for each result and record it.
