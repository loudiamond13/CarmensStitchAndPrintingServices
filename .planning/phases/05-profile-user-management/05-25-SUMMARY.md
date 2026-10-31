---
phase: 05-profile-user-management
plan: 25
subsystem: ui
tags: [react, react-hook-form, zod, slide-over, radio-group, conflict-banner, record-meta, actor-name, playwright, tdd, user-03, sec-07, sec-08, d-45, d-20, d-11]
created: "2026-10-18T07:52:00-05:00"
updated: "2026-10-18T07:52:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-17/05-23 GET and PUT /api/v1/users/{id} (detail, version, ActorRef); 05-40 PUT carrying email and the explicit emailChange choice (D-45); 05-22 RadioGroup, AddUserPanel, usersService, usersCopy; 05-13 ConflictBanner and the profile 409 handling; 05-20 UsersPage and RowAction"
provides:
  - "EditUserPanel (U3): Edit User slide-over that reads the person with the edit version, edits names, email and role, shows the sign-out note on a role change, and saves with the version"
  - "D-45 in the UI: when the email differs from the saved one and the person has a password, a RadioGroup under Email (Confirm by link preselected, Save at once); emailChange sent only when the email changed; an invited person gets no choice and 'confirm' is sent"
  - "D-20 / D-18 / D-19 / D-09 in the UI: 409 edit.stale keeps typed values with the shared ConflictBanner (Load Latest replaces values and version, focuses First name, announces it); 422 last-active-manager and own-account show a guard banner; 404 shows 'This user was deleted.' and aria-disables Save; a failed detail load shows ErrorState with Try Again"
  - "ActorName and RecordMeta in components/data (barrel @/components): SEC-08 'Recorded by' and 'Last changed by' with Manila time, muted (former staff) suffix, System, EmptyValue"
  - "updateUserSchema (OR-3 mirror of the 05-23/05-40 validator, with the D-45 choice), usersService.update, useUserQuery, useRowFocus, RoleField, UserBadges"
  - "Roster rows: pencil 'Edit {First Last}' with focus return to that row's button, the 'User updated' toast, and the roster refetch"
  - "web/e2e/users.spec.ts @users-edit: rename and promote in one save, two pages meeting the stale-save banner, the 320 px panel"
affects: [05-26 delete, 05-27 resend invitation, 05-28 row dialogs, 05-29 and 05-30 Edit panel Account access, Email notes and pending-change note, 05-31 email review, 05-33 audit log (target link), 05-37 screen review, 05-42 showcase]

actuals:
  tokens: 23184
  tasks: 3
  commits: 6
plan_head_before: f8d41262c70b6b01d2b9ca88baa1aac5aea7b926
plan_head_after: b759fe37c484c80993b1fda853e7c77a8f741576

tech-stack:
  added: []
  patterns:
    - "A panel form lives in a part mounted again on every open (key per open), and the detail query has no cache lifetime, so each open reads the person and the version fresh (isFetchedAfterMount)"
    - "The form is filled from a held 'person' state through the RHF values option; Load Latest also calls reset(), so typed values are replaced even when the latest version holds the same ones"
    - "Focus return after a roster save: a registry hook (useRowFocus) keeps one element per row id, and the page focuses it once the roster has read again, else the page heading"
    - "The saved email rides in the form values so one zod schema can tell a changed email (choice required) from an unchanged one"

