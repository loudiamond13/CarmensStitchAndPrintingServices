# Phase 14: Hardening & Release Readiness - Context
*Created: 2026-11-26T13:45:00-06:00 · Updated: 2026-11-26T17:10:00-06:00*

**Gathered:** 2026-11-26
**Status:** Ready for planning

<domain>
## Phase Boundary

The complete app, still on an empty database, is proven ready for release:
- reviewed end to end for security (CWE Top 25 and ATT&CK, CodeQL, ZAP);
- tested by hand for accessibility (keyboard, NVDA and VoiceOver);
- installable for staff as a PWA, with View Transitions on route changes;
- backed by runbooks for data requests, breaches, break-glass mail, lockout and backup restore.

Requirements: SEC-05, A11Y-05, PERF-06, PERF-07, LEGAL-06.

**Also in scope (owner, 2026-11-26, this discussion):**
- the full end-to-end suite goes green on every browser (D-25);
- every open "your review" item from earlier phases is closed through one review pack (D-26);
- a local restore drill of a real control-panel backup (D-07).

**Owner decisions closed here:** OD-13 (D-23), C-32 (D-24) and the "no staging site" question (D-01 to D-05).
- OD-10 was already closed by Phase 12 (12 D-01 to D-07, amended by 12.1 D-53, D-61, D-64).
- No open OD-14 item is known. Any WCAG clash found in this phase goes into the D-26 review pack.

**Not in scope:**
- automated database backups (D-51, chosen before the Phase 17 cutover);
- the D-56 table-drop list (needs its own owner yes);
- legacy data work (Phases 15 to 17).

</domain>

<decisions>
## Implementation Decisions

All rulings below: owner, 2026-11-26, in this discussion. Cite them as "14 D-xx".

### Security scans and audits with no staging site
- **D-01:** **ZAP runs in two places.**
  - (1) In CI, against a production-mode build of the app (Production settings) on CI's own SQL container with an empty test database.
  - (2) Once against the live site after each release deploy, started by the owner from GitHub Actions (`workflow_dispatch`).
  - Both runs use the ZAP **baseline** scan, which is passive: it crawls and reads answers but never attacks or submits forms. An active scan never points at the live site.
  - ZAP is Apache-2.0. Record its legitimacy and license check, and pin the action or image by SHA or digest.
- **D-02:** **The CI ZAP scan runs weekly** (added to `.github/workflows/weekly.yml`) **and once before each release** (part of the release gate). It does not run on every pull request.
- **D-03:** **Finding rules:**
  - High (and Critical) and Medium findings are fixed, or brought to the owner for a named acceptance.
  - Low and Info findings are listed in the report, each with an outcome: fixed, accepted, or false alarm.
  - Nothing is dropped silently.
- **D-04:** **The CI scan also scans signed in**, as a seeded test Manager on the empty test database, so the staff API answers are scanned. The live scan stays signed out. No real account, sign-in code or live data is used by a scanner.
- **D-05:** **Lighthouse is re-audited on the live site, on every public page, on mobile, at 95 or more.**
  - A shortfall caused by our code is fixed.
  - A shortfall caused by the host (for example a slow first response on shared hosting) goes to the owner for a named acceptance, with the evidence.
  - The CI Lighthouse check stays as it is.
  - The open `/gallery` choice (12-24) goes into the D-27 review pack.
- **D-06:** **Scanner visits are not counted in Visitor Stats.** The bot filter (12 D-21, `AnalyticsBots`) recognises the ZAP and Lighthouse user agents, and a test proves it.
- **D-07:** **Local restore drill.**
  - The owner makes one SmarterASP.NET control-panel backup and downloads it by FTP into `_local/`. It is never committed, uploaded or deployed.
  - It is restored into `(localdb)\MSSQLLocalDB` under a `CSPS_` name. It never goes into `CSPS_Dev`, `CSPS_Legacy_Restore` or any `BetsLLC_*` database.
  - The restore is checked (tables and row counts match, and the app opens against it), then the drill database is dropped.
  - The steps become a runbook, `docs/operations/backup-restore.md`.
  - The backup holds real data (staff accounts, quote requests), so the drill output stays on the owner's PC.
  - **Reversibility:** reversible. The drill only reads a copy.

