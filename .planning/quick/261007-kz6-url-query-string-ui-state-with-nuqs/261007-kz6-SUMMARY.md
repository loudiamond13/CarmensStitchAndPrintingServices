---
created: 2026-10-07T15:55:10-05:00
updated: 2026-10-07T15:55:10-05:00
phase: quick-261007-kz6
plan: 01
status: complete
subsystem: planning-docs
tags: [requirements, roadmap, nuqs, url-state, dependency-registry]
requires: []
provides:
  - "WEB-10 (Phase 2): URL query-string list state through nuqs 2.10.1"
  - "ROADMAP Phase 2 criterion 6 (URL state) and the Definition-of-Done URL-state bullet"
  - "nuqs recorded as an approved, planned dependency (STACK.md, docs/dependencies.json planned + approvals, docs/dependencies.md)"
affects: [phase-2, phase-5, phase-6, phase-8, phase-10, phase-11, phase-12, phase-13]
tech-stack:
  added: []
  patterns: ["planned dependencies live in a top-level `planned` array in docs/dependencies.json until the installing phase pins them"]
key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
    - .planning/research/STACK.md
    - docs/dependencies.json
    - docs/dependencies.md
decisions:
  - "Owner approved nuqs 2.10.1 (MIT) on 2026-10-07; any other version (e.g. a stable 2.10.2) needs a new owner approval at the Phase 2 install"
  - "Free-text search goes in the URL (owner choice), mitigated by query-free analytics (ANL-05), the server 100-character search cap (SEC-03), FND-07 log omission and SEC-01 Referrer-Policy"
  - "The public Gallery keeps its category in the URL; NuqsAdapter sits in a shared lazily loaded layout route around Outlet, root Outlet as fallback"
  - "Registry option (a): nuqs in a new top-level `planned` array plus an `approvals` entry, never in `packages`"
metrics:
  duration: "about 6 minutes"
  completed: 2026-10-07
actuals:
  tokens: 4350
  tasks: 3
  commits: 3
plan_head_before: 49ca74d88894accb42b77cda75f175a7e094adb4
plan_head_after: 415c7cb
---

# Quick 261007-kz6 Plan 01: URL query-string UI state with nuqs Summary

*Created: 2026-10-07T15:55:10-05:00 · Updated: 2026-10-07T15:55:10-05:00*

The owner's request ("Also i want query string url, use nuqs to achieve it.") and three locked answers are now one traced Phase 2 requirement (WEB-10), with nuqs 2.10.1 recorded as an approved, planned dependency. WEB-10 covers adapter placement, the hook and parser conventions, the three bug-avoidance rules, the privacy mitigations and the tests.

## What changed

**New requirement**
- **WEB-10 → Phase 2.** It has a Traceability row `| WEB-10 | Phase 2 | Pending |`, and the counts are now 180 total and 180 mapped.

**Amended requirements (append-only; the old text, checkboxes and flags are byte-identical)**
- **ORD-10 (precedence):** the URL `view` wins when valid, then `localStorage['csps-orders-view']`, then Grid. Only the explicit toggle writes both.
- **URL references (WEB-10):** USER-01, AUDIT-02 (the actor filter holds the user id, never an email), CEXP-01 (the 30-day default counts from the business "today"), ORD-02, ORD-07, DASH-03, MONEY-02, GAL-01 (owner decision 3), INQ-05 (inserted before its `⚑ C-36` flag) and ANL-08.
- **ANL-05 (query stripping):** the client sends `location.pathname` only, and the server cuts a reported path at the first `?` or `#`. This also applies to ANL-06.
- **SEC-03 (search cap):** list endpoints cap free-text search at 100 characters and reject longer text with a 400 field error.

**ROADMAP.md**
- WEB-10 is on the Phase 2 `**Requirements**:` line.
- Phase 2 has a new success criterion 6, "URL state".
- The Definition of Done has a new bullet: "every list page keeps its filters, search, sort and page in the URL via the shared WEB-10 parsers".
- Coverage reads "All 180", the Phase 2 row is `WEB-01…WEB-10 … | 20 |`, and the Total row is 180.
- The footer and the timestamp line were updated.
- The Progress table, Plans lines, phase checkboxes and the Phase 1 section were not touched.

**PROJECT.md**
- One Key Decisions row records the owner's three nuqs answers (2026-10-07).
- The footer and the timestamp line were updated.

**Registry (option a)**
- `docs/dependencies.json`: the owner approval is a third object in `approvals`, and nuqs sits in a new top-level `planned` array. `packages` is unchanged.
- `docs/dependencies.md`: a plain-words "Planned (not yet installed)" section that says what MIT means (free).
- `.planning/research/STACK.md`: nuqs 2.10.1 appears in the runtime table, the `npm i` line, the Version Compatibility table and What NOT to Use.
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"` passed 31 of 31 after a clean preflight (ports free, no TheBETSLLC test processes).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (tracer) | 06eb504 | WEB-10, traceability, counts 180, ROADMAP Phase 2 line and criterion 6, DoD bullet, coverage, PROJECT Key Decisions row, timestamps |
| 2 | 54d6d9a | ORD-10 precedence; WEB-10 references on 10 list requirements; ANL-05; SEC-03; footers; refreshed `Updated:` |
| 3 | 415c7cb | STACK.md nuqs rows; dependencies.json approval + `planned`; dependencies.md planned section |

## Verification

| Check | Result |
|-------|--------|
| Check A | `OK 180` |
| Check B | `OK 19 flagged ODs` |
| Check C | `OK Phase 1 untouched` |
| Check D | `OK lines preserved` (FND lines needed no exemption, because no concurrent FND change appeared) |
| Check T | `OK timestamps 5` |
| Registry docs check | `OK registry docs` |
| Guard (`sha256sum -c`) | Passed after Task 3. CLAUDE.md, .claude/CLAUDE.md, CSPS-PRD.md and CSPS-UI-SPEC.md are unchanged. The temp files were then removed. |
| DependencyRegistryTests | 31 passed, 0 failed |

## Deviations from Plan

**1. [Rule 3 - Blocking] `$TMPDIR` was unset inside a `bash script.sh` child shell.** The verify blocks were run from scratchpad script files. In those child shells `$TMPDIR` resolved to empty, so the first run's `test -s "$TMPDIR/…"` failed. The fix was `export TMPDIR=/c/Users/<user>/AppData/Local/Temp` at the top of each script, the same directory the guard files were written to. No repo file was affected.

The content changes were made exactly as the Content Spec wrote them.

## Follow-ups (for later work)

- `CSPS-PRD.md` (§2 stack, §9 frontend standards), `CSPS-UI-SPEC.md` (list toolbars, Orders view persistence) and the stack summary in `CLAUDE.md` / `.claude/CLAUDE.md` still need to mention nuqs and URL state. This task did not edit them.
- Phase 2 must:
  - recheck for a stable nuqs 2.10.2 or later that is at least 14 days old, and ask the owner before switching
  - add `"npm"` to the registry `Kinds` and read the pins in `web/package.json`
  - move nuqs from `planned` into `packages`
  - confirm zero React Compiler diagnostics on the hooks (research assumption A2)
  - confirm the nested adapter placement works, or fall back to the root route (A3)

## Known Stubs

None. This was a docs-only task.

## Self-Check: PASSED

- All six modified files exist, and each one appears in `git diff --stat 49ca74d HEAD`.
- Commits 06eb504, 54d6d9a and 415c7cb all exist on `gsd/phase-1-hosting-verification-backend-foundation`.
- `git rev-list --count 49ca74d..HEAD` = 3.
