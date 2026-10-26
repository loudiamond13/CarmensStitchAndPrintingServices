---
status: resolved
trigger: "CompanyExpenseListQueryCountTests.ThePageSizeDoesNotChangeTheNumberOfSqlCommands fails in about 2 of 3 full Server integration runs (large.Count 4 vs expected 3); TheKpisRunTheSameNumberOfSqlCommandsEachTime failed once the same way. Both pass alone."
goal: find_and_fix
created: 2026-10-25T22:20:00-05:00
updated: 2026-10-26T05:52:00-05:00
---

# Debug: expense list command count flake

## Current Focus

known_pattern_candidate: none (knowledge-base.md does not exist; MemPalace not available in this session, skipped)
bug_class: Heisenbug (timing-dependent: a 1 Hz background sweep overlapping a measured window). SBFL skipped: flaky spectrum.
hypothesis: CONFIRMED. The counter was host-wide, so the EmailDispatcher's 1 Hz EmailOutbox read on the same host was counted whenever it landed inside a measured request window. Longer windows under full-suite load made it likely.
test: done (stress loop alone and under a full run, deterministic RED test, fix, mutation check, three full runs).
expecting: n/a
next_action: Owner confirms (away mode: parked for review). After that, move this file to resolved/ and add the knowledge-base entry.

reasoning_checkpoint:
  hypothesis: "The expense count tests see one extra command because CommandCounter counts every CspsDbContext command on the host (AddDbContextFactory shares the options the test's ConfigureDbContext adds to), and the test host runs EmailDispatcher with a 1 s sweep that queries EmailOutbox from its own background flow."
  confirming_evidence:
    - "TempStress alone: 3 of 400 windows counted 4; each extra command is the EmailOutbox SELECT, about 1.05 s apart, matching SweepInterval 00:00:01."
    - "TempStress inside a full run: 6 of 400 windows counted 4, every extra one the same EmailOutbox SELECT; no other extra command."
    - "CspsApiFactory sets Email:Dispatcher:Enabled=true and SweepInterval=00:00:01 for every database host; the counting host is one of them."
  falsification_test: "A count test failing with an extra command that is not the EmailOutbox SELECT, or the stress loop still showing odd windows once only the request's own flow is counted."
  fix_rationale: "Count only the commands that run in the measured request's own async flow (AsyncLocal scope in CommandCounter plus TestServer.PreserveExecutionContext on the counting host). The dispatcher's flow was captured at host start, so its read is never in the scope, while every command the list request runs still is. The assertion stays exact equality."
  blind_spots: "HybridCache may run a cache-miss factory outside the request flow, so a miss would no longer be counted; misses do not depend on page size, and the caches are warmed first. Other future background services are covered by the same scoping."
  candidate_causes:
    - "code: host-wide counter scope in the test rig (CommandCounter had no notion of which request ran a command)"
    - "config: test host enables the email dispatcher with a 1 s sweep (CspsApiFactory)"
    - "environment: full-suite CPU and LocalDB load lengthens each measured window, raising the overlap chance from about 1 percent to most runs"
    - "data: none found (seeded rows identical per run; page size only changes Take)"
  and_gate: "yes: the failure needs the host-wide counter AND a background command on the same host inside the window; load only raises the odds. Fixing the counter scope removes the AND-gate without touching production or the dispatcher."

## Symptoms

expected: The list endpoint runs the same number of SQL commands at pageSize=10 and pageSize=100; the KPI route runs the same number each call.
actual: Under a full Server integration run, one of the two measured calls counts one extra command (06-13 saw small 4 vs large 3; the latest report is large 4 vs 3). The KPI test failed once the same way.
errors: Shouldly "large.Count should be 3 but was 4" (and the reverse in 06-13).
reproduction: Full Server integration project run (dotnet test tests/Csps.Server.IntegrationTests); about 2 of 3 runs fail. Alone it always passes.
started: Seen since 06-08 (KPI test once), then 06-13 (list test 2 of 3 runs).

## Eliminated

- hypothesis: A cached read (session cache 60 s, site settings or calendar 1 h) expires between the two measured calls.
  evidence: The lifetimes are far longer than the gap between the calls, and the instrumented full run showed no UserSessions or SiteSettings command in any odd window.
  timestamp: 2026-10-25T22:36:00-05:00

- hypothesis: The idempotency or claim-row purge (06-21) runs inside the measured GET.
  evidence: IdempotencyGate purges only on the write path; no purge command appeared in any odd window.
  timestamp: 2026-10-25T22:36:00-05:00

- hypothesis: A first-request warm-up command or shared static state across test classes.
  evidence: Both tests warm up before measuring; each rig has its own CommandCounter instance and hosts. The extra command shows up mid-loop (iterations 82, 240, 391), not on the first call.
  timestamp: 2026-10-25T22:36:00-05:00

## Evidence