### Manual accessibility passes (A11Y-05)
- **D-08:** **Claude writes, the owner runs.**
  - Claude writes a step-by-step script for each flow: the keys to press and what the screen reader should say.
  - Claude runs and records the keyboard-only pass itself.
  - The owner runs NVDA on their Windows PC and VoiceOver on their iPhone, and ticks pass or fail per step.
  - Each failure gets a recorded outcome, and any WCAG 2.2 AA failure is fixed before release.
- **D-09:** **Eight critical flows.** "Consent" is gone (12.1 D-59), so these are the flows:
  1. sign-in with the emailed code
  2. forgot password
  3. create an order
  4. record a payment
  5. add an expense
  6. Get a Quote with photos, on a phone
  7. Gallery and lightbox, including the phone tap zones (02 D-06)
  8. Quote inbox to order
- **D-10:** **Where each pass runs.**
  - **NVDA:** every flow, on the owner's PC against `CSPS_Dev`. Run the preflight first.
  - **VoiceOver:** every flow, on the iPhone against the live site.
  - **Staff flows on live** use the owner's own account. The test order and expense are named `TEST` and deleted afterwards.
  - **The test quote request is marked Spam.** Its photos then go within a day (13 D-04), and its text at the 6-month purge.
  - Audit entries from the test stay, because the audit log is append-only.

### Staff app install (PERF-06) and motion (PERF-07)
- **D-11:** **Built with `vite-plugin-pwa`** (MIT; pulls in Workbox, MIT), as the stack plan names it, with `injectRegister: null` so registration stays under the strict CSP. Before installing, Claude checks the exact version and the owner says yes:
  - age at least 14 days
  - advisories
  - open bugs and regressions
  - deprecation
  - license
- **D-12:** **Only the staff portal is installable.** The manifest scope covers the admin pages, and the installed app opens at the staff sign-in. Public pages get no manifest link, no service worker registration and no install prompt, so the public bundle budget and Lighthouse scores are untouched.
- **D-13:** **The service worker caches only static build assets and the app shell.** It never caches `/api/*` or any signed-in response, and tests prove it.
- **D-14:** **Update prompt:**
  - After a deploy, a banner says "A new version is available." with a Reload button.
  - The app never reloads by itself, so a half-filled form is never lost.
  - The banner stays until it is tapped or the app is next opened.
- **D-15:** **Offline page:**
  - With no signal, the installed app shows a plain page: "You're offline. Orders and payments need a connection. Try again when you have signal." with a Try again button.
  - Nothing is stored on the device.
  - The final wording goes through `/gsd-ui-phase 14` (OR-4: no long dash).

### Runbooks and sign-off (LEGAL-06, SEC-05)
- **D-16:** **A deletion request covers quote requests only.**
  - That person's quote requests and their photos are deleted.
  - Orders, payments and other money records stay unchanged, because they are kept forever as financial records (OD-10).
  - The reply to the customer says what was kept and why.
  - No "remove personal details" action is built.
  - **Researcher check:** confirm the inbox can truly delete a request. Today, Spam deletes the photos but keeps the text until the 6-month purge (13 D-04). If there is no real delete, the planner brings the gap to the owner before building anything.
  - **Researcher check:** confirm the Privacy Policy says orders are kept as financial records. Any wording change needs the owner's approval (12.1 D-73).
- **D-17:** **The owner is the Data Protection Officer (DPO).**
  - A Manager may do the day-to-day steps but brings every request and every possible breach to the owner.
  - The runbooks say "the owner" and put no name, email or phone in git.
