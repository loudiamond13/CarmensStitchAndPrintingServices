---
phase: 05-profile-user-management
plan: 37
subsystem: testing
tags: [playwright, owner-review, overflow, long-text, parity, api-docs, close-out]
created: 2026-10-18T19:50:00-05:00
updated: 2026-10-18T19:50:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "every Phase 5 screen and endpoint (plans 05-01 to 05-43)"
provides:
  - "overflow and long-text backstops for every Phase 5 screen (@shell sweep, @long-text), with the product fixes they found"
  - "the owner review pack: the real Users, My Profile and Audit Log pages signed in, 131 slide-over, dialog and state pictures, and a rulings page that lists only what is still open"
  - "docs/api/users.md, the Phase 4 review-note dispositions, the validation map of all 43 plans, the close-out records"
  - "the full local gate, green"
affects: [gsd-secure-phase 5, gsd-ui-review 5, gsd-verify-work 5, gsd-ship 5]

# Actuals (#2632): chars/4 over the realized diff.
actuals:
  tokens: 69000
  tasks: 2
  commits: 12
plan_head_before: ca70cd25d024aed7e1098788f20637ad2b0a4d2f
plan_head_after: ed47c56e83985b00971a1dea5bc926c2484d879b

tech-stack:
  added: []
  patterns:
    - "A shared-component fix for long text (wrap-anywhere on the title block, Note text, toast text and EmptyState message; one-line ellipsis on the sidebar chip and top bar name) with a parity ruling that mirrors it in the frozen reference (P5 long-text)"
    - "The Testing staff fixture takes an optional name and an address under csps.test, so long-text specs make their own people"
    - "The owner review signs a seeded Manager in through the fixture and the mail sink on a Testing host, and reports a picture it cannot take instead of stopping"

key-files:
  created:
    - web/e2e/long-text.spec.ts
    - docs/api/users.md
  modified:
    - web/e2e/shell.spec.ts
    - web/e2e/testing-api.ts
    - web/e2e/audit-log.spec.ts
    - web/e2e/motion.spec.ts
    - web/e2e/keyboard.spec.ts
    - web/e2e/a11y-rulings.spec.ts
    - web/scripts/owner-review.mjs
    - web/scripts/owner-review.test.ts
    - web/visual/reference/rulings.css
    - web/visual/reference/rulings.test.ts
    - src/Csps.Server/Controllers/TestingFixturesController.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - web/src/modules/admin/auditCopy.ts
    - docs/web/owner-review.md
    - docs/web/parity.md
    - docs/web/e2e.md
    - .planning/phases/04-identity-authentication/04-REVIEW-DISPOSITION.md
    - .planning/phases/05-profile-user-management/05-VALIDATION.md
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "Long names are fixed in the shared components (dialog and slide-over title, Note, toast, EmptyState message, sidebar chip, top bar name), never by hiding overflow on html or body"
  - "The 28 failing @lists parity rows are fixed by a documented ruling (P5 long-text: the frozen reference's name column gets min-width 0 and overflow-wrap anywhere), not by changing the app: removing min-w-0 broke the 820 px table layout, and a wrapper element would differ from the approved markup"
  - "The review host runs in the Testing environment like the E2E host, so the pack can sign in a Manager and read the code from the sink"
  - "CSPS_E2E was rebuilt once with the guarded DevSeed tool because 2,891 test staff made the Audit Log selects unrenderable in WebKit; the scale limit is recorded for the UI review"

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04, USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, USER-08, AUDIT-02, SEC-07, SEC-08]

