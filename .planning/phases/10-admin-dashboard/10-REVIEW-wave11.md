---
phase: 10-admin-dashboard
wave: 11
plans: [10-21]
created: 2026-11-08T16:48:00-06:00
updated: 2026-11-08T19:06:00-06:00
reviewed_range: fbc59c0a..c0669aff (excluding .planning/)
depth: deep
files_reviewed: 20
files_reviewed_list:
  - web/e2e/dashboard-sweep.spec.ts
  - web/e2e/money-sweep.spec.ts
  - web/e2e/showcase.spec.ts
  - web/src/modules/admin/components/DeleteTransferDialog.tsx
  - web/src/modules/admin/components/IncomeExpenseCard.tsx
  - web/src/modules/admin/components/RemoveTransferDialog.tsx
  - web/src/modules/admin/components/StaffBalancesTable.test.tsx
  - web/src/modules/admin/components/StaffBalancesTable.tsx
  - web/src/modules/admin/components/TransferModal.tsx
  - web/src/modules/admin/components/money.recipe.node.test.ts
  - web/src/modules/admin/components/money.recipe.ts
  - web/src/modules/admin/components/showcase/Phase10Demos.test.tsx
  - web/src/modules/admin/components/showcase/Phase10Demos.tsx
  - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
  - web/src/modules/admin/components/showcase/showcase.recipe.ts
  - web/src/modules/admin/components/showcase/showcaseCopy.ts
  - web/src/modules/admin/components/showcase/showcaseSections.test.ts
  - web/src/modules/admin/components/showcase/showcaseSections.ts
  - web/src/modules/admin/hooks/useTransferAction.ts
  - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
findings:
  critical: 0
  warning: 4
  info: 7
  total: 11
status: issues_found
---

# Phase 10 Wave 11 Code Review (plan 10-21)

*Created: 2026-11-08T16:48:00-06:00 · Updated: 2026-11-08T19:06:00-06:00*

## Summary

I reviewed the new showcase section (`Phase10Demos`, its test, its registration, copy and recipe), the two sweeps, the new `@dashboard-showcase` check, the All Staff phone fix, and the refactors outside the plan list. I traced the code into `TransferButton`, `MoneyStrip`, `MoneyOnHandCard`, `ConfirmDialog`, `Modal`, `MobileNavDrawer`, `useSubmission`, `useRefreshMoney`, `serverFieldMessage`, `HttpError`, `createQueryClient`, `ResponsiveTable`'s phone card recipe, the admin and dev routes, the e2e guard and axe helpers, and on the server `IDashboardReader` (how "Collected this month" is counted).

What holds:

- **The refactors keep behavior.** `IncomeExpenseCard` passes the same values it used before: `loading` is `isPending` with no data and the delayed refetch mark with data, `dimmed` is the same mark, and Try Again still calls `refetch`. `DeleteTransferDialog` still owns the balance read, the `answered` gate (wave 10 WR-02), the version sent with the delete (WR-01 is in `useTransferRowActions`, untouched), the missing-receiver rule (IN-03) and the busy 409 line (IN-01). The view still carries `role="alert"` on both late lines (WR-03). `RemoveTransferDialog` still sends no version. `TransferModal`'s connected part did not change and does not forward `send`.
- **`send` cannot bypass validation.** `handleSubmit` runs the zod schema before `action.submit`, and `send` only replaces the service call inside `useSubmission`. Only `Phase10Demos` passes it. Searching the source finds no other caller.
- **No request from the demos.** The section holds its own query client, so a demo save invalidates nothing in the app cache. No demo component calls a query hook, and `useSession` is a store read, not a request. The unit test watches both MSW and `fetch`.
- **Made-up data.** Every person, team and order number also appears in the UI spec or in existing fixtures. The staff ids are fake GUIDs. There is no outside address.
- **Where it ships.** The showcase is a lazy chunk at `/admin/components` behind `requireManager` (05 D-30 to D-33) and at `/dev/components` only when `__DEV_ROUTES__` is true. It is in no navigation. This is the approved design, so the new section ships to Managers like the earlier ones.
- **The 320 px fix.** `pg-phone:pr-18` applies only in the phone card layout and only to rows with Hand Over, so wider layouts and other rows do not change. The SUMMARY's numbers check out: before the fix the name area ended about 57 px inside the pinned buttons, so 72 px more leaves about 15 px clear at 320 px.
- **Sweeps.** The guard fixture is `auto`, so console, page error, CSP and failed-response findings fail every sweep test. Each sweep collects its findings and fails once. Nothing is skipped or fixme'd. The windows are closed with Esc, so no money is moved after seeding.
- **Rules.** No em or en dash in any added line (checked by code point). No `style` attribute, no `any`, no `eslint-disable`, no new or bumped package, no service outside `modules/admin/services`, no server change (so no new lock, D-53).

