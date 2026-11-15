---
phase: 11-public-site-content-management
plan: 38
subsystem: dev-seed-and-go-live
tags: [dev-seed, go-live, docs, cloudinary, sharing-debugger]
created: 2026-11-13T01:55:00-06:00
updated: 2026-11-13T01:55:00-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-07 to 11-33: Business Info and phones, opening hours, closures, product line prices, testimonials, order public settings and gallery entries (the domain methods the seed step calls)"
provides:
  - "SiteContentSeedStep (Order 500, Name SiteContent): a full demo public site from the existing dev-seed command"
  - "docs/operations/go-live-public-site.md: the owner's ordered go-live checklist for the public site"
  - "The deploy-gap ruling (D-123, option A) applied in the checklist and recorded under Go-live (plan 11-38) in 11-CONTEXT.md"
affects: [verify-work, ship]

actuals:
  tokens: 7800
  tasks: 3
  commits: 3

# commits is measured: git rev-list --count plan_head_before..plan_head_after. The SUMMARY commit follows plan_head_after.
plan_head_before: effa01f1f95fd2dc781e1c3f64e86bc9804d0488
plan_head_after: 71353767425c48b8f7f719e115ca0809edb89735

tech-stack:
  added: []
  patterns:
    - "A dev-seed step made of independent parts, each skipped when its own table already holds data, so a second run changes nothing and a Manager's content is never overwritten"
    - "Seed steps use the domain methods only (UpdateBusinessInfo, SetHours, ShopClosure.Create, ProductLine.Update, Testimonial.Create, Order.SetPublicSettings, GalleryEntry.ForOrder); no SQL"

key-files:
  created:
    - src/Csps.Infrastructure/Seeding/SiteContentSeedStep.cs
    - docs/operations/go-live-public-site.md
  modified:
    - src/Csps.Infrastructure/Seeding/DevSeedSteps.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs
    - tests/Csps.ArchitectureTests/DeployWorkflowTests.cs
    - docs/operations/deploy.md
    - docs/development.md
    - .planning/phases/11-public-site-content-management/11-CONTEXT.md

key-decisions:
  - "The new step runs at Order 500, not 400: 400 already belongs to OrdersSeedStep, and a duplicate order makes DevSeeder refuse to run (and the plan also says it registers after the orders step)"
  - "The dev seed leaves the Facebook link and the shop email empty: SiteSettingsSeedStep puts those two seed defaults back on every run, so a demo value would make the SiteSettings step report a change on every second run"
  - "The checklist puts Business Info and the hours first after the deploy (steps 4 and 5) and Cloudinary setup after them, following D-123 ('first steps of the go-live checklist') over the plan's list order; the Cloudinary step needs no visitor-facing change and the link preview picture, the only Business Info part that needs the new sizes, moved to its own step after Cloudinary"

patterns-established:
  - "Go-live docs for a phase live in docs/operations/go-live-<topic>.md and link the parked backlog file by path instead of copying its decisions"

requirements-completed: [PUB-02, CONT-01, CONT-02]

coverage:
  - id: D1
    description: "FND-04: the dev seed gains a SiteContent step that fills demo Business Info with two phones, a week of hours, one closure, prices on two lines, three shown testimonials and three shown demo orders with the customer's OK and gallery entries"
    requirement: PUB-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs#TheSiteContentStepFillsADemoPublicSite"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second run changes nothing; a Manager's own phone, testimonial, closure, hours and price are kept"
    requirement: PUB-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs#ASecondRunOfTheSiteContentStepChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs#TheSiteContentStepKeepsWhatAManagerAlreadyEntered"
        status: pass
    human_judgment: false
  - id: D3
    description: "The step has its own order, after the Orders step; the guard still refuses every database except CSPS_Dev and CSPS_E2E"
    requirement: PUB-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs#TheSiteContentStepRunsAfterTheOrdersStepWithItsOwnOrder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs (whole class)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The go-live checklist lists backup, migration script, deploy, Business Info and hours first (D-123), Cloudinary setup (D-44, P11-BL-21), share picture, closures, line review and prices (D-06, D-40), gallery and testimonials, then the Sharing Debugger on each public URL (P11-BL-40 item 4), robots.txt, sitemap.xml and App:PublicBaseUrl"
    requirement: CONT-01
    verification:
      - kind: other
        ref: "grep -n 'Sharing Debugger' docs/operations/go-live-public-site.md (2 matches); head -4 shows created and updated; grep -c 'go-live-public-site.md' docs/operations/deploy.md = 1; grep -c 'Go-live (plan 11-38)' 11-CONTEXT.md = 1"
        status: pass
    human_judgment: true
    rationale: "Whether the steps read clearly and are in the order the owner wants is the owner's judgment; no test can assert it"
  - id: D5
    description: "The owner rules what visitors see between the deploy and the first Business Info save: already ruled as D-123 (option A); applied, no new D-number"
    requirement: CONT-01
    verification: []
    human_judgment: false

