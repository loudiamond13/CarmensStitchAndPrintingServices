---
phase: 05-profile-user-management
plan: 33
subsystem: ui
tags: [react, audit-log, manager-only, url-state, expandable-rows, date-range, zod, playwright, audit-02, d-26, d-27, d-28, d-40]
created: "2026-10-18T12:53:00-05:00"
updated: "2026-10-18T12:53:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-29 GET /api/v1/audit-log and 05-41 GET /api/v1/audit-log/people; 05-32 ResponsiveTable detail rows, Select groups, DateInput and the Audit Log nav item; 05-25 ActorName; 05-20 Users list patterns"
provides:
  - "/admin/audit-log (Manager only): AuditLogRoute with the 7-day default, newest first, rows that expand to AuditDetail, and the Date range, Done by, Action and Done to filters in the URL"
  - "auditLogService (list, people), useAuditLogQuery, useAuditPeopleQuery, useAuditListParams, auditRange (keptFloor, resolveAuditRange, customRangeErrors), auditCopy (labels for all 37 action codes, describeAuditDetail), AuditDetail, AuditCustomRange"
  - "RowAction expand toggle (expanded, controls), ResultBar orderNote, and the @audit browser journeys in five projects"
affects: [05-37 screen review, 05-34 and later Phase 5 plans that link to the log, Phase 5 close-out test review]

actuals:
  tokens: 31121
  tasks: 3
  commits: 5
plan_head_before: f7f23aa89e6c39a295e6e41d0c48c537351373a2
plan_head_after: b34bb9bd7770469b5a6d5da347bd7b0626099aaf

tech-stack:
  added: []
  patterns:
    - "Range stored in the URL by name (last-7-days, ..., all, custom) and worked out against the business today read once at mount; the query keys on the resolved business days"
    - "A custom range is held as typed dates and written to the URL only once the zod schema (the server's rules) passes; an unapplied custom range leaves the 7-day default in force"
    - "Fixed-word detail rendering: describeAuditDetail maps stored words per action to sentences and gives null for anything else, so a stored value can never reach the screen (D-40)"
    - "User-id parsers for actor and target (dashed GUID, lower-cased; actor may be system); an email or a name is no filter and is removed with one replace"

key-files:
  created:
    - web/src/modules/admin/services/auditLogService.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditRange.ts
    - web/src/modules/admin/hooks/useAuditListParams.ts
    - web/src/modules/admin/hooks/useAuditLogQuery.ts
    - web/src/modules/admin/components/AuditDetail.tsx
    - web/src/modules/admin/components/AuditCustomRange.tsx
    - web/src/modules/admin/components/audit.recipe.ts
    - web/src/modules/admin/pages/AuditLogPage.tsx
    - web/e2e/audit-log.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/components/lists/cells.tsx
    - web/src/components/lists/lists.recipe.ts
    - web/src/components/lists/FilterBar.tsx
    - web/src/components/lists/copy.ts
    - web/e2e/fixtures.ts
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "aria-controls names the dl inside the detail cell, not the detail row: ResponsiveTable's detail row has no id and the dl has the same visibility, so the table stayed unchanged."
  - "Unapplied custom range: while From and To are not both valid the query keeps the last 7 days (or the last applied custom pair still in the URL); the inputs show the zod messages."
  - "Custom messages appear once a date is touched or the other one is filled, so choosing Custom range does not open with errors."
  - "The table's noun is 'audit entries' (for 'Loading audit entries…' and 'Couldn't load audit entries.'); the result bar says 'entry' and 'entries' with the fixed phrase 'newest first'."
  - "describeAuditDetail covers every stored reason word of the Phase 4 and 5 codes (sign-in failures, lockouts, revoked sessions, reset requests, invitations) as well as the three the plan named, so a Manager can read why; any unknown word shows no What changed line."
  - "The business today is read once when the page opens, so an audit page left open past midnight keeps its day until it is reopened; every visit works it out again."

patterns-established:
  - "An opt-in RowAction expand toggle (aria-expanded, aria-controls, a chevron that turns 180 degrees and stays still under reduced motion) for any later expandable table"
  - "E2E: bring the lone card to the middle of the screen before axe on a phone, because a card behind the fixed tab bar reads as an obscured target"