coverage:
  - id: D1
    description: "No Phase 5 screen scrolls sideways at 320, 375, 414, 768, 1024, 1280, 1536 and 1920 px, portrait and landscape, in Blush and Espresso (UI Considerations overflow, D-05)"
    verification:
      - kind: e2e
        ref: "web/e2e/shell.spec.ts#@shell phase 5 no sideways scroll on <path> (10 screens x 5 projects, all pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "100-character names and 256-character emails wrap or are cut short inside the width on the profile, roster, panels, dialog titles, toast, chips and the confirm-email page (UI Considerations long-text)"
    verification:
      - kind: e2e
        ref: "web/e2e/long-text.spec.ts#@long-text (6 journeys x 5 projects, all pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Slide-overs and dialogs keep their footer buttons reachable at 320 x 568 and at 640 x 360 (200% zoom) with long values typed in"
    verification:
      - kind: e2e
        ref: "web/e2e/long-text.spec.ts#@long-text the slide-overs and dialogs keep their footers reachable"
        status: pass
    human_judgment: false
  - id: D4
    description: "The owner screenshot pack: Users, My Profile and Audit Log signed in, 131 pictures of the slide-overs, dialogs and states, and a rulings page with only the open items"
    verification:
      - kind: other
        ref: "npm --prefix web run review (131 phase5-review pictures, no console problems) and web/scripts/owner-review.test.ts"
        status: pass
    human_judgment: true
    rationale: "Whether the screens look right and read well is the owner's judgment (D-48); the pack only produces the pictures"
  - id: D5
    description: "Every IN-01 to IN-19 outcome is recorded with its plan and commit, the validation map covers all 43 plans, and docs/api/users.md documents the Phase 5 routes"
    verification:
      - kind: other
        ref: "grep -c 'disposition: open' 04-REVIEW-DISPOSITION.md = 0; grep -c 'nyquist_compliant: true' 05-VALIDATION.md = 1; grep -c '/api/v1/(audit-log|profile|users)' docs/api/users.md = 3"
        status: pass
    human_judgment: false
  - id: D6
    description: "The full local gate: dotnet test, coverage gate, web verify (twice), E2E in every project, the parity matrix, the budget build and both vulnerability audits"
    verification:
      - kind: integration
        ref: "see 'Gate results' below"
        status: pass
    human_judgment: false
  - id: D7
    description: "The owner's rulings: the screen wording, the four flagged edge assumptions, the 40 temporary-password words, the phone motion check, the inbox check and the cookie check after deploy"
    verification: []
    human_judgment: true
    rationale: "Owner decisions and real-world checks that no test can make (Task 3 checkpoint, not yet answered)"

# Metrics
duration: 4h 25m
completed: pending the owner's verdict (Task 3)
status: halted
---

# Phase 5 Plan 37: Phase close-out Summary

**Every Phase 5 screen now passes the overflow and long-text sweeps in three engines and on phones (six shared-component fixes found by the sweeps), the owner review pack photographs the real signed-in screens with a rulings page that lists only what is still open, and the full local gate is green. Task 3, the owner's review, is waiting for the owner: nothing was approved.**

## Performance

- **Duration:** about 4 h 25 min (the full E2E run alone was 1.6 h at 2 workers; the parity matrix 35 min)
- **Started:** 2026-10-18T15:20:00-05:00
- **Ended:** 2026-10-18T19:45:00-05:00 (Tasks 1 and 2); Task 3 is open
- **Tasks:** 2 of 3 done; Task 3 is the owner checkpoint
- **Files modified:** 50 (2,643 insertions, 209 deletions)

## Accomplishments

