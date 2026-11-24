---
phase: 13-quote-inquiries
created: 2026-11-24T00:15:16-06:00
updated: 2026-11-24T00:15:16-06:00
reviewed: 2026-11-24T00:15:16-06:00
depth: standard
wave: 11
plans: [13-23]
diff: 02fc304a..2eb37c40
files_reviewed: 18
files_reviewed_list:
  - web/src/dev/previews/PublicShell.tsx
  - web/src/dev/previews/QuoteFormDemo.tsx
  - web/src/dev/scenarios/groups/quote.test.tsx
  - web/src/dev/scenarios/groups/quote.ts
  - web/src/dev/scenarios/index.test.ts
  - web/src/modules/admin/components/showcase/Phase13Demos.test.tsx
  - web/src/modules/admin/components/showcase/Phase13Demos.tsx
  - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
  - web/src/modules/admin/components/showcase/showcaseCopy.ts
  - web/src/modules/admin/components/showcase/showcaseSections.test.ts
  - web/src/modules/admin/components/showcase/showcaseSections.ts
  - web/src/modules/admin/pages/ComponentShowcasePage.lazy.test.tsx
  - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
  - web/src/modules/admin/pages/ComponentShowcasePage.tsx
  - web/src/modules/public/components/QuoteForm.tsx
  - web/src/modules/public/components/QuoteFormPhotos.test.tsx
  - web/src/modules/public/hooks/useQuoteTicket.ts
  - web/src/modules/public/quotePhotoUpload.ts
findings:
  critical: 1
  warning: 6
  info: 7
  total: 14
status: issues_found
---

# Phase 13: Code Review Report (wave 11, plan 13-23)

*Created: 2026-11-24T00:15:16-06:00 · Updated: 2026-11-24T00:15:16-06:00*

**Reviewed:** 2026-11-24T00:15:16-06:00
**Depth:** standard (with call-chain checks into `publicResource`, `useQuoteTicket`, `QuotePhotoSlot`, `QuotePhotoPicker`, `QuoteSendAnswers`, `UiLink`, `Sidebar`, `dev/kit.ts`, the router and the build-output test)
**Files Reviewed:** 18 (the 13-23 plan, summary and the UI-SPEC "Component Showcase additions" row were read for context only)
**Status:** issues_found

## Summary

I read the whole 13-23 diff and the code it calls. I did not run tests, a dev server, a build or Playwright. The only commands were small read-only greps.

What holds up:

- **The `service` prop is safe for visitors.** The default is the real `quoteService`, in `QuoteForm`, `useQuoteTicket` and `uploadPhotos`. The Contact page renders `<Form />` with no props, so nothing changes for a visitor. A visitor cannot set a prop. No path in `QuoteForm` calls `quoteService` directly any more: the ticket, the create, the resend after an expired ticket and the photo uploads all go through `service`.
- **The demo service cannot send a quote.** `demoService` answers `getTicket`, `create` and `uploadPhoto` itself. The form's other reads (shop facts, product lines) are primed, so they are not loaded either. The tests check both MSW and `fetch`.
- **The showcase is Manager-only.** `/admin/components` uses the `requireManager` loader. The dev routes are compiled out of production (`__DEV_ROUTES__`).
- **Focus-moving states are on request.** Field errors (first field takes focus), sent and sent-with-missing-photos (heading takes focus) are in `ON_DEMAND`. I checked the eager ones: the refused-file path, the pending send, the 429 box and the 5xx box do not move focus.
- **The steps reach the right states.** The invalid values break the real rules (team 107 > 100, message 2,029 > 2,000 after trim, `12345`, `juan@`). `QuotePhotoSlot.settled()` waits for the first pick, so `requestSubmit()` right after the pick still sends the photos. A 422 on an upload is not retried, so slots 1 and 2 show as missing.
- **No em or en dash** in any changed `web/src` file (checked for U+2012 to U+2015). No `console`, `TODO` or new `eslint-disable`.

The main problem: the demo writes made-up shop data into the app-wide public stores, and the showcase has live links to the real public pages. In production, a Manager who clicks one of those links sees the fake data on the real pages (CR-01). The plan's "dev-only, never shipped" claim is also wrong for this preview (WR-02).