- timestamp: 2026-10-25T22:22:00-05:00
  checked: CspsApiFactory.ConfigureWebHost
  found: Every database-backed test host sets Email:Dispatcher:Enabled=true and Email:Dispatcher:SweepInterval=00:00:01.
  implication: An EmailDispatcher BackgroundService queries EmailOutbox once a second on the counting host.

- timestamp: 2026-10-25T22:23:00-05:00
  checked: DependencyInjection.AddCspsPersistence and EmailDispatcher
  found: CspsDbContext is registered with AddDbContextFactory (singleton options shared by the scoped context and the factory). The dispatcher, SessionCache and SiteSettings reads create contexts from that factory. The test adds the counter with ConfigureDbContext, which applies to those same options.
  implication: The counter sees every command on the host, not only the request under test. Any background command inside a measured window is counted.

- timestamp: 2026-10-25T22:24:00-05:00
  checked: ListCompanyExpensesHandler, SessionCache (60 s), SiteSettingsReader (1 h), IdempotencyGate purge (write path only)
  found: The list request runs reader (2) plus staff state (1) = 3 once caches are warm.
  implication: The 1 Hz dispatcher is the prime suspect.

- timestamp: 2026-10-25T22:28:00-05:00
  checked: Temporary TempStress test (400 measured list calls alone, CommandCounter temporarily logging command text, time and thread)
  found: 3 of 400 windows counted 4 in 2.7 s (iterations 82, 240, 391, about 1.05 s apart). In each the extra command is "SELECT TOP(@p) [e].[Id], [e].[Attempts], ... FROM [EmailOutbox]" (the dispatcher sweep), twice on a thread other than the request's.
  implication: The dispatcher read is counted when it lands in a window. Windows are about 7 ms alone (about 1.4 percent chance per two-window test) and longer under full-suite load, which explains "fails in full runs, passes alone".

- timestamp: 2026-10-25T22:34:00-05:00
  checked: Full Server integration run with the temporary log (total 1316, failed 1: only TempStress; the two real count tests happened to pass this run)
  found: Under load the windows stretch to about 28 ms and TempStress saw 6 odd windows in 5.7 s. Every extra command is the dispatcher's outbox SELECT; no other extra command appeared.
  implication: The dispatcher read is the only extra source seen. Root cause confirmed.

- timestamp: 2026-10-25T22:38:00-05:00
  checked: New test AnEmailSweepDuringTheRequestIsNotCounted with the old host-wide count (RED)
  found: Fails twice in a row: "held.Count should be 3 but was 4"; the listed extra command is the EmailOutbox SELECT.
  implication: Deterministic reproduction of the root cause, failing for the right reason.

- timestamp: 2026-10-25T22:42:00-05:00
  checked: Fix applied (CommandCounter.MeasureAsync with an AsyncLocal scope; rig sets TestServer.PreserveExecutionContext)
  found: Class alone 4/4. Mutation (PreserveExecutionContext false) fails all three count tests on "the counter must be attached". Temporary 400-window stress loop: every window exactly 3, with dispatcher reads seen host-wide during the loop.
  implication: The scoped count leaves out the background read and still sees every command of the request.

## Resolution

root_cause: "The count tests measured host-wide: CommandCounter is added with ConfigureDbContext to the options AddDbContextFactory shares, so it sees every CspsDbContext command on the host. The test host runs EmailDispatcher with a 1 s sweep (CspsApiFactory), and its EmailOutbox SELECT counted as one more command whenever it landed inside a measured window; full-suite load lengthens the windows, so it happened in most full runs."
fix: "CommandCounter.MeasureAsync counts only the commands in the measured work's own async flow (AsyncLocal scope), and the rig sets TestServer.PreserveExecutionContext so each request runs in that flow. The dispatcher's flow was captured at host start, so its read is never counted. Count and Reset keep their host-wide meaning. New test AnEmailSweepDuringTheRequestIsNotCounted holds a window open across a real dispatcher read. Assertions stay exact equality; failures now list the commands. No production code changed."
oracle_type: specified (equal command counts across page sizes and repeated KPI calls; exact 3 per window in the stress check)
verification:
  - "RED: AnEmailSweepDuringTheRequestIsNotCounted failed twice with the old count (held 4 vs 3)."
  - "Mutation at the fix site (PreserveExecutionContext false): 3 of 4 class tests fail on the attached-counter guard."
  - "Alone: ThePageSizeDoesNotChangeTheNumberOfSqlCommands 1/1, TheKpisRunTheSameNumberOfSqlCommandsEachTime 1/1, class 4/4; CompanyExpenseReaderQueryCountTests 7/7."
  - "Full Server integration runs: total 1316 failed 0, three times (3m 58s, 3m 57s, 3m 57s)."
  - "Architecture tests 241/241; dotnet build Csps.slnx --no-incremental 0 warnings 0 errors; dotnet format --verify-no-changes exit 0."
guardrail_verdict: accepted
files_changed: [tests/Csps.Testing/CommandCounter.cs, tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseListQueryCountTests.cs, .planning/phases/06-company-expenses/deferred-items.md]
