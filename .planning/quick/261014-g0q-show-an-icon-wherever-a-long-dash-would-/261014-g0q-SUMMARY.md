---
quick_id: 261014-g0q
status: complete
created: 2026-10-14T15:10:00-05:00
updated: 2026-10-14T15:10:00-05:00
---

# 261014-g0q: Icon in place of the long dash

Owner rule: where a long dash would be a symbol, use an icon.

- New `web/src/components/states/EmptyValue.tsx`: aria-hidden lucide `minus` icon plus visually hidden "Not set".
- `formatBusinessDate`, `formatCalendarDate`, `formatDate` return `null` for empty or invalid input; `ResponsiveTable` (missing cells) and `OrderCard` (dates) render `EmptyValue`. Empty actions cells stay empty.
- `LISTS_COPY.missing` and the `EMPTY` constant removed. `minus` added after the 56 spec icons.
- OR-4 updated in CLAUDE.md, .claude/CLAUDE.md and 04-UI-SPEC.md.

Commits: a5021a9 (tests), 3f70b33 (feat), 5bb3879 (docs).
Verification: `npm --prefix web run verify` exit 0, 3135/3135 tests, zero warnings. No package changes.