## Critical Issues

### CR-01: The quote demo puts fake product lines (and shop facts) into the real public pages of the same tab

**File:** `web/src/dev/previews/QuoteFormDemo.tsx:49-53, 212`; the store is `web/src/lib/public-data/publicResource.ts:152-155`
**Issue:** `primeDemoData` calls `productLinesResource.prime(DEMO_LINES)` and `siteResource.prime(PARITY_SITE)`. Each is one store shared by the whole app, not a copy for the demo. `prime` marks the data fresh for 5 minutes (`SITE_STALE_MS`, `PRODUCT_LINES_STALE_MS`), and nothing undoes it when the demo unmounts.

This runs in production. `/admin/components` ships for Managers, `dev/kit.ts` imports every `dev/previews/*.tsx` eagerly, and five quote cases mount as soon as the page opens. The showcase has client-side links to public pages that are not blocked:
- the `site-header-home` scenario (Products, Gallery, Contact),
- the "View Products" ButtonLink scenario,
- and now each quote form's own "privacy notice" `UiLink to="/privacy"` (a react-router `Link`).

Steps: a Manager opens the showcase, then presses Products in the header scenario. The real Products page renders in the same document and reads the fresh store. It shows the two fake lines, "Basketball Jerseys" and "Polo Shirts", with empty text, for up to 5 minutes. The real Contact form then offers those two lines too. A Manager who sends a real quote from it picks a line key the server may not have (a 400), or one that happens to match a real key.

Before this plan, the product-lines store was never primed in the showcase. So this is new. The site store was already primed when `PublicShell.tsx` was imported (line 41, plan 11-10). This plan primes it again on every mount, and adds a new path to it (`/privacy`).

**Fix:** keep the demo's data out of the app-wide stores. Two options; the owner should choose:
- A (recommended, smallest): undo the prime when the last quote demo unmounts, and block the links in the quote cases (see WR-01). For example, add a `reset()` to `PublicResource` and keep a mount count in the demo:
  ```tsx
  let mounted = 0;
  function useDemoData(): void {
    useLayoutEffect(() => {
      mounted += 1;
      primeDemoData();
      return () => {
        mounted -= 1;
        if (mounted === 0) {
          productLinesResource.reset();
          siteResource.reset();
        }
      };
    }, []);
  }
  ```
  Move the import-time `siteResource.prime(PARITY_SITE)` in `PublicShell.tsx` into the same hook, so loading the showcase chunk changes no store by itself.
- B: let the showcase read the real shop facts and product lines (two harmless GETs). Prime only on the parity page. This drops the "no network call" truth for the showcase and needs an owner ruling.

Add a test: mount the quote demo, unmount it, then render `ProductsPage`. It must not show "Polo Shirts".

## Warnings

### WR-01: The quote cases have live links that leave the showcase, one to a third-party Messenger page

**File:** `web/src/dev/previews/QuoteFormDemo.tsx:213-219`; `web/src/modules/admin/pages/ComponentShowcasePage.tsx:140-147`
**Issue:** `Phase13Demos` wraps its parts in `Still` (click capture, `preventDefault`) so that "a press on a link stays on the showcase". The quote cases have no such guard:
- the privacy notice link goes to `/privacy` in the same tab (this is the path into CR-01);
- in `quote-form-rate-limited` (eager) and `quote-form-sent-photos-missing`, "Message Us on Messenger" goes to `https://m.me/cspsdemo`. That is a real outside site, and the shop does not own a "cspsdemo" account, so anyone could hold that name.

**Fix:** in `QuoteFormDemo`, catch clicks on links only, so Send and Send Another still work:
```tsx
const stayHere = (event: MouseEvent): void => {
  if (event.target instanceof Element && event.target.closest('a') !== null) event.preventDefault();
};
<div ref={frame} onClickCapture={stayHere}>...</div>
```
Also use a reserved, clearly fake Messenger URL in `PARITY_SITE`, or point it at `#`. Add a test that presses the privacy and Messenger links and stays on the case.

### WR-02: "Never shipped, D-20" is false for QuoteFormDemo; the threat disposition is wrong