- **D-18:** **Request handling:**
  - Requests to see, fix or delete data are answered within **15 days**.
  - We act only when the request comes from the email or phone number already on that person's quote or order, or they confirm by replying from it. Anything else gets one polite question before any data is shared.
  - No ID photos are asked for or kept.
- **D-19:** **Breach first steps:**
  - On a suspected breach, a Manager may at once, using the existing screens: deactivate the account, end its sessions, and set a temporary password. They then message the owner straight away.
  - These stay with the owner: changing host secrets, taking the site down (holding page), and any notice to the NPC or customers.
  - The breach steps follow the NPC 72-hour notice rule (RA 10173, NPC Circular 16-03) by default.
  - Claude is not a lawyer: the runbook marks the points the owner should confirm with the NPC or an adviser.
- **D-20:** **One active Manager is fine, with no two-Manager rule and no in-app warning.**
  - The lockout runbook documents waiting out the 15-minute lock, and the password reset by email.
  - A Manager lock with no second Manager to lift it (05 D-16) is fixed by a reviewed one-off step that Claude prepares on request. The owner says yes before it runs. It uses the ORM API, never inline SQL. It is not built in advance.
- **D-21:** **Break-glass mail and lockout runbooks** become their own pages in `docs/operations/`. They follow 04 D-29 and `bootstrap-manager.md`: if mail breaks, fix the SMTP settings (`mail-setup.md`). There is never a bypass of the emailed code.
- **D-22:** **How the owner signs:**
  - The security checklist (and the screen-reader results record) is a markdown file in `docs/operations/`.
  - The owner reads it and replies "signed" in chat.
  - Claude then adds `Signed: owner, <date>`, with no name, email or device id.

### Confirmed earlier rulings
- **D-23:** **OD-13 confirmed: OpenAPI and Scalar stay Development-only** (01 D-14). A test proves `/openapi/v1.json` and `/scalar` answer 404 in Production.
- **D-24:** **C-32 confirmed as built:** Data Protection keys are encrypted with the host-secret certificate (`ProtectKeysWithCertificate`, `docs/operations/data-protection-rotation.md`). Phase 14 checks that the live logs show no unencrypted-key warning, and adds a row to the security checklist.

### Release blockers from the backlog
- **D-25:** **The full end-to-end suite must be green on every browser project** (Chromium, Firefox, WebKit, iPhone) before release.
  - Phase 14 includes a debug plan for the known WebKit and iPhone failures and the Firefox flakes (09-30, the 12.1 final gate, 12.1 D-139).
  - A still-flaky test is re-run alone and recorded, never hidden.
  - A green full run is the evidence for "release ready".
- **D-26:** **One review pack closes every open owner-review item.**
  - Phase 14 collects every open item in STATE.md into one review pack (the `docs/web/owner-review.md` pattern), each with Claude's recommendation first.
  - The owner rules them in one sitting, and Phase 14 builds what is chosen. Nothing is left open at release.
  - Known items:
    - 09-08 photo-list looks and wording
    - 12-13 Staff Login target size
    - 12-20 map card notes
    - 12-24 `/gallery` Lighthouse and notes
    - 12-25 trend chart choices
    - the 06-21 two-minute retry wait
    - the cancelled-request logging quick task (06 D-59)
  - The planner adds any other open item it finds.
  - Excluded: items owned by later work (D-51 backup automation, the D-56 drop list, the legacy phases).

