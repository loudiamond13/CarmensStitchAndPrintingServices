---
phase: 04-identity-authentication
plan: 23
subsystem: auth-email
tags: [email, html, cid-logo, d-30, preview-tool, auth-13]
status: complete
created: "2026-10-15T08:30:00-05:00"
updated: "2026-10-15T08:30:00-05:00"

requires: ["04-22", "04-35"]
provides:
  - "EmailHtmlLayout: the D-30 branded frame (inline styles, role=presentation tables, 4px orange bar, inline CID logo, no remote resource) built from EmailContent blocks (ParagraphBlock, MetaBlock, CodeBlock, one optional button)"
  - "EmailRenderer: all seven auth emails go through one Brand step that builds the HTML and the text part from the same blocks"
  - "MailKitTransport.BuildMessage attaches the logo as a related image/png with Content-Id csps-logo when the HTML uses it"
  - "tools/Csps.EmailPreview (Development only): --out folder writes 7 .html and 7 .txt files, --to address sends the seven samples through the real SMTP path"
  - "web/scripts/render-email-logo.mjs: renders the 360 px logo PNG and writes EmailLogoPng.cs (--encode-only rewrites the C# from the PNG)"
affects: [04-32 UAT, 04-33]

requirements-completed: []

actuals:
  tokens: 20000
  tasks: 3
  commits: 8
plan_head_before: d3c59cb1af40d6da08d6d8649ad78b153a7e7297
plan_head_after: 32661c1f3b58a30b8d46ca5f7bc6c9cfbf5dc598

tech-stack:
  added: []
  patterns:
    - "One list of blocks makes both the HTML and the plain-text part, so the words cannot drift"
    - "A tools/ Exe takes an optional settings object: null reads the environment and user-secrets, a test passes its own so it never reads real mail settings"
    - "The logo bytes are compiled in as base64 from a generated file, checked against the committed PNG by a test"

key-files:
  created:
    - src/Csps.Infrastructure/Email/EmailHtmlLayout.cs
    - src/Csps.Infrastructure/Email/EmailLogoPng.cs
    - src/Csps.Infrastructure/Email/EmailPreviewOptions.cs
    - src/Csps.Infrastructure/Email/Assets/csps-logo.png
    - web/scripts/render-email-logo.mjs
    - tools/Csps.EmailPreview/Csps.EmailPreview.csproj
    - tools/Csps.EmailPreview/Program.cs
    - tools/Csps.EmailPreview/packages.lock.json
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailHtmlLayoutTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailPreviewTests.cs
  modified:
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Infrastructure/Email/MailKitTransport.cs
    - src/Csps.Infrastructure/Csps.Infrastructure.csproj
    - Csps.slnx
    - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/MailKitTransportTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/SignInCodeEmailRenderTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Csps.Infrastructure.IntegrationTests.csproj
    - tests/Csps.Infrastructure.IntegrationTests/packages.lock.json
    - docs/operations/mail-setup.md

key-decisions:
  - "Owner accepted (2026-10-15): the logo is compiled in as base64 (EmailLogoPng.cs, generated from the committed PNG) instead of an EmbeddedResource, because the dependency registry treats every embedded file as a third-party data file"
  - "Owner accepted: one small style block with a 480 px media query drops the card padding from 32 to 24 px on phones; clients that ignore it keep 32 px"
  - "Owner accepted: the text part prints Label: URL for the button and leaves out the copy-this-link sentence"
  - "Owner change after reviewing the previews: the staff address is bold (strong, font-weight 700, still HTML-encoded) in the HTML of the reset-link, password-changed, deactivated and invite emails; the text part is unchanged"
  - "The preview files inline the logo as a data URL because a browser cannot read CID parts; sent mail only uses CID"

patterns-established:
  - "The preview tool refuses outside Development with exit 2, uses fixed sample values, and prints only the count of emails sent"
---

# Phase 4 Plan 23: Branded auth emails, inline logo and the owner preview tool Summary

All seven auth emails now leave as the D-30 branded HTML (Blush page, 600 px card, orange bar, uppercase heading, one bulletproof button with a copy-link fallback) with the CSPS logo as an inline CID image, no remote resource and a plain-text twin built from the same blocks, and the owner reviewed and approved them rendered.

## What was built