**File:** `web/src/dev/previews/QuoteFormDemo.tsx:1`; `13-23-SUMMARY.md` "Threat Flags"; plan must-have 4
**Issue:** `ComponentShowcasePage.tsx:27` imports `@/dev/kit`, and `kit.ts:12` loads `./previews/*.tsx` with `eager: true`. The showcase ships for Managers (D-20 reversed, plan 04-25). So `QuoteFormDemo`, its demo service and its demo values are in the production `ComponentShowcasePage` chunk graph. The current production build shows the same for its neighbour: `src/Csps.Server/wwwroot/assets/ComponentShowcasePage-L8yPjFLt.js` contains `cspsdemo` from `PublicShell.tsx`.

The header comment ("never shipped, D-20"), the summary ("all new code under web/src/dev stays dev-only") and the plan truth ("the production build has no showcase or scenario module") all say otherwise. The `build-output` guard only checks the dev route copy ("Open Component Showcase", "Development only") and `/dev/` paths, not the previews. The static chunk can be downloaded without signing in (T-05-96), so whatever it holds is public. Today that is only fake data, which is fine, but the record is wrong, and a later plan may trust it.

**Fix:** change the header to say what is true, for example "Dev and showcase only: ships in the Manager showcase chunk, never in a public chunk." Correct T-13-66 in the summary. Add a build-output check that the quote demo's strings (for example `Brgy. San Roque Ballers`, `demo-ticket`) appear only in `showcaseChunks()`.

### WR-03: The demo phone number is not a UI-SPEC sample and may belong to a real person

**File:** `web/src/dev/previews/QuoteFormDemo.tsx:67, 71`
**Issue:** The UI-SPEC sample is `0917 123 4567` (13-UI-SPEC lines 263, 355, 407, 473). The demo uses `0917 555 0123`. The comment calls it "a 0917 555 01xx number", as if that range were set aside for fiction. It is not: the 555-01xx fiction range is a North American rule. In the Philippines, `0917 555 0123` is a valid Globe mobile number. It ships in a production chunk (WR-02), and the brief allows no phone numbers beyond the UI-SPEC samples.
**Fix:** use `0917 123 4567` and drop the "555 01xx" wording. The test fixtures (`web/src/test/quoteRequestFixtures.ts:28, 118`, `0917 555 0101`) are outside this diff. Note them as a follow-up.

### WR-04: The new `service` prop is read two ways: once for the ticket, every render for the rest

**File:** `web/src/modules/public/hooks/useQuoteTicket.ts:88`; `web/src/modules/public/components/QuoteForm.tsx:101, 142, 150, 164, 182`
**Issue:** `useQuoteTicket` keeps the `service` of the first render (inside `useState`). `create`, the resend and `sendWithPhotos` use the current prop. A caller that passes a new object each render (`service={{ ...demo }}`) would read tickets from the first service and create through the latest. That is how a seam gets misused later. No current caller does it: production uses the default, and the demo pins its service in `useState`.
**Fix:** pin it once in `QuoteForm` and say so in the prop's comment:
```tsx
export function QuoteForm({ service = quoteService }: QuoteFormProps = {}) {
  // Read once: the ticket and the sends must use the same service.
  const [api] = useState(() => service);
  const tickets = useQuoteTicket(api);
  // ...api.create(...), sendWithPhotos({ ..., service: api })
```

### WR-05: A Manager-only demo now shapes the public Contact bundle, which has 1.68 KB left

**File:** `web/src/dev/previews/QuoteFormDemo.tsx:7-8, 23-25`; owner item P13-23-3
**Issue:** The summary reports Contact going from 148.22 to 148.32 KB of 150. The reason is that the showcase now also loads `QuoteForm` and the public stores, so the bundler regroups the modules they share. The public chunk graph now depends on admin showcase code. Any later showcase change can move public bytes without touching a public file, and the budget run is the only thing that would notice. This is parked as P13-23-3, but there is no ruling yet.
**Fix:** get the owner's ruling on P13-23-3 before shipping (B removes the cost). If A stays, write the ruling down in `DECISIONS.md` and add a line to the budget report saying the showcase shares the quote form piece.

### WR-06: The tests do not prove the focus claim