### UI-SPEC rulings (owner, 2026-11-26, `/gsd-ui-phase 14`)
These answer the open questions in `14-UI-SPEC.md` (OQ-1 to OQ-4) and the owner calls the UI checker found.
- **D-27 (OQ-3):** the update banner adds a second line, "Save your work first, then reload." Only Site Content warns before leaving a page today, so this protects half-filled forms. Amends D-14's wording.
- **D-28 (OQ-1):** no in-app "Install app" button. Staff install from the browser menu, and a short how-to page in `docs/operations/` shows the steps.
- **D-29 (OQ-2):** no offline strip while the app is already open. Each action keeps today's failure message and every form keeps what was typed. The offline screen (D-15) shows only when a page opens with no signal.
- **D-30 (OQ-4):** under reduced motion the loading spinner keeps its slow turn (one turn every 2.4 seconds, spec §10). Every other animation, transition and smooth scroll stops. Narrows PERF-07's "all motion stops" for this one indicator.
- **D-31:** the offline screen button reads "Try Again" (Title Case, matching every other button and the existing error screen). Amends D-15's "Try again".
- **D-32:** the offline screen uses the staff sign-in card look (the AuthFrame: "CSPS Admin" label, heading, one button). Amends D-15's "plain page". The D-15 words stay as written.
- **D-33:** the smaller choices the UI-SPEC made are accepted as working defaults. The owner checks them for real at `/gsd-ui-review 14` and may change any of them then:
  - a new version is checked for when the app opens and when it comes back to the front, at most once an hour;
  - pending button text "Reloading" and "Checking";
  - the failed-retry line "Still no signal. Check your mobile data or Wi-Fi, then try again.";
  - no automatic retry on the offline screen;
  - the offline screen also shows in an ordinary admin browser tab once the service worker is installed, and on `/admin/login`;
  - the banner sits under the top bar, scrolls with the page, has no close button, also shows on the sign-in screens, and Reload in one tab updates every tab;
  - the manifest settings beyond name, icons and colour (`id`, `start_url` `/admin/login`, `display: standalone`, `background_color`, no orientation, no shortcuts), the manifest description and the iPhone app title;
  - no page fade for Back and Forward, the phone menu drawer, URL-only changes, dialogs or the lightbox;
  - the admin head tags are added on entry to `/admin` and removed on leaving.

### Claude's Discretion
- The installed app's name and short name, its icons (from `web/public/mark.svg`) and its theme colour. Final look goes through `/gsd-ui-phase 14`.
- The View Transitions style: a short, subtle change between routes, used only where the browser supports it. All motion stops under `prefers-reduced-motion`.
- The format and file layout of the full CWE Top 25 and ATT&CK review, as long as every mitigation names the test that proves it (SEC-05).
- When the live ZAP scan runs after a deploy (for example right after the smoke test).
- The name of the restore-drill database (`CSPS_` prefix, dropped by the drill steps).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 14: goal, success criteria, owner decisions, "no staging site" note
- `.planning/REQUIREMENTS.md`: SEC-05, A11Y-05, PERF-06, PERF-07, LEGAL-06
- `CSPS-PRD.md` §11.5 (pre-release security checklist), §11, §12, §7.1, §19 (hardening topics listed in PROJECT.md)
- `.planning/PROJECT.md`: OD-10, OD-13, OD-14, C-16; the Hardening bullet (includes the backup/restore test)
- `.planning/research/SUMMARY.md`: C-32, C-35

### Hosting and deploy (no staging)
- `.planning/HOSTING-RECORD.md`: A9 (no staging site), D-11
- `docs/operations/deploy.md`: the release deploy and smoke test the live ZAP and Lighthouse runs follow
- `docs/web/release-gates.md`, `docs/web/budgets.md`, `docs/web/e2e.md`: existing gates this phase extends
- `.github/workflows/weekly.yml`, `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/deploy.yml`