key-files:
  created:
    - web/src/modules/admin/components/EditUserPanel.tsx
    - web/src/modules/admin/components/EditUserPanel.test.tsx
    - web/src/modules/admin/components/RoleField.tsx
    - web/src/modules/admin/components/UserBadges.tsx
    - web/src/modules/admin/hooks/useUserQuery.ts
    - web/src/modules/admin/hooks/useRowFocus.ts
    - web/src/components/data/ActorName.tsx
    - web/src/components/data/RecordMeta.tsx
    - web/src/components/data/RecordMeta.test.tsx
  modified:
    - web/src/modules/admin/services/usersService.ts
    - web/src/modules/admin/services/usersService.test.ts
    - web/src/modules/admin/usersSchemas.ts
    - web/src/modules/admin/usersSchemas.test.ts
    - web/src/modules/admin/usersCopy.ts
    - web/src/modules/admin/components/users.recipe.ts
    - web/src/modules/admin/components/AddUserPanel.tsx
    - web/src/modules/admin/pages/UsersPage.tsx
    - web/src/modules/admin/pages/UsersPage.test.tsx
    - web/src/components/data/copy.ts
    - web/src/components/data/data.recipe.ts
    - web/src/components/data/index.ts
    - web/src/components/index.test.ts
    - web/e2e/users.spec.ts
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "D-45 override of the plan: updateUserSchema requires a choice ('confirm' or 'now') when the email differs from the saved one (compared after trim, ignoring letter case, as the server does); the choice control shows only for a person with a password; 'Confirm by link' is preselected and comes back whenever the email is typed back to the saved address"
  - "The PUT always carries the email; emailChange only when the email changed, and an invited person (hasPassword false) always sends 'confirm' because the server moves the address at once and re-invites either way"
  - "The role sign-out note names the person as saved (the loaded first name), not a name being typed in the same edit"
  - "Detail query: gcTime 0, staleTime 0, no refetch on focus; the panel treats data as fresh only when isFetchedAfterMount, so a reopened panel never shows the previous open's version"
  - "A server field message under emailChange shows under the choice (RadioGroup has no error slot, so a message line follows it); if the choice is not rendered (invited person) the message becomes the one alert line"
  - "The role block, the role/status/invite badges and the per-row focus registry were extracted (RoleField, UserBadges, useRowFocus) instead of copied; AddUserPanel now uses RoleField"
  - "Actor display: ActorName is a fragment of text nodes (CWE-79 safe); RecordMeta shows EmptyValue for the whole row when it has no time (a never-changed record) and 'System' only when there is a time but no actor"

patterns-established:
  - "Shared SEC-08 views live in components/data (ActorName, RecordMeta) and are reused by every later detail view"
  - "Server guard refusals (422) with a readable reason keep the form values and show a bold-over-muted ErrorState banner; the next valid submit clears it"

requirements-completed: [USER-03, SEC-07, SEC-08]