- **Tracer (Task 1, RED then GREEN).** The new `@shell` sweep (10 Phase 5 screens at 8 widths, portrait and landscape, Blush and Espresso) passed at once. The `@long-text` journeys (6) failed first, and the failures were real defects, now fixed at the wide child: the dialog and slide-over title block, the Note text (a pending 256-character email overflowed to 2,003 px), the toast message, the EmptyState message (a no-match line with a long name made the Audit Log scroll sideways), the sidebar user chip and the top bar user name (both now keep one line and are cut short, the whole name stays in the text and the title).
- **Owner review pack.** `npm --prefix web run review` now signs a seeded Manager in through the Testing staff fixture and the code in the mail sink (the review host runs in the Testing environment) and photographs Users, My Profile and the Audit Log for real, plus 131 pictures of Add User (both ways and the shown-once step), Edit User with its notes, the pending email change and "Carlos Tan (former staff)", the four dialogs, My Profile's three tabs and Change Email, the confirm-email page (Blush), the Audit Log with a row open, no matches and empty, the showcase banner and the shell at 1280 x 600. It ran with no console problems. The rulings page lists only the six open items, the four flagged edge assumptions, the 40 temporary-password words and every new screen sentence; OQ-1 to OQ-11 are marked as already ruled with their rulings.
- **Review scripts (close-out item 1).** `/admin/profile`, `/admin/users` and the new `/admin/audit-log` are photographed signed in; `design-side-by-side.mjs` reads the same `shots/` files, so its pairs are now the real pages. Broken Windows ledger entry 3 is marked fixed.
- **Parity (item 2).** All 471 rows pass. The 28 `@lists` failures are closed by the P5 long-text ruling (see Decisions), documented in `docs/web/parity.md` section 6.
- **Load-flaky tests (item 3).** Fixed for a real reason: the EditUserPanel Saving test (a fixed 400 ms delay that two clicks can outlast, now a gate the test opens), the AdminLayout sidebar-name test (waits for the name), and the cold starts of the routes, ResetPassword and VerifyCode tests (15 s for those files only, longer first waits). The global 5 s default is unchanged.
- **Firefox font-preload warning (item 4).** The owner's ruling stands; it is documented in `deferred-items.md` and the full E2E run needed no other console exception.
- **Security items (item 6).** `deferred-items.md` now holds one heading, "Security items for /gsd-secure-phase 5", with the unsalted `RequestHash` over password-bearing bodies (password, email-change and temporary-password routes), the `IdempotencyOutcome.KeepChanges` opt-in (the 429 lockout and 409 `email-change.taken` branches), and the session-cache eviction before commit (up to 60 s). Nothing was fixed.
- **Duplicate audit words (item 7).** Fixed: 14 handlers write `AuditActions.Detail*`; four constants were added; no behaviour change.
- **Records.** 04-REVIEW-DISPOSITION.md (IN-01 to IN-19 with plan and commit, IN-08 deferred to Phase 9 JOB-01), 05-VALIDATION.md (108 task rows, Wave 0 ticked, validated), `docs/api/users.md`, `docs/web/e2e.md` tags and fixture options, `docs/web/owner-review.md`.

## Task Commits

1. **Task 1 (tracer):** `3720de7` test (RED: sweeps and the fixture), `5452423` fix (GREEN: the shared components and the P5 long-text parity ruling), `8b27f11` fix (parity ruling for the user cell name column)
2. **Task 2:** `10af63a` test (RED: the review pack), `27521db` feat (the pack, the API guide, the dispositions), `e90c6f0` test (RED: audit detail constants), `0a69ee7` refactor (the shared words), `449d09a` fix (load-flaky tests), `548f6a1` fix (review: My Profile h1, per-picture errors), `140b89c` docs (records, security items, e2e tags, ledger), `1739728` fix (E2E specs the gate found failing), `ed47c56` docs (validation map)
3. **Task 3:** not done (owner checkpoint)

## Gate results (run after the preflight; `CSPS_TEST_SQL=localdb` for that process only)

| Gate | Result |
|---|---|
| `dotnet test --solution Csps.slnx` | 3,251 tests: 3,250 passed, 1 skipped (the live HIBP service test), 0 failed, no warnings |
| `tools/scripts/Invoke-CoverageGate.ps1` | Domain 100% line and branch (849/849, 372/372), Application 99.7% line (2,625/2,632); passed |
| `npm --prefix web run verify` | run twice: both exit 0, 186 files, 5,450 tests; web coverage 96.45% statements, 91.93% branches, 99.24% lines; typecheck, lint, format, build, `build:budget` (public 122.5 KB, admin 206.9 KB, CSS 14.6 KB against 150, 250, 35) and the license and notices gates passed |
| `npm --prefix web run e2e --workers=2` | first full run: 970 passed, 37 skipped by design, 24 failed; all 24 were fixed and re-run (see Deviations). Re-runs: `@audit`, `@motion`, `@keyboard` and `@a11y-rulings` in all five projects 332 passed, then `@audit` again after the fix 20 of 20; `@shell` and `@long-text` passed in every project in the full run (an earlier subset run found three Audit Log sweep failures in Firefox, WebKit and the Pixel profile, which were a layout-settle timing issue in the sweep and passed 30 of 30 after it waited for the layout). **Two workers were used because four workers make Firefox and WebKit time out on this shared machine.** |
| `npm --prefix web run parity -- --grep @parity` | 470 passed and 1 WebKit hang ("page, context or browser has been closed" at the test timeout, `@feedback light 390px`); the whole `@feedback` group re-ran 34 of 34, so all 471 rows pass |
| `dotnet list Csps.slnx package --vulnerable --include-transitive` | no vulnerable packages in any project |
| `npm --prefix web audit --audit-level=high` | 0 vulnerabilities |

