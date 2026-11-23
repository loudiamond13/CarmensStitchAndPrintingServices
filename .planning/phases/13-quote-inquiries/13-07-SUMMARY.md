---
created: 2026-11-22T21:40:00-06:00
updated: 2026-11-22T21:40:00-06:00
phase: 13-quote-inquiries
plan: 07
subsystem: api
tags: [site-settings, business-info, quote-alerts, email-validation, audit, tdd, cwe-93, cwe-200]

requires:
  - phase: 13-quote-inquiries
    provides: "13-02 quote request store and settings, 13-06 bot guards (wave 4 dependency)"
  - phase: 11-public-site-content-management
    provides: "the Business info tab, ContactEmail handling at every layer, SiteLinks.IsContactEmail, the site-settings.changed audit entry"
provides:
  - "SiteSettings.QuoteAlertsEmail (column QuoteAlertsEmail nvarchar(254) not null default ''), SiteSettings.QuoteAlertsEmailMaxLength = 254, BusinessInfoFields.QuoteAlertsEmail = quoteAlertsEmail, migration AddQuoteAlertsEmail"
  - "UpdateSiteSettingsRequest.QuoteAlertsEmail (optional; empty or missing clears it), SiteSettingsDto.QuoteAlertsEmail (staff read only; null when not set)"
  - "ISiteContentStore.GetQuoteAlertsEmailAsync: the saved address, or an empty string when none is set (used by the alert email in plan 13-10)"
  - "QuoteAlertsCard after the Email card in Business info, saved by Save Business Info in the same settings version; zod rule with the server messages"
  - "Audit viewer label 'Quote alerts email'; docs/api/site-content.md records the field"
affects: [13-10, 13-13]

actuals:
  tokens: 8500
  tasks: 2
  commits: 3
plan_head_before: e1c74e96e444055ea28c11fb0ff00b52e84f6a4a
plan_head_after: 1ae32403e23a0889b74f7da355ca0fafa238b18b

tech-stack:
  added: []
  patterns:
    - "A new optional staff setting copies ContactEmail at every layer: domain Optional + CheckShape + Track, request, validator, DTO, view, store, EF column, zod, label"
    - "The validator gives the length message before the shape message for the quote alerts address, so a 255-character address says how long it may be"
    - "The card is its own component over the shared SiteContentCard and a plain Controller + Field, inside the tab's form, so there is no import cycle with BusinessInfoTab"

key-files:
  created:
    - src/Csps.Infrastructure/Persistence/Migrations/20261123031035_AddQuoteAlertsEmail.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261123031035_AddQuoteAlertsEmail.Designer.cs
    - web/src/modules/admin/components/QuoteAlertsCard.tsx
    - web/src/modules/admin/components/QuoteAlertsCard.test.tsx
  modified:
    - src/Csps.Domain/Content/SiteSettings.cs
    - src/Csps.Domain/Content/BusinessInfo.cs
    - src/Csps.Domain/Content/SiteSettingsDefaults.cs
    - src/Csps.Application/Content/UpdateSiteSettingsRequest.cs
    - src/Csps.Application/Content/UpdateSiteSettingsRequestValidator.cs
    - src/Csps.Application/Content/UpdateSiteSettingsHandler.cs
    - src/Csps.Application/Content/SiteSettingsDto.cs
    - src/Csps.Application/Ports/ISiteContentStore.cs
    - src/Csps.Infrastructure/Content/SiteContentStore.cs
    - src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/components/BusinessInfoTab.tsx
    - web/src/modules/admin/siteContentSchemas.ts
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/modules/admin/auditCopy.ts
    - docs/api/site-content.md

key-decisions:
  - "The length message ('Keep the email to 254 characters or fewer.') wins over the shape message for an address over 254 characters, in the domain, the validator and zod (UI-SPEC row, plan truth). The shop email check still says 'Enter a valid email' for a long value, as before."
  - "Pitfall 12: an empty or missing quoteAlertsEmail clears the saved address, like every other optional Business info value. The web form always sends the field (null when empty), pinned by a test."
  - "The Admin staff read (GET /api/v1/site-settings) also carries the address, as it already does for the shop email. The save stays Manager only."

patterns-established:
  - "Public exclusion for a staff-only setting is a themed test over /api/v1/public/site, /api/v1/public/privacy-contact, /, /contact, /products, /gallery and /api/v1/public/home"

requirements-completed: [INQ-04]

