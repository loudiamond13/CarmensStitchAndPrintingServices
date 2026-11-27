# Phase 14: Hardening & Release Readiness - Research

*Created: 2026-11-26T18:16:00-06:00 · Updated: 2026-11-26T18:16:00-06:00*

**Researched:** 2026-11-26
**Domain:** release hardening: security review and scanning (CodeQL, OWASP ZAP), manual accessibility passes, staff PWA (vite-plugin-pwa / Workbox), View Transitions and reduced motion, operations runbooks, restore drill
**Confidence:** HIGH for the codebase facts and the PWA package behavior (read from source this session); MEDIUM for ZAP configuration details and the legal points; LOW where tagged `[ASSUMED]`

> **Branch note for the planner.** `14-CONTEXT.md`, `14-UI-SPEC.md` and the Phase 14 `STATE.md` exist only on branch `gsd/phase-14-hardening-release-readiness` (commits `6098f468` to `3e4b9868`). The working tree during this research was on `gsd/phase-13-records`, so they were read with `git show`. This file was written into the working tree and was **not committed**. Move it to the Phase 14 branch before planning.

## Summary

Phase 14 is mostly checklist work on top of a codebase that already has most controls in place. The research found five things that change the plan, beyond the checklist itself:

1. **CodeQL is not clean today.** The repository has 11 open code-scanning alerts (8 high, 3 medium): `cs/web/missing-x-frame-options` on `src/Csps.Server/web.config` and six `bin/` copies of it, `js/disabling-certificate-validation` in `web/scripts/deploy.mjs:363`, two `js/bad-code-sanitization` in dev or test scripts, and `cs/web/cookie-secure-not-set` in a test probe controller. One Dependabot alert is open (minimatch `GHSA-g3hv-75wg-m249`, already owner-accepted until 2026-12-14). Success criterion 1 needs each one fixed or given a named outcome.
2. **vite-plugin-pwa has four traps in this app.** (a) The plugin injects `<link rel="manifest">` into `index.html`, which is the shell of every public page, so `manifest` must be `false` and the manifest shipped another way (D-12). (b) Its Workbox default `navigateFallback: "index.html"` points at a file the server never serves raw, so the worker would fail to install. (c) In `prompt` mode every open tab reloads by itself once another tab presses Reload, unless the v1.3.0+ `onNeedReload` callback is supplied (breaks D-14). (d) `injectRegister: null` is marked deprecated in 2.0.0; `false` is the same behavior. Also, the UI-SPEC scope `/admin/` does not cover the dashboard at `/admin`.
3. **Adding vite-plugin-pwa will trip two existing gates.** Its Workbox build tree brings `glob@11` and `minimatch@10` (BlueOak-1.0.0 license) into the **build** scope, but the owner's BlueOak exception covers only `test` and `tool`. The same two packages carry the two moderate advisories already accepted until **2026-12-14**. Both need an owner ruling before install.
4. **Signed-in ZAP in a Production build has no ready sign-in path.** Production mode has no Testing mail sink, SMTP must use TLS with a valid certificate, and every token needs an active server-side session. The plan needs a small CI-only helper (options below). It also needs a way to reach staff API answers without submitting forms: a GET-only request list built from the committed OpenAPI snapshot (54 GET operations).
5. **D-16 gap confirmed, but it matches the Privacy Policy.** Delete Request is a real hard delete (Manager only, photos queued for removal). It refuses a request that became an order (`quote-requests.converted-locked`). The Privacy Policy already says converted requests are "Kept as long as the order", so a deletion request cannot remove a converted quote. The planner brings this to the owner (D-16 says so) before building anything.

**Primary recommendation:** Plan Phase 14 as five tracks that share no files: (A) security review, CodeQL triage and the ZAP CI and live workflows; (B) PWA plus View Transitions behind one owner package checkpoint; (C) runbooks, checklist and restore drill; (D) the manual accessibility scripts and records; (E) the D-25 e2e debug and the D-26 review pack. Put the owner gates first: package yes, BlueOak scope, audit exception renewal, D-16 converted gap, ZAP sign-in helper.

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied from `14-CONTEXT.md` on branch `gsd/phase-14-hardening-release-readiness`. All rulings: owner, 2026-11-26. Cite them as "14 D-xx".

### Locked Decisions

#### Security scans and audits with no staging site
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

#### Manual accessibility passes (A11Y-05)
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

#### Staff app install (PERF-06) and motion (PERF-07)
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

#### Runbooks and sign-off (LEGAL-06, SEC-05)
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

#### Confirmed earlier rulings
- **D-23:** **OD-13 confirmed: OpenAPI and Scalar stay Development-only** (01 D-14). A test proves `/openapi/v1.json` and `/scalar` answer 404 in Production.
- **D-24:** **C-32 confirmed as built:** Data Protection keys are encrypted with the host-secret certificate (`ProtectKeysWithCertificate`, `docs/operations/data-protection-rotation.md`). Phase 14 checks that the live logs show no unencrypted-key warning, and adds a row to the security checklist.

#### Release blockers from the backlog
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

#### UI-SPEC rulings (owner, 2026-11-26, `/gsd-ui-phase 14`)
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

### Deferred Ideas (OUT OF SCOPE)
- Automated database backups (09-31, 09-32, D-51): chosen before the Phase 17 cutover (CUT-01). Backups stay manual meanwhile.
- A Manager-only "remove personal details" action for orders: considered and not chosen (D-16). It would be its own change if ever wanted.
- An in-app warning when only one active Manager exists: considered and not chosen (D-20).
- Making the public site installable: not chosen (D-12).

