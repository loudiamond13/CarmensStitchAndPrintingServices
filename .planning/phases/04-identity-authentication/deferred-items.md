---
created: "2026-10-15T03:31:00-05:00"
updated: "2026-10-17T20:10:00-05:00"
---

# Deferred items (phase 04)

## 04-20

- **Flaky `ResendCodeEndpointTests.TheSixthCodeInAnHourIsRefusedWithNoWaitTime`** (from 04-14, untouched by 04-20). It failed once in a full `Csps.Server.IntegrationTests` run (571 tests, other projects running before it) and passed alone three times and in two further full runs. The likely cause is the final assertion that the sink holds exactly five emails read right after the sixth request while the dispatcher sweeps once a second. Not investigated; out of scope for the idempotency gate (resend is exempt and unchanged). Moved to Phase 5 by the owner on 2026-10-17 (ROADMAP Phase 5 carry-over).

**Fixed in plan 05-04 (2026-10-17).** Cause: the shared sink wait in `AuthClient.WaitForEmailsAsync` gave up after 5 s of wall time, so a loaded machine that delivered the fifth email late timed out. A new fact (`TheSixthCodeIsStillRefusedWhenMailLeavesSlowly`, each email delayed 1.3 s) reproduced it deterministically. The wait now allows 30 s and still returns as soon as the mail is there; the cap, 429 code, no-Retry-After and exactly-five assertions are unchanged.
