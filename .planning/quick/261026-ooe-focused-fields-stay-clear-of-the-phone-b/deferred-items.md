---
created: 2026-10-26T20:20:00-05:00
updated: 2026-10-26T20:20:00-05:00
---

# Quick 261026-ooe: deferred items (out of scope)

Found while running the e2e and verify gates. None is caused by this change.

## 1. WebKit and iPhone: the audit log "Done to" list loads slower than the 5 s expect timeout

- Tests: `audit-log.spec.ts` `@audit a Manager edits an expense amount and payer, then finds both entries ...` (webkit, iphone) and `@audit the Edit User panel links to the log filtered to that person ...` (webkit, iphone).
- Symptom: `getByLabel('Done to')` is still `disabled` after 5 s (the people list is still loading), or its value is not yet the person.
- Proof it is not this change: the same four tests fail the same way on the base code (`a8c408bf` admin recipe and audit-log spec with the old workarounds restored), and all four pass in webkit and iphone with the workarounds removed and a temporary 30 s expect timeout (config reverted, nothing committed).
- Likely cause: the shared `CSPS_E2E` database keeps growing (every test makes a staff user), so the people list is large and WebKit is slow to fill the select.
- Suggested follow-up: a separate quick task to measure the people list and either page it, trim old e2e staff, or wait for the select with an explicit longer timeout in these specs (the owner decides).

## 1b. Other e2e tests that fail the same way on the base code (19 test runs)

Run on the base code (`a8c408bf`, this change's source, specs, scripts and config checked out temporarily and put back), the same tests failed as on this change. Causes seen in their errors:

- `@expenses-list` and `@expenses-kpis` in all five projects: the shared `CSPS_E2E` database now holds more than 999 expenses, so the page shows `1,994 expenses` and `1,927 entries so far` (with a thousands comma) while the specs compare `String(total)` (`1994 expense`, `1927 entries so far`). A formatting assumption in the specs, not a page bug.
- `@target-size` Users page (chromium): `controls checked` is 10, the spec wants more than 10.
- `@audit` Done to specs (firefox, iphone, webkit), `@expenses-add` (firefox): see item 1 (slow people list, dialogs slow to close).
- `/dev/components` pages on WebKit and iPhone (`@shell` no sideways scroll, `@shell` sidebar and top bar pinned at 1440x900, `@a11y-rulings` D-05 light, `@showcase` 1920 px, `@expenses-sweep` 1440 px): the heading or content is not there within 5 s, or the 240 s test timeout runs out; the showcase page is heavy under load.

Four more failed once in the full run and again in the first rerun but passed on the base code and passed alone on this change (`@expenses-edit` firefox, `@long-text` four-chip firefox, `@a11y-rulings` D-02 iphone, `@shell` pinned 1024x768 iphone): load flakes.

## 2. `useUsersListParams.test.tsx` once failed in a loaded full unit run

- Test: `src/modules/admin/hooks/useUsersListParams.test.tsx` line 201 (`history: 'replace'` expectation, a debounce timing check).
- Seen once in the first `npm --prefix web run verify` (the run took 302 s). Passed alone 4 of 4 times afterwards and in the second full run (see the SUMMARY). Recorded as a load-sensitive flake, not changed.