- **Tracer (Task 1):** `EmailHtmlLayout` builds the frame from `EmailContent`. The sign-in code email shows the code in a selectable 32 px monospace box, the request time in business time and the coarse device, never an IP. `MailKitTransport` adds the 360 px logo PNG as a related part with Content-Id `csps-logo` only when the HTML references it. `web/scripts/render-email-logo.mjs` rendered the lockup from the showcase `logo-lg` case.
- **Task 2:** `EmailRenderer` builds every kind (code, locked, reset link, password changed, Manager reset, deactivated, invite) as `EmailContent` and one `Brand` step makes both parts. Tests pin each kind's UI-SPEC heading, preheader and button target, at most one button, every HTML sentence present in the text part, and no unfilled placeholder.
- **Task 3:** `tools/Csps.EmailPreview` with `EmailPreviewOptions` (`--to`, `--out`, `--public-base-url`). Outside Development it exits 2. With `--out` it writes 7 `.html` and 7 `.txt` files and never opens SMTP. With `--to` it sends the seven samples and prints `Sent 7 preview emails.` The tool is in `Csps.slnx` and `SolutionLayoutTests`, and `docs/operations/mail-setup.md` has a "Preview the emails" section.
- **Owner review (D-30):** the owner opened the rendered previews in `artifacts/email-preview/` (git-ignored) and asked for the staff address to be bold. That was done test-first (9d255f7 RED, 32661c1 GREEN) in the four kinds that show the address, and the owner then replied "approved".

## Owner approval

Approved by the owner on 2026-10-15 after the re-rendered previews, including the bold address, and the owner accepted the compiled-in logo, the 480 px padding style block and `Label: URL` in the text part.

## Verification

- Final runs: `Csps.Infrastructure.IntegrationTests` 407 passed, 1 skipped (already skipped before this plan); `Csps.ArchitectureTests` 127 passed; `Csps.Server.IntegrationTests` 638 passed (run before the bold change, which touches only email HTML); `dotnet build Csps.slnx` 0 warnings, 0 errors; ESLint and Prettier clean on the logo script.
- Acceptance greps: `cid:csps-logo` in `EmailHtmlLayout.cs`, `LinkedResources` in `MailKitTransport.cs`, the PNG is non-empty (360 x 68), `Csps.EmailPreview` in `Csps.slnx` and `mail-setup.md`. For the renderer criterion, all seven HTML parts are asserted to carry the frame's brand bar and logo.
- No automated test sent real mail. The preview tool's SMTP path was exercised only through a recording transport.
- Tracer gate (end-of-phase, automated verify only): the tracer's verify commands were re-run green before the expansion tasks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Logo compiled in as base64, not an EmbeddedResource**
- **Found during:** Task 3 (full ArchitectureTests run)
- **Issue:** `DependencyRegistryTests` fails with "embedded file has no data record": the registry demands a commit-pinned source URL, hash and an allowed license for any embedded file under `src/`.
- **Fix:** keep `Assets/csps-logo.png` as the committed asset; the render script also writes `EmailLogoPng.cs`; `CompiledLogoIsTheCommittedPngAsset` checks they match. The owner accepted this.
- **Files modified:** `EmailLogoPng.cs`, `EmailHtmlLayout.cs`, `Csps.Infrastructure.csproj`, `render-email-logo.mjs`
- **Commit:** d227bbb

**2. [Rule 1 - Bug] Existing renderer tests adjusted for the branded frame**
- **Found during:** Task 1 (RED)
- **Issue:** old tests forbade any `<img`, `src=` and `{`/`}` in the HTML, which the frame legitimately needs (the one logo image and the media-query style block).
- **Fix:** the brace check ignores the one style block; the image rule is now "only `cid:csps-logo`"; remote-resource bans (`<script`, `<link`, `@import`, `url(`, `http://`) stay.
- **Commit:** 9b9f804, 35c7833

**3. [Owner change] Bold staff address**
- Requested by the owner during the D-30 review; commits 9d255f7 and 32661c1.

**Total deviations:** 2 auto-fixed (1 blocking, 1 test adjustment) and 1 owner-requested change. **Impact:** none on scope; AUTH-13's secrets rule (code only in the code email, token only in the button URL and its fallback) is unchanged.

## Requirements

AUTH-13 is not ticked. Plans 04-32 and 04-33 also declare it and have no SUMMARY yet, so the shared-ID gate keeps it pending until they finish.

## Still open (end-of-phase UAT, not blocking this plan)

- Owner: send the seven to Gmail with `dotnet run --project tools/Csps.EmailPreview -- --to <address>` (Development) and check the logo shows without "load images" in Gmail web and the Android app, each button works, and "Show original" shows the text part.
- Developer (D-27, D-08, D-32): with the API and `npm --prefix web run dev` running, sign in with the bootstrapped account; the code email arrives from "Carmen's Stitch & Printing" with the code in its subject and the time and device.

## Known Stubs

None.

## Threat Flags

None. The preview tool adds no network surface; it sends mail only to an address typed on its command line, in Development.

## Self-Check: PASSED

All created files exist and all eight commits (9b9f804, 35c7833, 4ce7fb7, 340b988, 01397f4, d227bbb, 9d255f7, 32661c1) are ancestors of HEAD.