duration: about 75 min
completed: 2026-11-13
status: complete
---

# Phase 11 Plan 38: The owner has a go-live checklist for the public site, and developers have demo content Summary

**One dev-seed command now gives CSPS_Dev a full demo public site (business info, phones, hours, a closure, two prices, three testimonials, three shown orders) and a second run changes nothing; the owner has one ordered go-live checklist that applies D-123 (Business Info and hours first after the deploy) and holds the Cloudinary, line review, price and Sharing Debugger steps.**

## Open items for the owner

None new. Task 2 was already answered by D-123 (option A, owner, 2026-11-11), so the checkpoint was skipped as the brief says. Three small choices are listed under "Decisions Made" so they can be changed cheaply: the seed's step order (500), the empty Facebook link and email in the demo, and the checklist putting Business Info and hours before the Cloudinary step.

## Performance

- **Duration:** about 75 min (first command about 00:35 -06:00)
- **Completed:** 2026-11-13T01:55-06:00
- **Tasks:** 3 of 3 (Task 2 answered by D-123, no stop)
- **Files:** 8 changed, 2 created

## Accomplishments

- `SiteContentSeedStep` fills the public site through the domain methods only: demo Business Info with two phones (one main) and no Facebook link, Monday to Saturday 9:00 AM to 6:00 PM with Sunday closed, one closure 20 days after the business today, prices on basketball (650.00, minimum 10) and volleyball (720.00, minimum 10), three shown testimonials, and three shown demo orders (ORD-2026-0142, 0148, 0157) with the customer's OK, an explicit line and a gallery entry each.
- Each part is skipped when its table already holds data (phones, any open day, any closure, a line that already has a price, any testimonial, an order already shown), so a second run changes nothing and a Manager's content is kept.
- `docs/operations/go-live-public-site.md` is the owner's checklist in 13 steps, with the three "before the deploy" steps, the two "right after the deploy" steps (D-123), the Cloudinary setup (D-44, P11-BL-21), the share picture, closures, the six lines and prices (D-06, D-40), gallery and testimonials, and the live checks. It links the Phase 11 backlog file for P11-BL-21 and P11-BL-40 item 4 and copies none of their decisions.
- `deploy.md` points to the checklist and `development.md` says what the seed adds.
- No prefill migration was written (D-123).

## Task Commits

1. **Task 1 (tracer): the dev seed gives a full demo public site**
   - RED `a657d77c` (test): 11 tests in `DevSeederTests` ran, 3 failed on the planned assertions
   - GREEN `d34ed7e0` (feat): `SiteContentSeedStep`, registered in `DevSeedSteps.All`, and the seed paragraph in `development.md`
   - No REFACTOR commit: the code needed no cleanup after GREEN.
2. **Task 2: deploy-gap ruling** - no commit. Answered by D-123 before this plan ran.
3. **Task 3: ruling recorded and checklist written** - `71353767` (docs)

**Plan metadata:** the SUMMARY commit follows this file.

## Tracer feedback gate

Task 1 is `type="tracer"` with no `gate="blocking-human"`, and its `<verify>` has only `<automated>` commands. Both were run end to end before Task 3: `*DevSeederTests` + `*DevSeedTargetGuardTests` gave 64 passed, 0 failed (exit 0), and `dotnet format Csps.slnx --verify-no-changes` exited 0. Tracer verified end to end, expanded.