## Decisions Made

- **Parity ruling, not an app change.** Removing `min-w-0` from the user cell fixed the 390 and 1440 px rows but changed the 820 px table layout (the narrower minimum width that `overflow-wrap: anywhere` gives lets the table shrink), so two new Chromium rows failed. A wrapper element would be a structural difference from the approved markup. The smallest fix that kept long-name wrapping and made the matrix green was the ruling `P5 long-text` in `rulings.css`: the frozen reference's name column gets the same `min-width: 0` and `overflow-wrap: anywhere` as the app. All 48 `@lists` rows pass in three engines.
- **The review pack runs on a Testing host.** The pack needs the staff fixture and the sink, which exist only in the Testing environment; the host variables are copied from the Playwright config and set on that one child.
- **`CSPS_E2E` was rebuilt once** with `dotnet run --project tools/Csps.DevSeed -- --reset --database CSPS_E2E`, the documented, guarded way, after the first full E2E run (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Long names overflowed or clipped on shared components**
- **Found during:** Task 1 (the `@long-text` RED run)
- **Issue:** the dialog and slide-over title block, the Note, the toast text, the EmptyState message, the sidebar chip and the top bar name had no wrapping or truncation, so a 100-character name or 256-character email widened them or the page.
- **Fix:** `wrap-anywhere` on the first four; one-line ellipsis (with the whole name in the text and the title) on the last two; a parity ruling for the two that change a compared property.
- **Files modified:** `web/src/components/overlays/Modal.tsx` and `overlays.recipe.ts`, `states/Note.tsx` and `states.recipe.ts`, `feedback/feedback.recipe.ts`, `navigation/Sidebar.tsx`, `UserMenu.tsx` and `navigation.recipe.ts`, `web/visual/reference/rulings.css`
- **Verification:** `@long-text` and `@shell` pass in five projects; `rulings.test.ts`; the parity rows
- **Committed in:** `5452423`

**2. [Rule 3 - Blocking] The staff fixture could not make long-named people**
- **Found during:** Task 1
- **Issue:** `POST /api/testing/staff` always made "E2E Staff" with a random address, so no 100-character name or 256-character email could be tested.
- **Fix:** optional `firstName`, `lastName` and `email` (an address ending in `@csps.test`, at most 256 characters); `createStaff` takes them. Testing builds only (`#if CSPS_TESTING`), so nothing reaches Release.
- **Files modified:** `src/Csps.Server/Controllers/TestingFixturesController.cs`, `web/e2e/testing-api.ts`
- **Committed in:** `3720de7`

**3. [Rule 1 - Bug] Plan 05-42's demo triggers broke four E2E specs**
- **Found during:** Task 2 (the full E2E run)
- **Issue:** plan 05-42 added the triggers "Open Add User (invite)" and "(password)" to the showcase; `motion`, `keyboard` and `a11y-rulings` matched "Open Add User" by substring, so Playwright's strict mode failed in all five projects (24 failures with the audit one below).
- **Fix:** the trigger is matched exactly.
- **Files modified:** `web/e2e/motion.spec.ts`, `keyboard.spec.ts`, `a11y-rulings.spec.ts`
- **Verification:** 332 passed in the re-run of the four tags
- **Committed in:** `1739728`

**4. [Rule 1 - Bug] The Audit Log link-state journey depended on earlier runs' data**
- **Found during:** Task 2 (the E2E re-run on the rebuilt database)
- **Issue:** it needed a second page of "Signed in" entries (more than ten) and so failed on a fresh database, as CI has.
- **Fix:** it makes twelve "Password reset requested" entries itself and filters on that action.
- **Files modified:** `web/e2e/audit-log.spec.ts`
- **Verification:** `@audit` 20 of 20 in five projects
- **Committed in:** `1739728`

**5. [Rule 3 - Blocking] `CSPS_E2E` had grown to 2,891 staff, which froze the Audit Log in WebKit**
- **Found during:** Task 2 (the first full E2E run: the `@audit` journey timed out at 180 s in WebKit and on the iPhone profile; it passes in 32 s and 44 s in Chromium and Firefox)
- **Issue:** the Done by and Done to selects list every person ever recorded as staff (D-47), about 2,900 options each. Production will have tens of staff.
- **Fix:** rebuilt the E2E database with the guarded DevSeed tool (`--reset --database CSPS_E2E`), then re-ran. The scale limit and two suggestions (a searchable combobox, a periodic reset) are in `deferred-items.md`.
- **Files modified:** none (database only; recorded in `deferred-items.md`)

**6. [Rule 3 - Blocking] The review host had to run in the Testing environment**
- **Found during:** Task 2 (the signed-in pack)
- **Issue:** the Development host has no staff fixture or sink. The host variables now match `playwright.config.ts`; the unit test for the host step was updated.
- **Files modified:** `web/scripts/owner-review.mjs`, `web/scripts/owner-review.test.ts`
- **Committed in:** `27521db`

**7. [Rule 1 - Bug] The review waited for an h1 "My Profile" that the page does not have**
- **Found during:** Task 2 (the first pack run); My Profile's h1 is the person's name. Fixed in `548f6a1`, which also makes one picture that cannot be taken a listed problem instead of a stopped run.

---

**Total deviations:** 7 (4 Rule 1 bugs, 3 Rule 3 blockers; one of them is the database rebuild). **Impact on plan:** each was needed to reach a true green gate; no scope was added beyond the close-out items the orchestrator listed.

## Issues Encountered

- One WebKit parity row hung once in the full run and passed on re-run (a browser hang, not a difference).
- The parity matrix and the E2E run each hold the shared machine for 35 min and 1.6 h; the Playwright runs used two workers.

## Known Stubs

None. The review pack's people and pictures are sample data under `csps.test` on `CSPS_E2E` and stay in the git-ignored `artifacts/` folder.

## Threat Flags

None new. The fixture's optional fields exist only in Testing builds and accept only `@csps.test` addresses. T-05-101 (screenshots or credentials in the public repo): `git status --porcelain artifacts/` prints nothing and the gitleaks scan passed on every commit.

## Owner review (Task 3): not answered

**Do not read anything here as approved.** The review pack is `artifacts/owner-review/index.html` (git-ignored), section "Profile, users and audit log (Phase 5)" and the pages "Admin: Users", "Admin: My Profile" and "Admin: Audit Log" near the top. OQ-1 to OQ-11 are already ruled (D-42 to D-48) and are listed only as ruled. **Still open for the owner:**

1. The screen wording (D-48), including every sentence the executors wrote where the UI-SPEC had none.
2. The four flagged edge assumptions: PROF-02, PROF-03, USER-05, USER-07.
3. The 40 temporary-password words (plan 05-22).
4. Motion and the tab bar on a real phone.
5. The email-change mail in a real inbox (SMTP on a dev account).
6. The refresh cookie `Expires` after the next deploy (Phase 4 carry-over).

The owner's verdict and rulings, with the date, are recorded here when given; a changed ruling becomes a follow-up for `/gsd-verify-work 5` in `deferred-items.md`.

## Next Phase Readiness

- Ready for `/gsd-secure-phase 5` (the three security items are together in `deferred-items.md`), `/gsd-ui-review 5` (the Audit Log selects at scale is noted for it) and `/gsd-verify-work 5`, once the owner has answered Task 3.
- `state.advance-plan`, the ROADMAP progress row and the requirement check-offs are for the final close-out after the owner's verdict.

---
*Phase: 05-profile-user-management*
*Completed: pending the owner's verdict (Task 3)*

## Self-Check: PASSED
