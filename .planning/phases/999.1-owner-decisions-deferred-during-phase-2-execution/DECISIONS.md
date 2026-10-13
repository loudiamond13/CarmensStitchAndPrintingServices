# Owner decisions deferred during Phase 2

*Created: 2026-10-07T23:22:00-05:00 · Updated: 2026-10-13T10:55:45-05:00*

The owner was away while Phase 2 ran (`/gsd-execute-phase 2`, then `/gsd-verify-work 2` and `/gsd-secure-phase 2`). Anything that needed the owner was parked here instead of blocking the run. Nothing listed here was decided for the owner: each item stays open until the owner picks an option.

## D-BL-01 · Three more free licenses for the dev/build tool tree (plan 02-03)

**Status:** resolved 2026-10-08 · **Owner answer:** "Approve all three (Recommended)" → applied (commits 354d03a, 4951249; license gate exits 0) · *(was: open)* · **Raised:** 2026-10-07 · **Blocks:** plan 02-03's check "`node web/scripts/license-gate.mjs` exits 0", and plan 02-16, which wires the license gate into `verify`.

**What happened.** The new npm license gate passes for everything that ships to the browser (16 packages: MIT, ISC and the OFL fonts). The dev/build tree has 522 packages, and five of them use a license that is not in the owner's D-26 list. None of them ships to the browser, and none costs anything.

| License (plain words) | Packages | Pulled in by | Use |
|---|---|---|---|
| **MIT-0**: the MIT license without even the "keep the copyright notice" condition. Free, with fewer conditions than MIT. | @csstools/color-helpers 6.1.1, @csstools/css-syntax-patches-for-csstree 1.1.14 | jsdom 30.1.1 (the test DOM) | tests |
| **CC-BY-3.0**: free data license, credit the authors. An older version of CC-BY-4.0, which is already approved. | spdx-exceptions 2.5.0, spdx-ranges 2.1.1 (MIT AND CC-BY-3.0) | license-checker-rseidelsohn 5.0.1 (the license gate tool itself) | tool |
| **Python-2.0**: the Python Software Foundation license. Free and permissive like BSD; keep the notice. | argparse 2.0.1 | openapi-typescript 7.13.0 → @redocly/openapi-core → js-yaml (tools/openapi-gen) | tool |

**Options**

- **A (recommended): approve all three as dev/build-only exceptions**, on the same terms as D-26 (license-level, never allowed in the production tree). No package changes are needed. With these three added, the gate passes: 16 production packages, 522 dev packages and no stale exceptions.
- **B: reject some or all.** Each rejection means replacing a package, and each replacement needs its own approval. Rejecting CC-BY-3.0 replaces the license-gate tool with hand-rolled code. Rejecting MIT-0 replaces jsdom (for example with happy-dom). Rejecting Python-2.0 replaces openapi-typescript (D-16).
- **C: keep deferring.** The gate stays red until a decision is made.

**Current state:** option C applied by default because the owner is away. Plan 02-03 is otherwise complete, and its SUMMARY records this check as open.

