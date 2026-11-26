---
created: 2026-11-23T12:40:00-06:00
updated: 2026-11-23T12:40:00-06:00
phase: 13-quote-inquiries
wave: 6
review: 13-REVIEW-W6.md
findings_in_scope: 5
fixed: 4
not_fixed: 1
status: partial
---

# Phase 13: Code Review Fix Report (wave 6)

*Created: 2026-11-23T12:40:00-06:00 · Updated: 2026-11-23T12:40:00-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree). The preflight showed ports 5180, 5115, 7028 and 5199 free and no other dev or test processes before the full web test run. No .NET file changed, so no .NET build or test ran. No e2e ran: every change is covered by component tests.

In scope: the Prettier finding, WR-01, WR-02, IN-01 and IN-02. IN-03 is out of scope: deferred to plan 13-19. It is counted as not fixed.

Each fix is one commit with its test. Every new test was run red on the old code first (the IN-02 toast test is the one exception: see below).

## Fixed

### Prettier: the site settings service

**Commit:** e1c16864
`npx prettier --check .` flagged `web/src/modules/admin/services/siteSettingsService.ts`. One line was wrapped by Prettier. No code change.
Status: fixed.

### WR-01: the refresh stops while the last read failed

**Commit:** 5f1005db
- `useQuoteRequestsQuery` now pauses the 60-second clock and the focus re-read while the last read failed (`refetchInterval` and `refetchOnWindowFocus` return `false` for a query in error). Only Try Again reads again. After a good read, both start again.
- The stale line stays in place while Try Again reads. The button shows as busy (`pending`), so it keeps focus and ignores a second press. The `role="alert"` line is not mounted again, so it is not read out again.
- While reads succeed, the 60-second refresh and the focus re-read are unchanged.

Tests (fake clock, `QuoteRequestsPage.test.tsx`):
- After a failed refresh, with focus on Try Again, 3 minutes pass and the window gets focus again: no new read, the same stale line is still there and focus is still on Try Again. Before the fix: 4 more reads.
- Try Again while the read is held: the same line and button stay, the button has focus and `aria-busy="true"`. After a good read the line goes and the clock reads again after 60 seconds. Before the fix: the line was removed during the read.
- A failed first load: 3 minutes and a focus bring no new read, and the same error box stays. Before the fix: 4 more reads.
- The old "reads every 60 seconds and on focus" test now checks real reads on the clock and on focus, not the option values.

Status: fixed. Requires human verification: the refresh timing is a logic change.

### WR-02: the new-request line clears

**Commit:** e06877c3
- The hidden "n new quote request(s)." line now clears 5 seconds after it is set, and at once on a view change (a pill, the search, the page or the page size).
- A second arrival while the line still shows adds to its count ("2 new quote requests."), so the text always changes and is read out.

Tests: a second single arrival after the line has cleared is read again; the line is still there at 4.9 seconds and empty at 5.1; a second arrival inside the 5 seconds gives "2 new quote requests."; choosing All empties the line at once. All three failed before the fix.
Status: fixed.

### IN-01: only requests that really arrived are announced

**Commit:** 9c012a5a
A refresh now counts a New request as arrived only when no answer in this visit held its id (in any view) and it was received after the newest request this visit has seen. No server change was needed.

Tests: an older New request moving up from page 2 after another is closed gives no line; a request seen under Spam, then moved back to New, gives no line. Both failed before the fix. The arrival tests now give the new request a receipt time after the rows already shown, as a real arrival has.

What this rule still gets wrong (rare, see owner item 3): a visit that opens straight on page 2 or later can still announce a request that slides down from page 1; and a request that is newer than anything this visit has seen, was closed before this visit saw it, and is then moved back to New, is announced.
Status: fixed. Requires human verification: logic change.

### IN-02 (client part): the toast names the address the test was sent for

**Commit:** 29dd3e55
- The saved address is now the submission's data (`useSubmission<string, unknown>`, `test.submit(address)`). A failed test for the same address keeps its request key, as before. A newly saved address starts a new test with a new key, so a stored 202 for the old address is never replayed under the new one.
- The success toast names the address passed into that submission, not what the form holds when the answer comes back.
- The API is unchanged. Whether the 202 should say which address it used is owner item 4.

Tests (`QuoteAlertsCard.test.tsx`): a failed test retried reuses its key; after another address is saved, the next press uses a new key and the toast names the new address (this failed before the fix: the key was reused). A second test saves another address while the test is sending and expects the toast to name the first one. That one passed before the fix too, because the old code already read the address at press time; it pins the behavior.
Status: fixed.

## Not fixed

### IN-03: each name links to a request page that does not exist yet

Out of scope by instruction: deferred to plan 13-19, which adds the request page. 13-19 must land before `/gsd-ship 13`, and the routes Back test should then check the request page heading.
Status: deferred to 13-19.

## Flakes and other findings

- None. Every test passed on its first run in the full suite.

## Checks

- `npm run typecheck`: exit 0.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0.
- `npx prettier --check .`: "All matched files use Prettier code style!"
- Fresh production build (`NODE_ENV=production node node_modules/vite/bin/vite.js build`): exit 0, "built in 20.71s", no warnings.
- Whole web suite (`npx vitest run`, after the fresh build): "Test Files 444 passed (444)", "Tests 11864 passed (11864)", exit 0, no stderr lines.
- Budget (`npm run build:budget`): exit 0, every row ok. Public JS contact 148.21 KB of 150.00, privacy 149.10 of 150.00; admin 223.73 of 250.00; Quote form 44.39 of 45.00; CSS 20.50 of 35.00. No limit changed.
- No em or en dash was added in `web/src`. The test data uses `example.com` addresses and made-up names only.

## Owner items

1. **No re-read on focus after a failure (WR-01).** A, built: after a failed read, neither the 60-second clock nor a window focus reads again; only Try Again does, and a good read starts both again. B: keep the focus re-read after a failure (the stale line now stays put during it, but a failed first load would still swap to the loading rows for a moment each time).
2. **How long the new-request line stays (WR-02).** A, built: 5 seconds, and arrivals inside those 5 seconds add up ("2 new quote requests."). B: a longer time, such as 10 seconds, or each arrival shown with only its own count.
3. **How "new" is decided (IN-01).** A, built: the browser decides (an id not seen in this visit, received after the newest one seen), with the two rare misses listed above. B: the list answer carries what is needed (for example the newest received time of all open requests), so the line is always right. That is an API change.
4. **Should the 202 name the address it used (IN-02)?** A, built: no API change; the toast names the address saved when the test was sent. If another Manager saves a different address in between, the toast can still name the wrong one. B: the 202 carries the address the server mailed, and the toast names that. Only a Manager can call it, so this costs nothing in privacy.

---

_Fixed: 2026-11-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