## TDD Gate Compliance

RED `test(11-38)` `a657d77c` comes before GREEN `feat(11-38)` `d34ed7e0`. `gsd_run check tdd-red-evidence` takes TAP, JUnit, swift-testing or unittest reports; this repository's runner (xunit.v3 on Microsoft Testing Platform) writes none of those here, so the classifier was not run (same as 11-33). The RED was inspected by hand against the real console output (kept in the session scratchpad):

- **RED run** (`*DevSeederTests`: 11 run, 3 failed, 8 passed). Semantic assessment: all three failures were on the planned assertions and none was a compile, load or fixture fault. `TheSiteContentStepRunsAfterTheOrdersStepWithItsOwnOrder`: the step was null (should not be null). `TheSiteContentStepFillsADemoPublicSite`: the step names were `["Orders"]` where `["Orders", "SiteContent"]` was expected. `ASecondRunOfTheSiteContentStepChangesNothing`: the step names were two where three were expected. The tests find the step by name, so they compile before the class exists.
- **Not a RED, stated plainly:** `TheSiteContentStepKeepsWhatAManagerAlreadyEntered` passed on its first run because no step existed to overwrite anything. It is a guard on behaviour that must stay true once the step exists, and it passed again after GREEN with the step running.

## Evidence (real results)

- RED: `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DevSeederTests"`: exit 2, total 11, failed 3.
- GREEN: same project with `--filter-class "*DevSeederTests" --filter-class "*DevSeedTargetGuardTests"`: exit 0, total 64, failed 0. Wider run (`*SeedStepTests`, `*DevSeederTests`, `*DevSeedTargetGuardTests`, `*DevSeedOptionsTests`): total 92, failed 0 (this includes the company expenses and orders step tests).
- `dotnet build Csps.slnx --no-incremental`: 0 Warning(s), 0 Error(s).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0 (run after GREEN, and `--include` runs on the two other test files I touched).
- Architecture tests (`tests/Csps.ArchitectureTests`): first run after the docs change 289 passed, 1 failed (see Deviation 2); after the fix 290 passed, 0 failed.
- Acceptance greps: `grep -c "SiteContentSeedStep" src/Csps.Infrastructure/Seeding/DevSeedSteps.cs` = 1; `grep -n "Sharing Debugger" docs/operations/go-live-public-site.md` = 2 matches; the new file starts with `created:` and `updated:` lines; `grep -c "go-live-public-site.md" docs/operations/deploy.md` = 1; `grep -c "Go-live (plan 11-38)" 11-CONTEXT.md` = 1.
- gitleaks `protect --staged`: "no leaks found" before each of the three commits. I also looked by eye for real host names, database names, accounts, emails and local paths: the docs name none (placeholders such as "the live address" and "your Cloudinary account"), and every demo value is made up.
- Preflight run before the test runs: ports 5180, 5115, 7028 and 5199 free, no other dev processes.
- Not run: the dev-seed command against the real `CSPS_Dev` database (the brief only allowed bringing it up to date, and the integration tests cover the step against a migrated `CSPS_Test_<guid>` database). No Vite, API or Playwright server was started.

## Decisions Made

- **Step order 500.** `OrdersSeedStep` already has Order 400. Two steps with the same order make `DevSeeder` throw before any step runs, so the new step runs after it at 500. A test pins "unique orders" and "after the Orders step".
- **No Facebook link and no shop email in the demo.** `SiteSettings.ResetToSeedDefaults` compares both to their empty seed defaults on every run, so a demo value would be wiped by the next run and the SiteSettings step would report a change each time. The demo still has Messenger, Instagram, TikTok, directions and map links.
- **Checklist order follows D-123.** The plan lists Cloudinary before Business Info, but D-123 says Business Info and the hours are "the first steps of the go-live checklist". So after the three "before the deploy" steps, steps 4 and 5 are Business Info and hours, Cloudinary is step 6, and the link preview picture (the only Business Info part that needs the new sizes) is step 7. The doc says why in "What to expect".
- **Shown demo orders use an explicit product line**, not the auto line, so the seed does not have to touch the product type to line links. The recorder of the customer's OK is the Legacy holder, as the Testing seeder does.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan gives the new step Order 400, which is already taken**
- **Found during:** Task 1 (reading `OrdersSeedStep`)
- **Issue:** `OrdersSeedStep.Order` is 400. A second step with 400 makes `DevSeeder.RunAsync` throw "share Order 400" before anything runs. The plan's own key link says "registered after the orders step".
- **Fix:** Order 500. Tests pin the order as unique and greater than the Orders step's.
- **Files modified:** `src/Csps.Infrastructure/Seeding/SiteContentSeedStep.cs`
- **Commit:** `d34ed7e0`

