<!-- Created: 2026-10-15T22:39:00-05:00 · Updated: 2026-10-15T22:39:00-05:00 -->
## Summary

What changed and why, in plain words.

Title: use Conventional Commits, in the form `type(scope): summary` (for example `feat(03-05): add the PR template`).

## Requirements

The requirement IDs this PR covers (for example OPS-01).

## Definition of Done

Tick every item before merging. An item that does not apply is ticked with "N/A" and a reason. The merge gate refuses any unticked item.

- [ ] Requirements (by ID) are implemented and traced in the SUMMARY coverage.
- [ ] Tests were written first and pass (unit, integration and E2E for the slice), and the coverage gates are met.
- [ ] Zero warnings in the compiler, analyzers, lint, types, tests, build and browser console.
- [ ] Architecture tests pass, with no layer violations.
- [ ] Matches CSPS-UI-SPEC.md at 320, 768 and 1280 px with screenshots attached; skeletons for every loading state; images lazy and optimized.
- [ ] Responsive at every breakpoint, portrait and landscape; performance budgets and Lighthouse scores met; no bundle-size regressions.
- [ ] API calls go through the module services and the shared core/api client; no axios; shared components reused.
- [ ] WCAG 2.2 AA: axe reports zero violations and the keyboard pass is done.
- [ ] Security: the relevant CWE rows are mitigated and tested, the authorization matrix is updated, no secrets are committed, and .NET analyzers and ESLint clean (CodeQL is not available on the free private repo, D-10).
- [ ] Comments are short and purposeful; no dead code; no unexplained suppressions.
- [ ] Production data is untouched; migrations are reviewed and reversible where possible.
- [ ] /gsd-secure-phase, /gsd-ui-review and /gsd-verify-work were completed before /gsd-ship.

## Local full gate

Fill this in only when the free CI minutes are used up (D-16). Run the five commands on your machine and paste each one's output with its exit code, for example "exit 0". Leave this section as it is when CI ran.

- `dotnet build Csps.slnx` : exit code and output
- `dotnet test --solution Csps.slnx` : exit code and output
- `tools/scripts/Invoke-CoverageGate.ps1` : exit code and output
- `npm --prefix web run verify` : exit code and output
- `npm --prefix web run e2e` : exit code and output
