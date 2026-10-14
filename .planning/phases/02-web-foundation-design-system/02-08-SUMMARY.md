---
phase: 02-web-foundation-design-system
plan: 08
subsystem: web-formatting
tags: [intl, date-formatting, time-zone, asia-manila, money-input, centavos, vitest, tdd, ord-09]
created: "2026-10-08T11:53:00-05:00"
updated: "2026-10-08T11:53:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "npm run verify (typecheck, strict type-aware lint, Prettier, Vitest with coverage under the console guard, build), JUnit output for RED evidence"
  - phase: 02-web-foundation-design-system (plan 02-07)
    provides: "web/src/lib/csps.ts formatPeso (centavo-exact) and formatDate (App. D.1); format.ts does not touch or re-export them"
provides:
  - "web/src/lib/format.ts: BUSINESS_ZONE ('Asia/Manila'), formatBusinessDate(utcIso, zone = BUSINESS_ZONE), formatCalendarDate(ymd)"
  - "web/src/lib/format.ts: MONEY_TEXT (/^\\d{0,9}(\\.\\d{0,2})?$/, no flags), isMoneyText, normalizePastedMoney, padMoneyOnBlur, moneyTextToCentavos, centavosToMoneyText"
  - "web/src/lib/format.test.ts: 112 tests, format.ts at 100% statements/branches/functions/lines"
affects: [02-money-input, 02-showcase, phase-06-company-expenses, phase-07-orders-domain, phase-08-order-screens, ord-09]

actuals:
  tokens: 3600    # chars/4 over the realized diff (14,474 chars, 2 files)
  tasks: 2
  commits: 4
plan_head_before: b11b05193f7427c857ebe5fb395afa0b4cd5db9e
plan_head_after: 9983301c5f4717049352141d0e212f2e8264a413

tech-stack:
  added: []
  patterns:
    - "Instants from the API format with an explicit zone through one cached Intl.DateTimeFormat per zone; calendar dates format in UTC after a Date.UTC round-trip check, so the machine zone never moves the day"
    - "Machine-zone independence is tested by vi.stubEnv('TZ', zone) plus an assertion that the process zone really changed, with afterEach(vi.unstubAllEnvs)"
    - "Money entry stays text; centavos come from the integer and fraction digit strings (Number on at most 11 digits), never from a float"

key-files:
  created:
    - web/src/lib/format.ts
    - web/src/lib/format.test.ts
  modified: []

key-decisions:
  - "formatBusinessDate accepts only an RFC 3339 instant with Z or an offset (uppercase T/Z, up to 9 fractional digits for .NET's 7) and real calendar/clock parts; zone-less text, a bare date, Feb 30 or 24:00 give an em dash, because the browser would read them in the machine zone or roll them over"
  - "An unknown zone passed to formatBusinessDate throws a RangeError (a settings bug), it is not hidden as an em dash"
  - "'' and '.' count as money text (partial typing states), pad to '' on blur and throw TypeError('empty amount') in moneyTextToCentavos; invalid text throws TypeError('not an amount')"
  - "padMoneyOnBlur returns invalid text unchanged so the field can show its error; normalizePastedMoney does not strip the peso sign (the spec names only commas and spaces)"
  - "centavosToMoneyText throws a RangeError outside 0..99999999999 (negative, fractional, NaN, Infinity, more than 9 integer digits), so its output always satisfies MONEY_TEXT and round-trips"

patterns-established:
  - "format.ts is the single home for zone-aware dates and money-entry text; money display stays formatPeso in @/lib/csps"

requirements-completed: [ORD-09]

