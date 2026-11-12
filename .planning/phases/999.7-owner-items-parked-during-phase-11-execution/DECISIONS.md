# Owner items parked during Phase 11 execution

*Created: 2026-11-11T22:44:28-06:00 · Updated: 2026-11-11T22:44:28-06:00*

The owner went away during the Phase 11 run (2026-11-11) and asked for the run to finish with a code review and a security review. Anything that needs the owner is parked here instead of blocking the run. Nothing here was decided for the owner.

## P11-BL-01 · The new site contact migration cannot be rolled back (plan 11-07, deviation 1)

**Status:** open · **Blocks:** nothing. Built as option A.

Plan 11-07 added migration `AddSiteContactDetails` (12 new SiteSettings columns and the SitePhoneNumbers table). Nothing is dropped or renamed. Its "undo" step (`Down`) now stops with a clear error instead of dropping the new columns, because the plan forbids drop lines and earlier migrations follow the same rule (D-39). Production gets reviewed forward scripts, so the undo step is not used there.

- **A (built, recommended):** keep it forward only, like the earlier migrations.
- **B:** let the undo step drop the new columns and table, for local use only.

## Flakes seen in the post-merge gates (for the record, no decision needed)

| Wave | Test | Full run | Alone |
|------|------|----------|-------|
| 2 | `LastManagerGuardTests.TwoManagersDeactivatingEachOtherTogetherLeaveExactlyOneActiveEveryTime` | failed once | passed 7 of 7 (the class 6 times) |
| 2 | web `admin/routes.test.tsx` "/dev/public shows the real public layout ..." | failed once | passed |