The main problems: the guard that stops a showcase press from opening the real, connected Transfer window in production is not tested (WR-03). The P10-BL-06 comment in the dashboard sweep describes a fixme that does not exist (WR-01). The sweeps add large current-month payments to the shared database, which feeds P10-BL-06 (WR-02). The `@dashboard-showcase` check runs 18 whole-page axe passes over the 250-case page, which makes it slow and load-sensitive (WR-04). There is no critical finding.

**The iPhone `@showcase` timeouts.** The new section adds no rendering on first load: it draws one button until it is pressed. It does add loading work, because `Phase10Demos` is a static import. Its whole module graph (about 190 KB of source: the dashboard cards, the money components, `TransferModal`, `moneyService`, the schemas) must download and run before the showcase heading can show. That is a small cost next to rendering about 230 cases in one commit, which is what the 5 s heading wait mostly measures. So it is a plausible small contributor on a loaded WebKit, not a likely main cause. IN-01 shows how to remove it.

## Critical

None.

## Warning

### WR-01: The P10-BL-06 comment describes a fixme that the code does not have

**File:** `web/e2e/dashboard-sweep.spec.ts:156-157`

**Issue:** The comment says the 320 px sideways-scroll finding "is fixme'd when it is the only finding (see the SUMMARY of plan 10-21)". The test does nothing of the kind: it asserts `failures` is empty, and any sideways scroll fails it. The SUMMARY says no `test.fixme` was added. The code is right for the parked item (no skip, no layout change). The comment is wrong, and it is tagged "OWNER DECISION", so readers will trust it.

**Failure scenario:** In the phase gate the 320 px dashboard cases fail with "the page scrolls sideways". A reviewer reads the comment, thinks the failure should have been muted, and treats it as a broken mechanism. Or a later executor "restores" the fixme that the comment describes and hides the failure that P10-BL-06 says must stay visible.

**Fix:** Say what the code does:

```ts
// P10-BL-06 (owner, open): at 320 px a six-digit KPI figure can be wider than its card, so this case can fail with
// "the page scrolls sideways". It stays in the sweep and is left failing on purpose until the owner rules. No fixme.
```

### WR-02: The sweeps add about ₱84,000 of current-month payments per browser project, which feeds the P10-BL-06 overflow

**Files:** `web/e2e/dashboard-sweep.spec.ts:49-67`; `web/e2e/money-sweep.spec.ts:31-43`, `:227-228`

