---
phase: 02-web-foundation-design-system
lane: dotnet
created: 2026-10-13T07:12:00-05:00
updated: 2026-10-13T14:05:55-05:00
fixed_at: 2026-10-13T12:12:00Z
review_path: .planning/phases/02-web-foundation-design-system/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 02: Code Review Fix Report (lane: dotnet, NET-)

*Created: 2026-10-13T07:12:00-05:00 · Updated: 2026-10-13T14:05:55-05:00*

**Fixed at:** 2026-10-13T12:12:00Z
**Source review:** .planning/phases/02-web-foundation-design-system/02-REVIEW.md (lane detail: 02-REVIEW-lane-dotnet.md)
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (NET-WR-01..NET-WR-05; the lane has no criticals; Info findings out of scope)
- Fixed: 4
- Skipped: 1 (logged as an owner decision)
- Later: NET-WR-02 was fixed by owner ruling D-41 R2-06 in quick-261013-ihp, and NET-IN-01 (Info) was closed as "ruled: keep" (see below). The front-matter counts stay those of iteration 1.

Every fix was test-first: the new test was run and seen failing (RED) before the source change, then passing (GREEN). Each finding is one atomic commit (test and fix together).

## Fixed Issues

### NET-WR-01: An undefined `DiscountKind` is silently valued as a fixed peso amount

**Files modified:** `src/Csps.Domain/Orders/OrderMath.cs`, `src/Csps.Domain/Orders/OrderMathModels.cs`, `tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs`
**Commit:** ddd8bc3
**Applied fix:** `DiscountAmount` is now a `switch` over `Fixed` and `Percentage`, and any other value throws `ArgumentOutOfRangeException` (param `discount`, actual value the kind). The enum now starts at 1 (`Fixed = 1`, `Percentage = 2`), so an unset kind (`default`, 0) is invalid and also throws. This is safe now because nothing persists or serializes the enum yet. The golden vectors use the strings `"fixed"`/`"percentage"`, so the shared contract did not change: `web/src/lib/csps.ts` and the vector file are untouched, and `node web/scripts/gen-golden-vectors.mjs --check` passes (220 cases).
**RED evidence:** `AnUndefinedDiscountKindThrowsNamingTheDiscount` (0, 99, -1) and `TheDefaultDiscountKindIsNotAValidKind` failed 4 of 24 before the change.
**Note for Phase 5:** when the Order aggregate persists `DiscountKind`, map it explicitly (or keep the 1-based values); never let a 0 reach `OrderMath`. The browser preview (`csps.ts discountCentavos`) still treats every non-`'percentage'` type as fixed. TypeScript's union type covers this at compile time, and that file belongs to the weblib lane.

### NET-WR-03: The hidden-segment rule wraps one middleware's provider, not the web root itself

**Files modified:** `src/Csps.Server/Program.cs`, `tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs`
**Commit:** b8bda1a
**Applied fix:** right after `builder.Build()`, `app.Environment.WebRootFileProvider` is replaced by `new HiddenSegmentFileProvider(...)`. `UseStaticFiles` no longer passes its own `FileProvider`, so it uses the wrapped web root. The shell fallback (`MapFallbackToFile`), any later `UseDefaultFiles`/`UseFileServer` and any service reading `IWebHostEnvironment` now get the L-04 rule.
**RED evidence:** the new `TheHostsWebRootProviderIsTheWrapper` failed with "was PhysicalFileProvider". After the fix it also checks that `/.vite/license.md` is missing and `/assets/app-fixture.js` exists through the host's provider. All 70 HiddenSegment and SpaHost tests pass.

### NET-WR-04: Static-file responses no longer write the FND-07 request-completion event

**Files modified:** `src/Csps.Server/Program.cs`, `tests/Csps.Server.IntegrationTests/Logging/RequestLoggingTests.cs`
**Commit:** b9443c6
**Applied fix:** `UseSerilogRequestLogging` now runs right after `UseStatusCodePages`, before `UseResponseCompression` and `UseStaticFiles`. The comment now says why. `UseRouting` still follows `UseStaticFiles` (L-02 is kept).
**Decision check:** `02-CONTEXT.md` has no decision about request logging. Only the research pipeline diagram and the 02-01 plan's grep acceptance line listed request logging after `UseRouting`, and that order was incidental (the binding rule is L-02: routing after static files). FND-07 ("every request writes one completion event") governs, so the order was restored and the finding was not skipped.
**RED evidence:** the new theory `AStaticFileRequestWritesItsCompletionEvent` (`/assets/app-fixture.js`, `/robots.txt`) failed with "should have single item but had" (no event). It now finds one event with status 200 and a trace id.

### NET-WR-05: npm pins ignore `optionalDependencies`, `peerDependencies` and `bundleDependencies`