coverage:
  - id: D1
    description: "USER-03: each other user's row has a pencil 'Edit {First Last}' that opens 'Edit User' (loading region 'Loading user details…' to 'User details loaded.', then focus on First name); Save Changes sends the loaded version; success closes the panel, focus returns to that row's Edit button, the roster refetches and the toast reads 'User updated' / '{First Last} · {Role}'; the signed-in Manager's row has no Edit button"
    requirement: "USER-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/EditUserPanel.test.tsx#U3 loading the person, U3 saving (USER-03), U3 checks before sending (OR-3)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#U3 Edit User from the page (USER-03)"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-edit a Manager renames and promotes a person in one save (chromium, firefox, webkit, pixel, iphone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "USER-05: the note 'Changing the role signs {first} out on every device.' shows under the role hint while Role differs from the saved role; the person's other browser is signed out after the save"
    requirement: "USER-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/EditUserPanel.test.tsx#U3 changing the role (USER-05)"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-edit a Manager renames and promotes a person in one save (the person's other browser meets the sign-in page)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-45 owner override: a changed email for a person with a password shows 'Confirm by link' (preselected) and 'Save at once'; emailChange is sent only when the email changed (case-insensitive compare after trim); an invited person gets no choice and 'confirm'; typing the saved address back hides the choice and resets it; a server message under emailChange shows beside the control; updateUserSchema requires the choice for a changed email"
    requirement: "USER-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/EditUserPanel.test.tsx#U3 how a changed email applies (D-45)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/usersSchemas.test.ts#updateUserSchema"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-edit the panel fits a 320 px phone (the choice shows for a changed email)"
        status: pass
    human_judgment: true
    rationale: "Owner ruling D-48: the choice wording was built from D-45 and awaits the owner's approval in the 05-37 screen review (deferred-items.md)"
  - id: D4
    description: "D-20 / SEC-07: a 409 keeps every typed value and shows the shared ConflictBanner with focus on Load Latest; Load Latest replaces values and version (also when the latest holds the same values), removes the banner, focuses First name and announces 'Latest version loaded. Make your changes again.'; the next save uses the latest version; a failed Load Latest keeps values and banner and says why; two browser pages show the same in the real app"
    requirement: "SEC-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/EditUserPanel.test.tsx#U3 a stale save (D-20, SEC-07)"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-edit two pages editing the same person (five projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-18 / D-19 / D-09: a 422 users.last-active-manager shows 'You can't remove the last active Manager.' / 'Make another user a Manager first, then try again.' and users.own-account shows 'You can't do this to your own account.' with the values kept; a 404 (on save or on open) shows 'This user was deleted.' / 'Close this and refresh the list.' and aria-disables Save Changes while Cancel still closes; a detail load failure shows ErrorState 'Couldn't load user details.' with Try Again; other failures show one alert line with the values kept"
    requirement: "SEC-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/EditUserPanel.test.tsx#U3 refusals keep what was typed (D-18, D-19), U3 a person deleted meanwhile (D-09), U3 the detail cannot be loaded"
        status: pass
    human_judgment: false
  - id: D6
    description: "SEC-08 / D-11: RecordMeta is a dl of 'Recorded by' and 'Last changed by', each ActorName then ' · ' then a time element (UTC dateTime, Manila text such as 'Oct 17, 2026, 3:42 PM'); a deleted actor reads '{name} (former staff)' with the muted suffix; a null actor reads 'System'; a never-changed record shows EmptyValue (minus icon plus hidden 'Not set'); names are text nodes; terms stack over values at page widths up to 767; the Edit panel shows it with the activity link to /admin/audit-log?target={id}&range=all; Last changed by names the Manager after a save"
    requirement: "SEC-08"
    verification:
      - kind: unit
        ref: "web/src/components/data/RecordMeta.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/EditUserPanel.test.tsx#U3 who recorded and last changed the person (SEC-08, D-11)"
        status: pass
      - kind: unit
        ref: "web/src/components/index.test.ts#exports the SPEC-GAP primitive ActorName, RecordMeta"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-edit a Manager renames and promotes a person in one save (Last changed by names the Manager) and the 320 px test (terms over values)"
        status: pass
    human_judgment: false
  - id: D7
    description: "T-05-72 / prohibitions: actor and user names are rendered as text only; typed edits are never discarded on a 409 or a refusal; a deleted actor is never blank or unnamed"
    verification:
      - kind: unit
        ref: "web/src/components/data/RecordMeta.test.tsx#shows a name that looks like markup as text only (CWE-79)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/EditUserPanel.test.tsx#U3 a stale save, U3 refusals keep what was typed"
        status: pass
    human_judgment: false
  - id: D8
    description: "Long text at 320 px: the panel body scrolls inside the panel, the footer button stays on screen, the email choice descriptions wrap beside their control, the page behind is locked, nothing scrolls sideways, axe zero"
    verification:
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-edit the panel fits a 320 px phone (five projects)"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-10-18
---

# Phase 5 Plan 25: Edit User panel with conflict handling and Recorded by Summary

**The Users roster gets an Edit pencil on every other row that opens a slide-over reading the person with its version, saving names, email and role (with the owner's D-45 choice "Confirm by link" or "Save at once" under a changed email), keeping typed values through stale saves and guard refusals, and ending with the shared SEC-08 RecordMeta and ActorName.**

## Performance

- **Duration:** about 42 min (started 2026-10-18T07:09:28-05:00)
- **Completed:** 2026-10-18T07:52:00-05:00
- **Tasks:** 3 (one tracer, two auto; all TDD)
- **Files modified:** 23 in the six code commits (9 created, 14 modified), plus `deferred-items.md`

## Owner ruling override (D-45)

The plan was written before owner ruling D-45 and described only the contract default. Plan 05-40 built the server side (PUT carries `email` always and `emailChange` `confirm` or `now` when the email changed), so this plan built the form for it, as the orchestrator instructed:

- `updateUserSchema` (OR-3) requires a choice when the email differs from the loaded one, compared after trim and ignoring letter case; `savedEmail` rides in the form values so the schema can tell.
- Only when the email differs AND the person has a password (`hasPassword`), a `RadioGroup` (the 05-22 primitive) labelled "How this email change applies" appears under Email: "Confirm by link" (preselected; "The new address must confirm first, and the old address is told.") and "Save at once" ("The email changes now. The old address is told and they are signed out everywhere."). Typing the saved address back hides it and resets it to "Confirm by link".
- For an invited person (no password) no choice shows and `emailChange: "confirm"` is sent.
- `emailChange` is sent only when the email changed. A server field error under `emailChange` shows under the control.
- The choice sits in its own block under the Email field, so plan 05-30 can add the Email notes, the pending-change note with Cancel Email Change and the pending-aware toast beside it. None of those were built here.
- All new strings are marked pending owner review (D-48) and listed in `deferred-items.md`.

## Accomplishments

- `EditUserPanel` (U3): "Edit User" / "Update details or change their role."; SkeletonText inside a LoadingRegion ("Loading user details…" to "User details loaded."), then focus on First name; status line badges; First name, Last name, Email (hint "They'll use this to sign in."), the D-45 choice, Role with its hint and the sign-out note; footer Cancel and "Save Changes" (pending "Saving") sending the loaded version. Every rule runs in the browser first; server field messages win and put the cursor on the field; any other failure is one alert line with the values kept.
- Stale saves, refusals and a vanished person (Task 2): the shared ConflictBanner on a 409, a guard banner on a 422, the deleted banner with Save aria-disabled on a 404 (also when the person is already gone on open), ErrorState with Try Again when the detail cannot be read.
- `ActorName` and `RecordMeta` (Task 3) in `components/data`, exported from the barrel and pinned in `components/index.test.ts`; the panel shows RecordMeta and the link "See this user's activity in the audit log".
- UsersPage: every other row has "Edit {First Last}"; after a save the panel closes, the roster reads again, focus returns to that row's Edit button (else the page heading) and the toast reads "User updated" / "{First Last} · {Role}".
- `@users-edit` passes in all five projects (15 of 15); `@users` and `@users-add` still pass (44 of 45 in one run; the one failure is the known Firefox font-preload warning, and the test passes alone).
- `npm --prefix web run verify` passes: 174 files, 5080 tests, coverage 97.14% statements, bundle budgets, license and notices gates clean.

## Task Commits

1. **Task 1 (tracer): Edit a colleague's name, email and role** - `c44e245` (test, RED), `23e13ff` (feat, GREEN)
2. **Task 2: Stale saves, refusals, deleted person, load failure** - `cbe9678` (test, RED), `5131185` (feat, GREEN)
3. **Task 3: Recorded by and Last changed by, activity link, browser proof** - `7662d22` (test, RED), `b759fe3` (feat, GREEN)

**Plan metadata:** the docs(05-25) commit that carries this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md and the deferred-items note.

## TDD Gate Compliance

- **RED 1 (`c44e245`):** against stubs (`EditUserPanel` rendered nothing, `usersService.update` rejected "not implemented", `updateUserSchema` accepted anything), 39 tests failed on the planned behavior across the four files. Semantic assessment: every failure was a missing element or unmet assertion; no import, syntax or fixture fault. The schema cases that expect no message (an unchanged email needs no choice) passed against the permissive stub and stayed regression guards.
- **GREEN 1 (`23e13ff`):** 170 of 170 in the five related files, then 2380 across `src/modules/admin`, `src/test` and `src/components`.
- **Tracer gate:** Task 1's `<verify>` is automated only, so it was re-run after GREEN before Task 2 began. Tracer verified end-to-end, expanded.
- **RED 2 (`cbe9678`):** 17 of 39 panel tests failed on the planned behavior (no banners, no Load Latest, no deleted state, no ErrorState). **GREEN 2 (`5131185`):** 39 of 39, then 2216 across admin and components.
- **RED 3 (`7662d22`):** 13 failed (ActorName, RecordMeta, the panel's record meta and link) against stubs. **GREEN 3 (`b759fe3`):** all pass, then the full `verify`.
- The `check tdd-red-evidence` classifier was not run: this repo's Vitest output is not a report format it reads, the same call 05-13 through 05-24 made. No REFACTOR commit was needed. The e2e specs for Task 3 were written with the GREEN commit, as the plan says.

## Deviations from Plan

### Owner-ruled change

**1. [D-45 override] The Edit form offers the Manager's email choice**
- **Found during:** orchestrator instruction before Task 1
- **Issue:** the plan assumed the contract-default email behavior; the owner ruled D-45 and 05-40 built the server side.
- **Fix:** see "Owner ruling override (D-45)" above. The plan's own `updateUserSchema` truth ("names, email shape and 256, role") grew the choice rule.
- **Files modified:** `usersSchemas.ts`, `usersCopy.ts`, `EditUserPanel.tsx` and their tests, `deferred-items.md`
- **Committed in:** `c44e245` (tests), `23e13ff` (code)

### Auto-fixed Issues

**2. [Rule 1 - Bug] An existing @users assertion expected no buttons on another person's row**
- **Found during:** Task 3 browser run
- **Issue:** `web/e2e/users.spec.ts` (@users, 05-20) asserted `getByRole('button')` count 0 on an Active person's row; that row now has the Edit button.
- **Fix:** the assertion expects exactly one button.
- **Committed in:** `b759fe3`

**3. [Rule 1 - Bug] A test regex held literal long dashes (OR-4)**
- **Found during:** Task 3 verification (`no-long-dash.node.test.ts`)
- **Issue:** the RecordMeta test's `/[–—]/` was written with the characters themselves.
- **Fix:** it builds the pattern from escaped code points.
- **Committed in:** `b759fe3`

**4. [Rule 1 - Bug] The first e2e sign-out proof used a reload**
- **Found during:** Task 3 browser run
- **Issue:** reloading the signed-out person's `/admin` did not show the sign-in heading in the test; the repository's own proof pattern (auth-reset: open `/admin/login`, a live session would go on to `/admin`) does.
- **Fix:** the spec uses that pattern. No product change; whether a reload of a revoked session should land on sign-in at once is not part of this plan and was not investigated further.
- **Committed in:** `b759fe3`

### Scope and process notes

**5. [Scope] Extracted shared parts instead of copying.** `RoleField` (the role block of both forms; `AddUserPanel` now uses it), `UserBadges` (role, status and invitation badges for the roster and the panel's status line) and `useRowFocus` (per-row element registry for focus return). Not in the plan's file list; behavior of Add User and the roster is unchanged and their tests pass.

**6. [Scope] The sign-out note names the person as saved**, not a first name being typed in the same edit ("signs E2E out" while First name is changed to "Paulo"). The plan did not say.

**7. [Process] Prettier normalised line endings.** Some files were rewritten with CRLF by my edit scripts and were formatted back to LF before each commit; the diff shows only intended changes.

**8. [Process] The RED commit for Task 3 carries the recipe, copy and barrel entries** (declarative class lists and strings) so the tests could import them; the components were stubs, so the tests failed on behavior.

---

**Total deviations:** 1 owner-ruled change, 3 auto-fixed (Rule 1), 4 scope or process notes. **Impact on plan:** the owner ruling widens Task 1 as instructed; no plan truth was dropped.

## Issues Encountered

- One Firefox run of `@users the roster ...` failed with the known "font preloaded but not used" console warning under four parallel workers (already in `deferred-items.md`, found in plans 05-08 and 05-18). It passed alone on Firefox in the next run; nothing in this plan loads fonts.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows a line-ending-only difference from an earlier plan; left alone as instructed.
- USER-03, SEC-07 and SEC-08 are declared by later plans of this phase too, so the shared-ID gate (`requirements.ready-ids`) left them unmarked; the last declaring plan's close-out marks them.
- The shell tool rejected some large heredocs with apostrophes; those additions were written with the file tools.

## Authentication Gates

None.

## Known Stubs

None. The RED-commit stubs (`EditUserPanel`, `usersService.update`, `updateUserSchema`, `ActorName`, `RecordMeta`) were all replaced in the GREEN commits.

## Threat Flags

None. The register is mitigated as written: T-05-71 (ConflictBanner keeps typed values, covered by unit tests and the two-page e2e), T-05-72 (actor and user names are text nodes; the test renders a name that looks like markup and finds no element), T-05-SC (no installs; `package.json` untouched).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-30 can add the Email notes, the pending-change note with Cancel Email Change and the pending-aware toast beside the choice block in `EditUserPanel`; `RoleField`, `UserBadges` and `useRowFocus` are ready for the row dialogs of 05-28 (`useRowFocus.focusRow` for the Delete and Deactivate focus rules).
- 05-29/05-30 Account access buttons reload the panel through `userKey(id)` and `query.refetch()` in the same form part; they must stay `aria-disabled` while the form is dirty (UI-SPEC D-21).
- 05-33 lands the audit page the activity link points to (`/admin/audit-log?target={id}&range=all`).
- Owner review is open for the new choice wording (D-48, `deferred-items.md`); 05-37 should include the Edit panel with the choice showing and with RecordMeta "(former staff)".

## Self-Check: PASSED

- Created files exist: `EditUserPanel.tsx`, `EditUserPanel.test.tsx`, `RoleField.tsx`, `UserBadges.tsx`, `useUserQuery.ts`, `useRowFocus.ts`, `ActorName.tsx`, `RecordMeta.tsx`, `RecordMeta.test.tsx`.
- Commits `c44e245`, `23e13ff`, `cbe9678`, `5131185`, `7662d22` and `b759fe3` are on `gsd/phase-05-profile-user-management`; `git rev-list --count` from the recorded base gives 6.
- Acceptance greps: `export function EditUserPanel` 1; `signs .* out on every device` 1; `ConflictBanner` 2 in the panel; `You can't remove the last active Manager.` 1; `RecordMeta|ActorName` in the data barrel 5 lines; `(former staff)` in `copy.ts` 1; `@users-edit` in `users.spec.ts` 5.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