requirements-completed: [AUDIT-02]

coverage:
  - id: D1
    description: "A Manager opens /admin/audit-log and reads the last 7 days newest first: When in a time element, Done by and Done to (System, Unknown account, former staff, the empty icon), the plain-English action or the key itself, with the header, badge, subline and result bar from the UI-SPEC and no export"
    requirement: "AUDIT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/AuditLogPage.test.tsx#A1 the header, A1 the request, A1 the rows"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx#a Manager who opens /admin/audit-log stays and sees the Audit Log (AUDIT-02)"
        status: pass
      - kind: e2e
        ref: "web/e2e/audit-log.spec.ts#@audit a Manager finds a deactivation by Action and Done to"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each row expands (several at once, not in the URL) to What changed, IP address, Device and Reference; the toggle is a real button named for the action and time with aria-expanded and aria-controls; the chevron turns and stays still under reduced motion"
    requirement: "AUDIT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/AuditLogPage.test.tsx#A1 expanding an entry (D-27)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/AuditDetail.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/components/lists/ResponsiveTable.test.tsx#RowAction as an expand toggle (D-27)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-40: What changed comes only from fixed words (Name changed, Email changed, Role: Admin to Manager and the stored reasons); no name or email ever shows in the detail or the address"
    requirement: "AUDIT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/auditCopy.test.ts#describeAuditDetail (D-40)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/AuditLogPage.test.tsx#never shows a name or an email in what changed (D-40)"
        status: pass
      - kind: e2e
        ref: "web/e2e/audit-log.spec.ts (the address holds ids only)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-28: every action code the API can send has a label and a group (37 codes), including those added after the UI-SPEC table; an unknown key shows as itself"
    requirement: "AUDIT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/auditCopy.test.ts#the action labels (D-28)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-26 and WEB-10: Date range (presets by name, Everything kept, Custom range with From and To bounded by the kept window and today, applied only when valid with the server's messages inline), Done by, Action (three groups) and Done to live in the URL through one hook with allow-list parsers; chips and No matches with Clear Filters"
    requirement: "AUDIT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useAuditListParams.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/auditRange.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/AuditLogPage.test.tsx#A1 the date range (D-26, WEB-10), A1 Done by, Action and Done to (D-26)"
        status: pass
    human_judgment: false
  - id: D6
    description: "States: first load skeleton, error with Try Again, 403 banner, the default 7-day empty state with Show Everything Kept (range=all), any other empty result as No matches"
    requirement: "AUDIT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/AuditLogPage.test.tsx#A1 the states"
        status: pass
    human_judgment: false
  - id: D7
    description: "Browser journeys in chromium, firefox, webkit, pixel and iphone: find a deactivation by Action and Done to, open its detail, widen the range, Back from Users restores filters and page, the Edit User activity link, 320 px fit with the detail stacked in the card, Admin sent on to /admin, zero axe violations"
    requirement: "AUDIT-02"
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @audit --workers=2 (20 passed)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Long What changed and Reference values wrap inside the detail row and the phone card at 320 px"
    verification: []
    human_judgment: true
    rationale: "Plan truth 7 makes this a backstop for the 05-37 screen review: the wrapping class is pinned by a unit test and the 320 px stacking by the e2e, but whether a very long value reads well is a visual judgment."
  - id: D9
    description: "The sentences chosen for What changed (stored reasons such as 'Wrong password' or 'Too many requests this hour'), 'Unknown person', and the no-match wording are executor wording, not in the UI-SPEC"
    verification: []
    human_judgment: true
    rationale: "The owner reviews every new screen string before approving it (D-48); listed in deferred-items.md for 05-37."

duration: 59min
completed: 2026-10-18
---

# Phase 5 Plan 33: Audit Log Page Summary

**The Manager-only Audit Log at /admin/audit-log: newest-first entries with plain-English action labels for all 37 codes, rows that expand to fixed-word detail (D-40), and Date range, Done by, Action and Done to filters kept in the URL through one hook, proved in unit tests and in five browser projects.**

## Performance

