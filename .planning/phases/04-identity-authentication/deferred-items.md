---
created: "2026-10-15T03:31:00-05:00"
updated: "2026-10-15T03:31:00-05:00"
---

# Deferred items (phase 04)

## 04-20

- **Flaky `ResendCodeEndpointTests.TheSixthCodeInAnHourIsRefusedWithNoWaitTime`** (from 04-14, untouched by 04-20). It failed once in a full `Csps.Server.IntegrationTests` run (571 tests, other projects running before it) and passed alone three times and in two further full runs. The likely cause is the final assertion that the sink holds exactly five emails read right after the sixth request while the dispatcher sweeps once a second. Not investigated; out of scope for the idempotency gate (resend is exempt and unchanged).
