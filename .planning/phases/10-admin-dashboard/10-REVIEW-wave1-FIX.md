---
phase: 10-admin-dashboard
scope: wave 1 review fixes (chart only)
created: 2026-11-06T23:25:00-06:00
updated: 2026-11-06T23:25:00-06:00
rulings: D-104, D-106
---

# Phase 10 wave 1: chart review fixes

*Created: 2026-11-06T23:25:00-06:00 · Updated: 2026-11-06T23:25:00-06:00*

Three chart findings from `10-REVIEW-wave1.md` are fixed, each test-first. Only `web/src/components/data/IncomeExpenseChart.tsx` and its test file changed.

## Findings

| Finding | Ruling | Test commit | Fix commit | What changed |
|---|---|---|---|---|
| WR-01 tick labels overlap on a big loss | D-106 | 09a351bb | faa50974 | Ticks are kept in priority order (zero, bottom, top, half). A tick closer than 14px to a kept one is dropped. Zero is always kept. With no crowding nothing changes. |
| WR-03 profit line crosses a month with no profit | D-106 | 90b23613 | c6b52c6e | The profit path is built per run of consecutive months with a profit, one `M` subpath each. The halo and both clipped lines use it. |
| WR-02 one `profit` word for legend and tooltip | D-104 | 6621e13d | 015b0ec1 | `labels` gains optional `incomeTip`, `expensesTip` and `profitTip`. Defaults: "Income", "Expenses" and the legend `profit` word, which are today's words. Plan 10-11 passes `profit: 'Profit (income minus expenses)'` with `profitTip: 'Profit'`. |

## Tests added (all red before the fix, green after)

- WR-01: a 15,000 loss with a 2,000 top keeps `-15k`, `0`, `2k` with gridlines 14px or more apart. A 50,000 loss with a 3,000 top keeps the zero tick and spaces the labels 14px or more apart.
- WR-03: a middle month without profit gives two `M` and no `L`, the halo matches the line, and two points. A five-month series with one gap gives `M..L..M..L..`. No profit at all gives an empty path (this one passed before the fix; it pins the edge).
- WR-02: different legend and tooltip words for income, expenses and profit. A second case checks that a tooltip word not passed keeps today's word.

## Checks run

| Check | Result |
|---|---|
| Chart test file (red, before WR-01 fix) | 2 failed, 52 passed |
| Chart test file (red, before WR-03 fix) | 2 failed, 55 passed |
| Chart test file (red, before WR-02 fix) | 1 failed, 58 passed |
| Chart test file (final) | 59 passed (59) |
| `web/src/components/data` folder | 3 files, 127 passed |
| `npm --prefix web run typecheck` | clean, exit 0 |
| `npm --prefix web run lint` (`--max-warnings 0`) | clean, exit 0 |
| `no-long-dash` test | 1 passed |
| Prettier on both chart files | clean |
| gitleaks on each staged change (pre-commit) | no leaks found |

## Notes

- Playwright parity was not run (known local pixel differences).
- The default look is unchanged: the 640 default with no loss draws the same three ticks, and the default tooltip words are the same.
- `web/node_modules` in the worktree is a link to the main checkout's folder. It is git-ignored and not committed.
- STATE.md, ROADMAP.md and the plans were not touched.