- **Duration:** 59 min
- **Started:** 2026-10-18T16:52:46Z
- **Completed:** 2026-10-18T17:52:01Z (code); the docs commit follows
- **Tasks:** 3
- **Files modified:** 25 (16 created, 9 modified in the code commits) plus `deferred-items.md`

## Accomplishments

- **Tracer (Task 1):** `AuditLogRoute` loads `GET /api/v1/audit-log` for the last 7 business days, shows When (a `time` element), Done by and Done to through `ActorName` (System, Unknown account, former staff, the empty icon), the plain-English action (the key itself when unknown) and a chevron toggle named "Show details for {action}, {when}". `AuditDetail` shows What changed (left out when empty), IP address (empty icon when missing), Device ("Unknown browser") and Reference (wraps anywhere). Several rows open at once and the open state is not in the URL. The default-range empty state offers "Show Everything Kept".
- **Fixed-word detail (D-40):** `describeAuditDetail(action, detail)` reads `fields=` as "Name changed" and "Email changed", `role=admin>manager` as "Role: Admin to Manager", and the stored reasons of sign-in failures, lockouts, revoked sessions, reset requests and invitations as short sentences. Anything it does not know gives nothing, so a stored value, a name or an email can never be shown (a test feeds it emails for every action).
- **Filters in the URL (Task 2):** `useAuditListParams` holds page, size, range, from, to, actor, action and target. Actor and target are user ids only (actor may be `system`); an email, a name or an unknown action is dropped with one replace. The page resolves the range against the business today (Last 30 days, This month, Last month, Everything kept from the 8-month floor, Custom range). Custom From and To are bounded by the floor and today, checked by a zod schema that mirrors the server's validator, and applied only when both are valid.
- **Browser proof (Task 3):** `web/e2e/audit-log.spec.ts` (`@audit`) passes 20 of 20 in chromium, firefox, webkit, pixel and iphone. `npm --prefix web run verify` passes (5379 tests, 97.12% statements, budgets, licenses, notices).

## Task Commits

1. **Task 1 (tracer): Audit Log page and detail** - `1b549d6` (test, RED), `01c77e8` (feat, GREEN)
2. **Task 2: Date range, Done by, Action and Done to in the URL** - `5179ca8` (test, RED), `e4e0d86` (feat, GREEN)
3. **Task 3: Browser proof** - `b34bb9b` (test)

**Plan metadata:** the docs commit that follows this file (`docs(05-33): complete audit log page plan`).

## TDD Gate Compliance

Tasks 1 and 2 each have a `test(05-33)` RED commit before the `feat(05-33)` GREEN commit. No REFACTOR commit was needed. Task 3 is the browser proof of Tasks 1 and 2 (RED evidence is the Vitest failures), as the plan says.