coverage:
  - id: D1
    description: "A Manager types the Quote alerts email, presses Save Business Info and sees it after reload (same settings version)"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/SiteSettingsWriteTests.cs#AManagerSavesTheQuoteAlertsEmailAndTheStaffReadAndTheStoreReturnIt"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/BusinessInfoTab.test.tsx#sends the typed address with Save Business Info and shows it after the refetch"
        status: pass
    human_judgment: false
  - id: D2
    description: "The address is checked on both sides with the same messages, optional, 254 characters at most, the shop email allowed"
    requirement: INQ-04
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/SiteSettingsBusinessInfoTests.cs and tests/Csps.Application.UnitTests/Content/UpdateSiteSettingsRequestValidatorTests.cs"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/siteContentSchemas.test.ts#gives quoteAlertsEmail the message for ..."
        status: pass
    human_judgment: false
  - id: D3
    description: "An empty or missing address clears the saved one; the web form always sends the field"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "SiteSettingsWriteTests#ABodyWithoutAQuoteAlertsEmailClearsTheSavedOneLikeEveryOtherOptionalValue"
        status: pass
      - kind: unit
        ref: "BusinessInfoTab.test.tsx#always sends the field: null when it is empty ..."
        status: pass
    human_judgment: false
  - id: D4
    description: "The address is never in a public answer or page, and its change is audited by name only"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicSiteEndpointTests.cs#TheQuoteAlertsEmailIsInNoPublicAnswerAndNoPageHead"
        status: pass
      - kind: integration
        ref: "SiteSettingsWriteTests#ASaveThatChangesOnlyTheQuoteAlertsEmailAuditsTheFieldNameWithoutTheAddress"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/auditCopy.test.ts#reads site-settings.changed fields=quoteAlertsEmail"
        status: pass
    human_judgment: false
  - id: D5
    description: "The R5 card looks right in Blush and Espresso on a phone and a desktop"
    verification: []
    human_judgment: true
    rationale: "Spacing, theme and the look of the card against the other Business info cards need a person's eye; the tests only prove structure, labels and axe."

duration: 95min
completed: 2026-11-22
status: complete
---

# Phase 13 Plan 07: A Manager sets the Quote alerts address in Business info Summary

*Created: 2026-11-22T21:40:00-06:00 · Updated: 2026-11-22T21:40:00-06:00*

**The staff address for quote alerts is now a Manager setting in Business info: one optional email, checked the same way in the browser and on the server, audited by name, saved with the rest of the tab, and never sent to any public answer or page.**

## Performance

- **Duration:** about 95 min
- **Tasks:** 2 of 2
- **Commits:** 3 (one red, two green)

## What was built

- **Domain to database:** `QuoteAlertsEmail` sits beside `ContactEmail`: same `Optional` length rule, same `SiteLinks.IsContactEmail` shape check, `Track` for the audit field list. Migration `AddQuoteAlertsEmail` adds one non-null `nvarchar(254)` column that defaults to empty. The migration also holds an `UpdateData` that writes the same empty value to the seeded row (generated by EF from the seed list, no data is lost).
- **Application:** the request, DTO and port view carry the value. `GetQuoteAlertsEmailAsync` reads only that column (no tracking) and throws the existing missing-row error if the singleton is gone. The validator checks length first ("Keep the email to 254 characters or fewer."), then shape ("Enter a valid email, like name@gmail.com"). The public snapshot, public DTOs and the privacy-contact answer were not touched.
- **Web:** `QuoteAlertsCard` (SPEC-GAP) draws the title, hint, an email field with `type="email"` and `inputMode="email"`. It sits inside the tab form after the Email card. The zod rule mirrors the server. `formPathOf` knows the field so a server 400 lands on it and takes focus. The audit viewer reads `quoteAlertsEmail` as "Quote alerts email changed".
- **Docs:** `docs/api/site-content.md` describes the field, the clear-on-empty rule, the never-public rule and the audit wording.

## TDD record

- **RED** (`ba7c39de`): compile-only stubs (members exist but are not stored, mapped or checked; the EF property was ignored so the old schema still worked), then the tests. Failing runs quoted before any behavior: domain 15 failed of 67, application 9 failed of 95, server write tests 4 failed of 40 (all on assertions), web 23 failed of 483 (card, tab, zod rows, audit label).
- **GREEN** (`6907f86a`): domain, validator, store, EF mapping, migration, card and zod rule. The audit label and docs followed in `1ae32403`.

## Verification (real runs)