**2. [Rule 3 - Blocking] A test pinned the deploy runbook's timestamp offset to -05:00**
- **Found during:** Task 3 (architecture test run after editing `deploy.md`)
- **Issue:** `DeployWorkflowTests.DeployRunbookCoversTheCases` matched the runbook's `*Created ... · Updated ...*` line with a hard-coded `-05:00`, but the owner rule says to use the machine's real offset (-06:00 now). Editing the file's Updated value failed the test.
- **Fix:** the regex accepts any `[+-]hh:mm` offset. The test still checks that both timestamps are there. No other behaviour changed.
- **Files modified:** `tests/Csps.ArchitectureTests/DeployWorkflowTests.cs`
- **Verification:** architecture tests 290 passed, 0 failed.
- **Commit:** `71353767`

**3. [Interpretation] Files outside the plan's list were touched**
- `docs/development.md` (a paragraph on what the seed adds, so the developer guide stays true) and `tests/Csps.ArchitectureTests/DeployWorkflowTests.cs` (Deviation 2).

**Total deviations:** 3 (1 bug, 1 blocking, 1 interpretation). **Impact:** none on scope; each keeps the plan's behaviour.

## Issues Encountered

- A shown demo order reaches the public gallery only once it has a photo (the public gallery read requires one), and photos are not seeded. So the three demo orders are shown and consented in the database but do not yet list on `/gallery` in a fresh dev database. This is stated in `development.md`. Adding fake photo ids would give broken images locally.
- Several test and format runs took minutes each; none left a shell running. No wait loop was used.

## Known Stubs

None. No placeholder text or empty value reaches a UI in the new code.

## Threat Flags

None new. T-11-91 (dev seed target) is mitigated: the guard (`DevSeedTargetGuard`) and its tests are untouched and `DevSeedTargetGuardTests` ran green in the 64 and 92 runs, and the new step is reachable only through `DevSeedSteps.All`, which only the guarded command and tests use. T-11-92 (infrastructure names in a public repo) is mitigated: placeholders only, gitleaks clean, manual look done. T-11-SC: no package added or bumped.

## User Setup Required

None for this plan. The owner's go-live steps are in `docs/operations/go-live-public-site.md`. Nothing was run on the live account or the live database.

## Next Phase Readiness

- The owner can follow `docs/operations/go-live-public-site.md` at deploy time. Its steps 6, 11, 12 and 13 (Cloudinary `34 exist`, Sharing Debugger on four URLs plus one shared link, robots.txt and sitemap.xml, `App__PublicBaseUrl`) are manual-only checks from 11-VALIDATION.md and need the owner.
- `/gsd-verify-work` should route D4 to the owner (human judgment).
- REQUIREMENTS.md was not touched: PUB-02, CONT-01 and CONT-02 are shared with other plans, so the orchestrator's shared-ID gate should decide when they flip.

## Self-Check

PASSED. Created files exist on disk (`src/Csps.Infrastructure/Seeding/SiteContentSeedStep.cs`, `docs/operations/go-live-public-site.md`). The commits `a657d77c`, `d34ed7e0` and `71353767` are ancestors of HEAD (`git rev-list --count effa01f1..HEAD` = 3 before this file). `git status` was clean before this file. STATE.md and ROADMAP.md were not touched. No file was deleted.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-13*