**UI contract:** `14-UI-SPEC.md` (status: approved, 2026-11-26) is binding for W1 to W4 (manifest values, icons, update banner, offline screen, View Transitions, reduced-motion audit) and lists W5 review-pack recommendations. The planner reads it in full. This research flags three places where the UI-SPEC needs a recorded deviation (scope, `injectRegister`, shell URL). See Pitfalls 1 to 4.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|-------------|------------------|
| SEC-05 | Each phase's security review lists the CWE IDs it touches with the test proving each mitigation. Pre-release: full MITRE CWE Top 25 / ATT&CK review, CodeQL clean, ZAP baseline against staging with no high/critical findings, and signed security checklist (PRD §11.5) | CWE Top 25 2025 list (below); PRD §11.1/§11.2 maps; 15 existing phase SECURITY.md files; current CodeQL alert list (11 open); ZAP design for CI (Production build, signed in via GET list) and live (passive, signed out); checklist and sign-off format (D-22) |
| A11Y-05 | Manual keyboard-only and screen-reader (NVDA + VoiceOver) passes are recorded for critical flows before release | Eight flows (D-09); script format; where each runs (D-10); record file in `docs/operations/` (D-22); W2/W3 added to the scripts (UI-SPEC) |
| PERF-06 | Staff can install the admin portal as a PWA (manifest + icons). The service worker caches only static assets and the app shell, never API or authenticated responses, and shows a "new version available — reload" prompt | vite-plugin-pwa 2.0.0 option set verified from the package source; traps 1 to 4; Workbox `NetworkOnly` + `precacheFallback`; server caching and MIME facts; tests that prove D-13 |
| PERF-07 | Route transitions use the View Transitions API as a progressive enhancement, and all motion is disabled under `prefers-reduced-motion` | React Router 8.4.0 `viewTransition` support and its console warning; browser support (Chrome, Safari 18, Firefox 144); motion inventory of `web/src`; budget headroom risk |
| LEGAL-06 | Documented Manager procedures exist for data subject requests (access, correction, deletion of a customer's data) and breach response, including the owner notification steps | D-16 check results (hard delete exists; converted lock); Privacy Policy wording confirmed; NPC Circular 16-03 facts; quote alert emails in the shop mailbox; outbox retention |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

From `./CLAUDE.md`, `./.claude/CLAUDE.md` and the owner's global rules. The planner must honor all of them.

- **Free only.** No paid tools or services. Allowed licenses MIT, Apache-2.0, BSD, ISC, plus named exceptions (MPL-2.0 for axe dev/test, OFL-1.1 fonts, two pinned Microsoft SQL driver parts). Never GPL, AGPL, SSPL or commercial. No paid GitHub Code Security.
- **Packages:** before adding or bumping any package, check the exact version (advisories, open bugs, deprecation, license, at least 14 days old), record purpose, license, maintenance and legitimacy in RESEARCH.md, and **wait for the owner's yes**. Subagents never install silently.
- **Forbidden packages:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **Shared machine:** ports Vite 5180, API 5115/7028, HostProbe 5116/7029, Playwright 5199. Never 5173, 5023, 5099, or 49152 to 65535. Run `C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before dev servers, Playwright or full test runs. Never touch TheBETSLLC processes or `BetsLLC_*` databases. Never set environment variables at User or Machine level.
- **No Docker or Testcontainers locally.** ZAP (a Docker image) therefore runs only in GitHub Actions. Docker Desktop is installed on this machine, but the rule forbids using it.
- **LocalDB (OR-1):** `(localdb)\MSSQLLocalDB`, `CSPS_*` names only; cleanup may drop only `^CSPS_Test_[0-9a-f-]{36}$`.
- **`_local/` holds production backups:** never commit, upload or deploy. The restore drill output stays on the owner's PC.
- **No inline SQL in application code.** Use the ORM API. Generated migrations and migration scripts are the only exception, plus spots the owner approves by name. **No new triggers (OR-7).** No schema drops, renames or lossy changes without the owner.
- **Never read stdin** in a command (no bare `cat > file`, `read`, prompts). Leave no background shell running.
- **Client rules:** OR-2 minimal comments; OR-3 zod mirrors server validation; OR-4 no em dash or en dash in `web/src` (code, copy, comments, manifest fields); OR-5 API calls in `modules/*/services`, only `core/api/http` touches `fetch`; OR-6 the owner source tree; strict CSP with no `unsafe-inline`, no inline script, no `style` attribute.
- **Architecture:** onion layers (ArchUnitNET), one handler per use case, controllers thin, default-deny authorization, `[Authorize]` or `[AllowAnonymous]` on every action, authorization-matrix test covers every action.
- **Quality:** TDD (failing test first). Zero warnings in build, lint, types, tests and browser console. Coverage Domain 100%, Application ≥ 95%, `core/api` 100%, web ≥ 90%. Evidence before "done".
- **Budgets:** public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz; Lighthouse ≥ 95 mobile; LCP < 2.0 s, CLS < 0.05, INP < 200 ms. 320 to 1920 px, 44 px targets.
- **Public repo:** run gitleaks and look for real server or DB names, emails, local paths and customer data before every commit; mask them. Stage files by path; never `git add -A`.
- **Merges:** only through `tools/scripts/Merge-PullRequest.ps1`, only on the owner's word.
- **Markdown:** every created or edited `.md` carries Created and Updated timestamps (ISO 8601 with offset).
- **Workflow:** `/gsd-plan-phase 14 --tdd`; `/gsd-secure-phase 14` and `/gsd-ui-review 14` before `/gsd-ship 14`. Away mode: park owner questions in the backlog and keep working; never auto-approve a checkpoint, package or merge.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manifest file and icons | CDN / Static (web root, built by Vite) | API / Backend (static file MIME and cache headers) | Same-origin static files; ASP.NET Core serves them with `no-cache` (not under `/assets`) |
| Admin head tags (manifest link, theme colour, Apple icon, title) | Frontend Server (SSR: `ShellPage` admin head) | Browser (admin layouts on client-side entry and exit) | The server shapes each document head (PUB-04); the SPA must add and remove the tags when it moves between public and admin pages |
| Service worker: precache of static assets and the admin shell | Browser (service worker) | CDN / Static | Workbox generated at build time; never routes `/api/*` |
| Update banner and offline screen | Browser / Client (admin layouts, `useAppUpdate`, offline boot check) | — | Pure UI over `virtual:pwa-register` and the existing session check |
| View Transitions and reduced motion | Browser / Client (`UiLink`, router navigations, `usePrefersReducedMotion`) | — | React Router wraps the state update in `document.startViewTransition` |
| Bot filter for scanners | API / Backend (Domain `AnalyticsBots`) | — | Page views are a POST beacon handled server-side |
| `X-Frame-Options` / header fixes from CodeQL and ZAP | API / Backend (`SecurityHeadersMiddleware`, `web.config`) | — | One place for response headers |
| ZAP CI scan and live audit | CI (GitHub Actions, ubuntu runner, Docker) | API / Backend (Production-mode host on the runner) | Docker is CI-only by project rule |
| Restore drill | Database / Storage (LocalDB) | Owner's PC (PowerShell script, `_local/`) | Real data never leaves the owner's machine |
| Runbooks, checklist, review, a11y records | Docs (`docs/operations/`) | Architecture tests (doc shape checks) | Text artifacts, enforced by tests where possible |

## Standard Stack

### Core (already in the project, reuse)
| Library / Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router | 8.4.0 (installed) | `viewTransition` on `Link` and `navigate()` | Has View Transitions built in; no new package `[VERIFIED: web/node_modules/react-router/dist/development/lib/components.js:142-166]` |
| lighthouse | 13.5.0 (installed) | Live public-page audit (D-05) | Already owner-approved; `web/scripts/lighthouse.mjs` and `lighthouse-assert.mjs` reuse `[VERIFIED: web/package.json]` |
| @playwright/test | 1.63.0 (installed) | PWA, offline, View Transitions and reduced-motion e2e; icon rendering script (UI-SPEC) | Existing harness `[VERIFIED: web/package.json]` |
| GitHub CodeQL | codeql-action v4.39.3 pinned by SHA | Code scanning (C# manual build, JS/TS none) | Free for public repositories; already running `[VERIFIED: .github/workflows/codeql.yml:53,66]` |
| sqlcmd / PowerShell 5.1 | ODBC tools 17.0 on this PC | Restore drill script | `tools/scripts/Restore-LegacyReceipt.ps1` is the pattern (fixed target, metadata-only receipt) `[VERIFIED: read this session]` |

### New (needs the owner's yes before install)
| Library / Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-pwa | **2.0.0** (published 2026-10-03, 54 days old) | Builds `sw.js` with Workbox, gives `virtual:pwa-register` | The only new npm package (D-11). Dev dependency. `[VERIFIED: npm registry; package-legitimacy OK]` |
| workbox-build / workbox-window | 7.4.1 (published 2026-05-04; transitive) | SW generation (build) and the page-side helper (ships in admin chunks) | Come with vite-plugin-pwa; do not add directly unless the notices gate needs `workbox-window` named (Pitfall 9) `[VERIFIED: npm view]` |
| OWASP ZAP container | `ghcr.io/zaproxy/zaproxy` **2.17.0**, digest `sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af` (same digest as `stable` today; ZAP 2.17.0 released 2025-12-15) | Baseline-equivalent passive scan in CI and against live | CI only (no local Docker). Apache-2.0. `[VERIFIED: ghcr.io manifest HEAD and GitHub API this session]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Running the ZAP image with `docker run` (recommended) | `zaproxy/action-baseline` v0.15.0 (commit `de8ad967d3548d44ef623df22cf95c3b0baf8b25`, Apache-2.0, 2025-10-24) | The action defaults `allow_issue_writing: true` and files the report as a **public GitHub issue**, uploads an artifact named `zap_scan`, and floats `docker_name` to `:stable`. Running the pinned image directly needs no extra token rights and no third-party JS. `[VERIFIED: action.yml read via GitHub API]` |
| `virtual:pwa-register` (vanilla) + one module store | `virtual:pwa-register/react` (`useRegisterSW`) | The React hook keeps state per component. UI-SPEC wants one module-level store shared by AdminLayout and AuthLayout, so the vanilla API plus `useSyncExternalStore` fits better |
| `generateSW` strategy (recommended) | `injectManifest` with a hand-written worker | `generateSW` covers everything needed (precache + one `NetworkOnly` navigation route with `precacheFallback`). `injectManifest` means owning worker code and its tests |

**Installation (only after the owner's yes; never by a subagent on its own):**
```bash
npm --prefix web install --save-dev --save-exact vite-plugin-pwa@2.0.0
```

**Version verification done this session:**
- `npm view vite-plugin-pwa` → `2.0.0`, MIT, peers `vite ^3 ... ^8.0.0`, `workbox-build ^7.4.1`, `workbox-window ^7.4.1`, engines `node >=20.19.0` `[VERIFIED: npm registry]`
- `npm view workbox-build` → `7.4.1`, MIT, engines `node >=20.0.0` `[VERIFIED: npm registry]`

## Package Legitimacy Audit

Seam: `gsd-tools query package-legitimacy check --ecosystem npm` run this session.

| Package | Registry | Age (exact version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| vite-plugin-pwa@2.0.0 | npm | 54 days (2026-10-03) | 7.48M/wk | github.com/vite-pwa/vite-plugin-pwa | [OK] | Approved by research; **owner yes required** (D-11) |
| workbox-build@7.4.1 | npm | 206 days (2026-05-04) | 12.3M/wk | github.com/googlechrome/workbox | [OK] | Transitive |
| workbox-window@7.4.1 | npm | 206 days (2026-05-04) | 12.4M/wk | github.com/googlechrome/workbox | [OK] | Transitive (ships in admin chunks) |
| @trickfilm400/rollup-plugin-off-main-thread@3.0.0-pre1 | npm | 359 days (2025-12-02) | 6.47M/wk | github.com/Trickfilm400/rollup-plugin-off-main-thread | [OK] | Transitive (a community fork Workbox now uses; Apache-2.0; prerelease tag). Note for the owner |
| OWASP ZAP image 2.17.0 | ghcr.io | 346 days (2025-12-15) | n/a | github.com/zaproxy/zaproxy (Apache-2.0) | n/a (not npm) | Approved by research; pin by digest |

**Exact-version checks (owner rule):**
- **Advisories:** none listed for vite-plugin-pwa, workbox-build, workbox-window, workbox-core, workbox-precaching, the off-main-thread fork, tempy, source-map, @rollup/plugin-terser, @apideck/better-ajv-errors (GitHub advisory API). `ejs` (via the fork, `^3.1.10`) is past every listed fix. `[VERIFIED: GitHub advisory API]`
- **Transitive advisories that WILL show in `npm audit`:** `glob@11.1.0` (workbox-build needs `^11.0.1`) is inside `GHSA-3g3m-2fjr-6pw4` (moderate, fixed only in 14.0.2), and `minimatch@10.x` is inside `GHSA-g3hv-75wg-m249` (moderate, fixed in 11.0.1). Both IDs are already owner-accepted in `docs/audit-exceptions.json` for package names `glob` and `minimatch`, **review by 2026-12-14**, with reasons that say "pulled in only by the lint and license tools". `[VERIFIED: docs/audit-exceptions.json; GitHub advisory API]`
- **deepmerge@4.3.1** (via `@rollup/plugin-node-resolve`): advisory `GHSA-gcqx-w48m-w2h4` is **withdrawn** (`"summary":"Withdrawn Advisory: ..."`), so `npm audit` should not report it. `[VERIFIED: GitHub advisory API]` That npm audit skips withdrawn advisories is `[ASSUMED]`; the CI audit gate proves it.
- **Open bugs:** six open issues since 2026-05; none blocks this use. #959 (deepmerge, withdrawn), #940 (Vite 8 + Nitro `sharedConfigBuild`, not used here), #944 (Trusted Types, not enforced here). `[VERIFIED: GitHub issues API]`
- **Breaking changes:** 2.0.0 lists none; it needs Node 20.19+ (project runs Node 24.21). 1.3.0 added Vite 8 peer support and the `onNeedReload` callback. `[CITED: github.com/vite-pwa/vite-plugin-pwa/releases, README]`
- **Deprecation:** not deprecated. Inside 2.0.0 typings, `injectRegister: null` is documented as "deprecated, use `false` instead". `[VERIFIED: vite-plugin-pwa@2.0.0 dist/index.d.ts:316-332]`
- **Install scripts:** `postinstall: null` for all three. CI already uses `npm ci --ignore-scripts`. `[VERIFIED: package-legitimacy seam]`
- **Licenses in the tree:** MIT, Apache-2.0, BSD-2/3-Clause, ISC, plus **BlueOak-1.0.0** (glob 11, minimatch 10, jackspeak, path-scurry, lru-cache 11, minipass 7, package-json-from-dist, foreground-child, @isaacs/cliui) and CC-BY-4.0 (caniuse-lite, already excepted for build). `[VERIFIED: npm view license]` The BlueOak exception today covers scopes `test` and `tool` only, so the license gate will fail in the `build` scope (Open Question 2).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Owner checkpoints the planner must add (`checkpoint:human-verify`, never auto-approved):** (1) install vite-plugin-pwa@2.0.0; (2) widen BlueOak-1.0.0 to the `build` scope; (3) restate and, if needed, extend the two audit exceptions past 2026-12-14; (4) the ZAP image digest.

## Architecture Patterns

### System Architecture Diagram

```
                    STAFF DEVICE                                      SERVER (one ASP.NET Core host)
 browser menu "Install app" / "Add to Home Screen"
        |
        v
 GET /admin/login ---------------------------------------------> ShellPage (admin head: robots + NEW manifest,
        |                                                          theme-color, apple-touch-icon, app title)
        v
 SPA boots (entry chunk) -> admin route patch -> AdminLayout/AuthLayout
        |                                   |
        |                                   +--> dynamic import useAppUpdate -> virtual:pwa-register
        |                                              -> import("workbox-window") -> register /sw.js, scope /admin
        |                                                                           |
        |                                          SW install: precache /assets/*.{js,css,woff2}, icons,
        |                                          the admin shell URL (fallback) <---- GET from server
        |
   navigation under /admin? --yes--> SW NetworkOnly --network ok--> server shell (200, no-cache)
        |                                  \--network error--> precached admin shell -> SPA -> offline boot check -> W3
        |
   /api/* request -------------------------- never matched by the SW ------------------> controllers (no-store)
        |
   new deploy: sw.js changed -> "waiting" -> onNeedRefresh -> store -> W2 banner
        Reload pressed -> messageSkipWaiting -> "controlling" -> onNeedReload: reload THIS tab only

 CI (GitHub Actions, ubuntu)                                    LIVE (owner dispatch after deploy)
 SQL container -> migrate -> seed test Manager                 ZAP container (passive, signed out)
 Release build, ASPNETCORE_ENVIRONMENT=Production                -> spider (no forms) + sitemap + seed URLs
 throwaway secrets as env on that one process                    -> passive rules -> report (Low/Info outcomes)
 ZAP container --network host:                                 Lighthouse 13.5.0 mobile on all 7 public pages
   signed out: spider + passive                                   -> assert >= 0.95; host shortfall -> owner
   signed in: GET-only request list (from openapi.v1.json)      Checks: /openapi/v1.json and /scalar answer 404
   with ZAP_AUTH_HEADER_VALUE=Bearer <token>
 -> report -> rules file with an outcome per alert -> exit status
```

### Recommended Project Structure (new or changed files only)
```
web/
  public/
    manifest.webmanifest          # hand-written JSON (manifest: false in the plugin, Pitfall 1)
    pwa/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon-180.png
  scripts/
    pwa-config.ts (+ .test.ts)    # the plugin options as data, unit-tested (no /api route, no navigateFallback)
    pwa-icons.mjs (+ .test.ts)    # renders the PNGs from mark.svg with the installed Playwright Chromium
    zap-requests.mjs (+ .test.ts) # builds the GET-only request list from tools/openapi-gen/openapi.v1.json
  src/
    hooks/usePrefersReducedMotion.ts
    modules/admin/hooks/useAppUpdate.ts
    modules/admin/components/{UpdateBanner,OfflineCard}.tsx, pwa.recipe.ts
  e2e/pwa.spec.ts, view-transitions.spec.ts (or tags in motion.spec.ts)
.github/workflows/
  zap.yml                         # workflow_call (weekly.yml) + workflow_dispatch (release gate)
  live-audit.yml                  # workflow_dispatch, main only: ZAP passive signed out + Lighthouse 7 pages
  zap/                            # ZAP automation plans (CI and live) and the rules file with reasons
docs/operations/
  security-review.md              # CWE Top 25 (2025) + ATT&CK, each row names its test(s)
  security-checklist.md           # PRD §11.5 sign-off, D-22 line
  data-requests.md, breach-response.md, break-glass-mail.md, lockout.md,
  backup-restore.md, install-staff-app.md, a11y-manual-passes.md (scripts + results)
tools/scripts/Restore-BackupDrill.ps1   # fixed target CSPS_RestoreDrill, receipt in _local/
tests/Csps.ArchitectureTests/
  ZapWorkflowTests.cs, LiveAuditWorkflowTests.cs, OperationsRunbookTests.cs, RestoreDrillScriptTests.cs
```

### Pattern 1: vite-plugin-pwa options for this app
**What:** generateSW, prompt mode, registration from bundled admin code only, no manifest injection, no default navigate fallback, one navigation route under `/admin` that falls back to the precached shell on a network error.
**When to use:** the `production` and `e2e` modes (and `budget` so the admin budget measures the real code). Off (`disable: true`) for `development`, `test` and `parity`.
**Example (option names verified in vite-plugin-pwa 2.0.0 and workbox-build 7.4.1 typings; values are recommendations):**
```typescript
// Source: vite-plugin-pwa@2.0.0 dist/index.d.ts (options), workbox-build@7.4.1 build/types.d.ts (workbox)
VitePWA({
  strategies: 'generateSW',
  registerType: 'prompt',
  injectRegister: false,          // same as null, which 2.0.0 marks deprecated (D-11 intent kept)
  manifest: false,                // the plugin would otherwise put <link rel="manifest"> into every public page
  scope: '/admin',                // not '/admin/': the dashboard route is '/admin' (Pitfall 3) [ASSUMED prefix rule]
  workbox: {
    navigateFallback: null,       // plugin default is 'index.html', which the server never serves raw
    globPatterns: ['assets/**/*.{js,css,woff2}', 'mark.svg', 'pwa/*.png'],
    globIgnores: ['**/*.br', 'index.html'],
    additionalManifestEntries: [{ url: ADMIN_SHELL_URL, revision: SHELL_REVISION }],
    runtimeCaching: [
      {
        urlPattern: ({ request, url }) => request.mode === 'navigate' && url.pathname.startsWith('/admin'),
        handler: 'NetworkOnly',
        options: { precacheFallback: { fallbackURL: ADMIN_SHELL_URL } },
      },
    ],
    // no runtimeCaching entry for /api: the worker never touches it (D-13)
  },
})
```
`ADMIN_SHELL_URL`, `SHELL_REVISION` are placeholders for the planner (Pitfall 2). `urlPattern` is serialized into `sw.js`, so it must not use outside variables `[ASSUMED]`.

### Pattern 2: one update store, no surprise reloads
**What:** call `registerSW` once from a module store; pass `onNeedRefresh` (set "waiting"), `onRegisteredSW` (keep the registration for the hourly `update()` on open and on `visibilitychange`), and `onNeedReload`, which reloads only when this tab asked for it.
**Why:** the plugin's prompt mode adds a `controlling` listener in every tab that saw the waiting worker, and that listener calls `window.location.reload()` unless `onNeedReload` is given `[VERIFIED: vite-plugin-pwa@2.0.0 dist/client/build/register.js]`. Quote:
```js
// Source: vite-plugin-pwa@2.0.0 dist/client/build/register.js (verbatim excerpt)
wb?.addEventListener("controlling", (event) => {
  if (event.isUpdate) {
    if (onNeedReload)
      onNeedReload();
    else
      window.location.reload();
  }
});
```
`updateServiceWorker()` only sends `messageSkipWaiting()` in prompt mode; its `_reloadPage` argument is ignored in 2.0.0 `[VERIFIED: same file]`. So the tab that pressed Reload sets a flag, calls `updateSW()`, and reloads itself in `onNeedReload`. Other tabs keep their banner. That matches UI-SPEC W2 "a Reload in another tab where nothing is waiting any more simply reloads that tab". The dev build's `registerSW` is a no-op stub `[VERIFIED: dist/client/dev/register.js]`.

### Pattern 3: View Transitions only when supported and allowed
**What:** `UiLink` passes `viewTransition={canTransition}` where `canTransition = !reduce && typeof document.startViewTransition === 'function'`. Programmatic navigations pass `{ viewTransition: canTransition }`.
**Why the support check:** React Router 8.4.0 logs a warning (production build too) when `viewTransition` is passed and the API is missing:
```js
// Source: web/node_modules/react-router/dist/development/lib/components.js:142-143 (same text in dist/production)
let isViewTransitionAvailable = router.window != null && router.window.document != null && typeof router.window.document.startViewTransition === "function";
warnOnce(viewTransitionOpts == null || isViewTransitionAvailable, "You provided the `viewTransition` option to a router update, but you do not appear to be running in a DOM environment as `window.startViewTransition` is not available.");
```
jsdom has no `startViewTransition`, so passing `true` in Vitest would print this warning and break the zero-warnings rule. `[VERIFIED]`
**Browser support:** same-document View Transitions are Baseline (Chrome/Edge, Safari 18, Firefox 144 from 2025-10-14; Firefox lacks transition *types*). `[CITED: web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available]` All Playwright engines will run them, so the e2e suite sees real transitions.

### Pattern 4: ZAP as a passive Automation Framework plan
**What:** run `zap.sh -cmd -autorun /zap/wrk/plan.yaml` in the pinned image. The plan holds `spider` (forms off, explicit user agent), `requestor` (the GET list, CI only), `passiveScan-config`, `passiveScan-wait`, `report`, and `exitStatus`. No `activeScan` job. This is the baseline scan made explicit. `zap-baseline.py --auto` uses the same framework. `[CITED: zaproxy.org/docs/desktop/addons/automation-framework/]`
**Signed-in header:** `ZAP_AUTH_HEADER_VALUE` adds a header to every request (default name `Authorization`); `ZAP_AUTH_HEADER_SITE` limits it to a host. They must be set before ZAP starts. `[CITED: zaproxy.org/docs/getting-further/authentication/handling-auth-yourself/]`
**Exit codes of zap-baseline.py, if used instead:** 0 ok, 1 a FAIL, 2 WARN only, 3 other error; every alert defaults to WARN; `-c` rules file sets IGNORE/INFO/FAIL per rule id. `[CITED: zaproxy.org/docs/docker/baseline-scan/]`

### Pattern 5: Production-mode host in CI (D-01)
- Build **Release** (`CSPS_TESTING` is defined only in Debug, and a Debug build refuses to start as Production) `[VERIFIED: src/Csps.Server/Testing/TestingHostRegistration.cs:7-31]`.
- Set every startup-validated section as env vars on that one process, with throwaway values generated in the job: `Jwt__SigningKey`, `Auth__CodeMacKey`, `DataProtection__CertificateBase64/Password` (an openssl PFX made in the job), `Smtp__*`, `Cloudinary__*`, `App__PublicBaseUrl`, `ConnectionStrings__Csps`. `ValidateOnStart` is used by DataProtection, Email, Identity, Images, QuoteRequests and Jwt registrations `[VERIFIED: grep of src]`.
- Production turns on HTTPS redirection with `HttpsPort = 443` `[VERIFIED: src/Csps.Server/Program.cs:32-36]`, so ZAP must target the HTTPS URL directly. Give Kestrel an explicit throwaway certificate rather than relying on the dev certificate in Production `[ASSUMED]`.
- Migrate the container DB (`dotnet ef database update` or the idempotent script), then create the test Manager (Open Question 4).
- What CI cannot see: the IIS layer (`web.config` headers, in-process hosting). That is why the live scan exists.

### Anti-Patterns to Avoid
- **Letting the plugin write the manifest link into `index.html`:** it lands on every public page (D-12).
- **Precaching `index.html` or using `navigateFallback`:** `index.html` is hidden from static files (`ServerWrittenFileProvider`), so install fails, and a precached raw template would also lack the server-shaped head.
- **A runtime cache for navigations or `/api`:** D-13 and the UI-SPEC test "no HTML other than the precached shell".
- **Pointing an active scan, AJAX spider or OpenAPI import at live:** the OpenAPI import sends every operation, including POST and DELETE. Use the GET-only requestor list, and only in CI.
- **Uploading signed-in ZAP output without a secret scan:** the repository is public, and so are its run logs. Run the existing pinned gitleaks over the report folder before upload, and keep retention short.
- **Running the app against the restore-drill database with real SMTP or the production PFX:** pending outbox mail in the backup could be sent to real people (Pitfall 12).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker, precache manifest, revisioning, outdated-cache cleanup | A hand-written `sw.js` | vite-plugin-pwa `generateSW` (Workbox 7.4.1) | Cache versioning, `cleanupOutdatedCaches` and the skip-waiting message protocol are easy to get wrong (D-11) |
| Update detection and skip-waiting messaging | Own `navigator.serviceWorker` event wiring | `virtual:pwa-register` (`registerSW`) | Handles `waiting`, `installed`, `controlling` and external updates `[VERIFIED: register.js]` |
| Route-change animation | CSS keyframes or a motion library | React Router `viewTransition` + browser default cross-fade | No CSS change (stylesheet contract test), no package |
| DAST scanning | Custom header or crawler scripts | OWASP ZAP passive rules | Hundreds of maintained passive rules |
| Static analysis | Custom lint rules for injection | CodeQL (already running) | Free on public repos |
| Restore safety checks | A new C# tool with inline `RESTORE` SQL (would need the owner's by-name approval) | A PowerShell script copied from `Restore-LegacyReceipt.ps1` (fixed server and DB, VERIFYONLY before drop, metadata-only receipt in `_local/`) | Proven, already covered by `CutoverRunbookTests` |
| HIBP, mail, auth flows | Anything new | Existing code | Phase 14 adds no auth features |

**Key insight:** this phase should add almost no new runtime code. Every new moving part (worker, scanner, drill) has a mature tool. The work is in configuring them to respect this project's rules and proving it with tests.

## Common Pitfalls

### Pitfall 1: The plugin injects the manifest link into every page
**What goes wrong:** with `manifest` set, the build plugin replaces `</head>` in `index.html` with `<link rel="manifest" ...></head>` `[VERIFIED: vite-plugin-pwa@2.0.0 dist/chunk-I2Z7IWCN.js:128-150, dist/index.js:386-404]`. `index.html` is the template of every public document, outside the `csps:head` block.
**How to avoid:** `manifest: false` (then `injectServiceWorker` adds nothing); commit `web/public/manifest.webmanifest`; the server adds the link only for `PublicRouteKind.Admin`. A .NET test proves public documents have no manifest link.
**Warning signs:** `<link rel="manifest"` in `ShellPageTests` output for `/`.

### Pitfall 2: The default navigate fallback breaks install
**What goes wrong:** the plugin's default Workbox options include `navigateFallback: "index.html"` `[VERIFIED: vite-plugin-pwa@2.0.0 dist/index.js:833-841]`. The server hides `index.html` from static files (`private static readonly string[] Hidden = [SpaHosting.ShellFile, "robots.txt", "sitemap.xml"];`) `[VERIFIED: src/Csps.Server/Composition/SpaRegistration.cs, ServerWrittenFileProvider]`, so the precache request 404s and the worker never installs.
**How to avoid:** `navigateFallback: null`; precache the admin shell by URL instead. Use a never-linked admin path as the fallback URL (any `/admin/*` path gets the admin shell with status 200: `response.StatusCode = found ? StatusCodes.Status200OK : ...` and `if (IsAtOrUnder(trimmed, AdminPrefix)) return new PublicRouteMatch(PublicRouteKind.Admin, null, null);` `[VERIFIED: ShellPage.cs:170-172, PublicRouteTable.cs:97-99]`). A dedicated URL keeps the precache route from serving a real page like `/admin/login` from cache when online `[ASSUMED: Workbox precache route matching]`. The revision must change with each build (for example the content hash of the built `index.html`).
**Warning signs:** `bad-precaching-response` in the SW console; `navigator.serviceWorker.controller` stays null.

### Pitfall 3: Scope `/admin/` leaves the dashboard out
**What goes wrong:** the dashboard is the index route at path `'admin'` `[VERIFIED: web/src/modules/admin/routes.tsx:175]` (URL `/admin`). A worker and manifest scope of `/admin/` does not include `/admin`, so the dashboard opens outside the app (Chrome shows a URL bar in standalone mode) and the SW does not control it.
**How to avoid:** scope `/admin` (no slash) for both the SW registration and the manifest, `id` may stay `/admin/`. Prove it with Playwright: after install, `navigator.serviceWorker.controller` is set on `/admin`. Record a SPEC-DEVIATION against the UI-SPEC W1 table. Scope matching is by string prefix `[ASSUMED]`; no public path starts with `/admin` today `[VERIFIED: PublicRouteTable.cs:59-70]`.

### Pitfall 4: Every tab reloads by itself
**What goes wrong:** see Pattern 2. Without `onNeedReload`, pressing Reload in one tab reloads every other tab that had the banner. A half-filled form in another tab is lost (breaks D-14).
**How to avoid:** always pass `onNeedReload`; unit test with a fake `registerSW`; a two-page Playwright test (same context) proves the second tab keeps its banner and its typed text.

### Pitfall 5: Two existing gates fail on install
**What goes wrong:** `npm run license:check` fails on BlueOak-1.0.0 in the build scope; after 2026-12-14 `npm run audit:check` fails on glob and minimatch whatever happens.
**How to avoid:** owner rulings first (Open Questions 2 and 3); update `docs/license-exceptions.json` scopes, `docs/audit-exceptions.json` reasons and review dates, and `docs/dependencies.json` (the registry test requires an entry for every pin `[VERIFIED: tests/Csps.ArchitectureTests/DependencyRegistryTests.cs]`). Never widen a list without the owner (file comment says so).

### Pitfall 6: New build warnings from the Workbox toolchain
**What goes wrong:** workbox-build bundles the worker with its own Rollup 4, `@babel/preset-env` and terser. Two warnings are likely: Browserslist "caniuse-lite is outdated" (preset-env reads browserslist; the project's own Babel use does not today), and Node's `DEP0040 punycode` from `tr46@1.0.1` (via `source-map@0.8.0-beta.0` → `whatwg-url@7`) `[ASSUMED: both depend on dates and Node's exemption rules]`.
**How to avoid:** run `npm --prefix web run build` once after install and read the whole output. A warning is a blocker (zero warnings). Fixes: an `overrides` bump (needs the owner), or setting `BROWSERSLIST_IGNORE_OLD_DATA` on the build process only.

### Pitfall 7: Public budget overflow from the View Transitions change
**What goes wrong:** `UiLink` lives in the public entry chunk. Several public rows have well under 1 KB left (STATE "Budget room after wave 7": Privacy 149.56 KB, 0.44 KB left).
**How to avoid:** keep the support check and the media-query subscription tiny (one shared module, no new dependency); measure with `npm --prefix web run build:budget` before and after; the limit never moves (D-42). The update store and `workbox-window` must sit only in admin chunks; add a budget rule that fails if any public chunk contains `virtual:pwa-register` or `workbox-window` (UI-SPEC Interaction Contract).

### Pitfall 8: Playwright and the worker
**What goes wrong:** `page.route()` does not see requests a service worker handles; Playwright suggests `serviceWorkers: 'block'` when routing `[CITED: playwright.dev/docs/api/class-page#page-route; ASSUMED for the exact wording]`. Eight specs use `page.route`/`context.route` `[VERIFIED: grep web/e2e]`. Each new browser context also installs the worker and precaches about 2.3 MB raw of assets (231 JS, 1 CSS, 15 woff2 in the current wwwroot) `[VERIFIED: measured src/Csps.Server/wwwroot]`, which adds load to a suite that already flakes under load (D-25).
**How to avoid:** measure one full run with the worker on. If flakes or time grow, bring the choice to the owner (UI-SPEC says the planner must not quietly turn the worker off for every test). Recommended option for that question: `serviceWorkers: 'block'` in the shared `use`, and `'allow'` only in the PWA specs.

### Pitfall 9: Third-party notices for code that now ships
**What goes wrong:** Workbox runtime code ships in `sw.js` and `workbox-window` ships in an admin chunk, but both come from a dev dependency. `notices:check` follows production dependencies `[VERIFIED: docs/web/release-gates.md:26]`, so the shipped MIT code may be missing from `web/THIRD-PARTY-NOTICES.txt`.
**How to avoid:** add the shipped Workbox packages to the notices source (or list `workbox-window` as a direct dependency, owner yes). A test reads `sw.js` and the notices file.

### Pitfall 10: CodeQL web.config alert has seven copies
**What goes wrong:** `cs/web/missing-x-frame-options` fires on `src/Csps.Server/web.config` and on six copies under `bin/` of the server and test projects (the C# build copies `web.config`) `[VERIFIED: code-scanning API, alerts 14 to 19, 23]`. CSP `frame-ancestors 'none'` already blocks framing, but CodeQL looks for the header.
**How to avoid:** add `X-Frame-Options: DENY` (CWE-1021) in one place. If it goes only in `SecurityHeadersMiddleware`, CodeQL may still flag `web.config` `[ASSUMED: query logic]`; if it goes only in `web.config` `customHeaders`, Kestrel hosts (tests, CI ZAP) never send it. Decide with a PR run of CodeQL as evidence. Do not send it twice (IIS custom header plus app header).

### Pitfall 11: ZAP noise and ZAP defaults
**What goes wrong:** ZAP's default user agent looks like a desktop browser and does not say ZAP `[ASSUMED]`, so D-06 needs an explicit user agent set in the plan plus a matching `AnalyticsBots` token. The spider's form handling defaults are not documented `[CITED: zaproxy.org spider options page lists no defaults]`. JS bundles trigger Info and Low rules (suspicious comments, timestamp disclosure, base64). The ZAP container runs as a non-root user and may not be able to write to the mounted folder `[ASSUMED]`.
**How to avoid:** set user agent, `processForm: false`, `postForm: false` and low thread counts explicitly in the plan; keep a rules file where every IGNORE carries its reason and the D-03 outcome; make the work folder writable; keep spider time short so the live rate limits are not tripped.
**Note:** the beacon that counts page views is a client POST to `/api/v1/analytics/page-views` `[VERIFIED: AnalyticsController.cs:18,28]`; a traditional spider runs no JS, so it sends none. The token is a second line of defense.

### Pitfall 12: The restore drill can send real mail
**What goes wrong:** the backup holds the email outbox. If the app is started against the drill database with working SMTP and the production Data Protection certificate, the dispatcher can decrypt and send queued mail `[VERIFIED: EmailDispatcher unprotects ProtectedSubject/Text/Html; MailKitTransport sends over TLS]`. With the dev certificate, the production key ring cannot be read, and the app may write new keys into the drill copy `[ASSUMED]`.
**How to avoid:** "app opens" check uses the Development host with `Smtp__Host=smtp.invalid` on that one process, never the production PFX, and only for a read check (open the dashboard, Orders list). The drill DB is dropped after. Run the preflight first.
**Version fact:** production is SQL Server 2025 RTM-CU3 17.0.4025.3, compatibility 170 `[VERIFIED: .planning/HOSTING-RECORD.md:167]`; local LocalDB `MSSQLLocalDB` is 17.0.4025.3 `[VERIFIED: sqllocaldb info]`, so the restore is same-version.

### Pitfall 13: Open CodeQL and Dependabot items are part of "clean"
**What goes wrong:** success criterion 1 says CodeQL is clean; today 11 alerts are open `[VERIFIED: code-scanning API 2026-11-26]`.
**How to avoid:** one plan triages each alert: fix (preferred) or a GitHub dismissal with a written reason and an owner acceptance for high ones. `deploy.mjs:363` (certificate validation off) likely pins the host certificate by SHA-256 (`WEBDEPLOY_CERT_SHA256`); refactor to keep pinning without disabling validation, or bring a named acceptance `[ASSUMED: intent]`.

## Code Examples

### The bot filter today (extend for ZAP, keep Lighthouse)
```csharp
// Source: src/Csps.Domain/Analytics/AnalyticsBots.cs:13 (verbatim)
private static readonly string[] ExtraTokens = ["HeadlessChrome", "Lighthouse", "PTST"];
```
Lighthouse is already covered (its emulated user agent contains "Chrome-Lighthouse" `[ASSUMED]`). Add one ZAP token that matches the user agent set in the ZAP plan, with a Domain unit test for both.

### The strict CSP (no change needed for the worker or manifest)
```csharp
// Source: src/Csps.Server/Http/SecurityHeadersMiddleware.cs:19-20 (verbatim)
public const string StrictCsp =
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-src https://www.google.com/maps/embed; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";
```
`worker-src` and `manifest-src` fall back to `script-src`/`default-src` `'self'`, as the UI-SPEC says. The worker's own `fetch` and `importScripts` run under the CSP sent with `sw.js`, which this middleware sets on every response `[ASSUMED: CSP for workers comes from the worker script response]`.

### Static file cache rules (sw.js and the manifest revalidate)
```csharp
// Source: src/Csps.Server/Composition/SpaRegistration.cs:53,56 (verbatim)
public const string ImmutableCacheControl = "public, max-age=31536000, immutable";
public const string RevalidateCacheControl = "no-cache";
```
Only `/assets/*` is immutable, so `/sw.js`, `/workbox-*.js` and `/manifest.webmanifest` revalidate on each use, which is what a worker update needs. ASP.NET Core 10.0.13's default content-type map includes `.webmanifest` → `application/manifest+json` `[VERIFIED: string probe of Microsoft.AspNetCore.StaticFiles.dll 10.0.13]`.

### D-23 is already proven
```csharp
// Source: tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs:58-73 (excerpt, verbatim)
public async Task ProductionHasNoApiDocs()
...
foreach (var path in new[] { "/openapi/v1.json", "/scalar", "/scalar/" })
...
response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path);
```
The checklist cites this test. The live audit adds two GETs that expect 404.

### D-16: the delete exists, and converted requests are locked
```csharp
// Source: src/Csps.Application/QuoteRequests/DeleteQuoteRequestHandler.cs:68-71, 79-85 (verbatim)
if (quote.Status == QuoteRequestStatus.Converted)
{
    return Result.Failure(QuoteRequestErrors.ConvertedDeleteLocked);
}
...
List<string> stored = [.. quote.Photos.Select(static photo => photo.PublicId).OfType<string>()];
foreach (var publicId in stored)
{
    deletions.Enqueue(publicId, ImageDeletionReason.QuoteDeleted);
}

store.Remove(quote);
```
The endpoint is `[HttpDelete("{id:guid}")]` with `[Authorize(Policy = Policies.Manager)]` `[VERIFIED: QuoteRequestsController.cs:195-196]`. The error text is "A request that became an order can't be deleted." `[VERIFIED: QuoteRequestErrors.cs:39]`. The audit entry holds the status and photo count, never customer details.

### Privacy Policy lines the runbooks rely on
```typescript
// Source: web/src/modules/public/legalPrivacy.ts:133-134, 141-142, 324 (verbatim)
term: 'Orders, payments, discounts and expenses',
parts: ['Kept for good. They are our bookkeeping and tax records.'],
...
term: 'Quote requests that became an order, and their photos',
parts: ['Kept as long as the order.'],
...
{ kind: 'p', parts: ['The owner, as our Data Protection Officer, answers these requests.'] },
```
Policy version 1.1 is `approved: true`, last updated 2026-11-25 `[VERIFIED: legalPages.ts:28-30]`. The 15-day answer time (D-18) is an internal rule; the policy does not promise a time, so no wording change is needed. The file's header comment still says "draft 1.1, wording for the owner to approve", which is stale (doc-only fix, list it in the review pack).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `injectRegister: null` | `injectRegister: false` | vite-plugin-pwa 2.0.0 typings | Same behavior; use `false` and note it against D-11's wording |
| Relying on the default `controlling` reload | `onNeedReload` callback | vite-plugin-pwa 1.3.0 | Needed for D-14 |
| ZAP `:stable` tag | Pin by digest | Project rule (D-01) | Reproducible scans |
| CWE Top 25 2024 | **CWE Top 25 2025** (published December 2025; no 2026 list found as of today) | 2025-12 | The review uses the 2025 list; re-check if a 2026 list appears during the phase |
| View Transitions Chrome-only | Baseline same-document VT (Firefox 144, Safari 18) | 2025-10 | Transitions run in every e2e engine |
| Lighthouse PWA category | Removed in Lighthouse 12 | 2024 | Installability is proven by tests and device checks, not by Lighthouse `[ASSUMED]` |

**CWE Top 25 (2025), verbatim IDs** `[CITED: cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html]`: 1 CWE-79, 2 CWE-89, 3 CWE-352, 4 CWE-862, 5 CWE-787, 6 CWE-22, 7 CWE-416, 8 CWE-125, 9 CWE-78, 10 CWE-94, 11 CWE-120, 12 CWE-434, 13 CWE-476, 14 CWE-121, 15 CWE-502, 16 CWE-122, 17 CWE-863, 18 CWE-20, 19 CWE-284, 20 CWE-200, 21 CWE-306, 22 CWE-918, 23 CWE-77, 24 CWE-639, 25 CWE-770. Memory-safety entries (787, 416, 125, 120, 476, 121, 122) are "not applicable: managed runtimes (.NET, JavaScript) with no unsafe code"; the review must state that and point at a test or a rule that proves there is no `unsafe` block (for example an ArchUnitNET or build check) rather than leave the row blank.

**ATT&CK:** PRD §11.2 lists T1110 (incl. .003, .004), T1078, T1190, T1539, T1556, T1566, T1499, T1552, T1195 `[VERIFIED: CSPS-PRD.md §11.2]`. Recommended additions for a full review: T1550.001 (application access token), T1621 (MFA request generation), T1098 (account manipulation), T1531 (account access removal), T1485/T1565 (data destruction or manipulation, the audit log and soft delete), T1070 (indicator removal, the append-only audit trigger), T1505.003 (web shell, upload rules), T1530 (cloud storage, Cloudinary) `[ASSUMED: IDs from training; verify each at attack.mitre.org]`.

## Runtime State Inventory

Not a rename phase, but the PWA adds state that lives outside git.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None in the database. The restore-drill DB `CSPS_RestoreDrill` (suggested name) exists only during the drill. | Drill script drops it; receipt stays in `_local/` |
| Live service config | GitHub repo variables/secrets: `SITE_ORIGIN` exists; the ZAP workflows need no new secret (CI generates throwaway values). Code-scanning alert dismissals live in GitHub, not git. | Record each dismissal reason in `security-review.md` |
| OS-registered state | **Installed service workers and home-screen apps on staff devices** after the first PWA deploy. They persist until updated or unregistered. | Add a "turn the worker off" step to `deploy.md` (vite-plugin-pwa `selfDestroying: true` build) `[VERIFIED: option exists in 2.0.0 typings]` |
| Secrets and env vars | None new in git. CI-only throwaway JWT key, code MAC key, PFX, SMTP and Cloudinary values for the Production-mode host, set on that one process. | Mask with `::add-mask::`, never echo |
| Build artifacts | `sw.js`, `workbox-*.js`, the manifest and icons land in `src/Csps.Server/wwwroot` (git-ignored) and in the deploy package | `package-check.mjs` needs no change (no forbidden file types) `[VERIFIED: package-check.mjs]` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SW and manifest scope match by string prefix, so `/admin` covers `/admin` and `/admin/*` | Pitfall 3 | Dashboard outside the app; caught by the Playwright controller check |
| A2 | Workbox's precache route serves a precached navigation URL from cache even when online | Pitfall 2 | Only affects which fallback URL to pick |
| A3 | `urlPattern` functions are serialized into `sw.js` and cannot use outside variables | Pattern 1 | Build-time error; obvious |
| A4 | npm audit does not report withdrawn advisories (deepmerge) | Package audit | One more owner exception |
| A5 | Browserslist old-data and DEP0040 punycode warnings appear in the build | Pitfall 6 | Zero-warnings gate fails; fix path known |
| A6 | `page.route` misses SW-handled requests | Pitfall 8 | Some existing specs fail with the worker on |
| A7 | CodeQL's X-Frame-Options query checks `web.config` and may ignore middleware headers | Pitfall 10 | Alert stays open; re-run decides |
| A8 | ZAP's default user agent does not contain "ZAP"; container runs non-root | Pitfall 11 | D-06 test passes but live scan counts a view (unlikely: no JS) |
| A9 | Kestrel in Production should get an explicit certificate in CI | Pattern 5 | Host fails to start in the ZAP job; easy to see |
| A10 | Lighthouse's user agent contains "Chrome-Lighthouse" | Code Examples | Live audit counted in Visitor Stats; D-06 test covers it |
| A11 | Dev certificate cannot read the production key ring and may write new keys to the drill copy | Pitfall 12 | Only the throwaway drill copy is affected |
| A12 | ATT&CK IDs listed as additions | State of the Art | Wrong IDs in the review; verify at attack.mitre.org |
| A13 | The worker's CSP comes from the `sw.js` response headers | Code Examples | Unexpected CSP errors in the worker; e2e console guard sees them |
| A14 | NPC details beyond the 72-hour rule (five-day full report, 100-subject "no delay" rule, DBNMS portal, Advisory 2026-02) come from secondary sources | Breach runbook | Wrong step in the runbook; D-19 already makes the owner confirm with the NPC or an adviser |

## Open Questions (owner decisions not ruled in 14-CONTEXT.md)

1. **D-16 converted requests.** Delete Request refuses a request that became an order, and the Privacy Policy says those are kept as long as the order. Recommended: the runbook says so plainly (the converted request stays with its order, because the order is a financial record) and the reply to the person explains it. No code change. Alternative: allow deleting the request text but keep the order (new code, new policy wording). *Owner call before any build (D-16 says so).*
2. **BlueOak-1.0.0 in the build scope.** BlueOak is a short permissive license like MIT: free, no copyleft, no cost. Recommended: widen the existing exception's scopes to `build` for the glob 11 tree that vite-plugin-pwa brings. Alternative: an `overrides` entry to glob 14 / minimatch 11 (still BlueOak, and newer majors under the 14-day rule). *Owner call.*
3. **Audit exceptions expire 2026-12-14.** Both moderate advisories are build or tool only and never ship. Recommended: update the reasons to name the Workbox path too, and re-review on the date (or extend 30 days, as D-45 did). *Owner call; the gate fails on 2026-12-15 otherwise.*
4. **How the CI ZAP scan signs in (D-04).** Production builds have no Testing mail sink, SMTP must use real TLS, and tokens need an active session. Options, recommended first:
   - **A.** A CI-only console tool (fixed to a loopback container DB, like DevSeed's guard) that reads the queued invite and sign-in emails from the outbox with the CI's throwaway certificate, so a script can walk the real invite → set password → sign in → code flow. Reason: uses the real auth code paths, no token minting.
   - **B.** An in-house SMTP capture script with STARTTLS and a throwaway certificate trusted on the runner only. Reason: no new C# code, but more moving parts (TLS trust, AUTH).
   - **C.** A CI-only tool that creates a session row and mints a token with the CI key. Reason: simplest, but it is a token-minting tool in a public repo.
   *Security posture change: owner call.*
5. **ZAP inside the release gate.** D-02 says "once before each release". Recommended: `deploy.mjs` refuses to deploy a SHA unless a successful `zap.yml` run exists for it, as it already looks up the CI package by SHA. Alternative: a manual step in `release-gates.md`. *Behavior change: owner call.*
6. **Service workers in the e2e suite.** If the worker slows the suite or breaks `page.route` specs, recommended: block workers in the shared Playwright `use` and allow them only in PWA specs. *Owner call per the UI-SPEC E2E row.*
7. **UI-SPEC deviations to record.** Manifest/SW scope `/admin` instead of `/admin/`; `injectRegister: false` instead of `null`; the manifest is a committed file (not plugin-generated). Recommended: record them as SPEC-DEVIATION entries; no visible change. *Owner sees them at `/gsd-ui-review 14`.*
8. **CodeQL high alerts that are not fixed by code.** `deploy.mjs:363` certificate validation; any dismissal of a high alert. Recommended: fix in code (keep the SHA-256 pin through `checkServerIdentity`); otherwise a named owner acceptance. *Owner call if not fixed.*
9. **Restore drill "row counts match" against what?** Recommended: `RESTORE VERIFYONLY`, restore, `DBCC CHECKDB`, the metadata-only receipt, the latest `__EFMigrationsHistory` row equals the deployed release's last migration, and the counts the live admin shows (Orders, Users, Quote Requests) at backup time. No SQL runs on production. *Owner confirms the comparison.*
10. **NVDA's license.** NVDA is free but GPL. It runs as a separate program on the owner's PC; nothing from it enters the repo or ships. D-08 already chose it. Recommended: note it in the a11y record as a tool, not a dependency. *Owner confirms if the "never GPL" rule should cover tools used only by hand.*
11. **Live Lighthouse location.** GitHub's runners are far from the host and the shop's users. Recommended: run from GitHub Actions (repeatable) and, if a page misses 95, re-run from the owner's PC before calling it a host shortfall. *Owner call only if numbers differ.*
12. **Two other spinners stop fully under reduced motion** (`media.recipe.ts` and `orderPhotos.recipe.ts` use `motion-reduce:animate-none`), while D-30 keeps the button spinner's slow turn. Recommended: keep as built (D-30 names the loading spinner of buttons); list in the review pack. *Review-pack item.*
13. **Small doc slips:** CONTEXT D-05 says "D-27 review pack" (the pack is D-26); the `legalPrivacy.ts` header comment says the policy is a draft. Recommended: fix in docs, no ruling needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / npm | web build, scripts | ✓ | 24.21.0 / 11.19.0 | — |
| .NET SDK | server, tests | ✓ | 10.0.402 (global.json 10.0.401, latestPatch) | — |
| Playwright browsers | e2e, icon script | ✓ | chromium 1243/1248, firefox 1543, webkit 2359/2370 | — |
| LocalDB `MSSQLLocalDB` | restore drill, NVDA pass on CSPS_Dev | ✓ | 17.0.4025.3 (SQL Server 2025) | — |
| sqlcmd | restore drill | ✓ | ODBC tools 17.0 | PowerShell `System.Data.SqlClient` (as the legacy script does) |
| gh CLI | CodeQL/Dependabot triage | ✓ | 2.102.0 | GitHub web UI |
| Docker | ZAP | ✗ locally by rule (Docker Desktop is installed but forbidden) | — | **CI only** (ubuntu runner has Docker) |
| NVDA | A11Y-05 | owner's PC (not probed) | — | none: owner runs it (D-08) |
| iPhone + VoiceOver | A11Y-05 | owner's device | — | none: owner runs it (D-08) |
| PowerShell 7 (`pwsh`) | not needed locally | ✗ | — | Windows PowerShell 5.1 (scripts must stay 5.1-compatible, like `Restore-LegacyReceipt.ps1`) |

**Missing dependencies with no fallback:** none for Claude's work. The owner's devices are required for the NVDA and VoiceOver passes and the iPhone install check.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | .NET: xunit.v3 on Microsoft.Testing.Platform, Shouldly, ArchUnitNET. Web: Vitest 5.0.4 (jsdom), RTL, in-house axe matcher. E2E: Playwright 1.63.0 (seven projects) |
| Config file | `global.json`, `tests/Directory.Build.props`; `web/vitest.config.ts`; `web/playwright.config.ts` |
| Quick run command | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*ZapWorkflowTests"`; `npm --prefix web run test -- --run src/modules/admin/hooks/useAppUpdate.test.ts` |
| Full suite command | `dotnet test --solution Csps.slnx` (localdb, after preflight); `npm --prefix web run verify`; `npm --prefix web run e2e` (after preflight) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-05 | Every row of `security-review.md` names a test that exists in the repo | arch (doc parse + file search) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*SecurityReviewDocTests"` | ❌ Wave 0 |
| SEC-05 | `zap.yml`: `permissions: {}`, image pinned by digest, no `activeScan` job, Release build, `ASPNETCORE_ENVIRONMENT=Production` on the host step only, report scanned by gitleaks before upload | arch (workflow text) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*ZapWorkflowTests"` | ❌ Wave 0 |
| SEC-05 | `live-audit.yml`: `workflow_dispatch` only, main only, signed out, passive plan, seven pages | arch (workflow text) | `... --filter-class "*LiveAuditWorkflowTests"` | ❌ Wave 0 |
| SEC-05 | `weekly.yml` calls the ZAP workflow | arch | `... --filter-class "*ZapWorkflowTests"` | ❌ Wave 0 |
| SEC-05 | GET-only request list from the OpenAPI snapshot (no POST/PUT/PATCH/DELETE, only `/api/v1`) | unit (node) | `npm --prefix web run test -- --run scripts/zap-requests.test.ts` | ❌ Wave 0 |
| SEC-05 / D-06 | `AnalyticsBots.IsBot` is true for the ZAP plan's user agent and a Lighthouse user agent | unit (Domain) | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AnalyticsBotsTests"` | ✅ extend |
| SEC-05 / D-23 | `/openapi/v1.json`, `/scalar` 404 in Production | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiExposureTests"` | ✅ exists |
| SEC-05 | `X-Frame-Options: DENY` on responses (if chosen) | integration | `... --filter-class "*SecurityHeadersTests"` | ✅ extend |
| SEC-05 | CodeQL: zero open alerts on the PR | CI evidence | `gh api repos/{owner}/{repo}/code-scanning/alerts?state=open` (quote count) | manual evidence |
| PERF-06 | Plugin options: `manifest: false`, `navigateFallback: null`, no `/api` route, `/admin` scope, globIgnores `index.html`, `.br` | unit (node) | `npm --prefix web run test -- --run scripts/pwa-config.test.ts` | ❌ Wave 0 |
| PERF-06 | Built `sw.js` precache list holds only `/assets/*`, icons, `mark.svg` and the shell URL | unit (node, post-build) | `npm --prefix web run test -- --run scripts/pwa-build.test.ts` (reads `.e2e-dist` or `.budget-dist`) | ❌ Wave 0 |
| PERF-06 | Manifest JSON values (UI-SPEC W1) and icon PNG sizes; maskable and Apple icons opaque | unit (node) | `npm --prefix web run test -- --run scripts/pwa-icons.test.ts` | ❌ Wave 0 |
| PERF-06 | Admin documents carry manifest link, theme colour, Apple icon, app title; public documents do not | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ShellPageTests"` | ✅ extend |
| PERF-06 | `/manifest.webmanifest` 200 `application/manifest+json` + `no-cache`; `/sw.js` `no-cache` | integration | `... --filter-class "*SpaHostTests"` | ✅ extend |
| PERF-06 | No public chunk contains `virtual:pwa-register` or `workbox-window` | unit (budget) | `npm --prefix web run test -- --run scripts/budget.test.ts` | ✅ extend |
| PERF-06 | `useAppUpdate`: waiting → banner; Reload → skip-waiting; `onNeedReload` reloads only the pressing tab; hourly update throttle | unit | `npm --prefix web run test -- --run src/modules/admin/hooks/useAppUpdate.test.ts` | ❌ Wave 0 |
| PERF-06 | UpdateBanner announced once, never takes focus; OfflineCard focuses h1, failed retry announced; zero axe | component | `npm --prefix web run test -- --run src/modules/admin/components/UpdateBanner.test.tsx` (and `OfflineCard.test.tsx`) | ❌ Wave 0 |
| PERF-06 | Offline boot check: network failure or `navigator.onLine === false` → W3; any HTTP status → not offline | unit | `npm --prefix web run test -- --run src/modules/admin/guard.test.ts` | ✅ extend |
| PERF-06 | E2E: worker controls `/admin`; caches hold no `/api/*` and no HTML except the shell after signed-in use; offline reload of `/admin/orders` shows W3; update banner after a new build; two tabs | e2e (Chromium) | `npm --prefix web run e2e -- --grep @pwa --project chromium` | ❌ Wave 0 |
| PERF-07 | UiLink passes `viewTransition` only when supported and motion allowed; drawer links `noTransition` | unit | `npm --prefix web run test -- --run src/components/actions/UiLink.test.tsx` | ✅ extend |
| PERF-07 | `usePrefersReducedMotion` follows a media-query change | unit | `npm --prefix web run test -- --run src/hooks/usePrefersReducedMotion.test.ts` | ❌ Wave 0 |
| PERF-07 | E2E: a sidebar click and a public nav click start one transition (spy on `document.startViewTransition`); none under `reducedMotion: 'reduce'`; none for filters, drawers, Back/Forward | e2e | `npm --prefix web run e2e -- --grep "@motion|@view-transitions"` | ✅ extend `motion.spec.ts` |
| PERF-07 | Motion inventory: every `animate-csp-*` recipe has `motion-reduce:` (button spinner keeps 2.4 s, D-30); smooth scrolls use `auto` under reduce | unit (node, source scan) | `npm --prefix web run test -- --run src/test/motion-inventory.node.test.ts` | ❌ Wave 0 |
| PERF-07 / D-05 | CLS and budgets after the change; live Lighthouse ≥ 0.95 on 7 pages | build gate + live run | `npm --prefix web run build:budget`; `live-audit.yml` run (quote the result) | ✅ / ❌ workflow |
| LEGAL-06 | Each runbook exists, has the timestamp line, names "the owner" and contains no email, phone or person name; data-requests covers access, correction, deletion and the converted-request rule; breach-response covers the 72-hour rule and the owner steps | arch (doc shape) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*OperationsRunbookTests"` | ❌ Wave 0 |
| D-07 | Restore drill script: fixed server and DB, `_local/` only, VERIFYONLY before any drop, metadata-only receipt, drops the drill DB, never `CSPS_Dev`/`CSPS_Legacy_Restore`/`BetsLLC_*` | arch (script text) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*RestoreDrillScriptTests"` | ❌ Wave 0 (pattern: `CutoverRunbookTests`) |
| A11Y-05 | Scripts for 8 flows exist; results table has a row per step per reader; every fail has an outcome; `Signed:` line format | arch (doc shape) | `... --filter-class "*A11yManualRecordTests"` | ❌ Wave 0 |
| A11Y-05 | Keyboard-only pass (Claude) | e2e keyboard journeys + recorded results | `npm --prefix web run e2e -- --grep @keyboard` plus the written record | ✅ partial |
| D-25 | Full suite green on all seven projects | e2e | `npm --prefix web run e2e` (preflight first; quote totals) | ✅ |

### Sampling Rate
- **Per task commit:** the quick command for the touched file (Vitest file or one .NET test class).
- **Per wave merge:** `npm --prefix web run verify` and `dotnet test --solution Csps.slnx` (localdb, after preflight).
- **Phase gate:** full e2e green on every project (D-25), CodeQL zero open, ZAP CI run green with every alert given an outcome, live audit results quoted, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/Csps.ArchitectureTests/ZapWorkflowTests.cs`, `LiveAuditWorkflowTests.cs` (reuse `WorkflowText.cs`)
- [ ] `tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs`, `OperationsRunbookTests.cs`, `A11yManualRecordTests.cs`, `RestoreDrillScriptTests.cs`
- [ ] `web/scripts/pwa-config.test.ts`, `pwa-build.test.ts`, `pwa-icons.test.ts`, `zap-requests.test.ts`
- [ ] `web/src/modules/admin/hooks/useAppUpdate.test.ts`, `UpdateBanner.test.tsx`, `OfflineCard.test.tsx`, `web/src/hooks/usePrefersReducedMotion.test.ts`, `web/src/test/motion-inventory.node.test.ts`
- [ ] `web/e2e/pwa.spec.ts` (`@pwa`)
- [ ] Vitest needs a stub for `virtual:pwa-register` (alias or `vi.mock`), because the virtual module does not exist when the plugin is disabled in `test` mode
- [ ] No framework install needed

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture / V14 Configuration | yes | Security headers middleware, `web.config`, Production-only settings, Release build (no Testing features) |
| V2 Authentication | yes (review only, no new auth code) | Identity + emailed code, lockout, rate limits; break-glass runbook keeps "no bypass" (04 D-29) |
| V3 Session Management | yes | Server-side sessions checked on every request (`sid` must be active); the SW never caches API or signed-in answers |
| V4 Access Control | yes | Default-deny; authorization matrix; Manager-only delete |
| V5 Input Validation | yes | FluentValidation + zod mirrors (OR-3); unchanged |
| V6 Cryptography | yes (review) | Data Protection with certificate (C-32, D-24); no hand-rolled crypto |
| V7 Errors and Logging | yes | ProblemDetails with trace id; D-24 live log check for the unencrypted-key warning ("No XML encryptor configured", text from the 01-10 plan) |
| V8 Data Protection | yes | Data requests and breach runbooks; outbox content nulled on close and purged after 30 days `[VERIFIED: EmailOutboxMessage.cs:178-180; PurgeExpiredRecordsJob.cs:45]` |
| V10 Malicious Code / supply chain | yes | Pinned actions and image digest, lockfiles, `npm ci --ignore-scripts`, license and audit gates |
| V12 Files and Resources | yes (review) | Upload rules unchanged; SW precache of static files only |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale or poisoned worker serving old code after a fix | Tampering | `no-cache` on `sw.js`; update banner; `selfDestroying` kill switch in the deploy runbook |
| Cached signed-in data on a shared or lost phone | Information disclosure | No runtime caching; Playwright cache inspection test (D-13) |
| Manifest/SW leaking onto public pages | Tampering / scope creep | Server-only admin head tags; tests on public documents and public chunks |
| Scanner report or run log exposing a token | Information disclosure | Throwaway CI tokens, gitleaks over the report folder, short artifact retention, no issue writing |
| Scanner hammering the live shared host | Denial of service | Passive only, short spider, low threads, signed out (D-01, D-04) |
| Clickjacking | Tampering | CSP `frame-ancestors 'none'` plus `X-Frame-Options: DENY` (CodeQL) |
| Restore drill mailing real people | Information disclosure | Dummy SMTP, no production PFX, drop the copy (Pitfall 12) |
| Breach handled late | Repudiation / compliance | Breach runbook with the 72-hour clock and the owner steps (D-19) |

**NPC facts for the breach runbook** (owner to confirm with the NPC or an adviser, D-19): notify the NPC and affected people within 72 hours of knowing or reasonably believing a breach that needs notice occurred; an early notice may be incomplete, with a fuller report later (sources say within five days); no delay when at least 100 people are affected or sensitive personal information may cause harm; delay is allowed only to find the scope, stop further disclosure or restore integrity; NPC Advisory 2026-02 says filing through the Data Breach Notification Management System does not replace the Circular's duties `[CITED: privacy.gov.ph NPC Circular 16-03 page; secondary sources, see A14]`.

**Other runbook facts found:**
- The quote alert email to staff contains the visitor's name in the subject and up to 300 characters of their message `[VERIFIED: QuoteAlertText.cs:9-21]`. A deletion request must also remove those alert emails from the shop mailbox. The app cannot do that, so the runbook lists it as a manual step.
- Outbox email bodies are cleared when a message closes, and sent rows are removed after 30 days `[VERIFIED]`.
- Audit entries for a deleted quote hold only the status and photo count `[VERIFIED: DeleteQuoteRequestHandler.cs summary]`.

## Current CodeQL and Dependabot state (for the triage plan)

Read 2026-11-26 through the GitHub API. Latest analyses on main: C# 8 results, JS/TS 4 results.

| Alert | Rule | Severity | Location | Likely outcome |
|---|---|---|---|---|
| 14 to 19, 23 | `cs/web/missing-x-frame-options` | high | `src/Csps.Server/web.config` + six `bin/Debug` copies | Fix (Pitfall 10) |
| 5 | `js/disabling-certificate-validation` | high | `web/scripts/deploy.mjs:363` | Fix with pinning kept, or owner acceptance |
| 4 | `js/bad-code-sanitization` | medium | `web/scripts/design-side-by-side.mjs:345` (local review tool) | Fix or dismiss with reason |
| 3 | `js/bad-code-sanitization` | medium | `web/e2e/deleteOrderDialog.ts:15` (test helper) | Fix or dismiss with reason |
| 13 | `cs/web/cookie-secure-not-set` | medium | `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs:124` (test only) | Fix (set `Secure`) |
| Dependabot 6 | minimatch `GHSA-g3hv-75wg-m249` | medium | `web/package-lock.json` (development) | Already owner-accepted until 2026-12-14; dismiss in GitHub with that reason, or fix |

Secret scanning: 0 open. One code-scanning alert is already dismissed.

## D-26 review pack inputs

The Phase 14 `STATE.md` has **101 open** `- [ ]` items under Pending Todos (56 ticked). Besides the CONTEXT list and UI-SPEC W5, these open choices are not owned by later phases and should go in the pack (planner confirms each): the Firefox font-abort e2e choice (also a D-25 blocker), the 12-21/12-23 "today" range, 12-26/12-27/12-28/12-29/12-30 Visitor Stats choices, 12.1-08 layout and empty wording, 12.1-03 unused cursor row, 12.1-14 unused referrer constants, the stale `docs/web/budgets.md`, the stale Vitest cache fix, `CSPS_Dev` one migration behind (needs a yes), 09-01/09-05/09-06/09-11/09-16/09-21 wording items, 09-13/09-01 timing-test limits, 09-14 upload deadlock (real defect: decision needed), 09-15 and 09-17/09-20/09-28 choices, 07-REVIEW logic changes (DOM-WR-04) and the refunds-on-soft-deleted-order question (07-04 D-39), the rare 500 on two creates with the same email, the intermittent `ParallelCallersEachGetTheirOwnStatus` 500, and the two media spinners (Open Question 12). Items for Phase 15 to 17 (legacy import carry-forward, D-51, D-56) stay out.

## Sources

### Primary (HIGH confidence)
- Codebase files read this session: `Program.cs`, `SecurityHeadersMiddleware.cs`, `SpaRegistration.cs`, `ShellPage.cs`, `PublicRouteTable.cs`, `TestingHostRegistration.cs`, `AccessTokenIssuer.cs`, `SmtpOptions.cs`, `MailKitTransport.cs`, `DataProtectionSettings.cs`, `AnalyticsBots.cs`, `DeleteQuoteRequestHandler.cs`, `QuoteRequestsController.cs`, `legalPrivacy.ts`, `legalPages.ts`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `UiLink.tsx`, `guard.ts`, `router.tsx`, `routes.tsx`, `lighthouse.mjs`, `package-check.mjs`, `ci.yml`, `weekly.yml`, `codeql.yml`, `deploy.yml`, `maintenance.yml`, `Restore-LegacyReceipt.ps1`, `OpenApiExposureTests.cs`, `docs/audit-exceptions.json`, `docs/license-exceptions.json`, `docs/dependencies.json`, `CSPS-PRD.md` §11 to §13, `.planning/HOSTING-RECORD.md`
- vite-plugin-pwa@2.0.0 tarball (`npm pack`, read only): `dist/index.d.ts`, `dist/index.js`, `dist/chunk-I2Z7IWCN.js`, `dist/client/build/register.js`, `dist/client/dev/register.js`
- workbox-build@7.4.1 tarball (`npm pack`, read only): `build/types.d.ts`
- react-router 8.4.0 installed dist: `lib/components.js`
- npm registry (`npm view`), the package-legitimacy seam, GitHub REST API (advisories, releases, issues, code scanning, Dependabot), ghcr.io manifest digests
- MITRE CWE Top 25 2025: https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html

### Secondary (MEDIUM confidence)
- ZAP baseline scan docs: https://www.zaproxy.org/docs/docker/baseline-scan/
- ZAP Automation Framework: https://www.zaproxy.org/docs/desktop/addons/automation-framework/
- ZAP auth header env vars: https://www.zaproxy.org/docs/getting-further/authentication/handling-auth-yourself/
- ZAP connection options (default user agent setting exists, value not stated): https://www.zaproxy.org/docs/desktop/addons/network/options/connection
- ZAP spider options (defaults not stated): https://www.zaproxy.org/docs/desktop/addons/spider/options/
- vite-plugin-pwa releases and README: https://github.com/vite-pwa/vite-plugin-pwa/releases
- View Transitions Baseline: https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available
- React `<link>` placement: https://react.dev/reference/react-dom/components/link
- NPC Circular 16-03: https://privacy.gov.ph/?p=553

### Tertiary (LOW confidence)
- Secondary write-ups on NPC breach timing (law firm and news summaries found by search); ATT&CK IDs beyond PRD §11.2; Playwright `page.route` and service worker note (training knowledge)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. One new package, read from its own source; ZAP pinned by digest.
- Architecture: HIGH for the server and PWA wiring (read from code); MEDIUM for the ZAP sign-in path (owner choice pending).
- Pitfalls: HIGH for 1 to 5, 7, 9, 12, 13 (verified); MEDIUM for 6, 8, 10, 11 (partly assumed).
- Legal points: MEDIUM to LOW (the owner confirms, D-19).

**Research date:** 2026-11-26
**Valid until:** 2026-12-14 (audit exceptions expire; a 2026 CWE Top 25 may appear in December). Re-check ZAP and vite-plugin-pwa versions if planning starts after that.
