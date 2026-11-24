---
created: 2026-11-24T03:45:21-06:00
updated: 2026-11-24T03:45:21-06:00
phase: 13-quote-inquiries
topic: showcase e2e failures after plan 13-23
status: fixed
---

# Phase 13: Showcase e2e fix

*Created: 2026-11-24T03:45:21-06:00 · Updated: 2026-11-24T03:45:21-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`, main checkout (no worktree). All checks below ran in the main checkout.
**Commit:** `839b30ed` test(13): showcase e2e expects the Quote requests section and the shell's count read.
**Changed:** `web/e2e/showcase.spec.ts` only. No source, server, package or budget change.

## Failures 1 to 3: one more section heading

**Cause.** Plan 13-23 added a 19th showcase section, "Quote requests". The spec's `SECTIONS` list still had 18 entries.
- Tests 1 and 2 (`showcase.spec.ts:59`, Blush and Espresso) compare every `main > section > div > h2` with `SECTIONS`.
- Test 3 (`showcase.spec.ts:214`) counts them ("expected 18, received 19").

**Title check.** The section is `{ id: 'quotes', title: 'Quote requests', groups: ['quote'] }` in `showcaseSections.ts`, and it comes last. The unit tests `showcaseSections.test.ts` and `ComponentShowcasePage.test.tsx` expect the same title in the same place. The UI-SPEC row "Component Showcase additions" (13-UI-SPEC.md line 119) lists what goes into the section but does not name it. "Quote requests" follows the sentence case every other showcase section uses ("Visitor stats", "Staff and audit"). See owner choice 2.

**Fix.** I added `'Quote requests'` at the end of `SECTIONS`. The checks stay exact: full text match for tests 1 and 2, and an exact count for test 3.

## Failure 4: one more API call

**What was called.** I ran test 4 alone in chromium. It got:

```
Array [
  "/api/v1/auth/refresh",
+ "/api/v1/quote-requests/new-count",
]
```

**Who calls it.** The admin shell does, not a demo. `AdminLayout.tsx:201` reads the Quote Requests New count for the sidebar on every admin page once someone is signed in (`useNewQuoteCountQuery({ enabled: sessionUser !== null })`). `/admin/components` sits inside that shell.

**Evidence that this is the only source:**
- I turned the shell's read off for one throwaway run (`enabled: false` in `AdminLayout.tsx`), rebuilt and ran test 4 again in chromium: "1 passed (19.6s)". Then I put the file back with `git checkout` and `git status` was clean. Nothing from that run was committed.
- The demos cannot make this call. `Phase13Demos` hands the strip and NavCount fixed values (`countQuery(...)`), and test 4 never opens the Quote requests demos. The quote form cases use the demo service and the `PublicDataScope` (W11 CR-01).

**Evidence that it is planned and older than 13-23:**
- Plan 13-17 must-have: "The count reads with the admin shell, on window focus, every 60 seconds while visible" (13-17-PLAN.md line 42). Its threat row lists "Admin shell to the new-count endpoint: a count only, no personal data".
- It landed in `343872a8` (feat(13-17), 2026-11-23 12:52), which comes before the first 13-23 commit `d63ec77e` (23:28 the same day).
- D-32 and D-33 (05-CONTEXT.md) require the Demo data banner, demo-only data in the chunk, strict CSP, no console warnings and no axe findings. The "no API call but the session refresh" check comes from the plan 05-35 test. It was written when the session refresh was the shell's only read.

**Fix (owner choice 1, A built).** The spec now names the shell's two reads once:

```ts
const SHELL_CALLS = ['/api/v1/auth/refresh', '/api/v1/quote-requests/new-count'];
```

- Both Manager tests (test 3 and test 4) now use `toEqual(SHELL_CALLS)`. This is still an exact match, so any call from a demo still fails.
- Test 3 has the same check. It failed first on the heading count, so it never got to its call check.
- The two test titles now say "no API call but the admin shell reads". The file header says the same.
- The `/dev/components` tests still expect no API call at all (`toEqual([])`). No one is signed in there, so the shell asks for no count.

No source changed, so there was no red-then-green source fix. The red was the e2e test itself (the received array above). The throwaway run is the proof of where the call comes from.

## Results

The preflight ran before every Playwright run. Ports 5180, 5115, 7028 and 5199 were free each time, and no dev or test processes were listed.

| Check | Result |
| --- | --- |
| `npm run e2e -- --grep "@showcase" --project chromium` | "24 passed (3.1m)" |
| `npm run e2e -- --grep "@showcase"` (all five projects) | "120 passed (17.5m)" |
| `npm run e2e -- --grep "@quote" --project chromium` | "30 passed (2.1m)" |
| `npm run parity -- --grep "@quote "` | "8 passed (14.2s)" |
| `npm run parity -- --grep "@layouts-public "` (the PublicShell rows) | "14 failed". This is a known open item; see below |
| Vitest: `scripts/e2e-lock-timeouts.test.ts` (reads every e2e spec), `showcaseSections.test.ts`, `ComponentShowcasePage.test.tsx`, `ComponentShowcasePage.lazy.test.tsx`, `AdminLayout.test.tsx` | First run: "Tests 1 failed / 128 passed (129)". Two reruns of the same five files: "Tests 129 passed (129)" each. See Flakes |
| `npm run typecheck` | exit 0 |
| `npm run lint` (`--max-warnings 0`) | exit 0 |
| `npx prettier --check .` | "All matched files use Prettier code style!" |
| `npm run build:budget` | exit 0, every row ok, no limit changed. The rows are the same as in 13-REVIEW-FIX-W11.md (for example contact 148.42 KB, privacy 149.19 KB of 150, admin JS 226.10 KB of 250, Quote form 44.40 KB of 45). The standing barrel-split note still prints |

The e2e seed prints its usual line, "CompanyExpenses skipped: no active Admin or Manager who has signed in". It is not a test result.

### The PublicShell parity grep

The tag "public-shell" matches no test. Parity titles are `@parity @<group> <theme> <width>px <state>` (`visual/parity-matrix.ts` line 54), and the PublicShell scenarios (`public-shell` and `public-shell-base`) sit in group `layouts-public`. So the grep is `npm run parity -- --grep "@layouts-public "`.

It fails 14 rows: chromium 320, 390, 820 and 1440 at rest, 390 and 1440 on hover, plus firefox and webkit 390 and 1440. This failure is already known and is not caused by W11:
- Every difference is in the footer's bottom row: the app has a Legal `nav > ul` where the approved reference has a `span` and links, plus the extra page height that row adds. Not one difference is outside the footer, and none is in the shop-fact text.
- The row is the Phase 12 deviation `SPEC-DEVIATION: FOOTER-LEGAL` in `SiteFooter.tsx`.
- STATE.md already parks it as an open owner choice: "12-13 footer Legal row fails look-equality (needs your choice) ... 6 failed rows". This run has the same 6 rows in chromium, and the same rows in Firefox and WebKit.
- So the W11 change (shop facts through the scope) looks the same as before. I changed nothing here and did not edit STATE.md.

## Flakes

- `ComponentShowcasePage.lazy.test.tsx` "does not load the Phase 13 demos with the page, and loads them when the button is pressed" failed once (3278 ms) in the first five-file run. I did not change that file or its source.
  - Alone it passed 3 times out of 3 ("Tests 3 passed (3)").
  - The same five files then passed twice ("Tests 129 passed (129)").
  - I did not keep the first run's error text. This is a load-timing flake like the others in `deferred-items.md`, and it should get an entry there. I did not edit that backlog.

## Owner choices

1. **The admin shell's count on the showcase page.**
   - **A (built):** the Manager showcase keeps the real shell, so its sidebar reads the real New count, as on every admin page. The e2e allows exactly that read next to the session refresh. Demos still call nothing.
   - **B (alternative):** the shell skips the count on `/admin/components`, so the page calls only the session refresh. This is a small source change in `AdminLayout.tsx`, and the Manager would see no count in the sidebar on that one page.
2. **The section title.**
   - **A (built):** "Quote requests", in sentence case like the other showcase sections.
   - **B (alternative):** "Quote Requests", to match the nav item and page title. This needs changes in `showcaseSections.ts`, its unit tests and this spec.
3. **The footer Legal row parity gap.** This is still open in STATE.md (12-13). It was not decided or changed here.

## Safety

- gitleaks (pre-commit hook): "no leaks found".
- I staged only by path. The commit holds no real names, emails, server names or local paths.
- No package was added or bumped. No server, schema or SQL change. No em or en dash added in `web/src`, because no `web/src` file changed.
- I did not edit STATE.md, ROADMAP.md, DECISIONS.md or deferred-items.md.
- No dev server, e2e host, browser or background shell is left running. The last preflight showed every port free and no processes. I stopped three leftover `grep` processes from my own earlier repo search.