**To apply option A later:** add three `npmLicenseExceptions` entries to `docs/license-exceptions.json` (dev-only, with this decision's ID), add a D-26 addendum line to `02-CONTEXT.md` and a line in `docs/dependencies.md`. Then re-run `node web/scripts/license-gate.mjs` and `npm --prefix web run verify`.

## D-BL-02 · The "Manager" tag disappears on the selected Users menu row (plan 02-05)

**Status:** resolved 2026-10-08 · **Owner answer:** "Option B: hide it" → recorded in D-31 (fe6180f); implemented by the re-planned 02-11 work · *(was: open)* · **Raised:** 2026-10-08 · **Blocks:** nothing yet (no admin screen uses it until plan 02-15). Best settled together with the O-1..O-8 owner confirmations and the D-23 screenshot review.

**What happened.** In the approved design CSS (UI spec Appendix B), the small "Manager" tag in the admin sidebar uses the same color as the highlight of the selected row. When **Users** is the current page, the tag text matches its background, so it can't be read: 1.00:1 contrast in Blush and 1.43:1 in Espresso, against the 4.5:1 minimum (WCAG 1.4.3). The executor did not change it, because any fix changes the approved look (rule D-08: visual changes go to the owner with a before/after).

**Options**

- **A (recommended): show the tag in the "text on primary" color when its row is selected**, one rule in `overrides.css` with this decision's ID: `.csp-nav.is-on .csp-nav-tag { color: var(--on-primary); }`. The tag then reads like the row's own label.
- **B: hide the tag on the selected row.** The page title already says where you are.
- **C: keep the approved look** and accept the WCAG failure. Not recommended, because the project target is WCAG 2.2 AA with zero axe violations.

Full finding: `.planning/phases/02-web-foundation-design-system/deferred-items.md`.

## FYI-01 · Five faded texts made slightly darker for readability (plan 02-05, no action needed)

Under your existing ruling **D-02** (no text below 4.5:1 contrast), plan 02-05 set five spec texts back to full opacity: the input placeholder, the "Manager" tag, the call-to-action lead text, the filter-pill count and the big-button caption. Four of them failed when faded; the worst was the pill count, at 3.32:1 in Blush. The visible effect is that these five texts look a little darker than in the design file. Entry animations and two decorative elements keep their fade. You'll see this in the D-23 screenshot review (plan 02-18). Say so if you'd rather handle any of them differently.

## D-BL-03 · Design rulings O-1..O-8, 20 redrawn icons and the Logout look (plan 02-09, Task 3)

**Status:** resolved 2026-10-08 · **Owner answer:** "Option A: accept all (Recommended)" → recorded as D-31/D-32 in 02-CONTEXT.md (fe6180f) · *(was: open)* · **Raised:** 2026-10-08 · **Blocks:** plan **02-11** and everything after it (02-14, 02-15, 02-16, 02-17, 02-18). Plans 02-10, 02-12 and 02-13 do not need these rulings and continue.

**Review pack (open it in a browser, local only):** `artifacts/owner-review/phase2-rulings/index.html`, with 17 before/after pictures. Rebuild it with `node web/scripts/owner-review-pack.mjs`. The pack also shows **D-BL-02** (the Manager tag), so you can rule on both in one pass.

### 1. Owner Confirmations O-1..O-8 (UI spec "Owner Confirmations", rule D-08)

| Item | What changes | Visible? | Recommended |
|---|---|---|---|
| O-1 | The initials badge (Avatar) is announced as a picture (`role="img"`). Needed for zero axe errors. | No (spoken label only) | Yes |
| O-2 | Testimonial stars are announced as a picture (`role="img"`). Same axe rule. | No (spoken label only) | Yes |
| O-3 | On phones, the current link in the public menu is marked as the current page and turns **italic**, as a second cue next to the orange. | **Yes, the only visible one** | Yes |
| O-4 | Fix the footer's spoken labels "CSPS onFacebook / onInstagram / onTikTok" → "CSPS on Facebook …". | No (spoken label only) | Yes |
| O-5 | The toast area is always present (empty when there are no toasts), so screen readers announce new ones reliably. | No (behaviour only) | Yes |
| O-6 | For people who set "reduce motion" on their device: stop the loading shimmer and the pop-up and toast entry animations. | Only for those people | Yes |
| O-7 | Warning toasts stay until closed; success and info toasts pause their timer while the pointer or keyboard focus is on them. | No (behaviour only) | Yes |
| O-8 | Keep the smaller designed controls (36 px small buttons and icon buttons, 38×32 segment buttons, 22×22 filter-chip clear, 20×20 login checkbox) and record the exception. They pass WCAG 2.2 AA (24 px minimum); the project's own target is 44 px. | No, if kept | Keep as designed |

Rejecting O-1 or O-2 leaves an accessibility error that the zero-violation gate will report, and plan 02-11 would then stop for re-planning.

### 2. Redrawn icons (rule D-12, recorded as D-32)

Lucide redrew 20 of the 56 icons between version 0.460 (in the design) and 1.52.0 (installed); the other 36 are identical. Approve each new drawing, or name a replacement Lucide icon. Only **menu** looks noticeably different.

- **menu**: the three bars moved slightly further apart (heights 6/12/18 → 5/12/19). *The one you'll notice.*
- Look the same (shapes only rebuilt): search, log-out, clock, circle-check, list, calendar, trending-up, trending-down.
- Look very similar (small curve changes): receipt, users, phone, message-circle, mail, palette, zap, package, moon.
- Renamed by Lucide, same meaning: trash-2 → "trash" (lid and handle redrawn, about the same); filter → "funnel" (rounded joins, very similar).

### 3. D-27 Logout (already ruled; please confirm the look)

The sidebar Logout is now a real button instead of a link. Chromium measured it identical to the old link in all 34 checks (both themes, sidebar expanded and collapsed, at rest and on hover). Before/after pictures are in the pack. One small deviation is recorded in `web/SPEC-DEVIATIONS.md`: the style rule leaves out three properties the plan listed, because they would have overridden the sidebar's own hover and selected styles.

### 4. New look-changing items found in plan 02-09

None.

**How to answer:** reply "option-a" to accept every recommendation (O-1..O-7 yes, O-8 keep as designed, approve all redrawn icons, D-27 confirmed). Or answer item by item, for example: "O-1 yes, O-2 yes, O-3 no, …, menu: approve, filter: use list-filter".

**To apply after the answer:** record the rulings in `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md` as **D-31** (one dated line per O-1..O-8, plus D-BL-02 if ruled) and **D-32** (one line per redrawn icon), and update its `Updated` timestamp. Repeat the reply verbatim in `02-09-SUMMARY.md`. Then run plan 02-11, followed by 02-14 → 02-18.

## D-BL-04 · Should website visitors be able to read the third-party credits? (D-10, found in UAT)

**Status:** resolved 2026-10-08 · **Owner answer:** "Repo only" → recorded as D-35 in 02-CONTEXT.md (Vite build.license off; notices stay in the repository) · *(was: open)* · **Raised:** 2026-10-08 · **Blocks:** nothing. The security fix (UAT gap G-02-2) goes ahead without this decision.

**What happened.** UAT found that the server publishes a build file, `/.vite/license.md`, which lists the bundled libraries with their exact versions. It was never meant to be public. The fix (block every file inside a dot-folder) needs no decision from you. But it raises a question you ruled on before in **D-10**: your ruling says credit for the free libraries comes "via the license notice pipeline (Vite build.license / THIRD-PARTY-NOTICES)". Today:

- `web/THIRD-PARTY-NOTICES.txt` already lists all 16 libraries that ship to the browser (more complete than Vite's file, which lists 5). It lives in the repository and isn't shown on the website.
- The shipped JavaScript contains no license text, because the minifier removes it. So once the fix lands, a visitor has no page showing the credits.

**Options**

- **A (recommended): publish the credits on purpose.** Serve the complete notices as a named, deliberate public file or a small "Credits" page linked from the legal pages. Stop Vite writing its own file (`build.license: false`), since THIRD-PARTY-NOTICES covers more.
- **B: keep the credits in the repository only.** Turn off Vite's file and publish nothing. Most of these licenses (MIT, ISC, OFL) only require keeping the notice with copies of the code, and the repository does that.
- **C: keep Vite's file but move it out of the web root.** Use it as an internal build record only.

**Recommended answer:** A. It's the clearest way to honour D-10, and it costs one small public file.

## FYI-02 · Two low risks accepted at plan time (security review, no action unless you disagree)

`/gsd-secure-phase 2` recorded two **low** risks as accepted in `02-SECURITY.md`, as the plans proposed. You haven't ratified them yet, so say so if you disagree:

- **AR-02-01 (T-02-35):** the password field has a Show/Hide toggle. The password stays hidden until the user taps Show, and it shows only on their own screen (the approved design's behaviour).
- **AR-02-02 (T-02-56):** the new rule that blocks files inside dot folders would also block a future deliberate `/.well-known/` file (for example `security.txt` or the Android app link file). Nothing like that exists today. When one is needed, it gets an explicit, tested exception.

The security review also left two **medium** items open, but not blocking: T-02-26 (your review of the 20 redrawn icons) and T-02-27 (your design checkpoint). Both close when you answer **D-BL-03**.

---

# Run 2: the D-33 re-plan (40 plans, executed 2026-10-08 → 2026-10-13)

The owner was away again while the re-planned Phase 2 ran (`/gsd-execute-phase 2`, the code review and its fixes, `/gsd-verify-work 2` and `/gsd-secure-phase 2`). Nothing below was decided for the owner. The approved spec behaviour is kept until a ruling is made. Full context for most items is in `.planning/phases/02-web-foundation-design-system/deferred-items.md` ("Owner decisions pending"), `02-VERIFICATION.md` (status `gaps_found`), the `02-REVIEW-FIX-*.md` reports and `02-UAT.md` (13 pending human tests).

Already ruled during this run (recorded, no action): **D-39** zero KPI dimmed by colour only · **D-40** "Walk-in customer" on no-team order cards · **OD-4** no overpayment, the server refuses and the payment form warns during input (2026-10-13).

## A. Blocking Phase 2 sign-off (verification gaps: the approved spec conflicts with binding rules)

Each fix is small and ready. Each one changes the approved look slightly, so it needs your OK (D-08).

- **R2-01 · Admin top bar makes pages scroll sideways on phones.** The admin Topbar's search box doesn't shrink, so the whole page scrolls sideways below 398 px (Chromium), 406 px (WebKit/Safari) and 418 px (Firefox). That is 13 px on an iPhone 15 and up to 98 px at 320 px. It breaks "no horizontal scroll 320–1920" (PERF-03, WCAG 1.4.10). **Recommended:** let the search box shrink (`min-w-0`).
- **R2-02 · List pages scroll sideways by 22 px at 768 px (tablet).** The hidden "Actions" table header is positioned against the page instead of the table. **Recommended:** contain it in the table frame (`contain: paint`). There is no visible pixel change, but the parity harness needs an intentional-difference entry.
- **R2-03 · The list search box shows no focus outline.** App. C removes the outline and adds no replacement (WCAG 2.4.7 Focus Visible). **Recommended:** use the same focus ring as other fields.
- **R2-04 · The "/" search shortcut can't be turned off** (WCAG 2.1.4). The review fix stopped it firing while typing, with modifiers or while a dialog is open. **Options:** (a) remove it, (b) require a modifier key, for example Ctrl+K, or (c) add an off switch.
- **R2-05 · Visual review of Phase 2 (WEB-02 sign-off).** Regenerate the pack first with `npm --prefix web run review`, because the current one predates the review fixes. Then open `artifacts/owner-review/index.html` and `artifacts/owner-review/side-by-side/index.html`. UAT tests 2–4 in `02-UAT.md` walk you through it.

## B. Decide before Phase 4/5 builds on it

- **R2-06 · Order math naming (NET-WR-02).** The shared math, the browser and the 220 golden vectors call the before-discount amount "Total". The PRD calls it "Subtotal", and the PRD's "Total" is after discount. The approved OrderTotals panel labels the before-discount figure "Total". **Option A:** follow the PRD names everywhere, with a before/after of the panel wording. **Option B:** keep the design's naming as a recorded PRD deviation. Related: a 100%-discounted, unpaid order currently reads "Fully Paid" (NET-IN-01).
- **R2-07 · Overpayment follow-ups (OD-4 / C-38), for the Orders discuss step.** Should other edits that would push a balance below zero also be blocked? Examples are removing an item, lowering a quantity or adding a discount after payments. The default reading is yes. How should already-overpaid legacy orders be imported and shown?
- **R2-08 · Retrying a failed save (review fix LIB-WR-01).** These failures keep the same request key, so the server won't double-save: network error, timeout, cancelled, unreadable reply, 5xx, 408, 409. These get a fresh key: 400, 401, 403, 404, 422, 429. Confirm. Also human-verify the double-submit lock and the upload-retry rules.
- **R2-09 · "Your session ended. Sign in again."** Should a 401 show a message? The UI-SPEC currently says no message (Phase 4 sign-in).
- **R2-10 · Page behind a phone bottom-sheet dialog isn't inert** (axe target-size on half-covered buttons). This is planned for Phase 4. FYI.

## C. Look and wording questions (non-blocking; the approved look is kept until you rule)

- **R2-11 · "Get a Quote"** in the public header stays a button, as in the spec. Should it become a real link?
- **R2-12 · Sidebar collapse button** announces its state only by changing its name ("Collapse/Expand sidebar"), per App. D.3. Should it also expose an expanded/pressed state?
- **R2-13 · "Try Again"** inside the red error banner is muted grey (approved App. E.8; passes contrast). Keep it, or use normal ink?
- **R2-14 · Users list:** the name and avatar initials render small (12 px) and muted, exactly as approved. Confirm.
- **R2-15 · Preview-page empty state wording:** "Nothing to show here yet" / "Until this screen is built, the Component Showcase shows every shared building block." Confirm or reword.
- **R2-16 · Dev-only Component Showcase:** keep the two extra sections ("Navigation", "Marketing") and the demo button words ("Open Add Payment", "Open Add User", "Open Delete Order", "Open Delete Payment", "Open navigation drawer", "Show … toast", "Show this example")?
- **R2-17 · Public footer headings** jump from h1 to h4 (Lighthouse heading order). **Recommended:** make them h2, with no visible change.
- **R2-18 · Money paste refused:** show the amount hint, or keep ignoring the paste silently as the UI-SPEC says?
- **R2-19 · Barlow Condensed fallback** tries "Arial Narrow" first but is sized for Arial, so text may shift on machines that have Arial Narrow. This is the UI-SPEC's exact value. Changing it needs measuring on such a machine.

## D. Confirm by hand (behaviour only a person can judge)

- **R2-20 · Phone tap prefetch:** on a phone, the first tap never prefetches data (touch is ignored by intent prefetch). Confirm.
- **R2-21 · Focus and timer fixes from the review:** dialogs stack correctly, toasts are reachable while a dialog is open, dismissing a toast returns focus sensibly, and Pagination keeps focus after a page change.
- **R2-22 · Screen readers:** toasts are now announced once, politely (also for danger toasts). Spot-check with NVDA/VoiceOver (UAT test 9; full pass in Phase 14).
- **R2-23 · Long text wraps inside its box** (toast, field error, EmptyState), UAT test 4.

## E. FYI and housekeeping (no decision needed unless you disagree)

- **R2-24 · Reference-side cursor rule:** WebKit reported the approved Logout link's cursor differently, so a reference-only rule makes the cursor `pointer`. Nothing visible changes.
- **R2-25 · Tablet rail accessible names:** the approved rail had unnamed links (labels hidden). They now carry `aria-labelledby`, with no visible change.
- **R2-26 · Package cool-down waivers** in `web/.npmrc` (vite, source-map-js, http-cache-semantics) can't be narrowed to a version in npm 11.19, so every future release of those packages skips the 14-day cool-down. Keep them, or drop them?
- **R2-27 · One npx download:** an executor once ran `npx tsx` for a scratch probe, which put `tsx@4.23.15` into your npm cache. The project files were not changed, and executors are now barred from npx downloads. You may want to clear the npx cache.
- **R2-28 · Lighthouse mobile LCP** is now about 1.88 s against the 2.0 s budget (about 116 ms headroom). Options are in deferred-items.md.
- **R2-29 · Code review:** all 4 criticals and 37 of 42 warnings are fixed. The 5 unfixed warnings are items R2-04, R2-06, R2-18, R2-19 and R2-26 above.