coverage:
  - id: D1
    description: "formatBusinessDate('2026-10-05T16:30:00Z') is 'Oct 6, 2026' and '2026-12-31T16:00:00Z' is 'Jan 1, 2027' on machines in America/Chicago, Pacific/Kiritimati and Pacific/Pago_Pago; invalid or zone-less input is an em dash"
    requirement: ORD-09
    verification:
      - kind: unit
        ref: "web/src/lib/format.test.ts#formatBusinessDate"
        status: pass
    human_judgment: false
  - id: D2
    description: "formatCalendarDate('2026-10-06') is 'Oct 6, 2026' with no zone shift; impossible dates (2026-02-30, 2026-02-29, month 13) are an em dash"
    requirement: ORD-09
    verification:
      - kind: unit
        ref: "web/src/lib/format.test.ts#formatCalendarDate"
        status: pass
    human_judgment: false
  - id: D3
    description: "Money text rules: MONEY_TEXT/isMoneyText accept and reject per the spec, normalizePastedMoney(' 12,450.00 ') is '12450.00', padMoneyOnBlur('5000') is '5000.00' and '' stays ''"
    requirement: ORD-09
    verification:
      - kind: unit
        ref: "web/src/lib/format.test.ts#isMoneyText, normalizePastedMoney, padMoneyOnBlur"
        status: pass
    human_judgment: false
  - id: D4
    description: "moneyTextToCentavos('0.07') is 7 and ('999999999.99') is 99999999999 exactly; centavosToMoneyText(125050) is '1250.50'; every amount 0..10000 centavos round-trips"
    requirement: ORD-09
    verification:
      - kind: unit
        ref: "web/src/lib/format.test.ts#moneyTextToCentavos, centavosToMoneyText"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0, 703 tests)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 08: Business-Zone Dates and Exact Money Text Summary

**`web/src/lib/format.ts` shows API instants as the Asia/Manila calendar date ("Oct 6, 2026") on any machine, shows plain YYYY-MM-DD dates with no shift, and gives MoneyInput an allow-list pattern, paste and blur rules, and exact integer text-to-centavos conversion.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-08T16:45:51Z
- **Completed:** 2026-10-08T16:52:14Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments

- `formatBusinessDate(utcIso, zone = BUSINESS_ZONE)` formats with a cached `Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })` per zone. Tests run it with the process zone stubbed to America/Chicago, Pacific/Kiritimati (UTC+14) and Pacific/Pago_Pago (UTC−11), and they check that the stub took effect. The year-boundary case ("Jan 1, 2027") passes.
- `formatCalendarDate(ymd)` checks YYYY-MM-DD by round-tripping the parts through `Date.UTC` and formats in UTC, so 2026-10-06 is "Oct 6, 2026" in every machine zone.
- MoneyInput rules: `MONEY_TEXT`, `isMoneyText`, `normalizePastedMoney`, `padMoneyOnBlur`, and `moneyTextToCentavos` / `centavosToMoneyText`. Conversion uses the digit strings, so 0.29 and 1.15 (float traps) come out as exactly 29 and 115.
- format.ts has 100% coverage in every column. `npm --prefix web run verify` exits 0 (703 tests).

## Task Commits

1. **Task 1 (tracer): a UTC instant from the API shows as the Manila business date**
   - RED `77af656` (test): 36 tests against an inert stub, 35 assertion failures, `RED_EVIDENCE_OK`
   - GREEN `8678ec1` (feat)
   - Tracer gate: interactive, `end-of-phase`, automated-only verify. I re-ran the verify (36/36 passed) and went on to Task 2. No checkpoint was needed.
2. **Task 2: exact money-text rules for entry, paste, blur padding and centavo conversion**
   - RED `8e3746c` (test): 112 tests, 52 assertion failures against inert money stubs, `RED_EVIDENCE_OK`
   - GREEN `9983301` (feat)

No refactor commit was needed.

## Files Created/Modified

- `web/src/lib/format.ts`: business-zone and calendar date formatting and money-entry text rules (ORD-09)
- `web/src/lib/format.test.ts`: 112 Vitest cases, including machine-zone stubs, the year boundary, impossible dates, the accept/reject table, paste and blur cases, float traps and round trips

## Decisions Made

See `key-decisions` in the frontmatter. The two with the most effect on callers:

- `formatBusinessDate` is strict: only a timestamp with `Z` or an offset is accepted. Anything else shows "—" instead of a date that depends on the machine. Callers with a plain business date use `formatCalendarDate`.
- `''` and `'.'` count as valid partial input but are "empty amounts". MoneyInput has to show "Enter an amount." for them (UI-SPEC copy) before it converts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] formatBusinessDate refuses zone-less and rolled-over timestamps**
- **Found during:** Task 1 (GREEN design)
- **Issue:** The research snippet passes any string to `new Date()`. A timestamp without a zone designator (`2026-10-05T16:30:00`) is read in the machine's zone, which breaks the "independent of the machine's zone" must-have. V8 also rolls impossible parts over: `2026-02-30T00:00:00Z` turns into Mar 2, and `24:00` into the next day.
- **Fix:** The input must match an RFC 3339 instant with `Z` or `±hh:mm`, and its date parts must name a real day. Anything else gives "—". Up to 9 fractional digits are accepted, so the 7 digits System.Text.Json writes still parse. A test covers this.
- **Files modified:** `web/src/lib/format.ts`, `web/src/lib/format.test.ts`
- **Verification:** 8 em-dash cases and 2 offset/fraction cases in `format.test.ts`
- **Committed in:** `77af656` (tests), `8678ec1` (implementation)