**Files modified:** `tests/Csps.ArchitectureTests/PackagePins.cs`, `tests/Csps.ArchitectureTests/DependencyRegistryTests.cs`
**Commit:** 280b8e3
**Applied fix:**
- `NpmSections` now also covers `optionalDependencies` and `peerDependencies`.
- The `bundleDependencies`/`bundledDependencies` name arrays are read. A bundled name takes its version from the section that installs it. A name that no section pins becomes a pin with an empty version, so it still meets the registry and exact-version gate. The `true`/`false` bundle-all flag adds nothing.
- Fail closed: any other top-level key ending in `dependencies` (case-insensitive, e.g. `devdependencies` or a future section) throws `InvalidDataException` naming the section and manifest. `peerDependenciesMeta` is not a dependency section.

**RED evidence:** 7 of 60 DependencyRegistryTests failed before the change, including `AnOptionalDependencyWithoutAnEntryFailsNamingIt` ("web:fsevents 2.3.3 (npm) has no registry entry"). `RepositoryRegistryCoversEveryPinWithACompleteEntry` still passes, because neither real manifest has the new sections.
**Note:** the JS-side license gate (`web/scripts/license-gate.mjs`, tooling lane) reads the installed tree, not these sections. It was not changed here.

## Skipped Issues

### NET-WR-02: `OrderMathResult.Total` is the PRD's *Subtotal*, and the PRD's net *Total* is missing

**File:** `src/Csps.Domain/Orders/OrderMathModels.cs:24-38`, `src/Csps.Domain/Orders/OrderMath.cs:37,46`
**Status:** fixed by D-41 R2-06 (owner, 2026-10-13), quick-261013-ihp. Commits c985508 (RED) and 38db727 (GREEN): the PRD §5.1 names are used in C# (`OrderMathResult(Subtotal, Discount, Total, Paid, Balance, Expenses, Profit, FullyPaid)`), in the browser preview (`web/src/lib/csps.ts` `Totals`) and in the shared golden vectors (version 2, `expected.subtotal` and `expected.total`), with Total = Subtotal − Discount, Balance = Total − Paid and Profit = Total − Expenses; every amount is unchanged. The xUnit vector loader now fails closed on a missing or unknown member. The OrderTotals panel and card read "Subtotal" and the note "Profit = Subtotal − Discount − Expenses. Internal only."; the look-equality proof stays equal through the reference-only OrderTotals and OrderCard overrides (5f467d5, 78a26ca, 63e3a21). The panel wording is awaiting the owner's before/after review (69a48f3: `npm --prefix web run review` → artifacts/owner-review/index.html, "Wording changes for you to confirm").
**Reason:** skipped as an owner decision (logged in `deferred-items.md` under "## Owner decisions pending", commit ad95a34). The rename is internal to Phase 2 code: no table, endpoint or DTO uses these names yet. But it is not purely internal to the code:
- `Totals.total` in `web/src/lib/csps.ts` is copied from the approved design's own `csps.ts` (App. D.3), which the parity reference build also loads.
- The approved `OrderTotals` block shows this before-discount figure in a row labelled "Total".

Renaming it to `subtotal` and adding a net `total` therefore raises a look/copy question: what the panel's rows are labelled, and whether a net-Total row appears. That needs a D-08 before/after from the owner. The same field drives the "fully paid" rule (NET-IN-01). The logged question gives the owner two options: follow the PRD naming in C#, TS and the vectors together, or record the design naming as a deliberate PRD deviation. It also notes that this must be settled before Phase 5 builds order DTOs and the reconciliation report.
**Original issue:** PRD §5.1 defines Subtotal = Σ line totals, Total = Subtotal − Discount. `OrderMathResult.Total` is the pre-discount items total, and no field holds the net total, so a later phase could map the wrong figure to the ORD-01/ORD-07 "Total" or the reconciliation report.

## Info findings closed by owner ruling

- **NET-IN-01** (a 100%-discounted, unpaid order reads "Fully Paid"): closed, **ruled: keep** (D-41 R2-06, owner, 2026-10-13). FullyPaid stays Subtotal > 0 and Balance ≤ 0, so a fully discounted order with no payment is fully paid and an empty order is not. The rule is written in the `OrderMathResult.FullyPaid` XML doc and pinned by tests in the oracle, C# (`AHundredPercentDiscountWithNoPaymentIsFullyPaid`) and TS (quick-261013-ihp, 38db727).

## Verification

All gates ran in the **main checkout** (`C:/Work/CarmensStitchAndPrintingServices`, branch `gsd/phase-2-web-foundation-design-system`; `workflow.use_worktrees` handling was overridden by the orchestrator's sequential-on-main-tree instruction, so no worktree was created). Shared-machine preflight was clear (ports 5180/5115/7028/5199 free, no other-project test processes) before the test runs.

- `dotnet build Csps.slnx -tl:off --no-incremental`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: 906 total, 906 passed, 0 failed, 0 skipped (Domain, Application, Architecture, Infrastructure integration, Server integration).
- `dotnet format Csps.slnx --verify-no-changes`: clean.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (325/325), branch 100% (142/142); Csps.Application line 100% (38/38). PASS.
- `node web/scripts/gen-golden-vectors.mjs --check`: matches the oracle (220 cases).
- `npm --prefix web run verify` was not run, because no web file and no shared-math contract changed (`csps.ts` and the vector file are untouched).

---

_Fixed: 2026-10-13T12:12:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