**File:** `web/src/modules/admin/pages/ComponentShowcasePage.test.tsx:452-462`; `web/src/dev/scenarios/groups/quote.test.tsx`
**Issue:**
- The on-request test waits for `findByRole('heading', { level: 2 })`. The form's own title "Inquiry form" is an h2, so the test passes as soon as the empty form draws. It does not show that the field-errors or sent state was reached, or that focus moved.
- No test shows that the five eager quote cases leave focus alone when the showcase loads. `ON_DEMAND` is a hand-kept list. If a later change makes the 429 box take focus, nothing fails.
**Fix:** in the showcase test, after the eager cases reach their states (reuse the `READY` texts), assert `document.activeElement === document.body`. In the on-request test, wait for the state's own text ("Enter your name.", "Inquiry sent") and assert focus is inside the case.

## Info

### IN-01: Three alert boxes announce at once when the showcase opens

**File:** `web/src/dev/scenarios/groups/quote.ts:227-236`; `ComponentShowcasePage.tsx:52-58`
**Issue:** The eager `photos-refused`, `rate-limited` and `send-failed` cases each insert a `role="alert"` after load. A screen reader reads all three as the page opens. This is not a WCAG failure, but it is noisy for the owner's review.
**Fix:** add these three to `ON_DEMAND` too, or accept it and say so.

### IN-02: The new QuoteFormPhotos test removes its MSW listener only when it passes

**File:** `web/src/modules/public/components/QuoteFormPhotos.test.tsx:507-541`
**Issue:** `server.events.removeAllListeners()` is the last line of the test body. If an assertion fails earlier, the listener stays for the rest of the file. Unlike `quote.test.tsx`, it also does not spy on `fetch`.
**Fix:** move the cleanup to an `afterEach` or a `try/finally`.

### IN-03: "Sends no request" is checked only at the moment the state shows

**File:** `web/src/dev/scenarios/groups/quote.test.tsx:171-189`
**Issue:** A request made after `READY` resolves (for example a stale reload, or the photo preview path) would not be counted.
**Fix:** wait one more tick (`await new Promise((r) => setTimeout(r, 0))`) or flush timers before the `requests` and `fetchSpy` checks.

### IN-04: A failed load of the form piece takes down the whole showcase page

**File:** `web/src/dev/previews/QuoteFormDemo.tsx:215-218`
**Issue:** The lazy `DemoForm` has a `Suspense` but no error boundary. A chunk that fails to load (for example after a redeploy) throws up to the route boundary, so the whole showcase is replaced. The Phase 10, 11 and 13 on-request chunks have the same gap.
**Fix:** wrap each case in a small boundary that shows "This example could not load."

### IN-05: The UI-SPEC "dev public page" is not built as written

**File:** 13-UI-SPEC.md line 119; owner item P13-23-2
**Issue:** The form states are in the showcase and on the parity page, not on `/dev/public`. This is recorded and parked. It is listed here so it gets a recorded outcome.
**Fix:** owner ruling on P13-23-2.

### IN-06: Two plan acceptance greps still fail as written

**File:** `13-23-PLAN.md` Task 1 and Task 2 acceptance criteria
**Issue:** `grep -c "Phase13" showcaseSections.ts` and `grep -c "quote" dev/scenarios/index.ts` both return 0. The summary explains why. A later verifier that runs the plan's checks as written will still fail.
**Fix:** update the plan's acceptance lines to the real ones (`EXTRA_CASES` in `ShowcaseDemos.tsx`; the `index.test.ts` case).

### IN-07: The sidebar demos add four more "Admin" nav landmarks and a second "current page"

**File:** `web/src/modules/admin/components/showcase/Phase13Demos.tsx:70-76, 132-134`
**Issue:** Each `NavDemo` renders the real `Sidebar` (`<nav aria-label="Admin">`). The 99+ case sets `active="quotes"`, so `aria-current="page"` lands on Quote Requests while the real sidebar marks Components. Screen-reader users of the showcase hear five Admin navs and two current pages. axe here runs only the WCAG tags, so `landmark-unique` is not checked. Earlier Sidebar scenarios share this.
**Fix:** mark the sidebar demos `inert` (they are still pictures, and `Still` already blocks their clicks), or accept it as a showcase pattern and record it.

---

_Reviewed: 2026-11-24T00:15:16-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
