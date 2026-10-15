# The owner review: screenshots and the side-by-side with the design

*Created: 2026-10-09T07:57:00-05:00 · Updated: 2026-10-15T11:50:00-05:00*

This page explains the two local reports the owner uses to check how the new site looks (decisions D-23 and D-24, plan 02-36). Both are made on this computer and **stay on this computer**: they are never put in git, uploaded or put on the live site. The output folder `artifacts/` is git-ignored, and both scripts refuse to run if it is not.

## 1. What the owner gets

| Report | Open this file | What it shows |
|---|---|---|
| Screenshots (D-23) | `artifacts/owner-review/index.html` | Every page of the new app as a phone (390 px wide), a tablet (820 px) and a laptop (1440 px): the public home page in Blush, the five admin pages and the Component Showcase in Blush and Espresso. Then "Wording changes for you to confirm": each wording change you still have to approve, as a before picture (the approved wording) next to an after picture (what the app shows now), with a Place / Before / After table of the words. Then the parts the approved design never drew (SPEC-GAP), each in both themes. Then the automatic look check: how many parts matched in each browser engine, and every intentional difference from the design with the decision that allowed it. |
| Phase 4 sign-in screens (plan 04-32) | the section "Sign-in screens and devices (Phase 4)" in `artifacts/owner-review/index.html` | The sign-in cards S1 to S6 in their states, the Signed-in devices page S7, both sign-out dialogs (open and after a failed request), the account menu with its four items and the session toasts, each at 390, 820 and 1440 px, then the seven open rulings (OQ-1 to OQ-7) with the default that is built, and a table of every new sentence for the wording check (OQ-7). |
| Side by side (D-24) | `artifacts/owner-review/side-by-side/index.html` | The same pages next to the matching screens from the original design files in `.planning/design/`, at the same width and in the same theme. |

Open either file by double-clicking it. Click a picture to see it full size.

## 2. How to read them (for the owner)

- **The admin pages are still placeholders.** Their real content (orders, expenses, users) is built in later phases. For now, compare the frame around the page: the side menu, the top bar, the phone tab bar, the colours, the fonts and the spacing.
- **The public home page is a placeholder too.** Compare its header and footer.
- **Wording changes for you to confirm** (before and after): right now this is your ruling D-41 R2-06, the PRD money words. "Subtotal" is the amount before discount and "Total" the amount after discount, so the order totals panel and the order card say "Subtotal" where the approved design said "Total", and the profit note reads "Profit = Subtotal − Discount − Expenses. Internal only.". The demo Orders table's "Total" column now shows the amount after discount. Only the words change. A fully discounted order with no payment still reads "Fully Paid", and the panel has no row for the Total after discount, as in the approved design. Decide: **approve the new wording, or say what to change** (for example, ask for a "Total" row after the discount).
- **The SPEC-GAP parts** (page numbers, sign-in code boxes, money boxes, tick boxes, the skip link, list states, loading placeholders, pictures, error boxes, the phone menu and the account menu) have no drawing in the design. Check that each looks like it belongs.
- **The look check table** should show "did not match: 0". The differences table lists every change from the approved design that you decided, with its decision number (for example D-27 for the Logout button).
- Write down anything that looks wrong, in your own words. Every difference you name becomes a fix. A change that would alter the approved look comes back to you as a before/after picture first (D-08).

## 3. How to make them (for developers)

Do the shared-machine preflight first (the screenshot script also runs it):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
```

If TheBETSLLC's test processes are listed, wait. Never stop another project's process.

1. **Optional, for a fresh look-check summary:** `npm --prefix web run parity` (about 30 minutes, see [parity.md](parity.md)). The parity run writes `web/test-results/parity-results.json`; the screenshot report reads the latest one and says which filters it was run with. With no file, the report says so in plain words.
2. **Screenshots:** `npm --prefix web run review` (about 4 minutes). It:
   1. refuses unless `artifacts/owner-review` is git-ignored (`git check-ignore`);
   2. takes the shared run lock `web/.locks/e2e.lock` (E2E, Lighthouse and this run all start the host on 5199) and refuses a busy port 5199;
   3. runs the shared-machine wait (`web/scripts/shared-machine.mjs`): it runs the preflight report and waits, up to 15 minutes, while one of this project's ports is in use by another program or TheBETSLLC's dev/test processes are listed, then exits 1. It never stops anything. Without the preflight script (CI) it says so and goes on; then the guarded CSPS_E2E seed (the host's `/health` checks the database);
   4. rebuilds the e2e bundle `web/.e2e-dist` whenever any build input (`web/src`, `web/public`, the HTML entries, `vite.config.ts`, `.env.e2e`, the lockfile, the build plugins) is newer than it, not only when it is missing (L-29);
   5. starts the real host on `https://localhost:5199` for this run only, exactly as the E2E host does, and stops only that host when the pictures are done;
   6. writes `artifacts/owner-review/shots/` (39 pages), `artifacts/owner-review/spec-gap/` (54 SPEC-GAP pictures), `artifacts/owner-review/auth-review/` (150 pictures of the Phase 4 sign-in screens, devices page, dialogs, menu and toasts, at 390, 820 and 1440 px: Blush for the cards, both themes for the rest), `artifacts/owner-review/before-after/` (6 pictures: a before and an after for each of the 3 wording cases in `BEFORE_AFTER_CASES`, Blush at 1440 px) and `index.html`. The after picture is the case frame as the app shows it; for the before picture the script writes the approved wording back into that frame's exact texts (the swaps go into the page as JSON) and photographs it again, and the run stops with the case's name if a swap matches no text, so an outdated case can never give two equal pictures. Each SPEC-GAP picture is its case frame on `/dev/components`, except the phone menu (the whole phone screen, because it covers the page) and the skip link (reached with the keyboard, because it shows only with keyboard focus, and photographed at the top left of the screen where it then appears). It never writes into `src/`, `web/src` or the server's `wwwroot`.
3. **Side by side:** `node web/scripts/design-side-by-side.mjs` (about 30 seconds, after step 2, because it reuses the step 2 screenshots of our pages). It:
   1. refuses in CI (any `CI` value), when `.planning/design` is not git-ignored, when any file under it is tracked by git, and when its own output folder is not git-ignored;
   2. opens the two design exports **in place** (never copied or moved) in Playwright Chromium with every network request blocked, picks each matching screen by its exact title, checks its width, sets its theme (the export's light/dark prop, `data-theme`) and photographs it;
   3. writes the pictures and `index.html` only under `artifacts/owner-review/side-by-side/`.

The pairings are in `PAIRINGS` (web/scripts/design-side-by-side.mjs). The public design has no tablet screen, so the report says "The design has no screen at this width" there. A design screen can be shorter than its frame; the space below it is painted in the screen's own background colour, so it is empty space, not part of the design.

## 4. Rules

- **Never** `git add -f` anything under `artifacts/` or `.planning/design/`, and never move or copy the design files.
- The side-by-side never runs in CI: the design files are not in git (D-24, threat T-02-77).
- No package was added for these reports: they use the Playwright already installed.
- The tests are `web/scripts/owner-review.test.ts` and `web/scripts/design-side-by-side.test.ts` (the guards, the page list, the widths, the rebuild rule, the output paths and the report pages).
