---
created: 2026-10-20T06:05:00-05:00
updated: 2026-10-20T06:05:00-05:00
phase: quick-261020-pr10
plan: 01
status: complete
key-files:
  modified:
    - tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs
    - tools/openapi-gen/openapi.v1.json
    - docs/CSPS-UI-SPEC.md (moved from the repo root)
    - web/visual/reference/extract-spec.mjs
    - web/visual/reference/extract-spec.test.ts
---

# Quick 261020-pr10: Fix PR #10 CI and move the UI spec

- **CI fix:** `OpenApiSnapshotTests` now stores text with LF, so a snapshot written on Windows matches Linux CI. New test `LineEndingsInsideTextAreNotDifferencesAndAreWrittenAsLf` failed first, then passed. The snapshot was rewritten; the generated web types did not change.
- **Ruling (owner, 2026-10-20):** the UI spec stays tracked and lives at `docs/CSPS-UI-SPEC.md`. The extract script, its test, `.claude/CLAUDE.md`, the PRD and the PR template point to the new path.
- **Checks run:** integration tests 1051 passed; architecture tests 217 passed; web `visual/reference` tests 96 passed; `npm --prefix tools/openapi-gen run check` matched.