**Issue:** Every dashboard sweep test records a ₱3,000.00 payment dated today and a ₱500.00 expense. Every money sweep test records one or two ₱5,000.00 payments dated yesterday. `IDashboardReader` counts "Collected this month" as payments dated in the business month, across the whole shop. Per project that is 8 × ₱3,000.00 plus 4 × ₱5,000.00 plus 4 × ₱10,000.00, about ₱84,000.00. Across five projects it is about ₱420,000.00 in one run, plus ₱20,000.00 of expenses. P10-BL-06 says the dashboard scrolls sideways at 320 px once full-run figures grow to six digits. So these sweeps push the shared database toward the very failure the parked item describes. Whether the 320 px checks pass (this sweep's three cases, `dashboard.spec.ts`, `admin.spec.ts`) then depends on run order and on which projects ran first. The SUMMARY's "P10-BL-06 not triggered" came from single-spec runs on a fresh database, which a full run does not reproduce. The plan asked for "never shop-wide totals" in the assertions, but the layout checks depend on them.

**Failure scenario:** The owner rules P10-BL-06 option B (shrink six-digit figures). A full run then shows the 320 px cases passing on chromium and failing on iPhone, because by the time the iPhone project runs, the sweeps have pushed a figure past what option B was sized for. The result looks like a flaky fix.

**Fix:** Keep the money each person holds, but keep it out of the current month and keep it small:

```ts
// money-sweep.spec.ts: on-hand counts every date, the dashboard counts only this month.
orderDate: manilaDate(-45),
payments: [{ paymentDate: manilaDate(-45), amount: 5000, ... }],
```

In the dashboard sweep, a ₱10.00 payment and a ₱5.00 expense are enough for the cards and the chart to draw. Note the change in the SUMMARY so the P10-BL-06 gate is read with this in mind.

### WR-03: The guard that keeps a showcase press from opening the real Transfer window is not tested, and it is all that stands between the production showcase and a real transfer

**Files:** `web/src/modules/admin/components/showcase/Phase10Demos.tsx:66-79`, `:676-697`, `:706-712`; `web/src/modules/admin/components/TransferButton.tsx:59-77`; test `web/src/modules/admin/components/showcase/Phase10Demos.test.tsx:351-362`; `web/e2e/showcase.spec.ts:384-394`

**Issue:** The D1 demo draws the real `MoneyStrip` with ₱8,450.00, so its Transfer button is enabled. That button is the connected `TransferButton`. On press it mounts the real `TransferModal`, which reads the signed-in person's money and recipients and saves through `moneyService.create`. The only thing that stops it is `Still`'s `onClickCapture` swallow. The showcase ships to Managers at `/admin/components`, so the real data and the real save are a Manager's.

The test that should prove the swallow works does not. "makes no request, whatever is pressed" presses the strip's Transfer in `money-strip-negative`. That strip shows −₱500.00, so `transferGate` blocks the button and the press would do nothing even without `Still`. The other static presses are Hand Over (`onHandOver` is a no-op) and Try Again (`refetch` is a no-op). None of them reaches anything that `Still` guards. If `Still` were removed or broken, every test would still pass. The browser check closes every window with Esc and never presses a static case or a save button, so its "no API call" result does not cover the `send` path either.

The swallow also covers only `click`. A middle click (`auxclick`) or "Open in new tab" on a static order link still opens the real address.

**Failure scenario:** A later change makes `Button` act on `pointerup` for touch, or `TransferButton` opens on a keyboard handler. The D1 strip's Transfer in `/admin/components` then opens the real window. The Manager sees their real balance and coworkers inside the "Demo data" page, and Record Transfer moves real money. The unit test stays green.

**Fix:** Test the guard where it matters, and do not rely on it alone:

```ts
it('a press on the D1 strip Transfer opens nothing and asks for nothing', async () => {
  const user = userEvent.setup();
  renderDemos();
  await user.click(within(caseFrame('dashboard-d1-demo')).getByRole('button', { name: 'Transfer' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(requests).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
});
```

Then remove the live writer from the static cases. For example, give `MoneyStrip` an optional `transfer` slot (default: the real `TransferButton`) and pass a plain `Button` in the demos, the same view-and-connected split this plan used for the dialogs. In the browser check, press Record Transfer in the plain Transfer demo once before asserting `calls` is empty.

### WR-04: The `@dashboard-showcase` check runs 18 whole-page axe passes over the 250-case showcase, so it is slow and fails under load

**File:** `web/e2e/showcase.spec.ts:361-397`

**Issue:** For each of three widths the test runs `expectNoAxeViolations(page)` once for the page and once for each of the five windows. Each run scans the whole showcase, about 250 cases, not the new section or the open dialog. That is 18 full scans per theme per project. This is why the test needs a 480 s budget and a 60 s heading wait. The SUMMARY records three of ten cases failing in run 5 even so. It also keeps the machine busy for a long time, which the other `@showcase` tests in the same run feel.

**Failure scenario:** In the phase gate on a loaded machine, `@dashboard-showcase` on WebKit times out during the eleventh axe pass. Nothing is wrong with the section, but the gate is red, and the run is re-done or the failure is waved through as "load". Both weaken the gate.

**Fix:** Scan the whole page once per width. For each window, scan only the open dialog: add an optional `include` to `pageAxe` and `expectNoAxeViolations` (`new AxeBuilder({ page }).include('[role="dialog"][aria-modal="true"]:not([aria-label="Navigation"])')`), or scope it to the section. The dialogs are also covered by the component-level axe tests in `Phase10Demos.test.tsx:402-415`. Then bring the budget back down so a real slowdown shows.

## Info

### IN-01: `Phase10Demos` is imported statically, so "on request" defers only the render, not the load

**File:** `web/src/modules/admin/components/showcase/ShowcaseDemos.tsx:48`, `:436-456`

**Issue:** The comment says the cases "mount when asked for" so they do not slow the first load. Rendering is deferred. But the static import puts the whole Phase 10 graph (about 190 KB of source, see the Summary) in the showcase chunk graph. It downloads and runs before the heading shows, on every visit to `/dev/components` and `/admin/components`. It also runs `parseLedgerPage`, `parseStaffBalances` and `parseTransferPage` and a module-level `throw` at import time. A demo-data mistake would then break the whole showcase page, not just this section.

**Fix:** Load it only when asked:

```tsx
const Phase10Demos = lazy(async () => ({ default: (await import('./Phase10Demos')).Phase10Demos }));
// in Phase10OnRequest:
if (shown) return <Suspense fallback={<SkeletonText />}><Phase10Demos /></Suspense>;
```

The same applies to `Phase9OnRequest`. Check that the budget build keeps it out of the initial admin JS (it is already out, since the showcase is lazy).

### IN-02: The demo figures do not add up across cases, which the owner's screenshot review may read as real behavior

**File:** `web/src/modules/admin/components/showcase/Phase10Demos.tsx:325-404`, `:346-357`, `:430`, `:644`

**Issue:** Three small mismatches:
- Delete with warning says "Liza Mercado's balance will be −₱500.00." after deleting a ₱2,000.00 transfer to her, so she must hold ₱1,500.00. All Staff in the same section shows Liza at −₱500.00, which would give −₱2,500.00.
- Carmen's ledger has a hand-over as money out, "Handed over by Carmen Reyes". A hand-over moves a leaver's money. It cannot leave an active Manager's own ledger. On Carmen's ledger it would be money in from Jomar Santos.
- The ledger rows are dated Nov 1 to Nov 4, 2026, while the demos' business today is Oct 8, 2026 and the chart ends in October.

**Fix:** Make Liza hold ₱1,500.00 in All Staff (and adjust the total), or set the warning to −₱2,500.00. Make the hand-over row `kind: 'transfer-in'` with `counterpart: JOMAR`. Date the ledger rows on or before Oct 8, 2026.

### IN-03: The Hand Over reserve is a fixed 72 px tied to the button's English label and to another file's 88 px

**File:** `web/src/modules/admin/components/money.recipe.ts:133-134`; `web/src/components/lists/lists.recipe.ts:128`

**Issue:** The fix works because 88 px (`pr-22` in `ResponsiveTable`) plus 72 px happens to clear an eye link plus a 121 px "Hand Over" button with about 15 px to spare. Nothing links the two numbers. A user text-spacing override (WCAG 1.4.12: letter spacing 0.12 em adds about 15 px to "Hand Over"), a label change, or a change to the row actions' gap removes the margin, and the name runs under the button again. The unit test checks only that the class is present. The browser check covers one name at 320 px. P10-BL-15 parks the layout choice itself; this note is only about how the current choice is built.

**Fix:** Name the coupling where both numbers live (one comment in each recipe, or a shared constant), or reserve the space from the actions' real width. For example, a phone card could lay the title and the actions out in a flex row instead of an absolute position. If the owner keeps option A, add a browser check with a long label under text spacing.

### IN-04: Some sweep helpers check less, or more, than their names say

**File:** `web/e2e/money-sweep.spec.ts:25`, `:28`, `:89-101`

**Issue:**
- `footerReachable` scrolls each button into view and then asserts it is in the viewport. That passes for nearly any button that exists. It only fails when the button is clipped by `overflow: hidden`.
- `PANEL_FITS` measures the first `[role="dialog"]` in the document. The always-mounted `MobileNavDrawer` panel also has that role. It works today only because `Modal` renders in place inside `main`, which comes before the drawer. A dialog rendered after the drawer would make the check measure the closed drawer and always pass.
- `TAB_STRIPS_FIT` fails if the tab strip scrolls sideways. The UI spec allows that ("Tab strip scrolls sideways; page never does", UI-SPEC UI Considerations, Tabs at 320px). A longer tab label would fail the sweep even though the spec allows it.

**Fix:** For reach, check the button is visible without scrolling the page, or that the sheet's footer is inside the sheet's box. For the panel, measure the dialog through its locator (`dialog.evaluate(...)` with a string body, as elsewhere) or select `[role="dialog"][aria-labelledby]`. For tabs, drop the strip check or ask the owner whether the stricter rule is wanted.

### IN-05: The showcase check copies the sideways-scroll test instead of importing it, and the test compares against `innerWidth`

**File:** `web/e2e/showcase.spec.ts:346`; `web/e2e/helpers.ts:13`

**Issue:** `showcase.spec.ts` redefines `NO_SIDEWAYS_SCROLL` with the same text as `helpers.ts`. Both compare `scrollWidth` with `window.innerWidth`, which includes a classic vertical scrollbar. Where the browser draws one (desktop Firefox), an overflow narrower than the scrollbar (about 12 to 17 px) is not caught. P10-BL-06 measured overflows of 6 to 18 px.

**Fix:** Import the helper, and compare with `document.documentElement.clientWidth` in the helper so every spec gets the stricter check.

### IN-06: The new `send` seam in a money-writing hook has no test of its own and no guard against app use

**File:** `web/src/modules/admin/hooks/useTransferAction.ts:27-28`, `:44-47`; `web/src/modules/admin/components/TransferModal.tsx:184-185`

**Issue:** There is no `useTransferAction` test file. The seam is covered only through the showcase. Nothing proves that, without `send`, the hook still calls `moneyService.create` for a transfer and `moneyService.handover` for a hand-over body. Nothing stops a later screen from passing `send` and showing "Transfer recorded" for a save that never reached the server.

**Fix:** Add a small hook test for both branches. Consider a lint rule (`no-restricted-syntax` on a `send` attribute of `TransferForm` outside `components/showcase/`) so only the showcase can use it.

### IN-07: The demo windows unmount at once, so they show no close animation and do not return focus to their trigger

**File:** `web/src/modules/admin/components/showcase/Phase10Demos.tsx:556-616`

**Issue:** `WindowDemo` renders `TransferForm` with `open` always true and removes it on close. The real `TransferModal` passes `open={false}` first, so the close animation plays, and it sends focus back to the button through `returnFocusTo` (Safari does not focus a clicked button). In the showcase, after Cancel, Esc or a demo save, focus lands on the page body on Safari and iPhone, and the window vanishes without its animation. The SUMMARY says the showcase shows the real parts, and the owner reviews focus and motion there.

**Fix:** Keep the form mounted and toggle `open`, and return focus to the trigger the way `TransferModal` does (a ref on the trigger button and an effect when `open` turns false).

---

_Reviewed: 2026-11-08T16:48:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

## Outcomes

| Finding | Outcome |
|---|---|
| WR-01 | Fixed in 217b7347: the comment says the 320 px case stays failing on purpose. |
| WR-02 | Fixed in f1c0e622: the money sweep dates its money 45 days back and the dashboard sweep adds ₱10.00 and ₱5.00; a node test covers the date math. |
| WR-03 | Fixed in d5d76df6: `MoneyStrip` takes a `transfer` slot and the demos pass a plain button; tests prove no window, request or fetch. |
| WR-04 | Fixed in 98ec585f: axe scans the section or the open dialog only, one test per theme and width (iPhone 6 of 6 passed, 47 to 96 s). |
| IN-01 | Fixed in 038dec62: `Phase10Demos` loads lazily; a test proves it loads only on request. |
| IN-02 | Fixed in d2b4db72: the delete warning, hand-over direction and dates agree. |
| IN-03 | Deferred to the phase-end review (fixed 72 px reserve for Hand Over at 320 px). |
| IN-04 | Fixed in e5a2aab8: the dialog, selected tab and footer checks measure what the spec says and are unit tested. New owner item P10-BL-16 (footer buttons at 320 px). |
| IN-05 | Fixed in 258fe739: one shared check comparing scrollWidth with clientWidth. |
| IN-06 | Fixed in 49040e15: hook tests for `send` plus a lint rule that bars it outside the showcase and the modal. |
| IN-07 | Deferred to the phase-end review (demo windows close without the animation and focus return). |
| X-01 | Fixed in e95e98cb: the O-6 test focuses Dismiss to pause the toast before reading it, and the showcase heading wait is 30 s (iPhone 5 of 5 passed). |