**2. [Rule 2 - Missing critical] centavosToMoneyText has an upper bound**
- **Found during:** Task 2
- **Issue:** The plan only says negatives throw. An amount over 99,999,999,999 centavos would produce text that breaks MONEY_TEXT, so the round trip would fail without any error.
- **Fix:** It throws a RangeError for anything that is not a whole number from 0 to 99999999999 (negative, fractional, NaN, Infinity, too large).
- **Committed in:** `8e3746c`, `9983301`

### Plan-text adjustments (no behaviour impact)

- **The RED stubs avoid `void param`.** typescript-eslint's `no-meaningless-void-operator` rejects that form, so the inert stubs read their parameters through `.slice(0, 0)` and similar expressions. They still return `''`/`false`/`0`, and every RED failure was an assertion.

---

**Total deviations:** 2 auto-fixed (both Rule 2), plus 1 plan-text adjustment.
**Impact on plan:** Every must-have holds. Both fixes only tighten input validation. No package changed and no lint rule was disabled.

## Issues Encountered

- The coverage table printed no per-file row for format.ts because every column was 100% (the text reporter skips full rows). The summary lines show 100% statements, branches, functions and lines.
- Web branch coverage overall is 99.18%. The one uncovered branch is the existing `?? ''` in csps.ts `formatDate` (noted in 02-07), not this plan's code.

## Known Stubs

None.

## Notes for Later Plans

- **MoneyInput (ORD-09 primitive):** ignore a keystroke when `!isMoneyText(next)`. On paste, use `normalizePastedMoney`; an empty result means "reject the paste". On blur, use `padMoneyOnBlur`. Before converting, map `''`/`'.'` to "Enter an amount." and invalid text to "Enter an amount like 1250.50 (numbers only, up to 2 decimals)." Only then call `moneyTextToCentavos`, which throws on both.
- **Dates:** use `formatBusinessDate` for API instants (createdAt and similar) and `formatCalendarDate` for date-only fields (orderDate, dueDate). csps.ts `formatDate` (App. D.1) reads date-only strings as local midnight and is kept for spec parity. New screens should prefer the format.ts functions.
- **SiteSettings zone (later):** pass the Manager-set zone as the second argument. An invalid zone throws a RangeError, so validate it on the server.

## TDD Gate Compliance

- Task 1: RED `77af656` comes before GREEN `8678ec1` (`RED_EVIDENCE_OK`, target `src/lib/format.test.ts`, 35/36 failing on assertions).
- Task 2: RED `8e3746c` comes before GREEN `9983301` (`RED_EVIDENCE_OK`, target `src/lib/format.test.ts`, 52/112 failing on assertions).
- No refactor commits were needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved, and `web/package.json` / `web/package-lock.json` are unchanged.

## Threat Mitigations

- **T-02-21 (CWE-20):** MONEY_TEXT allow-list with no flags, so `test()` is stateless. Minus signs (ASCII and U+2212), signs, exponents, grouping and non-ASCII digits are rejected, and conversion is exact integer arithmetic.
- **T-02-22:** formatting uses the business zone, with tests across the year boundary and the minute before midnight.
- **T-02-SC:** no installs.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- ORD-09's formatter and money-text contract is in place for MoneyInput and every date display.
- Ready for the next Phase 2 plan.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- `web/src/lib/format.ts` and `web/src/lib/format.test.ts` exist.
- Commits `77af656`, `8678ec1`, `8e3746c` and `9983301` are on `gsd/phase-2-web-foundation-design-system`.
- Acceptance criteria re-run: `grep -c "Asia/Manila" web/src/lib/format.ts` = 1, `grep -c "parseFloat" web/src/lib/format.ts` = 0, the year-boundary case passes, `npm --prefix web run test -- --run src/lib/format.test.ts` passes (112/112), coverage for format.ts is 100% in every column, and `npm --prefix web run verify` exits 0.