- **RED 1 (`1b549d6`):** 57 of the new or changed tests failed on the planned assertions across seven files (the page, `AuditDetail`, copy, range, service, the route and the `RowAction` toggle); the 58 older tests in those files passed. Each new module had an inert stub (empty lists, `null`, empty page) so every file loaded and failed on its assertions instead of on a missing import. `semanticAssessment`: the target tests executed and failed for the intended reason (empty list where 37 labels were expected, no table where the page should be, no `aria-expanded`, the route showing no heading); no compile, discovery or fixture fault.
- **RED 2 (`5179ca8`):** the actor, action and target parser tests, the whole date range and filter page block (12 range tests, 12 filter tests) and five `auditRange` cases failed on assertions. A few tests passed at RED by design (the unchanged page, the hook's already-existing writes, "does not apply an invalid custom range", which the inert stub satisfied by returning the default). `semanticAssessment`: intended failures only (no Date range select, actor parser accepting nothing, `customRangeErrors` returning no message).
- The Vitest JUnit/TAP report is not a format `gsd check tdd-red-evidence` accepts for this run, so the semantic inspection above is the evidence (as in 05-29, 05-32 and 05-41).

## Files Created/Modified

- `web/src/modules/admin/services/auditLogService.ts` (+ test) - `list` and `people`, typed from the generated contract; null filters are not sent
- `web/src/modules/admin/auditCopy.ts` (+ test) - labels and groups for 37 codes, `describeAuditDetail` (`// SPEC-DEVIATION: D-40`), the page, toolbar, chip and error copy
- `web/src/modules/admin/auditRange.ts` (+ test) - `keptFloor` (8 months, day clamped like the server), `resolveAuditRange`, `customRangeErrors` (zod)
- `web/src/modules/admin/hooks/useAuditListParams.ts` (+ test), `useAuditLogQuery.ts` - the one URL hook and the two queries
- `web/src/modules/admin/components/AuditDetail.tsx` (+ test), `AuditCustomRange.tsx`, `audit.recipe.ts` - the detail list, the From and To inputs, the class lists
- `web/src/modules/admin/pages/AuditLogPage.tsx` (+ test), `routes.tsx` (+ test) - the page and its route (still behind `requireManager`)
- `web/src/components/lists/cells.tsx`, `lists.recipe.ts`, `FilterBar.tsx`, `copy.ts` (+ tests) - the `RowAction` expand toggle and the `ResultBar` order phrase
- `web/e2e/audit-log.spec.ts` - the `@audit` journeys; `web/e2e/fixtures.ts` - one more exact console ignore
- `.planning/phases/05-profile-user-management/deferred-items.md` - the new wording to review in 05-37 and the Firefox warning note

## Decisions Made

See `key-decisions` above. The two that change behavior most: an unapplied custom range leaves the 7-day default in force, and the business "today" is read once when the page opens.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RowAction needed an expand toggle**
- **Found during:** Task 1
- **Issue:** The plan's toggle is "the per-row chevron RowAction", but `RowAction` had no `aria-expanded`, `aria-controls` or a turning icon.
- **Fix:** Added opt-in `expanded` and `controls` props (and `rowActionChevronClasses`: `rotate-180`, `transition-transform duration-200`, `motion-reduce:transition-none`). Without `expanded` the markup is unchanged.
- **Files modified:** `web/src/components/lists/cells.tsx`, `lists.recipe.ts`, `ResponsiveTable.test.tsx`
- **Committed in:** `1b549d6` (tests), `01c77e8`

**2. [Rule 3 - Blocking] ResultBar could only say "sorted by"**
- **Found during:** Task 1
- **Issue:** The UI-SPEC result bar reads "Showing 4 entries · newest first", but `ResultBar` always wrote " · sorted by {label}".
- **Fix:** Added an optional `orderNote` (a fixed phrase after " · ") next to `sortLabel`. The test was added with the GREEN commit, not before it.
- **Files modified:** `web/src/components/lists/FilterBar.tsx`, `copy.ts`, `FilterBar.test.tsx`
- **Committed in:** `01c77e8`

**3. [Rule 2 - Missing critical] aria-controls names the dl, not the detail row**
- **Found during:** Task 1
- **Issue:** UI-SPEC says the toggle controls "the detail row id", but `ResponsiveTable`'s detail row has no id, and adding one would change the shared table outside this plan.
- **Fix:** `AuditDetail` takes an `id` and the toggle's `aria-controls` points at that `dl`, inside the row it opens. It is hidden and shown with the row.
- **Files modified:** `AuditDetail.tsx`, `AuditLogPage.tsx`
- **Committed in:** `01c77e8`

**4. [Rule 3 - Blocking] Three small files the plan did not list**
- **Found during:** Tasks 1 and 2
- **Issue:** The range maths and the zod schema (`auditRange.ts` + test), the From and To inputs (`AuditCustomRange.tsx`) and the class lists (`audit.recipe.ts`) needed homes; stuffing them into the hook or the page would have broken the "hook has no `new Date()`" and one-concern rules.
- **Fix:** Created them beside the plan's files, each with tests (or covered by the page tests).
- **Committed in:** `01c77e8`, `e4e0d86`

**5. [Rule 3 - Blocking] The e2e guard failed every long Firefox journey on a font warning**
- **Found during:** Task 3
- **Issue:** Firefox writes "preloaded with link preload was not used within a few seconds" for the app's own Archivo woff2 when a document stays open; the `@audit` journeys failed on it in Firefox even with one worker (the known item in `deferred-items.md`).
- **Fix:** `web/e2e/fixtures.ts` now ignores exactly that warning for `/assets/archivo-latin-wght-normal-*.woff2`, the way it already ignores WebKit's module-preload warning. The fonts spec still proves the font preloads once from the same origin. Noted in `deferred-items.md` for the close-out test review to confirm or revert.
- **Files modified:** `web/e2e/fixtures.ts`
- **Committed in:** `b34bb9b`

**6. [Rule 1 - Bug] The first Playwright runs found two test faults**
- **Found during:** Task 3
- **Issue:** (a) The Admin test asserted no Audit Log nav item, but the e2e bundle's `/admin` is a preview shell with a placeholder Manager, so the item shows; (b) a phone has no Users link outside the navigation drawer; (c) a card behind the fixed tab bar failed axe `target-size` as an obscured target; (d) one long journey stayed on one document long enough for the Firefox font warning.
- **Fix:** Dropped the nav assertion (the Admin's missing item is proved by the Sidebar and route unit tests), opened the drawer first on a phone, centered the lone card before axe, and split the long journey into two (the second holds the page-and-filters Back round trip and the bad-link cleanup).
- **Files modified:** `web/e2e/audit-log.spec.ts`
- **Committed in:** `b34bb9b`

---

**Total deviations:** 6 (4 blocking: the expand toggle, the order phrase, the extra files and the e2e guard; 1 missing-critical wiring choice; 1 bug in the first test drafts). **Impact:** all inside the plan's intent; no new package, no API change.

**Acceptance note:** `grep -c "createListParams" useAuditListParams.ts` is 2, not 1: the import line and the call, the same as `useUsersListParams.ts`. The intent (one factory call, no second state source) holds; `grep -c "new Date()"` in the hook is 0.

## Issues Encountered

- A shell command with an unbalanced apostrophe inside a heredoc body was refused by the tool twice; the content was written with the Write and Edit tools instead. Nothing was left half written.
- The `ResetPasswordPage.test.tsx` line-ending-only change from an earlier plan was left alone, as instructed.

## Known Stubs

None. The inert RED stubs were all replaced in the GREEN commits (`grep "RED stub"` finds nothing).

## Threat Flags

None. T-05-91 (URL parameters): allow-list and user-id parsers with one replace, presets by name, no parameter reaches a link or redirect. T-05-92 (email in the URL or detail): ids only in the address, and `describeAuditDetail` uses fixed words, with a test that no output holds "@". T-05-93 (XSS): every value is a text node; an `<img onerror>` device value renders as text in a test. T-05-SC: no package was installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-37 (screen review) can open `/admin/audit-log` and review the wording listed in `deferred-items.md`. The review scripts `owner-review.mjs` and `design-side-by-side.mjs` do not list the Audit Log, and no dev preview ever shadowed it (the `devRoutes` have no `audit-log` entry), so nothing needed removing; a signed-in capture path is still needed there for any page.
- Open for the close-out test review: the Firefox font-preload ignore in `fixtures.ts`.
- Long What changed and Reference values at 320 px remain a visual backstop for 05-37 (plan truth 7).

## Self-Check: PASSED

- All 16 created files exist (checked with `git diff --name-status`), and this summary.
- All five code commits are ancestors of HEAD: `1b549d6`, `01c77e8`, `5179ca8`, `e4e0d86`, `b34bb9b`; each RED commit precedes its GREEN commit.
- Acceptance criteria: `AuditLogRoute` export count 1, `SPEC-DEVIATION: D-40` count 1 in `auditCopy.ts`, `AuditLogPage` in `routes.tsx` count 1, `@audit` in the e2e spec count 4 (at least 1), `new Date()` in the hook count 0, `createListParams` count 2 (import and call; see the acceptance note).
- Verification: Vitest for `src/modules/admin`, `src/components`, `src/dev`, `src/layouts`, `src/lib` and `src/test` passes; `npm --prefix web run e2e -- --grep @audit --workers=2` passes 20 of 20; `npm --prefix web run verify` passes (185 files, 5379 tests, 97.12% statements, budgets, license gate, notices).

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
