# Phase 9: Order Images & Maintenance Jobs - Research

*Created: 2026-10-31T10:05:00-05:00 · Updated: 2026-10-31T10:10:00-05:00*

**Researched:** 2026-10-31
**Domain:** server-side image upload to Cloudinary (free plan), image delivery, browser photo preparation, a scheduled maintenance endpoint
**Confidence:** MEDIUM overall (HIGH on the codebase, MEDIUM on Cloudinary behavior from official docs, LOW on the few items in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied from `09-CONTEXT.md`. The two long dashes in D-01 and D-21 are shown as a period here, per the owner's no-long-dash rule. The wording is otherwise unchanged.

### Locked Decisions

#### Photo privacy and delivery (OD-9, C-26)
- **D-01:** **Order photos use public Cloudinary delivery with random, unguessable public ids** under `csps/orders/{orderId}/` (owner, 2026-10-31). This goes against the PRD's recommendation of authenticated delivery. The owner chose it knowing that anyone who has an address can open the photo. Addresses appear only in staff API responses and staff pages, never on the public site. **Reversibility:** costly. Moving to authenticated delivery later means re-uploading or retyping every stored asset and rebuilding every delivery URL.
- **D-02:** **GPS and camera data are stripped before the file reaches Cloudinary** (server side, at upload). Delivery also strips it, so the stored copy is clean even if an address leaks (owner, 2026-10-31).
- **D-03:** **Strict transformations are on** in Cloudinary: only the named sizes the app uses can be loaded. No raw original and no ad-hoc sizes, so free credits can't be burned (owner, 2026-10-31). The owner turns the setting on (owner checklist item). Research picks the named sizes (list thumb, grid, viewer, full size).
- **D-04:** Staff get an **"Open full size"** action. It loads one large allowed size (about 2000 px long side, metadata stripped), never the raw upload (owner, 2026-10-31).
- **D-05:** **Deleting a photo from Cloudinary also clears its cached copies** (invalidate), so the old address stops loading within minutes of the job running (owner, 2026-10-31).
- **D-06:** **Cloudinary account: the owner has a free-plan account** and supplies the cloud name, key and secret as host secrets and dev user-secrets, never in git (owner, 2026-10-31). Every design must fit the free plan (no paid features, such as expiring signed URLs).
- **D-07:** **Development and live share the one account, in separate folders:** `csps-dev/orders/` for development and `csps/orders/` for live, each from configuration. A job or sweep touches only its own environment's folder. **Automated tests never call Cloudinary.** They use a fake `IImageStorage` (owner, 2026-10-31).

#### Photo limit and new orders (C-2)
- **D-08:** **Maximum 5 photos per order**, as in the PRD and the domain rule (`MaxImagesPerOrder = 5`, Domain plus DB-level guard). The uploader is passed `max = 5` (owner, 2026-10-31).
- **D-09:** **On the new-order form, staff pick photos like any other field.** Save creates the order first, then the photos upload one by one with progress (owner, 2026-10-31).
- **D-10:** **If a photo fails after the order is saved, the order stays saved.** Staff land on the order page, a message says how many photos didn't upload, and those photos wait there with "Try again" and "Remove". They are lost only if staff leave the page (owner, 2026-10-31).
- **D-11:** **Closed orders follow the Phase 8 lock** (08 D-15, 07 D-05): photos can't be added, moved or deleted on a Completed or Cancelled order until it is reopened (owner, 2026-10-31).
- **D-12:** **Alt text is optional, with a default** of "Order {number} photo {n}", which staff can edit. An upload is never blocked on typing (owner, 2026-10-31).

#### Reorder, cover and viewing (C-16)
- **D-13:** **Reorder by buttons, with drag as a bonus:** each photo has "Move left" and "Move right" buttons (44 px, named per photo). Mouse drag stays. A live region announces "Moved to position {n} of {total}" (owner, 2026-10-31; WCAG 2.5.7).
- **D-14:** **"Make cover" is an always-visible button** on every photo except the cover, with no hover gate. The cover keeps its "Cover" tag. This replaces the Phase 2 hover star for this action (owner, 2026-10-31). The cover is the lazy thumbnail in the order list, with the existing placeholder when there's none.
- **D-15:** **Photo changes save immediately** (move, cover, alt text, delete), each with a small "Saved" message. Delete asks to confirm. A conflict (rowversion 409) reloads the latest photos (owner, 2026-10-31).
- **D-16:** **Tapping a photo opens a viewer** with Previous and Next buttons, arrow keys, Esc to close, the alt text and "Open full size". Focus goes back to the photo on close (owner, 2026-10-31).
- **D-17:** **On phones, two buttons: "Take Photo"** (opens the camera, `capture`) **and "Choose Photos"** (gallery). A computer shows the drop zone and browse only (owner, 2026-10-31).
- **D-18:** **Every upload is downscaled in the browser to a 2000 px long side**, camera and gallery alike. A file already within that size is left as it is. The server still enforces 10 MB (configurable), magic bytes (JPEG/PNG/WebP/HEIC), max dimensions and no SVG (owner, 2026-10-31).
- **D-19:** **Admins and Managers both** add, arrange and delete photos, like other order parts (07 D-25). Every photo change goes in the audit log (07 D-31) (owner, 2026-10-31).

#### Deletes and maintenance jobs (JOB-01, JOB-02)
- **D-20:** **Photos leave Cloudinary only on a permanent delete:** deleting one photo, or a Manager's "Delete permanently" of an order. A soft-deleted order keeps its photos, so a restore brings them back (07 D-26 to D-28). The removal is queued in the **same transaction** as the business change (owner, 2026-10-31).
- **D-21:** **The scheduled maintenance call runs once a month**, and it does everything in one run: the Cloudinary removal queue, the token, 2FA code and idempotency-key purges, the stray-file check and the usage report. The owner chose this knowing that a deleted photo stays reachable at its old address for up to a month and that expired rows build up between runs (owner, 2026-10-31). The workflow also has a manual **"Run now"** (`workflow_dispatch`). This overrides the roadmap's "weekly orphan sweep": the sweep is monthly. **Reversibility:** reversible. One cron line in the workflow.
- **D-22:** **Failures:** each removal is retried with leases and growing waits within a run, and failures are logged. A removal still failing at the end of a run makes the endpoint report failure, so the GitHub run turns red and GitHub emails the owner. No new screen (owner, 2026-10-31).
- **D-23:** **Stray files:** the sweep deletes Cloudinary files under its own environment's `…/orders/` folder that match no photo row and are **older than 2 days**. Each removal is logged, with a count in the run summary (owner, 2026-10-31).
- **D-24:** **Usage report:** each run reports Cloudinary storage and monthly credits used in the run summary. **Above 80% of the free plan, the run turns red** (owner, 2026-10-31).

#### UI contract rulings (UI-SPEC OQ-1 to OQ-7)
- **D-25:** **Photos show as one compact photo list** on the order page and the order form: each photo is a small card with an 88px thumbnail, its description, "Make Cover" and four 44px buttons; 2 columns on wide screens, 1 on phones. No mosaic gallery (OQ-1 A; owner, 2026-10-31).
- **D-26:** **"Take Photo" uses lucide's `camera` icon**, added to `icons.ts` from the already installed package (OQ-2 A; owner, 2026-10-31).
- **D-27:** **"Open Full Size" opens the large photo in a new browser tab** (OQ-3 A; owner, 2026-10-31).
- **D-28:** **New-order photos upload on the order page:** after Save, staff go to the new order's page at once and the photos upload there with progress (OQ-4 A; owner, 2026-10-31).
- **D-29:** **Leaving the order page while photos wait or failed asks first:** "Leave this page?" with "Stay on Page" / "Leave Page", plus the browser prompt on reload or close (OQ-5 A; owner, 2026-10-31).
- **D-30:** **The default description is not stored:** "Order {number} photo {n}" is shown from the photo's current position, so the number follows moves (OQ-6 A; owner, 2026-10-31).
- **D-31:** **Upload progress is count-based** ("Uploading photo 2 of 4") with a spinner. No percent bar, so `core/api/http` is unchanged (OQ-7 A; owner, 2026-10-31).

#### Carried forward (already decided, not re-asked)
- **Scheduler:** GitHub Actions cron calling a secret-protected endpoint, because the Basic host has no scheduler (01 D-10). Nothing relies on in-memory state.
- **OD-14:** design-vs-WCAG clashes on these screens are ruled item by item in `/gsd-ui-phase 9`, as in Phases 4 to 8.
- **Phase 8 D-27:** the "Image uploads are coming soon." card on the form and order page is replaced by the real uploader and gallery.
- Server-only upload (IMG-01), no local disk or webroot (IMG-02), lazy responsive delivery with explicit sizes and placeholders (IMG-04), CSP `img-src` already allows `https://res.cloudinary.com`.

### Claude's Discretion
- The named transformation sizes and the `srcset`/`sizes` set (within D-03 and IMG-04).
- The lease, retry and back-off numbers within a run, and the batch sizes for purges.
- How the maintenance secret is sent and checked (constant-time compare, rotation notes), and which endpoint shape it takes, within the controller rules.
- Upload concurrency (one at a time is the default), and HEIC preview handling in browsers that can't show HEIC.
- How the job runner is laid out so Phases 12 and 13 can add jobs to the same endpoint.

### Deferred Ideas (OUT OF SCOPE)
- **Featured orders on the public site (Phase 11, input to C-12):** order photos show on the public site **by default**, and a Manager can turn it off per order so it doesn't show. Raised by the owner on 2026-10-31. Open for the Phase 11 discussion: showing customer orders publicly by default may need customer consent under the Philippine Data Privacy Act, or a "Customer said OK to show" box, and it affects the Privacy Policy (LEGAL-01). Phase 9's public delivery (D-01) and strict sizes (D-03) can serve it.

Also out of scope (CONTEXT boundary): the public gallery, analytics aggregation and inquiry retention jobs (Phases 12 and 13), the audit-log retention purge (hardening phase), legacy images (MIG-05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORD-04 | Staff can upload images to an order (during creation and later): a per-order maximum, reorder via an accessible non-drag alternative, choose the cover, set alt text and delete images | Patterns 2 (OrderImage child with slot guard), 3 (endpoints), 8 (client queue and handoff); Pitfalls 9, 10, 14 |
| IMG-01 | Order images upload through the server only (multipart, validation, Cloudinary signed upload). The Cloudinary secret never reaches the browser | Pattern 1 (upload pipeline), Standard Stack (CloudinaryDotNet 1.29.3); Security Domain |
| IMG-02 | Validated by magic bytes (JPEG/PNG/WebP/HEIC), max 10 MB (configurable), max dimensions, SVG rejected. Never on local disk or webroot (CWE-434) | Pattern 1, Pattern 7 (body limits and idempotency hashing), "Hand-rolled on purpose" (sniffer and stripper); Pitfalls 1 to 5 |
| IMG-03 | Random public ids in `csps/orders/{orderId}/`, EXIF/GPS stripped on delivery, original dimensions stored | Pattern 1 (random id, `private` type, stripping before upload), Pattern 4 (delivery); Pitfalls 6, 7 |
| IMG-04 | Lazy, responsive delivery (`srcset`/`sizes`, `f_auto,q_auto` or eager variants, explicit width/height, skeleton). Nothing larger than its display size | Pattern 4 (named transformations, true-width `srcset`), Named Sizes table; Open Question 2 (format) |
| IMG-05 | On mobile, staff capture a photo with the camera; it is downscaled client-side before upload | Pattern 8 (`prepareImage`), Pitfalls 11 to 13 |
| JOB-01 | Short, leased, idempotent jobs behind a secret-protected maintenance endpoint on a schedule; nothing relies on in-memory state | Pattern 5 (runner), Pattern 6 (key filter), Pattern 9 (workflow), purge rules table; Pitfalls 15 to 18 |
| JOB-02 | Image deletions queued in the same transaction as the business change, retried until they succeed, failures logged, orphan sweep reconciles storage | Pattern 5 (queue, leases, sweep); Pitfalls 8, 19 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These carry the same weight as locked decisions. Sources: `./CLAUDE.md`, `./.claude/CLAUDE.md`, the owner's global rules.

- **Stack:** .NET 10 controllers (`[ApiController]`, attribute routes under `/api/v1`), EF Core 10 Fluent config, SQL Server, FluentValidation in handlers, Serilog. React 19 + TS strict + Vite, TanStack Query, RHF + zod. Cloudinary through `CloudinaryDotNet` (PRD §2 table: "Images | Cloudinary (`CloudinaryDotNet`) | Server-side signed uploads only (§10).").
- **Forbidden:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **Free only; licenses MIT, Apache-2.0, BSD, ISC** (plus the named exceptions). No GPL, AGPL, SSPL or commercial. LGPL is not on the list either.
- **New dependencies:** purpose, license, maintenance and legitimacy recorded in RESEARCH.md (below); each version at least 14 days old; **owner approval before any install** (subagents never install silently).
- **Onion:** Domain ← Application ← Infrastructure ← Server, enforced by ArchUnitNET. PRD §3 forbids Cloudinary in Application ("Application | ... | Infrastructure, Server, EF Core, ASP.NET Core, Cloudinary, MailKit").
- **No mediator:** one handler per use case, manual mapping, `Result<T>` to RFC 9457 ProblemDetails. Thin controller actions call one handler.
- **Default-deny:** every action declares `[Authorize(Policy = ...)]` or `[AllowAnonymous]`; the authorization-matrix test covers every endpoint × {anonymous, Admin, Manager}.
- **SEC-06:** every state-changing POST needs `Idempotency-Key`, or an `[IdempotencyExempt("reason")]` plus a test allow-list entry.
- **rowversion per aggregate (409). UTC + `TimeProvider`; `DateTime.Now`/`UtcNow` and `System.Random` are banned** (`BannedSymbols.txt`).
- **Schema:** EF migrations only, **no JSON columns, no triggers except `TR_AuditLog_AppendOnly` (OR-7)**, drops/renames/lossy changes need the owner. Never `Database.Migrate()` at startup.
- **No inline SQL** in application code: LINQ, `ExecuteUpdate`, `ExecuteDelete` only.
- **Quality:** TDD (failing test first), zero warnings, coverage Domain 100%, Application ≥ 95%, `core/api` 100%, web ≥ 90%.
- **Security:** CWE Top 25 review, strict CSP (no `unsafe-inline`/`unsafe-eval`), append-only audit, no secrets or data in git. Treat the repo as public (it is public since 2026-10-16): no real cloud names, keys, server names, emails or local paths in tracked files.
- **A11y:** WCAG 2.2 AA, zero axe violations, 44 px targets.
- **Perf:** admin initial JS ≤ 250 KB gz, CSS ≤ 35 KB gz, LCP < 2.0 s, CLS < 0.05.
- **Client rules:** OR-3 zod mirrors every server rule; OR-4 no em or en dash in `web/src`; OR-5 calls in `modules/{public,admin}/services/`, only `core/api/http` touches `fetch`; OR-6 owner layout tree.
- **Shared machine:** ports 5180, 5115, 7028, 5199 only; LocalDB `(localdb)\MSSQLLocalDB` with `CSPS_` databases; no Docker locally; preflight before dev servers or full runs; never set env vars at User/Machine level; never run a command that reads stdin.
- **Workflows:** top-level `permissions: {}`, every job has `timeout-minutes`, actions pinned by SHA and listed in `ApprovedActions` (`CiWorkflowTests`).
- **Merges:** only through `tools/scripts/Merge-PullRequest.ps1`, on the owner's word.
- **Markdown files** carry created and updated timestamps.

## Summary

Most of this phase is ordinary work in the patterns the codebase already has: a new order child (`OrderImage`) written through `OrderChildWrite`, a new controller, audit entries, and new web components the approved UI-SPEC already describes. Three areas need care, and they shape the plan.

**First, the upload path touches four request-size limits and the idempotency gate.** Kestrel, IIS in-process, `RequestBodyLimitMiddleware` and `web.config` all cap bodies at 1 to 2 MB today, and the middleware refuses a large `Content-Length` before routing, so a 10 MB upload cannot reach any action. The idempotency middleware buffers and hashes the raw body with a 1 MB cap, and the file deferral LIB-CR-02 is still open: a multipart body gets a new boundary on every send, so "Try Again" with the same key would get a 422. The plan must raise the limit only for the upload route (ASP.NET Core's routing applies `[RequestSizeLimit]` per endpoint), move the body-limit check after routing, raise the IIS backstop, keep every buffer in memory (never a temp file), and hash multipart bodies part by part.

**Second, Cloudinary's free plan dictates the delivery design.** Strict transformations block ad-hoc sizes but do not, by Cloudinary's own description, block the untransformed original of an `upload`-type asset. The `private` delivery type does: its original needs a signed URL while its transformed sizes are public. Named transformations created through the Admin API are allowed under strict mode by default, but `f_auto` cannot sit inside a named transformation. Signed delivery URLs would also pass strict mode, but Cloudinary does not invalidate signed URLs by default, which breaks D-05. The recommendation is `private` type, 13 named transformations with an explicit format, unsigned URLs with the `/v1/` component (the only form Cloudinary invalidates for public ids with slashes), and `destroy` with `invalidate=true` on the Upload API, which is not rate-limited. Two of these points reach slightly past the letter of D-01 and IMG-04, so they are Open Questions 1 and 2 for the owner.

**Third, D-02 (strip GPS before Cloudinary) has no permissive library that fits.** ImageSharp's license is not on the allowed list, SkiaSharp cannot read HEIC on Windows or Linux and decodes full bitmaps on a 256 MB app pool, and Magick.NET bundles LGPL codecs. The recommendation is a small hand-written byte-level sniffer and metadata stripper (JPEG segments, PNG chunks, WebP RIFF chunks, HEIC `meta` items), with no decoding. It keeps JPEG orientation as a one-tag Exif block, so Cloudinary's default EXIF auto-rotation still turns photos upright. This is the riskiest code in the phase and needs synthetic fixtures built in test code (never real photos).

**Primary recommendation:** build the server pipeline (limits, multipart hashing, sniff, strip, `IImageStorage`, `OrderImage` with a slot-based DB guard, deletion queue) and the maintenance runner first, behind the fake storage, then the client (`prepareImage`, the queue, the photo list, the viewer), and finish with a one-time Cloudinary setup command and the owner checklist. Add exactly one NuGet package, `CloudinaryDotNet` 1.29.3, after owner approval. No npm packages.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Photo preparation (sniff, upright, downscale to 2000 px, preview) | Browser | n/a | D-18; saves bandwidth on phone data; `createImageBitmap` applies EXIF orientation |
| Client rule checks (type, size, count, description length) | Browser | API (authoritative) | OR-3 mirror; the server repeats every check |
| Upload transport (multipart, one file at a time, key per file) | Browser (`core/api/http`) | n/a | D-31, SEC-06, WEB-09 |
| Body size limits, multipart hashing, idempotency | API (Server middleware) | IIS `web.config` backstop | Must run before the action; IIS limit is enforced before ASP.NET Core |
| Magic bytes, dimensions, metadata strip | API (Application, pure code) | n/a | D-02, IMG-02; client is untrusted |
| Signed upload, delete, list, usage | API (Infrastructure adapter over CloudinaryDotNet) | Cloudinary | IMG-01; secret stays on the server |
| Photo limit, positions, cover, lock rule | Domain (`Order` aggregate) | Database (CHECK + unique slot) | D-08 "Domain plus DB-level guard", D-11 |
| Deletion queue writes | Database (same transaction) | API handler | D-20, JOB-02 |
| Delivery URL building (named sizes, true-width `srcset`) | API (Infrastructure, pure string code) | CDN (Cloudinary) | UI-SPEC: "the client never assembles Cloudinary URLs or knows transformation names" |
| Image bytes delivery, EXIF strip on delivery, auto-rotate | CDN (Cloudinary) | n/a | Cloudinary defaults |
| Scheduling | GitHub Actions cron | n/a | 01 D-10 (no host scheduler) |
| Maintenance work (purges, sweep, queue, usage) | API (Application jobs + Infrastructure EF) | Database leases | JOB-01; nothing in memory |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CloudinaryDotNet | **1.29.3** (published 2026-08-16, 76 days old) | Signed upload, `destroy` with invalidate, prefix listing, usage report, named transformation setup | Cloudinary's official .NET SDK; already named in PRD §2 and `.planning/research/STACK.md` [VERIFIED: NuGet registration API, GitHub releases] |
| ASP.NET Core `MultipartReader` / `IFormFile` with `[RequestFormLimits]` | 10.0.x (in box) | Reading the multipart body in memory | Microsoft's documented upload path [CITED: learn.microsoft.com/aspnet/core/mvc/models/file-uploads] |
| `System.Security.Cryptography` (`RandomNumberGenerator`, `CryptographicOperations.FixedTimeEquals`, `SHA256`) | in box | Random public ids, maintenance key check | Already used by `ProbeKey` and `TokenHash` [VERIFIED: codebase] |
| `createImageBitmap` + `<canvas>` `toBlob`/`toDataURL` | browser built-in | Upright decode, downscale, re-encode, `data:` preview | No package needed; `imageOrientation: 'from-image'` is the default [CITED: developer.mozilla.org/docs/Web/API/Window/createImageBitmap] |
| `lucide-react` `Camera` icon | 1.53.0 (installed) | "Take Photo" (D-26) | Already a dependency [VERIFIED: web/package.json] |

### Supporting (already in the solution)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Microsoft.Extensions.Http.Resilience | 10.10.0 | Timeouts on the Cloudinary `HttpClient` | Timeouts only; app-level retries (see Pitfall 20) |
| Microsoft.Extensions.TimeProvider.Testing | 10.10.0 | `FakeTimeProvider` for leases, back-off waits, "older than 2 days" | Maintenance tests |
| Newtonsoft.Json | 13.0.4 (already resolved transitively) | CloudinaryDotNet's JSON | Comes with the SDK; no direct reference |
| MSW 3, Playwright, axe | installed | Upload flow, viewer, a11y | Existing harness |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written metadata stripper | SixLabors.ImageSharp | Six Labors Split License is not on the allowed list (needs an owner exception), no HEIC, decodes full bitmaps |
| Hand-written metadata stripper | SkiaSharp (MIT) | Re-encodes (quality loss), large native assets, no HEIC decode on Windows/Linux, full-bitmap memory on a 256 MB pool [ASSUMED] |
| Hand-written metadata stripper | Magick.NET | Wrapper is Apache-2.0 but ships ImageMagick with LGPL codecs (libheif, libde265), tens of MB of native code [ASSUMED] |
| Hand-written metadata stripper | MetadataExtractor (Apache-2.0) | Reads metadata only; cannot strip |
| CloudinaryDotNet | Hand-rolled REST calls | Avoids Newtonsoft, but re-implements request signing; the SDK is already the approved choice |
| Client `createImageBitmap` | `browser-image-compression`, `heic2any` npm packages | Not needed; `heic2any` bundles a libheif build (LGPL concerns) [ASSUMED] |
| Named transformations | Eager variants at upload | Every size generated for every photo whether viewed or not (13 transformations per photo up front); costs free credits |
| Named transformations | Signed delivery URLs | Pass strict mode without allow-listing, but signed URLs are not invalidated by default, which breaks D-05 [CITED: cloudinary.com/documentation/invalidate_cached_media_assets_on_the_cdn] |

**Installation (do NOT run; owner approval first):**
```xml
<!-- Directory.Packages.props, runtime group -->
<PackageVersion Include="CloudinaryDotNet" Version="1.29.3" />
<!-- src/Csps.Infrastructure/Csps.Infrastructure.csproj -->
<PackageReference Include="CloudinaryDotNet" />
```
Plus a `docs/dependencies.json` record (purpose, license MIT, publisher, legitimacy, published 2026-08-16, adopted date, coolDown "aged"), regenerated lock files, and `THIRD-PARTY-NOTICES.md`.

**Version verification (done this session):** `api.nuget.org` lists 1.29.3 as the newest stable (versions 1.27.0 to 1.29.3 all MIT, none deprecated, no `vulnerabilities` entries). GitHub release 1.29.3 (2026-08-16) changes only "Handle unsigned 32-bit wrap-around in integer response fields". Repo `cloudinary/CloudinaryDotNet`: MIT, not archived, last push 2026-09-30, 16 open issues. Total downloads about 8.06 M.

## Package Legitimacy Audit

The `gsd-tools package-legitimacy` seam supports npm, PyPI and crates only, so the NuGet check was done by hand against the NuGet registration API, the NuGet search API and the GitHub Advisory Database (`gh api /advisories?ecosystem=nuget&affects=...`).

| Package | Registry | Age (this version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| CloudinaryDotNet 1.29.3 | NuGet | 76 days (2026-08-16) | ~8.06 M total | github.com/cloudinary/CloudinaryDotNet (MIT, active) | OK (manual): official vendor SDK, owners `cloudinary`, no GHSA advisories, not deprecated | Approved for planning; **owner approval needed before install** |
| Newtonsoft.Json 13.0.4 (transitive) | NuGet | 410 days (2025-09-16) | very high | github.com/JamesNK/Newtonsoft.Json (MIT) | OK: GHSA-5crp-9r3c-p9vr affects only `< 13.0.1`; 13.0.4 is already in `src/Csps.Infrastructure/packages.lock.json` | No new package; it already resolves (via EF Core Design) |
| System.Net.Http 4.3.4, System.Text.RegularExpressions 4.3.1 (transitive, netstandard2.0 group) | NuGet | old, patched versions | very high | dotnet | OK; expected to be pruned by the .NET 10 SDK for `net10.0` [ASSUMED] | Check the regenerated lock file; `NuGetAuditMode=all` flags any regression |

**Plain-English findings for the owner (CloudinaryDotNet 1.29.3):** it is Cloudinary's own free library for .NET, under the MIT license (free to use, no payment, keep the notice). The version is about 11 weeks old, so it passes the 14-day rule. No known security problems are listed for it. Its last change was a small fix to how it reads large numbers. It needs one other library, Newtonsoft.Json, which the project already has at a safe version. Two open issues on GitHub look relevant but do not affect this design: #361 (a bulk delete that also sets a tag deletes by tag, not by id; this design uses single `destroy` calls) and #385 (empty upload parameters break the signature; the adapter never sends empty values).

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.
**npm:** no new packages. The `camera` icon comes from the installed `lucide-react` 1.53.0.

## Architecture Patterns

### System Architecture Diagram

```
UPLOAD (one file per request)
 Phone/desktop browser
   pick or capture ──► prepareImage: sniff bytes ─► reject? ─► pick-error box (no request)
                        │ decode upright (createImageBitmap) ─► downscale to 2000 px if larger ─► Blob + data: preview
                        ▼
   usePhotoUploadQueue (memory only, one at a time, one Idempotency-Key per file)
                        │ multipart POST /api/v1/orders/{id}/images
                        ▼
 Server pipeline
   SecurityHeaders ─► UseRouting (applies [RequestSizeLimit] for this route)
     ─► RequestBodyLimit (moved after routing; 413 above the route's limit, 1 MiB elsewhere)
     ─► RateLimiter (upload policy + concurrency cap) ─► AuthN/AuthZ (Staff)
     ─► Idempotency (buffer in memory, part-wise multipart hash, claim key, open transaction)
     ─► OrderImagesController.Upload (thin) ─► UploadOrderImageHandler
          1 quick check: order exists, editable, fewer than 5 photos (else 404/422, nothing uploaded)
          2 sniff + dimensions + strip metadata (pure Application code; 400 with plain-English message)
          3 IImageStorage.UploadAsync (Cloudinary, type=private, public id {root}/orders/{orderId}/{random})
          4 OrderChildWrite: find order, AddImage (re-checks lock and limit), lock row, audit, save
             └ failure after step 3 ─► queue removal of the new asset (separate short context) ─► sweep is the backstop
     ◄─ 200 whole order (photos with ready URLs) ─► stored with the key, committed

DELETE PHOTO / PERMANENT ORDER DELETE
   handler: domain change + IImageDeletionQueue.Enqueue(publicId) + audit ─► one SaveChanges, one transaction
   (soft delete and restore touch nothing in storage)

MAINTENANCE (monthly cron + "Run now")
 GitHub Actions (ubuntu) ─ curl POST /api/v1/maintenance/run + X-Maintenance-Key ─► [AllowAnonymous] + key filter
   ─► RunMaintenanceHandler: take run lease (DatabaseLocks claim) ─► jobs in order, each with a time budget:
        1 PurgeExpiredRecords (sessions + refresh tokens, 2FA challenges + codes, account links, idempotency keys, stale claims, [outbox])
        2 StraySweep (list {root}/orders/ by prefix, 500 per page; no photo row, not queued, older than 2 days ─► enqueue)
        3 ImageRemoval (claim item lease ─► destroy invalidate=true ─► ok/not found = done; transient ─► wait and retry)
        4 CloudinaryUsage (credits percent; above 80% ─► failed line)
   ◄─ 200 { ok, more, lines[] } ─► workflow loops while more (cap), writes counts to the run summary, exits 1 when !ok
```

### Recommended Project Structure

```
src/Csps.Domain/Orders/
  OrderImage.cs                 child entity (Slot, Position, PublicId, Width, Height, Bytes, Format, Description)
  OrderImageRules.cs            MaxImagesPerOrder = 5, description limit, messages, DefaultDescription(number, position)
  Order.cs                      AddImage, MoveImage, DescribeImage, RemoveImage (EnsureEditable first)
src/Csps.Application/Images/
  ImageKind.cs, ImageFacts.cs   sniff result (kind, width, height, orientation)
  ImageSniffer.cs               magic bytes + header dimensions, no decoding
  ImageMetadataStripper.cs      JPEG/PNG/WebP/HEIC byte-level strip
  ImageUploadSettings.cs        MaxBytes, MaxPixels, MaxSide (configurable)
  PublicIds.cs                  {root}/orders/{orderId}/{26-char base32 random}
src/Csps.Application/Ports/
  IImageStorage.cs              UploadAsync, DeleteAsync, ListAsync(prefix, cursor), GetUsageAsync
  IImageDelivery.cs             urls for a stored photo (slots), pure
  IImageDeletionQueue.cs        Enqueue (same unit of work); claim, complete, fail (jobs)
src/Csps.Application/Orders/
  UploadOrderImageHandler.cs, MoveOrderImageHandler.cs, DescribeOrderImageHandler.cs,
  RemoveOrderImageHandler.cs, GetImageRulesHandler.cs   (+ request records and validators)
  PermanentlyDeleteOrderHandler.cs   (changed: enqueue each photo)
src/Csps.Application/Maintenance/
  IMaintenanceJob.cs, MaintenanceLine.cs, MaintenanceRunResponse.cs, RunMaintenanceHandler.cs,
  StraySweepJob.cs, ImageRemovalJob.cs, CloudinaryUsageJob.cs
src/Csps.Infrastructure/Images/
  CloudinarySettings.cs, CloudinaryImageStorage.cs, CloudinaryImageDelivery.cs, ImagesRegistration.cs,
  ImageDeletion.cs (queue row), ImageDeletionQueue.cs, TestingImageStorage.cs, TestingImageDelivery.cs (Debug only)
src/Csps.Infrastructure/Maintenance/
  PurgeExpiredRecordsJob.cs, MaintenanceRunLock.cs
src/Csps.Infrastructure/Persistence/Configurations/
  OrderImageConfiguration.cs, ImageDeletionConfiguration.cs   (+ migration AddOrderImages)
src/Csps.Server/Controllers/
  OrderImagesController.cs, MaintenanceController.cs, TestingImagesController.cs (Testing only)
src/Csps.Server/Security/
  RequireMaintenanceKeyAttribute.cs, MaintenanceKey.cs (ProbeKey pattern)
tools/Csps.CloudinarySetup/     one-time: create the 13 named transformations (owner keys from user-secrets or args)
.github/workflows/maintenance.yml
web/src/utils/images.ts                         prepareImage (pure core + thin browser adapter)
web/src/modules/admin/hooks/usePhotoUploadQueue.ts
web/src/modules/admin/components/OrderPhotosCard.tsx, OrderPhotoPicker.tsx, PhotoDescriptionModal.tsx
web/src/modules/admin/services/orderPhotosService.ts
web/src/modules/admin/orderPhotosCopy.ts, orderPhotosSchemas.ts
web/src/components/media/ImageUploader.tsx (rebuilt), PhotoTile.tsx, PhotoViewer.tsx
docs/operations/maintenance.md, docs/operations/cloudinary-setup.md
```

### Pattern 1: The upload pipeline (IMG-01, IMG-02, IMG-03)

**What:** a thin action hands the handler the file bytes in memory; the handler checks cheaply first, then inspects, strips, uploads, and saves through `OrderChildWrite`.

**Order of steps (each one is a test):**
1. **Quick pre-check (no upload yet):** read the order (not tracked). Missing or soft-deleted: 404. Locked: 422 `orders.locked`. Already 5 photos: 422 "This order already has 5 photos." This avoids uploading a file that will be refused.
2. **Inspect:** `ImageSniffer.Inspect(bytes)` gives kind (jpeg, png, webp, heic), width, height, orientation, or a 400 with the UI-SPEC message. SVG, GIF, AVIF, BMP and anything else fail the sniff. The client file name and `Content-Type` are never trusted; the name is used only inside the error message, HTML-encoded by React.
3. **Limits:** bytes ≤ `MaxBytes`; pixels ≤ `MaxPixels` (and long side ≤ `MaxSide`), using the upright dimensions (swap width and height for JPEG orientations 5 to 8).
4. **Strip:** `ImageMetadataStripper.Strip(kind, bytes)` returns new bytes (see "Hand-rolled on purpose").
5. **Upload:** `IImageStorage.UploadAsync(publicId, assetFolder, strippedBytes, kind)` with a random id from `RandomNumberGenerator`.
6. **Save:** `OrderChildWrite.AttemptAsync` with `order.AddImage(...)` (re-checks lock and limit under the row lock), audit `order-image.added`, `SaveChangesAsync`. Return the whole order (`OrderDetailResponse`) like the other child writes.
7. **Compensation:** if step 6 fails or throws after step 5 succeeded, write an `ImageDeletion` row through a short-lived context from `IDbContextFactory<CspsDbContext>` (the pattern `IdempotencyGate.TryClaimAsync` uses), so it is not rolled back with the request. The 2-day stray sweep is the backstop if even that fails.

**Upload parameters (CloudinaryDotNet `ImageUploadParams`):** `PublicId = "{root}/orders/{orderId}/{random}"`, `AssetFolder = "{root}/orders/{orderId}"` (dynamic folder mode ignores slashes in the public id for placement), `Type = "private"` (Open Question 1), `Overwrite = false`, `UseFilename = false`, `UniqueFilename = false`, `AllowedFormats = ["jpg","png","webp","heic"]` as a second guard, `File = new FileDescription("photo", stream)`. Never set `Folder` (backward-compat only in dynamic mode), `Tags` with ids, `Context` or any empty string parameter (issue #385). [CITED: cloudinary.com/documentation/folder_modes; cloudinary.com/documentation/image_upload_api_reference_upload; VERIFIED: SDK source 1.29.3 `RawUploadParams.AllowedFormats`, `ImageUploadParams.AssetFolder`]

**Why `Overwrite = false`:** "When set to false, a response is returned immediately if an asset with the same public ID is found." So an app-level retry of the same upload with the same public id cannot create a second asset. [CITED: image_upload_api_reference_upload]

### Pattern 2: `OrderImage` as an order child with a constraint-only 5-photo guard (ORD-04, D-08, OR-7)

**What:** `OrderImage` follows `OrderItem` exactly (constructor binding, `IAttributedRecord`, `internal set` navigation, SoftDelete named query filter, cascade from `Order`). The DB guard is two plain constraints, no trigger:

- `Slot tinyint NOT NULL` with `CHECK (Slot BETWEEN 0 AND 4)` and a unique index `(OrderId, Slot)`. A new photo takes the lowest free slot; the slot never changes. Six rows for one order cannot exist.
- `Position int NOT NULL` with `CHECK (Position BETWEEN 0 AND 4)`, **not** unique. Position is the display order (0 = cover); the domain keeps it contiguous. A unique index on position would break every swap, because SQL Server checks a unique index after each UPDATE statement and EF writes one statement per row.

A second insert racing for the same slot gets a unique-index violation; map it to the stale 409 like other lost races. The order row lock (`IOrders.LockAsync`) already makes this rare.

**Columns:** `Id` (v7 Guid), `OrderId`, `Slot`, `Position`, `PublicId nvarchar(200)` unique, `Width int`, `Height int` (upright, as stored), `Bytes int`, `Format varchar(8)` (jpg, png, webp, heic), `Description nvarchar(200) NULL` (null = default text, D-30), `CreatedById/AtUtc`, `UpdatedById/AtUtc`. No row version of its own: the order's row version guards every child (SEC-07).

**Domain methods (each starts with `EnsureEditable()`, ends with `Touch(now)`):** `AddImage`, `MoveImage(imageId, toPosition)`, `DescribeImage(imageId, description)` (trimmed empty or equal to `DefaultDescription(Number, position)` stores null), `RemoveImage(imageId)` (renumbers positions, returns the removed image so the handler can queue its public id).

**`IOrders.FindAsync`** must add `.Include(order => order.Images)` so the delete handlers see the public ids.

### Pattern 3: Endpoint contract (controller rules, SEC-06, D-15)

| Method and route | Body | Policy | Notes |
|---|---|---|---|
| `GET /api/v1/orders/image-rules` | none | Staff | `{ maxPerOrder, maxBytes, maxPixels, maxSide, types, descriptionMaxLength }`; the single server source the client mirrors (UI-SPEC server work 4) |
| `POST /api/v1/orders/{orderId:guid}/images` | multipart: `file`, optional `description` | Staff | Idempotency-Key required; `[RequestSizeLimit]`, `[RequestFormLimits]`; rate limit + concurrency cap; no version (acts on latest, like the single-click child actions); 200 whole order, 400, 404, 409, 413, 422, 429, 503 when storage is not configured |
| `PUT /api/v1/orders/{orderId:guid}/images/{imageId:guid}/position` | `{ position, version }` | Staff | Move and Make Cover (position 0); 409 `edit.stale` on a stale version (D-15) |
| `PUT /api/v1/orders/{orderId:guid}/images/{imageId:guid}` | `{ description, version }` | Staff | 409 on stale; 404 when the photo is gone |
| `DELETE /api/v1/orders/{orderId:guid}/images/{imageId:guid}` | none | Staff | No version, like `RemoveOrderItem`; queues the removal; 404 when already gone |
| `POST /api/v1/maintenance/run` | none | `[AllowAnonymous]` + `[RequireMaintenanceKey]` | `[IdempotencyExempt]` with a reason; per-IP rate limit; 401 for every matrix caller without the key; 409 when a run is already going |

**Audit actions** (follow the `order-item.added` style, verified in `AuditActions.cs`): `order-image.added`, `order-image.moved`, `order-image.cover-changed`, `order-image.description-changed`, `order-image.deleted`. Details name the order and positions, never a public id or URL.

**Responses:** `OrderDetailResponse` gains `Images: OrderImageResponse[]` in position order: `Id`, `Position`, `Description` (null = default), `Width`, `Height`, `Thumb { Src, SrcSet }`, `Viewer { Src, SrcSet }`, `FullSize`. `OrderListEntry` gains `ImageCount` and `Cover` (`Card { Src, SrcSet }`, `Table { Src, SrcSet }`, `Width`, `Height`) or null. The deleted-order view reuses `OrderDetailResponse`, so X2 and the permanent-delete count get photos for free.

### Pattern 4: Delivery with named transformations (IMG-03, IMG-04, D-03, D-04, D-05)

**What:** 13 named transformations created once (setup command), all `allowed_for_strict` (the Admin API default is `true` on create [CITED: cloudinary.com/documentation/admin_api_transformations]). The server builds unsigned URLs:

```
https://res.cloudinary.com/{cloud}/image/private/t_{name}/v1/{root}/orders/{orderId}/{random}
```

- `/v1/` is required: for public ids that contain slashes, with "invalidate versioned URLs" off (the default), "Only URLs delivered with the /v1/ component are invalidated." CloudinaryDotNet adds `/v1/` by default when the id has folders and no version is set (`ForceVersion = true`). Never put the real upload version in the URL. [CITED: invalidate_cached_media_assets_on_the_cdn; VERIFIED: SDK `ApiShared.cs` `ForceVersion` comment]
- `f_auto` cannot be used inside a named transformation [CITED: cloudinary.com/documentation/control_access_to_media]. Recommended: an explicit `f_webp` in each display size and `f_jpg` for full size (Open Question 2).
- The server returns per-photo `srcset` with **true widths**: for each candidate, width = round(min(1, box / long side) × original width) for `c_limit`, and it drops candidates wider than the original, so nothing is upscaled or larger than needed.

**Named sizes (recommended; names are account-wide and shared by dev and live):**

| Name | Transformation | Used by (UI-SPEC slot) |
|---|---|---|
| `csps_sq_44` | `c_fill,g_auto,w_44,h_44/q_auto/f_webp` | Table thumb 1x |
| `csps_sq_88` | `c_fill,g_auto,w_88,h_88/q_auto/f_webp` | Table thumb 2x, tile thumb 1x |
| `csps_sq_176` | `c_fill,g_auto,w_176,h_176/q_auto/f_webp` | Tile thumb 2x |
| `csps_card_320` to `csps_card_960` (320, 480, 640, 800, 960) | `c_fill,g_auto,w_{W},h_{W×10/16}/q_auto/f_webp` | Card cover 16:10 |
| `csps_view_640`, `_960`, `_1280`, `_1600` | `c_limit,w_{N},h_{N}/q_auto/f_webp` | Viewer (whole photo, long side ≤ N) |
| `csps_full_2000` | `c_limit,w_2000,h_2000/q_auto/f_jpg` | "Open Full Size" (D-04, D-27) |

The `sizes` strings stay the UI-SPEC's (client constants); the server owns `src` and `srcset`. Placeholder stays the skeleton (no blurred variant, which would cost one more transformation).

**Cost estimate (free plan, 25 credits a month; 1 credit = 1 GB storage, 1 GB bandwidth or 1,000 transformations [CITED: cloudinary.com/documentation/pricing]):** sizes are generated only when first requested, so a photo typically costs 4 to 6 transformations once. At an assumed 400 photos a month, that is about 2 to 3 credits. Storage grows with the archive (2000 px JPEGs are typically 0.3 to 0.8 MB), so storage, not transformations, is what eventually nears the 80% alarm. [ASSUMED: order volume and file sizes]

### Pattern 5: Maintenance runner, deletion queue, leases (JOB-01, JOB-02, D-20 to D-24)

**Job contract (Application), so Phases 12 and 13 just register another job:**
```csharp
public interface IMaintenanceJob
{
    int Order { get; }                       // run order: purge 10, sweep 20, removals 30, usage 40; later phases slot in
    Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken);
}
public sealed record MaintenanceLine(string Label, long? Value, bool Failed, string? Text = null);
public sealed record MaintenanceJobReport(IReadOnlyList<MaintenanceLine> Lines, bool More);
public sealed record MaintenanceRunResponse(bool Ok, bool More, IReadOnlyList<MaintenanceLine> Lines);
```
`RunMaintenanceHandler` takes a run lease, runs every job in `Order` with try/catch per job (one failing job never stops the next; a thrown job adds a failed line with a code, never the exception text), and returns `Ok = no failed line`.

**Run lease:** reuse `DatabaseLock.Claim(name, holderId, now, lease)` (an expiring claim row in `DatabaseLocks`, inserted on its own short context like the idempotency claims) with the name `maintenance-run` and a 3-minute lease; a second call while one runs gets 409. Expired claims are already purged by the idempotency gate's own purge.

**Deletion queue row (`ImageDeletions`):** `Id bigint identity`, `PublicId nvarchar(200)` (indexed, **not** unique: a sweep and a delete may queue the same id, and a second `destroy` is harmless), `DeliveryType varchar(16)`, `Reason tinyint` (PhotoDeleted, OrderDeleted, UploadUndone, Stray), `EnqueuedAtUtc`, `Attempts int`, `NextAttemptAtUtc`, `LeaseUntilUtc NULL`, `LeaseHolder uniqueidentifier NULL`, `LastFailureCode varchar(50) NULL`, `LastFailedAtUtc NULL`. A finished row is deleted.

**Per-item lease (no raw SQL, no `UPDATE TOP`):** read up to 25 candidate ids (`NextAttemptAtUtc <= now` and lease free or expired), then claim each with a conditional `ExecuteUpdateAsync` (`Where(id == x && (LeaseUntilUtc == null || LeaseUntilUtc < now))`). A result of 1 means this run owns it.

**Retries within a run (D-22; recommended numbers):** up to 3 tries per item, waits of 2 s then 8 s through `Task.Delay(delay, timeProvider, ct)` so tests use `FakeTimeProvider`. Transient: timeouts, 420, 429, 5xx. Done: `ok` or `not found`. Permanent for the run: 401 or 403 (bad keys) stops the job with a failed line. An item still failing after its tries keeps its row (Attempts++, LastFailureCode) and makes the run red.

**Budget and `more`:** each call works for at most about 90 seconds; if work remains, it answers `more: true` and the workflow calls again (cap of 10 calls). Nothing is held in memory between calls.

**Stray sweep (D-23):** list `{root}/orders/` with `ListResourcesAsync(new ListResourcesByPrefixParams { Prefix, Type = "private", MaxResults = 500, NextCursor })`. For each page, skip ids that have an `OrderImage` row (query with `IgnoreQueryFilters(["SoftDelete"])`, Pitfall 8) or a queue row, and skip any created within the last 2 days; queue the rest with reason Stray. At 500 per page, a few thousand photos is a handful of Admin API calls (free plan limit 500 per hour [CITED: pricing]).

**Purge rules (recommended; each is a batched `ExecuteDeleteAsync` loop of 500, all existing tables):**

| Rows | Delete when | Why the margin |
|---|---|---|
| `UserSessions` (their `RefreshTokens` cascade) | `AbsoluteExpiresAt` more than 1 day ago | A session past its fixed end can never be used; the Sessions screen lists only active ones |
| `TwoFactorChallenges` (their `TwoFactorCodes` cascade) | `ExpiresAt` more than 1 day ago | Send and failure windows are 1 hour (`TwoFactorSettings.SendWindow`, `AccountFailureWindow`) |
| `AccountTokens` | `ExpiresAt` more than 7 days ago | Keeps "link already used" or "expired" messages accurate for a week; `LiveInvitation` reads only unexpired rows |
| `IdempotencyRecords` | `ExpiresAt <= now` | Already ignored when expired (SEC-06); same rule as the gate's own purge |
| `DatabaseLocks` claims | `ExpiresAtUtc <= now` | Same rule as the gate's own purge |
| `EmailOutbox` closed rows | closed (`SentAt`, `FailedAt` or `ExpiredAt`) more than 30 days ago | The written rule in `docs/operations/mail-setup.md`, deferred to "the maintenance job planned for Phase 9" (Open Question 4) |

Consumed refresh tokens of live sessions stay: they power reuse detection until the session ends.

### Pattern 6: The maintenance key check

**What:** `[AllowAnonymous]` plus an `IAsyncAuthorizationFilter` attribute `[RequireMaintenanceKey]` modeled on `RequireCsrfHeaderAttribute`, with the comparison copied from `ProbeKey.Matches`: both values hashed with SHA-256, then `CryptographicOperations.FixedTimeEquals`, minimum length 32, a missing or short configured key leaves the endpoint closed (401). Header `X-Maintenance-Key`. Config key `Maintenance:Key` (app-pool env var `Maintenance__Key`, dev user-secrets, GitHub secret `MAINTENANCE_KEY`). **Rotation:** change the host env var and the GitHub secret together; the next run uses the new value. No dual-key window is needed for a monthly job.

### Pattern 7: Body limits, memory-only buffering and multipart hashing (SEC-03, SEC-06, LIB-CR-02)

Today every layer caps at 1 to 2 MB [VERIFIED: quoted below]. For the upload route only:

1. Put `[RequestSizeLimit(UploadBodyLimit)]` on the upload action (UploadBodyLimit = MaxBytes + 64 KiB for the form overhead). ASP.NET Core 10's `EndpointRoutingMiddleware` copies `IRequestSizeLimitMetadata` into `IHttpMaxRequestBodySizeFeature` when the endpoint is matched, if the feature is still writable [VERIFIED: dotnet/aspnetcore `src/Http/Routing/src/EndpointRoutingMiddleware.cs` on `release/10.0`, `SetMaxRequestBodySize`]. This raises the Kestrel and IIS in-process limits per request.
2. **Move `RequestBodyLimitMiddleware` to just after `app.UseRouting()`** and have it use the endpoint's `IRequestSizeLimitMetadata` (default `MaxBytes`) for both the `Content-Length` 413 check and the feature. Static files, HTTPS redirection, the exception handler and status pages do not read bodies, so moving it loses nothing. Update `RequestBodyLimitTests`.
3. **Raise `web.config` `maxAllowedContentLength`** above the upload limit (for example 11534336, 11 MiB), because "applying `RequestSizeLimitAttribute` only overrides ASP.NET Core server limits ... It does not bypass the IIS module-level `maxAllowedContentLength`" [CITED: learn.microsoft.com file uploads]. Update `WebConfigTests` (it pins `"2097152"` today).
4. **Idempotency middleware:** use the endpoint's limit for the count and for `EnableBuffering(bufferThreshold: limit + ReadSize, bufferLimit: limit + ReadSize)` so the buffer never spills to a temp file. For `multipart/form-data`, hash part by part with `MultipartReader`: for each section, length-prefixed name, file name, content type and bytes; never the boundary. Then rewind. Same bytes with a new boundary must replay; changed bytes must get 422.
5. **Form reading:** either `IFormFile` with `[RequestFormLimits(MemoryBufferThreshold = UploadBodyLimit + 1, MultipartBodyLengthLimit = UploadBodyLimit)]` (keeps the file in memory because no file can exceed the threshold; keeps OpenAPI's multipart description), or a manual `MultipartReader` copy into a bounded `MemoryStream`. Recommended: `IFormFile` with the attribute, plus a test that reads the action's metadata and asserts the threshold exceeds the body limit. Without the attribute, "Any single buffered file exceeding 64 KB is moved from memory to a temp file on disk." [CITED: learn.microsoft.com file uploads]
6. **Memory on a 256 MB pool:** add a global concurrency limiter for the upload route (2 at a time, small queue) next to a per-IP sliding window. The limiter runs before authentication in this pipeline, so a per-user partition is not available (Program.cs: rate limiter is "before authentication so a throttled request costs nothing").

### Pattern 8: Client preparation and the upload queue (IMG-05, D-09, D-10, D-18, D-28 to D-31)

- `prepareImage(file)`: read the first 32 bytes and sniff (same signatures as the server); `createImageBitmap(file, { imageOrientation: 'from-image' })`; if the long side > 2000, draw scaled onto a canvas with `imageSmoothingQuality = 'high'` and `toBlob`; else send the original file unchanged (D-18). Then a 176 px `toDataURL` preview (CSP allows `data:`, not `blob:`). Always `bitmap.close()`.
- **Output type:** JPEG for JPEG and HEIC input (quality about 0.85); PNG stays PNG (mockups may have transparency); WebP stays WebP only if the produced `blob.type` is `image/webp`, else JPEG. `toBlob` silently falls back to PNG for an unsupported type [CITED: MDN HTMLCanvasElement.toBlob], so always check `blob.type`.
- **HEIC the browser cannot decode:** `createImageBitmap` rejects; send the file as is if within the size limit, show the placeholder and "No preview. It shows after upload." (UI-SPEC). The server checks pixels.
- **Queue:** module-level store keyed by order id (memory only), one upload at a time, one `crypto.randomUUID()` key per file, **the prepared Blob kept and reused** for "Try Again" so the bytes (and therefore the server's part-wise hash) match. Per-request `timeoutMs` around 120 s for phone data. F1 hands drafts to the queue after create (D-28).
- The client mirrors `GET /api/v1/orders/image-rules` through zod (OR-3) and still lets the server message win.

### Pattern 9: The scheduled workflow (D-21, D-22, 01 D-10)

```yaml
# .github/workflows/maintenance.yml (sketch; plain-English comments in the real file)
name: Maintenance
on:
  schedule:
    - cron: "17 19 1 * *"     # 19:17 UTC on the 1st (03:17 Manila on the 2nd); off the top of the hour
  workflow_dispatch:           # "Run now"
permissions: {}
concurrency:
  group: maintenance
  cancel-in-progress: false
jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Run maintenance
        env:
          MAINTENANCE_KEY: ${{ secrets.MAINTENANCE_KEY }}
          SITE_ORIGIN: ${{ vars.SITE_ORIGIN }}
        run: |
          # loops while the answer says "more" (cap 10), writes counts only to the summary, exits 1 when ok is false
```
No third-party actions are needed (curl and jq ship on GitHub's ubuntu images [ASSUMED]), so `ApprovedActions` does not change. Use a repository secret, **not** the `production` environment (its required reviewer would hold every cron run). Never echo the key or the response body to the log; write only the label and count lines to `$GITHUB_STEP_SUMMARY` through `jq`, never by interpolating response text into shell.

### Anti-Patterns to Avoid
- **Calling Cloudinary inside the business transaction for deletes.** Deletes only queue a row (D-20); only the job calls `destroy`.
- **Binding `IFormFile` without `[RequestFormLimits]`.** Files over 64 KB go to a temp file on disk (breaks IMG-02).
- **Building delivery URLs on the client** or storing URLs in the database. Store the public id and dimensions; build URLs at read time, so sizes can change without a migration.
- **A unique index on `(OrderId, Position)`.** Every reorder would fail mid-update.
- **Signed delivery URLs.** Not invalidated on delete by default (breaks D-05).
- **Admin API bulk delete with `invalidate`.** "Bulk invalidation through Admin API methods must be enabled for your account. It isn't on by default." Use per-asset `destroy` (Upload API, not rate-limited) [CITED: invalidation doc; pricing search result].
- **Logging or auditing public ids or URLs.** With D-01, an address is the key to the photo. Log the image row id and an error code.
- **Re-preparing the file on "Try Again".** A new encode gives new bytes, the hash changes, and the server answers 422.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cloudinary request signing, multipart upload, admin calls | Own signer and HTTP calls | CloudinaryDotNet 1.29.3 | Signature rules, parameter sorting, error parsing |
| Multipart parsing | Own boundary parser | `IFormFile` + `[RequestFormLimits]`, or `MultipartReader` | Edge cases in headers and boundaries |
| Random ids | `Guid.NewGuid()` strings, `System.Random` | `RandomNumberGenerator.GetBytes(16)` → base32 lowercase | 128 bits of entropy; `System.Random` is banned |
| Secret comparison | `==` on strings | SHA-256 both, then `CryptographicOperations.FixedTimeEquals` (copy `ProbeKey.Matches`) | Timing leaks |
| Leases and run locks | In-memory flags, `static` state | `DatabaseLock.Claim` rows and conditional `ExecuteUpdateAsync` | App pool recycles (PRD §13) |
| Retry waits | `Thread.Sleep`, custom timers | `Task.Delay(TimeSpan, TimeProvider, CancellationToken)` | Testable with `FakeTimeProvider` |
| Image decode and resize in the browser | JS decoders (pica, heic2any) | `createImageBitmap` + canvas | Native, orientation-aware, no package |
| Focus trap, inert, scroll lock in the viewer | New hooks | `useFocusTrap`, `useInertOutside`, `useBodyScrollLock` from `@/components` | Already tested (UI-SPEC) |
| Leave guard | New blocker | The Phase 8 ORD-15 guard pattern | Same behavior staff know |

**Hand-rolled on purpose (no suitable permissive package; each needs fixture tests):**

| Code | Scope | Notes |
|---|---|---|
| `ImageSniffer` | JPEG `FF D8 FF`; PNG `89 50 4E 47 0D 0A 1A 0A`; WebP `RIFF....WEBP`; HEIC `ftyp` at offset 4 with brand `heic`, `heix`, `hevc`, `hevx`, `heim`, `heis`, or `mif1`/`msf1` only when a compatible brand is a HEIC brand (reject `avif`/`avis`). Dimensions: JPEG SOFn (skip C4, C8, CC), PNG IHDR, WebP VP8/VP8L/VP8X, HEIC `ispe` of the primary item | Never decode; bounds-check every offset; a truncated or looping file is a 400, never an exception |
| `ImageMetadataStripper` | JPEG: drop APP1 (Exif, XMP, XMP extension), APP13, COM, anything after the first EOI (MPF secondary images); keep APP0, APP2 `ICC_PROFILE`, APP14, tables, SOF, SOS; write a fresh minimal APP1 holding only Orientation when it is not 1. PNG: drop `eXIf`, `tEXt`, `zTXt`, `iTXt`, `tIME` and unknown ancillary chunks; keep IHDR, PLTE, IDAT, IEND, tRNS, gAMA, cHRM, sRGB, iCCP, sBIT, pHYs. WebP: drop `EXIF` and `XMP ` chunks, clear the EXIF and XMP bits in VP8X, fix the RIFF size. HEIC: zero the payload bytes of `Exif` items and `mime` items with an XMP content type, located through `iinf` and `iloc`, keeping every offset unchanged (orientation lives in `irot`/`imir`, so it survives) | The riskiest code in the phase. The HEIC zero-fill is [ASSUMED] safe for Cloudinary's decoder: verify once with a real HEIC in the dev folder (owner or developer smoke test) |

## Common Pitfalls

### Pitfall 1: The upload never reaches the action (413)
**What goes wrong:** every upload over 1 MiB gets 413. **Why:** `RequestBodyLimitMiddleware` checks `Content-Length` before routing, and Kestrel, IIS in-process and `web.config` are all capped. **Avoid:** Pattern 7 steps 1 to 3. **Warning sign:** `RequestBodyLimitTests` and `WebConfigTests` still pass unchanged after the upload work.

### Pitfall 2: Files spill to disk
**What goes wrong:** IMG-02 broken silently. **Why:** `IFormFile` buffering above 64 KB and `EnableBuffering` above its threshold both use temp files. **Avoid:** thresholds at or above the route limit; an architecture test bans `File`, `FileStream`, `Path.GetTemp*` in the upload code.

### Pitfall 3: "Try Again" gets 422 `idempotency.key-mismatch`
**Why:** the raw body hash includes the multipart boundary (LIB-CR-02), or the client re-encoded the file. **Avoid:** part-wise hashing (Pattern 7.4) and reuse of the prepared Blob (Pattern 8). **Test:** same file, new boundary, same key: replayed answer, one photo.

### Pitfall 4: AVIF or animated files pass as HEIC or WebP
**Why:** AVIF uses the same `ftyp`/`mif1` container as HEIC. **Avoid:** brand rules above; decide animated WebP (recommended: refuse with the type message, since order photos are stills).

### Pitfall 5: Parser crashes on hostile bytes
**Why:** hand-written offset math. **Avoid:** every read bounds-checked, a loop cap on segments and boxes, `Result` failures instead of exceptions; fuzz-style tests with truncated and self-referencing boxes.

### Pitfall 6: Sideways photos
**Why:** stripping all Exif drops Orientation; a phone JPEG within 2000 px is not re-encoded by the client (D-18). **Avoid:** keep a one-tag Exif with Orientation. Cloudinary rotates by default: "By default, the image is automatically rotated according to the EXIF data stored by the camera when the image was taken." [CITED: transformation_reference_a_angle]. Store upright width and height computed by the server (swap for orientations 5 to 8); do not rely on Cloudinary's reported width and height [ASSUMED: whether they are pre- or post-rotation is undocumented].

### Pitfall 7: The raw original stays reachable
**Why:** strict transformations govern transformations; the docs do not say they block the untransformed original of an `upload` asset. **Avoid:** `private` type (Open Question 1): "the original file is protected and only accessible via a signed URL", "any derived (transformed) versions of the asset are publicly accessible", and strict mode limits those to allow-listed ones [CITED: control_access_to_media].

### Pitfall 8: The sweep deletes photos of soft-deleted orders
**Why:** every order child has the named filter `HasQueryFilter("SoftDelete", item => item.Order.DeletedAtUtc == null)` [VERIFIED: `OrderItemConfiguration.cs:34` and the other child configurations]; `OrderImage` will too. A sweep that reads `OrderImages` with the filter on sees soft-deleted orders' photos as strays and destroys them, which D-20 forbids and which cannot be undone. **Avoid:** `IgnoreQueryFilters(["SoftDelete"])` in the sweep, plus a test with a soft-deleted order's photo older than 2 days.

### Pitfall 9: The wrong environment's folder is swept
**Why:** dev and live share one account (D-07); a dev run configured with the live root would destroy live photos missing from the dev database. **Avoid:** a root-folder guard like `DevSeedTargetGuard`: Production requires root `csps`; any other environment refuses `csps`. The prefix always ends in `/orders/` (`csps` is a prefix of `csps-dev`). Test both refusals.

### Pitfall 10: List query count and timing tests break
**Why:** adding the cover to `OrderListEntry` can add a query. **Avoid:** project the cover in the same query (a correlated `Position == 0` subquery) with an index on `(OrderId, Position)` including `PublicId`, `Width`, `Height`; rerun `OrderListQueryCountTests` and `OrderListTimingTests`.

### Pitfall 11: The camera button does nothing on some phones
**Why:** the site sends `Permissions-Policy: camera=()` [VERIFIED: `SecurityHeadersMiddleware.cs:21`]. The `capture` attribute opens the system camera through the file picker, which should not be governed by that policy [ASSUMED]. **Avoid:** do not loosen the policy; prove "Take Photo" on a real Android and iPhone in UAT before release.

### Pitfall 12: iOS hands over HEIC or JPEG unpredictably
**Why:** iOS may convert HEIC to JPEG on file-input upload depending on the `accept` list [ASSUMED]. **Avoid:** treat both as normal; the pipeline handles either.

### Pitfall 13: Canvas encodes a different type than asked
**Why:** `toBlob` falls back to PNG for unsupported types (Safari WebP encoding on older versions, HEIC everywhere). **Avoid:** check `blob.type`; JPEG fallback.

### Pitfall 14: Self-made 409s during a batch
**Why:** each upload moves the order's row version. **Avoid:** uploads carry no version; move, cover and description send the version from the latest response (the queue sets the order query from each response); the UI busy rule blocks photo changes while a batch runs (UI-SPEC).

### Pitfall 15: The schedule silently stops
**Why:** "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." Also "The `schedule` event can be delayed during periods of high loads" and runs only on the default branch [CITED: docs.github.com events-that-trigger-workflows]. **Avoid:** document it in `docs/operations/maintenance.md`; the owner re-enables or uses "Run now"; the workflow must be on `main` before the first cron fires.

### Pitfall 16: Public run logs leak data
**Why:** the repo is public, so Actions logs and summaries are world-readable. **Avoid:** counts only; no public ids, URLs, cloud name, error bodies or the key. The usage percentages are visible to anyone; accept or drop (Open Question 5).

### Pitfall 17: A cron run is held for approval
**Why:** using the `production` environment, which has a required reviewer. **Avoid:** repository secret; no `environment:` on this job.

### Pitfall 18: Purges remove rows still in use
**Why:** rate limits count recent 2FA codes and reset emails; reuse detection needs consumed refresh tokens. **Avoid:** the margins in the purge table; tests with rows on both sides of each cut-off.

### Pitfall 19: Deletes lost on rollback, or done twice
**Why:** queue write outside the business transaction, or a unique index on the queue's public id. **Avoid:** enqueue through the same `DbContext` before the one `SaveChanges`; non-unique index; `not found` counts as done.

### Pitfall 20: The resilience handler re-sends a consumed upload stream
**Why:** an automatic retry of a request with `StreamContent` can fail because the stream was read [ASSUMED]. **Avoid:** timeouts only on the Cloudinary `HttpClient` (assign it to `cloudinary.Api.Client`, a public field in the SDK [VERIFIED: SDK `ApiShared.Proxy.cs`]); retry at app level by calling `UploadAsync` again with a fresh stream and the same public id.

### Pitfall 21: Prefix listing returns 10 at a time
**Why:** the simple `ListResourcesByPrefixAsync(prefix, type, nextCursor)` overload sets no `max_results` (Cloudinary's default is 10 [ASSUMED]). **Avoid:** `ListResourcesAsync(new ListResourcesByPrefixParams { MaxResults = 500, ... })`.

### Pitfall 22: The site breaks if deployed before the keys exist
**Why:** strict options validation at startup would stop the app. **Avoid:** an unconfigured storage that answers uploads with 503 "Photo uploads aren't set up yet." and leaves `/health` unchanged; the owner checklist adds keys before the deploy.

## Code Examples

### Raising the limit for one route (pattern; values are the plan's)
```csharp
// Source: ASP.NET Core docs (RequestSizeLimit, RequestFormLimits) + EndpointRoutingMiddleware.SetMaxRequestBodySize (release/10.0)
[HttpPost]
[EndpointName("UploadOrderImage")]
[RequestSizeLimit(ImageUploadLimits.BodyBytes)]
[RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = (int)ImageUploadLimits.BodyBytes + 1)]
[EnableRateLimiting(RateLimitPolicies.ImageUpload)]
[Consumes("multipart/form-data")]
public async Task<IResult> Upload(Guid orderId, IFormFile? file, [FromForm] string? description, CancellationToken cancellationToken)
{
    var result = await upload.HandleAsync(orderId, UploadOrderImageRequest.From(file, description), cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
}
```
`ImageUploadLimits`, `RateLimitPolicies.ImageUpload` and `UploadOrderImageRequest` are new names [ASSUMED]; `ToHttpResult` and `TypedResults.Ok(order)` follow `OrderItemsController.cs:52-53` [VERIFIED].

### Values the plan changes (verbatim, read this session)
- `src/Csps.Server/Http/RequestBodyLimitMiddleware.cs:14`: `public const long MaxBytes = 1_048_576;`
- `src/Csps.Server/Program.cs:24`: `options.Limits.MaxRequestBodySize = RequestBodyLimitMiddleware.MaxBytes;`
- `src/Csps.Server/Program.cs:28`: `builder.Services.Configure<IISServerOptions>(options => options.MaxRequestBodySize = RequestBodyLimitMiddleware.MaxBytes);`
- `src/Csps.Server/web.config:13`: `<requestLimits maxAllowedContentLength="2097152" />`
- `src/Csps.Server/Security/IdempotencyMiddleware.cs:137`: `request.EnableBuffering((int)RequestBodyLimitMiddleware.MaxBytes, RequestBodyLimitMiddleware.MaxBytes + ReadSize);`
- `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs:217,220`: `public const int PurgeBatchSize = 100;` and `public static readonly TimeSpan ClaimLease = TimeSpan.FromMinutes(2);` (keep the Cloudinary upload timeout well under this lease)

### Values the plan reuses (verbatim, read this session)
- `src/Csps.Application/Security/Policies.cs:10`: `public const string Staff = "Staff";`
- `src/Csps.Domain/Orders/OrderRules.cs:45`: `public const int MaxItems = 100;` (model for `MaxImagesPerOrder = 5`)
- `src/Csps.Domain/Orders/OrderRules.cs:255`: `public const string LockedCode = "orders.locked";`
- `src/Csps.Server/Http/SecurityHeadersMiddleware.cs:17`: `"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";` (no change needed: images load from `res.cloudinary.com`, uploads go to `'self'`)
- `src/Csps.Server/Http/SecurityHeadersMiddleware.cs:21`: `"accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";`
- `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:82` (model row for the key-protected endpoint): `new("POST", "/api/v1/auth/two-factor/verify", "/api/v1/auth/two-factor/verify", Anonymous: 401, Admin: 401, Manager: 401),`
- `src/Csps.Infrastructure/Persistence/Locking/DatabaseLock.cs:35,41`: `public static DatabaseLock Claim(string name, Guid holderId, DateTimeOffset now, TimeSpan lease)` returning `new DatabaseLock { Name = name, TakenAtUtc = now, ExpiresAtUtc = now + lease, HolderId = holderId };`
- Batched delete shape already in use, `IdempotencyGate.cs:390-395`:
  ```csharp
  await context.Set<IdempotencyRecord>()
      .Where(record => record.ExpiresAt <= now)
      .OrderBy(record => record.ExpiresAt)
      .Take(PurgeBatchSize)
      .ExecuteDeleteAsync(cancellationToken)
  ```

### Purge job, one rule (pattern)
```csharp
// Same shape as IdempotencyGate.PurgeExpiredAsync. Fields read this session:
// UserSession.AbsoluteExpiresAt (UserSession.cs:50), TwoFactorChallenge.ExpiresAt (TwoFactorChallenge.cs:54),
// AccountToken.ExpiresAt (AccountToken.cs:61), EmailOutboxMessage.SentAt/FailedAt/ExpiredAt (EmailOutboxMessage.cs:54,57,60).
var cutoff = now - TimeSpan.FromDays(1);
long removed = 0;
int batch;
do
{
    batch = await context.Set<UserSession>()
        .Where(session => session.AbsoluteExpiresAt < cutoff)
        .OrderBy(session => session.AbsoluteExpiresAt)
        .Take(BatchSize)
        .ExecuteDeleteAsync(cancellationToken)
        .ConfigureAwait(false);
    removed += batch;
}
while (batch == BatchSize && !budget.IsSpent);
```
The refresh tokens go with their session through the configured database cascade (`RefreshTokenConfiguration` uses `OnDelete(DeleteBehavior.Cascade)` on `SessionId` [VERIFIED: grep this session; confirm the generated FK in the migration snapshot]).

### Destroy with invalidation (CloudinaryDotNet)
```csharp
// Source: SDK 1.29.3 DeletionParams (PublicId, Type, Invalidate, ResourceType) and ICloudinaryUploadApi.DestroyAsync(DeletionParams)
var result = await cloudinary.DestroyAsync(new DeletionParams(publicId) { Type = "private", Invalidate = true }).ConfigureAwait(false);
// result.Result: "ok" (documented) or "not found" ([ASSUMED] wording); both mean the photo is gone.
```
`DestroyAsync` takes no cancellation token in 1.29.3 [VERIFIED: `ICloudinaryUploadApi.cs:358`], so the `HttpClient` timeout is the guard.

### Usage report fields (CloudinaryDotNet `UsageResult`)
`Credits` (`Usage` with `Used` long, `Limit` long, `UsedPercent` float, `CreditsUsage` float), `Storage`, `Bandwidth`, `Transformations`, `MediaLimits` (`image_max_size_bytes`, `image_max_px`, ...) [VERIFIED: SDK source `UsageResult.cs`, `NestedTypes/Usage.cs` at tag 1.29.3]. Use `UsedPercent` for the 80% rule. Also turn the run red if `MediaLimits["image_max_size_bytes"]` is below the configured `MaxBytes`, so a config above the plan limit is caught.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed folders (public id path = folder) | Dynamic folders: `asset_folder` separate from `public_id`; `folder` param kept only for backward compatibility | Accounts created after 2024-06-04 | Set both `PublicId` and `AssetFolder`; never `Folder` [CITED: folder_modes] |
| `image_metadata`, `exif` upload params | `media_metadata` | Cloudinary deprecations | Do not request metadata at all |
| Global body limit only | Per-endpoint `IRequestSizeLimitMetadata` applied by routing | ASP.NET Core 8 | Raise the limit for one route only |
| `createImageBitmap` ignoring EXIF | `imageOrientation: 'from-image'` default | Spec change, current browsers | Upright decode for free |

**Deprecated/outdated:** the roadmap's "weekly orphan sweep" (replaced by monthly, D-21); the PRD's "authenticated delivery" recommendation (replaced by D-01); the PRD's "accessible alt (required field)" (replaced by D-12 default text).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zero-filling HEIC `Exif`/XMP item payloads keeps the file valid for Cloudinary | Hand-rolled on purpose | HEIC uploads fail at Cloudinary; fall back to renaming the item type, or refuse undecodable HEIC (owner call) |
| A2 | `Permissions-Policy: camera=()` does not block `<input capture>` | Pitfall 11 | "Take Photo" fails on phones; would need a policy change (security ruling) |
| A3 | iOS may convert HEIC to JPEG on upload depending on `accept` | Pitfall 12 | None functionally; both paths handled |
| A4 | Cloudinary's reported width/height may not reflect EXIF rotation | Pitfall 6 | Server computes its own; low risk |
| A5 | `destroy` returns "not found" for a missing asset | Code Examples | Must treat any non-error "missing" result as done; test against the fake |
| A6 | `ListResources` default page size is 10 | Pitfall 21 | Only cost; MaxResults=500 is set anyway |
| A7 | Automatic retry of `StreamContent` uploads can fail | Pitfall 20 | Only if retries are enabled; design avoids them |
| A8 | curl and jq are on GitHub ubuntu runners | Pattern 9 | Use `node -e` (also preinstalled) instead |
| A9 | `System.Net.Http 4.3.4` and `System.Text.RegularExpressions 4.3.1` are pruned on net10.0 | Package audit | Extra (patched) assemblies; NuGetAudit would warn |
| A10 | Order volume (about 400 photos/month) and 0.3 to 0.8 MB per 2000 px JPEG | Pattern 4 cost | Credits reached sooner; the 80% alarm covers it |
| A11 | `g_auto` crop has no extra cost on the free plan | Named sizes | Swap to `g_center` |
| A12 | SkiaSharp and Magick.NET details (native size, HEIC support, LGPL codecs) | Alternatives | Only affects the rejected options |
| A13 | Strict mode does not block the untransformed original of `upload` assets (docs silent) | Pitfall 7 | If it does block it, `upload` type would also satisfy D-03; `private` is still safe |
| A14 | New class and policy names in the code examples | Code Examples | Planner renames freely |

## Open Questions (for the owner)

**Resolved 2026-10-31:** the owner chose A for all five. See 09-CONTEXT.md D-32 to D-36, and D-37 for the package approval.

1. **Store photos as Cloudinary "private" type?** D-03 says "no raw original". Strict transformations stop ad-hoc sizes, but Cloudinary does not say they stop the untransformed original of a normal ("upload") photo. With the "private" type, the original needs a signed link, while the allowed sizes stay public exactly as D-01 chose.
   - **A (recommended):** "private" type. It is free, keeps D-01's public sizes and guarantees D-03.
   - **B:** normal "upload" type. Simpler wording, but the original may stay reachable by anyone with its address.
   - Reversibility: changing the type later is possible through Cloudinary's rename, but every URL changes.
2. **Image format for the sizes:** Cloudinary does not allow automatic format choice (`f_auto`) inside a named size, and IMG-04 names `f_auto`.
   - **A (recommended):** each size is WebP (every phone and browser staff use shows it) and "Open Full Size" is JPEG (easy to save and share). One setup command, fewer credits.
   - **B:** keep `f_auto` by allow-listing each "size plus auto format" pair in the Cloudinary console after a first use. More setup steps, more credits, and the allow-list method is not confirmed by Cloudinary's docs.
3. **"Max dimensions" rule and wording:** the free plan refuses photos over 25 megapixels. A single "at most N pixels wide or tall" rule either lets 25+ MP photos through (then Cloudinary refuses them) or refuses normal 24 MP iPhone HEIC files.
   - **A (recommended):** at most 25 megapixels (and at most 10,000 px on a side), message "{file name} is too big. Photos can be at most 25 megapixels." This only bites for HEIC files a computer browser can't shrink.
   - **B:** keep the UI-SPEC wording with 5,000 px on a side.
4. **Also delete old sent-email records in the monthly run?** `docs/operations/mail-setup.md` says closed outbox rows are deleted 30 days after they close, "done by the maintenance job planned for Phase 9". CONTEXT lists only tokens, 2FA codes and request keys.
   - **A (recommended):** include it (the rule is already written down; it removes personal email addresses on time).
   - **B:** leave it for the hardening phase.
5. **Run summary wording and visibility:** the repo is public, so anyone can read the run summary. On the free plan, storage has no separate limit (it shares the 25 credits), so "Cloudinary storage: {used} of {limit}" cannot be shown as written.
   - **A (recommended):** show "Cloudinary storage used: {n} GB" and "Cloudinary credits this month: {used} of {limit} ({p}%)", counts only, nothing that identifies the account.
   - **B:** hide the usage figures from the summary and only turn the run red above 80%.

Not owner questions (planner decides): the retry numbers, batch sizes, run budget, endpoint shapes and job order above; the purge margins (they keep every current rule working); the setup command shape.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | build, tests, EF migration | ✓ | 10.0.402 (global.json 10.0.401, latestPatch) | n/a |
| Node / npm | web build and tests | ✓ | 24.21.0 / 11.19.0 | n/a |
| dotnet-ef local tool | migration | ✓ | 10.0.13 (`.config/dotnet-tools.json`) | n/a |
| LocalDB `(localdb)\MSSQLLocalDB` | integration tests | not probed (shared-machine rule: no DB touching in research) | n/a | CI SQL 2025 container |
| gh CLI | owner merge, API checks | ✓ | 2.102.0 | n/a |
| jq (local) | not needed locally | ✗ | n/a | Only the GitHub runner uses it |
| Cloudinary account (free) | live and dev uploads | owner has it (D-06) | n/a | Fake `IImageStorage` for all tests |
| Outbound HTTPS from the host to `api.cloudinary.com` | uploads, jobs | unverified (HIBP outbound HTTPS is verified in HOSTING-RECORD) | n/a | Owner smoke test after deploy |

**Missing dependencies with no fallback:** none for building and testing. Live use needs the owner checklist below.

**Owner checklist (external state, not in git):**
1. Approve CloudinaryDotNet 1.29.3.
2. Put the Cloudinary cloud name, key and secret in dev user-secrets and as app-pool env vars (`Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret`); root folder from config (`csps` live, `csps-dev` development).
3. Run the one-time setup command (creates the 13 named sizes), **then** turn on strict transformations in the Cloudinary console.
4. Generate a maintenance key (at least 32 characters) and set it as the app-pool env var `Maintenance__Key` and the GitHub repository secret `MAINTENANCE_KEY`.
5. After the deploy: one real upload from a phone (camera and gallery), one real HEIC, one "Run now".

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | .NET: xunit.v3 4.0.1 on Microsoft.Testing.Platform, Shouldly 4.3.0, NSubstitute 6.2.0, FakeTimeProvider. Web: Vitest + RTL + MSW 3; Playwright + axe |
| Config file | `global.json` (`"runner": "Microsoft.Testing.Platform"`), `web/vitest.config.ts`, `web/playwright.config.ts` |
| Quick run command | `dotnet test --project tests/<Project> --filter-class "*<Class>"` · `npm --prefix web run test -- --run <path>` |
| Full suite command | preflight (`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`), then `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` set in that process only), `tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORD-04 | Add up to 5, refuse a 6th, lock on Completed/Cancelled, move, cover, description default rule, remove renumbers | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderImageTests"` | ❌ Wave 0 |
| ORD-04 | Upload, move, cover, describe, delete endpoints; 409 stale; 422 locked and full; whole order returned; audit entries | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImagesEndpointTests"` | ❌ Wave 0 |
| ORD-04 | DB guard: CHECK slot 0..4, unique (OrderId, Slot), racing inserts give one winner | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*OrderImageSchemaTests"` | ❌ Wave 0 |
| ORD-04 | Every new endpoint × anonymous/Admin/Manager | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"` | ✅ (add rows) |
| ORD-04 | List cover and count in one query; timing p95 | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*OrderReaderQueryCountTests"` and `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderListTimingTests"` | ✅ (update) |
| ORD-04 | Photo list, move buttons, Make Cover, names, live announcements, busy rule | component | `npm --prefix web run test -- --run src/components/media/ImageUploader.test.tsx src/modules/admin/components/OrderPhotosCard.test.tsx` | ✅ / ❌ Wave 0 |
| ORD-04 | Viewer keys, wrap, focus return; description window 409/404; leave guard; F1 draft handoff | component | `npm --prefix web run test -- --run src/components/media/PhotoViewer.test.tsx src/modules/admin/components/PhotoDescriptionModal.test.tsx src/modules/admin/hooks/usePhotoUploadQueue.test.tsx src/modules/admin/pages/OrderFormPage.test.tsx` | ❌ Wave 0 |
| ORD-04 | Keyboard reorder end to end, viewer focus return, axe, CSP listener | e2e | `npm --prefix web run e2e -- order-photos.spec.ts` | ❌ Wave 0 |
| IMG-01 | Secret never in any response or log; Application has no Cloudinary reference | integration + arch | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ImageSecretExposureTests"` · `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*LayerDependencyTests"` | ❌ / ✅ (extend) |
| IMG-01 | Adapter sends the right upload params (type, public id, asset folder, overwrite false, allowed formats) through a stub `HttpMessageHandler`, no network | unit | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageStorageTests"` | ❌ Wave 0 |
| IMG-02 | Magic bytes for each kind; SVG, GIF, AVIF, renamed files refused; truncated files are 400s | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageSnifferTests"` | ❌ Wave 0 |
| IMG-02 | 413 above the upload limit; 1 MiB still enforced everywhere else; web.config backstop | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*RequestBodyLimitTests"` and `--filter-class "*WebConfigTests"` | ✅ (update) |
| IMG-02 | No disk writes: form limits metadata above the body limit; banned file APIs in upload code | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*UploadNoDiskTests"` | ❌ Wave 0 |
| IMG-02 | Multipart idempotency: new boundary same bytes replays; changed bytes 422; one photo saved | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*IdempotencyMultipartTests"` | ❌ Wave 0 |
| IMG-02 | Client sniff and limits match the server rules endpoint | unit | `npm --prefix web run test -- --run src/utils/images.test.ts src/modules/admin/orderPhotosSchemas.test.ts` | ❌ Wave 0 |
| IMG-03 | Stripper: GPS/serial/XMP gone per format; orientation kept; ICC kept; trailing MPF dropped; HEIC offsets unchanged | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageMetadataStripperTests"` | ❌ Wave 0 |
| IMG-03 | Public ids random (128 bits) under `{root}/orders/{orderId}/`; upright width/height stored | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*PublicIdsTests"` | ❌ Wave 0 |
| IMG-04 | URLs per slot use `/v1/`, named sizes, true-width `srcset`, no candidate wider than the original | unit | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageDeliveryTests"` | ❌ Wave 0 |
| IMG-04 | `LazyImage` passes `srcSet`/`sizes`/`fit`; each slot picks ≤ 2x its box at 390, 820, 1440 px | component | `npm --prefix web run test -- --run src/components/states/LazyImage.test.tsx src/modules/admin/imageSlots.test.ts` | ✅ (extend) / ❌ |
| IMG-05 | `prepareImage`: downscale only above 2000 px, upright (orientation 6 fixture), blob type fallback, HEIC fallback | unit | `npm --prefix web run test -- --run src/utils/images.test.ts` | ❌ Wave 0 |
| IMG-05 | Touch devices show "Take Photo" with `capture="environment"` and "Choose Photos"; hover devices the drop zone | component | `npm --prefix web run test -- --run src/components/media/ImageUploader.test.tsx` | ✅ (rewrite) |
| IMG-05 | Real decode and downscale in Chromium with a large fixture | e2e | `npm --prefix web run e2e -- order-photos.spec.ts` | ❌ Wave 0 |
| IMG-05 | Camera on a real Android and iPhone | manual | UAT checklist | manual only (device camera) |
| JOB-01 | Key filter: missing/wrong/short key 401; constant-time compare; 409 when a run holds the lease | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MaintenanceEndpointTests"` | ❌ Wave 0 |
| JOB-01 | Each purge rule with rows on both sides of its cut-off; batches; cascade | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*PurgeExpiredRecordsJobTests"` | ❌ Wave 0 |
| JOB-01 | Runner: job order, one failing job does not stop others, `ok`/`more`, budget | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*RunMaintenanceHandlerTests"` | ❌ Wave 0 |
| JOB-01 | Workflow: monthly cron, `workflow_dispatch`, `permissions: {}`, `timeout-minutes`, no environment, key only via env, no new actions | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` | ✅ (extend) |
| JOB-02 | Delete photo and permanent delete enqueue in the same transaction (rollback leaves none); soft delete enqueues nothing | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageDeletionQueueTests"` | ❌ Wave 0 |
| JOB-02 | Removal job: lease claim, retries with waits (FakeTimeProvider), not found = done, still failing = red, 401 stops | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageRemovalJobTests"` | ❌ Wave 0 |
| JOB-02 | Sweep: only own root, refuses wrong root, keeps soft-deleted orders' photos, skips under 2 days, skips queued | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*StraySweepJobTests"` · `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*OrderImageIndexTests"` | ❌ Wave 0 |
| JOB-02 | Usage: above 80% credits is a failed line; plan file limit below config is a failed line | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CloudinaryUsageJobTests"` | ❌ Wave 0 |
| all | No JSON columns; only `TR_AuditLog_AppendOnly` trigger; OpenAPI snapshot updated; generated types | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*Schema*"` · `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"` · `npm --prefix tools/openapi-gen run check` | ✅ (rerun) |

### Sampling Rate
- **Per task commit:** the quick command for the class or file the task touches.
- **Per wave merge:** `dotnet test --solution Csps.slnx` after preflight, plus `npm --prefix web run verify`.
- **Phase gate:** full suite, coverage gate, e2e, and the manual phone and HEIC checks before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Synthetic image fixtures **built in test code**, never real photos (public repo): JPEG with a fake GPS block at 0°N 0°E and Orientation 6, JPEG with XMP and trailing MPF bytes, PNG with `tEXt`/`eXIf`, WebP with `EXIF`/`XMP ` chunks and VP8X flags, an ISOBMFF HEIC shell with an `Exif` item and an `ispe`, an AVIF shell, an SVG renamed `.jpg`, truncated and looping files.
- [ ] `TestingImageStorage` (memory store, records calls, can fail N times) and `TestingImageDelivery` with same-origin URLs plus `TestingImagesController` (Testing only, matrix rows), so Playwright never calls Cloudinary (D-07).
- [ ] A multipart request helper for integration tests (builds bodies with a chosen boundary).
- [ ] Web fixtures for Playwright: a large JPEG generated in the browser by canvas at test time.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (maintenance endpoint) | Long random key, SHA-256 + `FixedTimeEquals`, closed when unset (ProbeKey pattern) |
| V3 Session Management | no change | Existing JWT and refresh flow |
| V4 Access Control | yes | `Policies.Staff` on photo endpoints; children reached only through their order (CWE-639, `OrderChildWrite`); authorization matrix |
| V5 Input Validation | yes | Magic bytes, size, pixels, description length (FluentValidation + domain); zod mirror |
| V6 Cryptography | yes | `RandomNumberGenerator` for public ids; no custom crypto |
| V12 Files and Resources | yes | No disk, no webroot, no SVG, server-side upload, sniff not trust names (CWE-434) |
| V13 API | yes | Idempotency on the upload POST, rate and concurrency limits, 413 per route |
| V7 Errors and Logging | yes | No public ids, URLs, keys or exception text in logs, audit or run summary; mask `ApiSecret` and `Maintenance:Key` in `SensitiveDataMasking` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file disguised as a photo (SVG script, polyglot) | Tampering / Elevation | Sniff, refuse non-photo kinds, `allowed_formats` at Cloudinary, delivery only through transformations |
| Location leak from EXIF GPS | Information disclosure | Strip before upload (D-02) and Cloudinary strips on delivery by default ("Cloudinary's default behavior is to strip almost all embedded metadata from a delivered asset." [CITED: transformation_reference]) |
| Guessing photo addresses | Information disclosure | 128-bit random ids; addresses only in staff responses (D-01); no ids in logs or public run summaries |
| Credit burning with ad-hoc sizes | Denial of service (cost) | Strict transformations + named sizes; `private` original (Open Question 1) |
| Memory exhaustion via concurrent 10 MB uploads | Denial of service | Concurrency cap, per-IP window, in-memory bounded buffers |
| SSRF | Spoofing | No server fetch of user URLs; outbound only to Cloudinary (PRD CWE-918 row) |
| Brute force on the maintenance key | Spoofing | 32+ character key, per-IP rate limit, constant-time compare |
| Duplicate uploads on retry | Tampering | Idempotency-Key with part-wise hash; `Overwrite = false` |
| Script injection through the workflow | Tampering | Response text only through `jq` into the summary file; zizmor stays clean |
| Deleting live photos from dev | Tampering | Root-folder guard (Pitfall 9) |

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `Order.cs`, `OrderItem.cs`, `OrderRules.cs`, `OrderChildWrite.cs`, `AddOrderItemHandler.cs`, `PermanentlyDeleteOrderHandler.cs`, `IOrders.cs`, `IUnitOfWork.cs`, `OrderItemsController.cs`, `Program.cs`, `RequestBodyLimitMiddleware.cs`, `IdempotencyMiddleware.cs`, `IdempotencyGate.cs`, `DatabaseLock.cs`, `DatabaseLocks.cs`, `SecurityHeadersMiddleware.cs`, `web.config`, `Policies.cs`, `AuthorizationMatrix.cs`, `TwoFactorSettings.cs`, `AuthSettings.cs`, `UserSession.cs`, `TwoFactorChallenge.cs`, `AccountToken.cs`, `EmailOutboxMessage.cs`, `OrderItemConfiguration.cs`, `LazyImage.tsx`, `Directory.Packages.props`, `web/package.json`, `weekly.yml`, `CiWorkflowTests.cs`, `ProbeKey.cs`, `docs/operations/mail-setup.md`, `docs/api/auth.md`
- NuGet registration and search APIs (CloudinaryDotNet, Newtonsoft.Json); GitHub releases, issues and source of `cloudinary/CloudinaryDotNet` at tag 1.29.3; GitHub Advisory Database
- dotnet/aspnetcore `release/10.0` `EndpointRoutingMiddleware.cs`

### Secondary (MEDIUM confidence, official docs)
- https://cloudinary.com/documentation/control_access_to_media (strict transformations, private and authenticated types)
- https://cloudinary.com/documentation/admin_api_transformations.md (named transformations, `allowed_for_strict`)
- https://cloudinary.com/documentation/admin_api_usage.md (usage fields)
- https://cloudinary.com/documentation/invalidate_cached_media_assets_on_the_cdn.md (invalidation rules)
- https://cloudinary.com/documentation/image_upload_api_reference_upload.md and `_destroy_by_public_id.md`
- https://cloudinary.com/documentation/folder_modes.md (dynamic folders)
- https://cloudinary.com/documentation/transformation_reference.md and `transformation_reference_a_angle.md`
- https://cloudinary.com/documentation/pricing.md (free plan numbers)
- https://cloudinary.com/documentation/admin_api_overview.md (Admin API limits; Upload API not rate-limited)
- https://learn.microsoft.com/en-us/aspnet/core/mvc/models/file-uploads?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.http.metadata.irequestsizelimitmetadata
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob and https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap

### Tertiary (LOW confidence)
- Training knowledge for the items in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. One package, verified on the registry, the advisory database and its source.
- Architecture: HIGH for the codebase fit (every pattern mirrors existing code); MEDIUM for the Cloudinary delivery design (official docs, two owner questions).
- Pitfalls: HIGH for the limits, idempotency and soft-delete filter (read in code); MEDIUM for Cloudinary and browser behavior; LOW for the flagged assumptions.

**Research date:** 2026-10-31
**Valid until:** 2026-11-30 (Cloudinary plan terms and SDK releases can change; recheck the package age and advisories at install time)