### Earlier rulings this phase builds on
- `.planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md`: D-14 (OpenAPI/Scalar Development only), C-32 key protection
- `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md`: D-02 to D-06 (WCAG clashes, lightbox tap zones)
- `.planning/phases/04-identity-authentication/04-CONTEXT.md`: D-29 (no bypass of the emailed code), break-glass
- `.planning/phases/05-profile-user-management/05-CONTEXT.md`: D-16 (Manager lock), last-Manager guard
- `.planning/phases/12-consent-analytics-legal/12-CONTEXT.md`: D-01 to D-07 (retention, OD-10), D-21 (bots and staff not counted)
- `.planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-CONTEXT.md`: D-59 (consent removed), D-73 (Privacy Policy approval), D-139 (DoD gaps on PR #28)
- `.planning/phases/13-quote-inquiries/13-CONTEXT.md`: D-04 (Spam deletes photos), the 6-month purge
- `.planning/STATE.md`: the open owner-review and blocker items for the D-26 pack; D-51 (manual backups)

### Existing runbooks to sit alongside
- `docs/operations/bootstrap-manager.md`, `docs/operations/mail-setup.md`, `docs/operations/data-protection-rotation.md`, `docs/operations/audit-log.md`, `docs/operations/maintenance.md`, `docs/operations/cutover-runbook.md`
- `docs/web/owner-review.md`: the review-pack pattern (D-26)

### Legal (cited in the runbooks, not legal advice)
- Republic Act 10173 (Data Privacy Act of 2012) and NPC Circular 16-03 (personal data breach management, 72-hour notice)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Csps.Domain/Analytics/AnalyticsBots.cs` and `CollectPageViewHandler.cs`: the bot filter to extend for ZAP and Lighthouse user agents (D-06).
- `web/scripts/lighthouse.mjs` and `lighthouse` 13.5.0 (dev dependency): reuse for the live public-page audit (D-05).
- `web/scripts/e2e.mjs`, `docs/web/e2e.md`: the end-to-end runner for the D-25 debug plan.
- `web/public/mark.svg`: source for the PWA icons.
- Existing admin screens for breach first steps: deactivate, end sessions, temporary password (Phase 5). The quote inbox for deletion requests (Phase 13).
- The owner review pack pattern (`docs/web/owner-review.md`, `artifacts/owner-review/index.html`, made locally and never committed).

### Established Patterns
- Strict CSP with no inline script: register the service worker from bundled code (`injectRegister: null`).
- Package adoption: an exact-version check, recorded in RESEARCH.md, then an owner yes (14-day cool-down, allowed licenses).
- CI uses the SQL 2025 container on ubuntu (`CSPS_TEST_SQL=container`). Local runs use LocalDB and never Docker.
- Owner sign-offs are recorded as dated rulings with no personal details (the repo is public).
- Markdown files carry created and updated timestamps.

### Integration Points
- `web/vite.config.*`: the PWA plugin, limited to the admin entry and routes.
- Admin layout and router (`web/src/layouts/AdminLayout`, `web/src/core/routes/`): the update banner, the offline page and View Transitions hooks.
- `.github/workflows/weekly.yml` and the release gate: the CI ZAP job. A new owner-dispatched workflow, or a deploy follow-up step, runs the live ZAP and Lighthouse.
- `docs/operations/`: new pages for data requests, breach response, break-glass mail, lockout, backup restore and the security checklist.

</code_context>

<specifics>
## Specific Ideas

- Update banner text: "A new version is available." with a Reload button (D-14).
- Offline page text: "You're offline. Orders and payments need a connection. Try again when you have signal." with a Try again button (D-15).
- Live test data during the VoiceOver pass is named `TEST` and removed afterwards (D-10).
- Sign-off line format: `Signed: owner, <date>` (D-22).

</specifics>

<deferred>
## Deferred Ideas

- Automated database backups (09-31, 09-32, D-51): chosen before the Phase 17 cutover (CUT-01). Backups stay manual meanwhile.
- A Manager-only "remove personal details" action for orders: considered and not chosen (D-16). It would be its own change if ever wanted.
- An in-app warning when only one active Manager exists: considered and not chosen (D-20).
- Making the public site installable: not chosen (D-12).

</deferred>

---

*Phase: 14-hardening-release-readiness*
*Context gathered: 2026-11-26*