| Check | Result |
|---|---|
| `dotnet build Csps.slnx -warnaserror` | 0 warnings, 0 errors |
| `Csps.Domain.UnitTests` SiteSettingsBusinessInfoTests + SiteSettingsTests | 83 of 83 |
| `Csps.Application.UnitTests` UpdateSiteSettingsRequestValidatorTests, UpdateSiteSettingsHandlerTests, GetSiteSettingsHandlerTests | 95 of 95 |
| `Csps.Server.IntegrationTests` SiteSettingsWriteTests, SiteSettingsEndpointTests, OpenApiSnapshotTests, PublicSiteEndpointTests, PublicPrivacyTests, PrivacyContactEndpointTests | 58 of 58 |
| `Csps.Infrastructure.IntegrationTests` Persistence, Content, Seeding namespaces | 468 of 468 |
| `Csps.ArchitectureTests` | 290 of 290 |
| web: QuoteAlertsCard, BusinessInfoTab, siteContentSchemas, auditCopy, service and hook tests | 479 of 479 (412 in the wider site content run) |
| `npm --prefix web run typecheck`, `lint` (max warnings 0), `format:check`, `build` | all pass |
| `npm --prefix tools/openapi-gen run check` | "Generated API types match tools/openapi-gen/openapi.v1.json." |

The whole `Csps.Server.IntegrationTests` project was not run here: a full run was going in the main checkout. No flaky test was seen; nothing was re-run to pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan text] The 250-letter local part case**
- **Found during:** Task 2 tests
- **Issue:** The plan lists "a 250-letter local part" among shape failures that get "Enter a valid email", and "255 characters" as the length message. The existing fixture `a`*250 + `@b.ph` is 255 characters, so the two lines name the same input.
- **Fix:** Over 254 characters always gets the length message (the UI-SPEC row lists it second and the plan truth says "a long one 'Keep the email to 254 characters or fewer.'"). Short wrong shapes ("nope", "a@b@c.ph", "name@[example].ph") get the shape message. Tests pin both.
- **Files modified:** `UpdateSiteSettingsRequestValidator.cs`, `SiteSettings.cs`, `siteContentSchemas.ts`, their tests.
- **Commit:** 6907f86a

**2. [Rule 3 - Blocking] Task boundary**
- **Issue:** Task 1's verify command runs the whole `BusinessInfoTab.test.tsx` and the server write tests, which include the validation cases the plan lists under Task 2.
- **Fix:** The validator, domain check and zod rule landed in the Task 1 green commit. Task 2's own commit holds the audit label and the docs. All the tests were written in the one red commit.
- **Commit:** 6907f86a, 1ae32403

**3. [Rule 1 - Bug] An existing test now out of date**
- **Found during:** Task 1 green run
- **Issue:** `BusinessInfoTab.test.tsx` "is card 6" listed the headings without the new card.
- **Fix:** Renamed to card 7 and added the Quote alerts heading, inside the form.
- **Commit:** 6907f86a

### Other notes (not code deviations)

- The plan says to stay on `gsd/phase-13-quote-inquiries`; the run was in the orchestrator's worktree branch as instructed.
- Commit messages end with the Sonnet 5.5 co-author line from the harness, not the Opus 5.5 text in the plan.
- `docs/api/site-content.md` `updated` is the real clock time. It is earlier than the old stamp, which was set ahead of the clock by an earlier edit.

## Owner notes

- **Admin can read the address.** `GET /api/v1/site-settings` is open to Admin and Manager, and it already returns the shop email. It now returns the quote alerts address too. Only a Manager can save it. If you want the address hidden from Admin, that is a behavior change for you to decide; it was not made.
- Plan 13-13 adds the Send Test Email button inside this card. The card takes only a `control` today.

## Known Stubs

None. The red-stage stubs were all replaced.

## Threat Flags

None. T-13-20 (public leak) is covered by the public exclusion tests, T-13-21 (header injection) by the shape check on both sides with MailKit building the address in plan 13-10, T-13-22 (who changed it) by the audit entry and RecordMeta, T-13-SC by no package change (`npm ci` from the lockfiles only).

## Self-Check: PASSED

- Files found: QuoteAlertsCard.tsx, QuoteAlertsCard.test.tsx, the AddQuoteAlertsEmail migration, docs/api/site-content.md.
- Commits found: ba7c39de, 6907f86a, 1ae32403.
- Acceptance: `QuoteAlertsEmail` appears 7 times in SiteSettings.cs (needed 2), `quoteAlertsEmail` is in auditCopy.ts, the openapi check exits 0, the build has 0 warnings.
