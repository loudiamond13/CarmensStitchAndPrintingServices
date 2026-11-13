---
phase: 11-public-site-content-management
created: 2026-11-13T06:10:00-06:00
updated: 2026-11-13T06:10:00-06:00
reviewed: 2026-11-13T12:10:00Z
depth: standard
diff_base: febeb63d
files_reviewed: 678
findings:
  critical: 0
  warning: 18
  info: 30
  total: 48
status: issues_found
---

# Phase 11 code review

*Created: 2026-11-13T06:10:00-06:00 · Updated: 2026-11-13T06:10:00-06:00*

Six reviewers ran in parallel at standard depth, one per slice, over the 676 source, test and doc files changed since febeb63d (planning files, lockfiles and images left out). Their reports are merged below. Finding ids carry the slice letter (for example WR-C-01). Items already parked in backlog 999.7 (P11-BL-01 to 46) were not re-reported.

| Slice | Area | Files | Critical | Warning | Info |
|---|---|---|---|---|---|
| A | Domain and Application | 141 | 0 | 3 | 5 |
| B | Infrastructure, Server, tools, docs | 98 | 0 | 2 | 5 |
| C | Web admin module | 105 | 0 | 3 | 3 |
| D | Web public module and shared web | 141 | 0 | 3 | 6 |
| E | .NET tests | 153 | 0 | 3 | 5 |
| F | Web e2e, scripts, build | 40 | 0 | 4 | 6 |

No Critical finding. Outcomes for every finding are recorded in 11-REVIEW-FIX.md.

## Slice A: Domain and Application (141 files)
## Phase 11, Slice A: Code Review Report

**Reviewed:** 2026-11-13
**Depth:** standard (changed code read in full, plus the Infrastructure callers needed to judge it: the invalidation interceptor, `CspsUnitOfWork`, `ConflictRetry`, the gallery, product line and site content stores, the public reader and the gallery projection)
**Files reviewed:** 141 (every path in `rev-A.txt`)
**Status:** issues_found

### Summary

The Domain and Application layers for Phase 11 are in good shape. I found no critical issues.

What I checked and found sound:

- **Locking and races.** Every write that depends on the whole content list takes the site-content lock first, inside the transaction. I traced the lock order of the order handlers, the gallery move, the closure writes and the photo writes and found no cycle. Row versions are checked both in the handler and by EF at save.
- **Cache invalidation.** The interceptor clears the cache only after a commit, and it covers every new `IPublicContentRecord`, `ProductType` and any save of a shown order (photo, item and status changes all `Touch` the order).
- **Photo handling.** All four upload handlers queue the new file when the save fails, with a token that cannot be cancelled. The replace and remove paths queue the old file, and the image removal job skips any file a row still names. The stray sweep covers all four photo tables through `ImageInventory`.
- **Audit and privacy.** All 31 new audit actions are valid and listed in `AuditActions.All`. Audit detail text escapes `;`, `=`, `>` and `%`. No customer name, phone or email reaches an audit entry or a public DTO, and the shop email is not in `PublicSiteDto` (D-25).
- **Link and phone rules.** The link allow-lists reject any scheme but https, user-info, ports, backslash, quotes, angle brackets, brackets and non-ASCII. The phone parser and E.164 round trip are correct.
- **Date math.** I traced `OpenStatus`, `ShopClosure`, `OpeningHours`, `LineKey` and the base32 id builder for off-by-one errors and found none.

The three warnings are about rules that live in only one place, and about a gap between the design and the code. Nothing here is a ruled decision. P11-BL-29 (restore of a deleted order), BL-31 and BL-35 are parked and I did not re-report them.

### Warnings

#### WR-A-01: Public link and email rules exist only in the request validator

**File:** `src/Csps.Domain/Content/SiteSettings.cs:267-315` (also `src/Csps.Application/Content/UpdateSiteSettingsRequestValidator.cs:68-76`)
**Issue:** `SiteSettings.UpdateBusinessInfo` trims and stores the six link fields, the postal code and the email without calling `SiteLinks` or any shape check. Only `UpdateSiteSettingsRequestValidator` calls `SiteLinks.IsFacebookLink`, `IsMapEmbedLink` and the others (a grep of `SiteLinks.` finds no other caller). The public reader (`PublicContentReader.Build`, lines 355-366) copies these strings into the public JSON without a re-check. The values end up as `href` targets and the Google map iframe `src`. The product line, gallery, testimonial and closure aggregates all run the same `Check` in the domain and in the validator, so this one is the odd one out. Today the handler is the only writer, so there is no live exploit. But any other write path (a tool, a future import, a direct SQL fix on the host) reaches the public page with no guard, and a `javascript:` or off-site link would be served.
**Fix:** Move the link, email and postal rules into the domain, so `UpdateBusinessInfo` refuses them the way it refuses an over-long text.
```csharp
// SiteSettings.UpdateBusinessInfo, after the Optional(...) calls
if (directions is not null && !SiteLinks.IsDirectionsLink(directions)) errors[BusinessInfoFields.DirectionsUrl] = [SiteLinks.DirectionsInvalidMessage];
// ...same for map embed, messenger, facebook, instagram, tiktok
if (postalCode is not null && !(postalCode.Length == 4 && postalCode.All(char.IsAsciiDigit))) errors[BusinessInfoFields.PostalCode] = ["Use the 4-digit postal code, like 8600."];
```
Keep the validator, so the form still gets its field messages first. The read side can also drop a link that fails its check when it builds `PublicSiteDto`.

#### WR-A-02: A shown order silently leaves the public site when its team name is cleared

**File:** `src/Csps.Application/Orders/UpdateOrderDetailsHandler.cs:100-139`, `src/Csps.Domain/Orders/Order.cs:515` and `:1500`, `src/Csps.Infrastructure/Content/PublicGalleryProjection.cs:152`
**Issue:** The rule "a shown order needs a name" is checked only inside `Order.SetPublicSettings` (line 1500). `UpdateOrderDetailsHandler` runs that check only when the request carries a `publicWebsite` block (`block is not null`, line 129). The class comment says "A form without the block leaves the public settings as they are". Failure scenario for any API client that omits the block (the API is client-agnostic, and the Android app is planned): an order is shown with a team name and no public name. The client sends `PUT /orders/{id}` with an empty `teamName` and no block. `UpdateDetails` accepts it (`TeamName` is optional). The order stays "Shown on the website" in the admin card, but `PublicGalleryProjection` line 152 drops any entry with a blank team, so it vanishes from Home and Gallery with no message and no audit line about the website.
**Fix:** Check the website rule on every details save when the order is shown. In `AttemptAsync`, after `UpdateDetails` and when `block is null`, call a small check that returns `OrderPublicSettings.NameRequiredMessage` on field `teamName` if `order.IsShownOnWebsite && string.IsNullOrWhiteSpace(order.PublicName) && string.IsNullOrWhiteSpace(order.TeamName)`. Or make `Order.UpdateDetails` refuse the change itself, which also protects any other caller.

#### WR-A-03: Open status gives no reopening date for a closure longer than 14 days

**File:** `src/Csps.Domain/Content/OpenStatus.cs:23` and `:46-66`, `src/Csps.Domain/Content/ShopClosure.cs:23`
**Issue:** `FindNextOpening` looks ahead `LookAheadDays = 14`, but a closure may last `MaxSpanDays = 31` days. Failure scenario: a closure from Dec 1 to Dec 31. On Dec 5 every day from Dec 5 to Dec 19 is covered, so `NextOpening` is null. `statusLine` in `web/src/modules/public/hoursCopy.ts:30-47` then shows only "Closed today for {note}." (or nothing if the note is empty and the closure is not today). D-22 says the closed status says when the shop opens next. A second effect: for a day 8 to 14 days out, `When` is `Weekday` and the client prints only the day name (`dayName(next.day)`), so "Opens Thursday 9:00 AM" reads as the next Thursday, which may itself be inside the closure.
**Fix:** Search at least as far as the longest closure plus a week, for example `LookAheadDays = ShopClosure.MaxSpanDays + 7`. The snapshot already holds closures for 60 days (`SearchWindowDays`), so the data is there. For `Weekday` results more than 6 days away, have the client print the date from `NextOpeningDto.Date`, for example "Opens Dec 24, 9:00 AM". Add a test with a 31-day closure.

### Info

#### IN-A-01: `TestimonialAuditDetail.Changed` can build a detail longer than the 400-character limit

**File:** `src/Csps.Application/Content/TestimonialAuditDetail.cs:31-47`
**Issue:** The Gallery, Product Line and Site Settings audit builders use a `Fit` step so "the entry is always written". `TestimonialAuditDetail.Changed` does not. In the worst case a 60-character name made of `%`, `;`, `=` or `>` encodes to 180 characters each side, so `fields=quote,name,teamOrRole,stars;name=...>...;stars=1>5` is about 411 characters. `AuditEntry.Create` then throws `ArgumentException` (`AuditEntry.cs:138`) and the Manager gets a 500 on an edit. Normal names are far from the limit, so this is a robustness gap, not a live bug.
**Fix:** Reuse the same fit rule as `GalleryAuditDetail.Fit`, for example by moving it to `AuditDetailFormat.Fit(params string[] pairs)` and calling it from all builders.

#### IN-A-02: Four upload handlers repeat the same storage and undo code

**File:** `src/Csps.Application/Content/CreateGalleryUploadHandler.cs:92-198`, `ReplaceGalleryPhotoHandler.cs:68-160`, `UploadProductLinePhotoHandler.cs:79-184`, `UploadSharePictureHandler.cs:73-171`
**Issue:** Inspect, strip metadata, upload, queue the file on a transient failure, save with a retry, undo on failure, and `UndoUploadAsync` are copied four times (about 60 lines each). A fix to one copy (for example the cancellation handling or a new failure code) must be made four times, and the copies already differ in small ways (only some catch `SiteContentBusyException`).
**Fix:** Extract one helper, for example `ContentImageUploader.StoreAsync(bytes, fileName, area, ownerId, ...)` returning `Result<LinePhotoFile>`, and `ContentImageUploader.UndoAsync(publicId)`. Each handler then keeps only its own `AttemptAsync`.

#### IN-A-03: The cached public site holds the year and the closure window from the moment it was filled

**File:** `src/Csps.Application/Content/PublicSiteDto.cs:55` (`Year`), `src/Csps.Infrastructure/Content/PublicContentReader.cs:45`, `:114` and `:370-374`
**Issue:** `Year` and `UpcomingClosures` are computed once when the snapshot is built, and the snapshot lives for one hour (`Expiration = 1 hour`) unless a save clears it. After midnight (Manila) on Jan 1 the footer can show the old year for up to an hour, and a closure that ended yesterday can stay in the closures list for the same time. `OpenStatus` itself is computed per call, so open or closed is correct. The effect is small.
**Fix:** Either compute `Year` in the client from the date, or give the snapshot an expiry that ends at the next Manila midnight when that is sooner than one hour.

#### IN-A-04: Gallery and testimonial moves borrow constants from the product line validator

**File:** `src/Csps.Application/Content/MoveGalleryItemHandler.cs:46`, `MoveTestimonialHandler.cs:43`, `MoveGalleryItemRequest.cs:22`, `TestimonialRequestValidator.cs:44`
**Issue:** `MoveProductLineRequestValidator.Up` and `.IsDirection` are used by three unrelated features, and the three validators live inside other features' files. A change to the product line validator changes gallery and testimonial behaviour. `ProductLineRequest.ProductTypeIds` also has no upper bound; `ProductTypeLinker.FindTickedAsync` sends the whole list to the database.
**Fix:** Move `Up`, `Down` and `IsDirection` to a small shared `MoveDirection` type in `Csps.Application.Common`, and add `RuleFor(r => r.ProductTypeIds).Must(ids => ids is null || ids.Count <= 200)` (or the real number of types) to the product line validator.

#### IN-A-05: The opening hours "someone else changed this" check is not airtight

**File:** `src/Csps.Application/Content/UpdateOpeningHoursHandler.cs:63-70` and `src/Csps.Infrastructure/Content/SiteContentStore.cs:96-100`
**Issue:** The handler compares the request's week version with the row versions it reads, but it takes no lock and EF only checks the row versions of the days it changes. Scenario: Manager A and Manager B both load the card at version V. A saves a Monday change. If B's request has already read the rows before A commits, B's Tuesday-only save passes and both changes are stored, with no "someone else changed this" message for B. Nothing is lost, and the window is only a few milliseconds, so this is benign. It does differ from the other cards, which refuse the second save.
**Fix:** Take `ISiteContentLock` at the start of `AttemptAsync` (as the closure handlers do), so the second save reads after the first commit and fails the version check.

---

_Reviewed: 2026-11-13_
_Reviewer: Claude (gsd-code-reviewer), slice A_
_Depth: standard_

## Slice B: Infrastructure, Server, tools and docs (98 files)
## Phase 11 slice B: Code Review Report

**Scope:** Infrastructure, Server, tools and docs (the 98 files in rev-B.txt).
**Depth:** standard.

### Summary

No blockers found. The head writer, the boot data and the JSON-LD are safe against script injection: every attribute goes through an HTML encoder and every script block holds JSON from the default encoder, which escapes `<`, `>` and `&`. The addresses come from `App:PublicBaseUrl` and the route table, never from the request. The public gallery projection selects only the D-13 columns and checks consent, shown date, status, delete mark and a shown line. The cache interceptor flushes after commit and forgets on rollback. The deadlock-to-409 changes in the lock classes are consistent with the unit of work. The Testing controller is compiled out of Release and gated by environment.

Two warnings need a decision. The four new photo upload endpoints skip the server-wide two-at-a-time upload cap, and the settings seed row now carries a Manager-editable column in `HasData`.

Checked and found fine (not findings): CSP map line against the embed-link prefix rule, the `.br` twin rewrite and its `Vary` header, `ServerWrittenFileProvider`, the 34 named sizes (13 + 21, names unique, 4:5 and 16:10 maths), `ImageInventory` covering all four photo tables, the 68 standing lock rows, the forward-only migration `Down` methods, the openapi drift test guard.

### Warnings

#### WR-B-01: The new Manager photo uploads bypass the two-at-a-time upload cap

**File:** `src/Csps.Server/Security/UploadSlotsMiddleware.cs:15,39` and `src/Csps.Server/Controllers/GalleryItemsController.cs:89,164`, `ProductLinePhotosController.cs:45`, `SharePictureController.cs:41`
**Issue:** The slot limiter only acts when the endpoint name is `UploadOrderImage`. The four Phase 11 upload endpoints (`CreateGalleryUpload`, `ReplaceGalleryPhoto`, `UploadProductLinePhoto`, `UploadSharePicture`) carry the per-address rate limit but never take a slot. Each one holds up to 10 MB in memory (`MemoryBufferThreshold = BodyBytes + 1`) and then decodes an image of up to 25 megapixels. The cap exists for the 256 MB app pool (T-09-27, CWE-770), and `docs/api/order-images.md:98` says "The whole server works on two uploads at a time". Failure scenario: two Managers (or one script with a stolen Manager token, 30 uploads per 10 minutes allowed) post gallery photos while two staff upload order photos. Six large decodes run at once, which can exhaust the pool and recycle the app for every visitor. The e2e specs even take a "photo host lock" because only two fit.
**Fix:** Match all upload endpoints, not one name. For example mark them with a metadata attribute and test for it:
```csharp
// UploadSlotsMiddleware
if (context.GetEndpoint()?.Metadata.GetMetadata<UploadSlotMetadata>() is null) { await next(context); return; }
```
Put `[UploadSlot]` on the five upload actions, and update `docs/api/order-images.md` and the new site-content docs to say the cap covers every photo upload. Add an authorization or pipeline test that fails when an `[EnableRateLimiting(ImageUpload)]` action has no slot metadata.

#### WR-B-02: A Manager-editable column is in `HasData`, so a later change to the constant overwrites the live value

**File:** `src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs:59-72` (and `Migrations/20261112030543_AddSiteContactDetails.cs` `UpdateData` of `Tagline`, `Migrations/20261113025547_AddSharePicture.cs` `UpdateData`)
**Issue:** Phase 11 adds `SiteSettingsDefaults.Tagline` to the `HasData` seed row, and the Business Info save lets a Manager change the tagline. `ProductLineConfiguration` explicitly avoids `HasData` "so a later deploy can never overwrite a Manager's edits (D-06)". For the settings row the opposite is now true. EF diffs the seed row on every `migrations add`: the day someone edits the `Tagline` constant (or any other seeded default), the generated `UpdateData` will reset the Manager's saved tagline in production. `AddSharePicture` already shows EF emitting an `UpdateData` on this row for new columns. It is harmless today (the columns are new) but it proves the row is under EF's control. The same applies to the older seeded business name.
**Fix:** Do not seed the Manager-editable columns through the model. Keep the one initial row from the original migration, and drop `Tagline` (and ideally `BusinessName`) from the anonymous `HasData` object, with a hand-written `UpdateData` or `InsertData` in the migration as the product-line and opening-hours migrations do. Add a schema test that fails when a migration contains `UpdateData` on `SiteSettings` after the baseline.

### Info

#### IN-B-01: The shell head can mix a stale and a fresh snapshot

**File:** `src/Csps.Server/Endpoints/ShellPage.cs:216-278`
**Issue:** `PublicHeadAsync` reads the site snapshot (and the lines, home or gallery snapshot) before it calls `cache.GetOrCreateAsync` for the shaped head. The head entry's own cache timestamp is taken after those reads. If a Manager save commits and clears the `public-content` tag in the gap, the snapshot already in hand is old, but the head built from it is stored as new and can serve old boot data (phone, hours, closures) for up to an hour. The gap is a few milliseconds, so this is rare, and a reload does not fix it until the entry expires or the next change.
**Fix:** Read the snapshots inside the cache factory, or store the snapshot's `LastChangedUtc` in the key (`csps:shell:{page}:{lastChanged:x}`), so a head built from an old snapshot can never be found under the new key.

#### IN-B-02: `sitemap.xml` `lastmod` ignores everything except the site facts

**File:** `src/Csps.Server/Endpoints/SeoEndpoints.cs:75-87`
**Issue:** Every page gets the date of `snapshot.Json.LastChangedUtc`, which only tracks settings, phones, hours and closures. A new gallery photo, product line edit or testimonial never moves `lastmod` for `/gallery`, `/products` or `/`. The docs describe it honestly ("newest change to the public site facts"), so this is a quality gap, not a bug. Crawlers may skip re-reading pages that did change.
**Fix:** Use each page's own newest stamp (lines snapshot for `/products`, gallery for `/gallery`, home for `/`), or leave `lastmod` out, since a wrong date is worse than none.

#### IN-B-03: The public read 429 says "Too many attempts"

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:20,147`
**Issue:** Only the image upload policy has its own text. A visitor who hits the `public-read` limit gets "Too many attempts from this address", which reads like a sign-in lockout. Plain wording for the policy would help. The default of 600 a minute per address is generous, but mobile carriers in the Philippines share addresses across many phones, and the limiter keys on the connection address.
**Fix:** Add a `PublicReadBusyDetail` ("This page is busy right now. Wait a moment, then try again.") and pick it for `RateLimitPolicies.PublicRead`.

#### IN-B-04: Two staff controllers lack `no-store`

**File:** `src/Csps.Server/Controllers/OpeningHoursController.cs:13-16`, `src/Csps.Server/Controllers/SiteSettingsController.cs:11-14`
**Issue:** Every other new staff controller has `[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]`. These two do not, although `GET /site-settings` returns the shop email and both return row versions used for edit conflict checks. A browser or proxy that stores the answer can show a stale version and cause needless 409 banners.
**Fix:** Add the same `[ResponseCache]` attribute to both controllers.

#### IN-B-05: Consent is only a domain rule, not a database rule

**File:** `src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs:38-86`
**Issue:** The public projection checks `PublicConsentAtUtc != null && ShownOnWebsiteSinceUtc != null`, and the domain enforces it, but nothing in the schema stops a row with a shown date and no consent (for example from a hand-run script). The repo already uses CHECK constraints for such rules (OR-7). Consent is the Data Privacy Act basis for D-11.
**Fix:** Add `HasCheckConstraint("CK_Orders_ShownNeedsConsent", "[ShownOnWebsiteSinceUtc] IS NULL OR [PublicConsentAtUtc] IS NOT NULL")` in a forward-only migration (first confirm no existing row breaks it, since consent is off for every migrated order).

---

_Reviewed: 2026-11-13T09:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice C: Web admin module (105 files)
## Phase 11, slice C: web admin module review

### Summary

I read the schemas, the services, every hook, the Business Info, Hours, Closures, Products, Testimonials and Gallery code, the order form and order page changes, and the audit copy changes. I compared the link and phone rules in `siteContentSchemas.ts` with `SiteLinks.cs` and they match rule for rule. No injection, XSS, open redirect or fetch-boundary problem was found. No `dangerouslySetInnerHTML`, no raw `fetch`, no storage use, `target=_blank` carries `rel`. The three warnings are about idempotency keys and a version race, not security.

### Warnings

#### WR-C-01: A move that may have run keeps its Idempotency-Key, so the next same move is silently replayed

**File:** `web/src/modules/admin/hooks/useProductLineQueries.ts:97-114`, `useTestimonialQueries.ts:85-101`, `useGalleryItemQueries.ts:121-137`; callers `components/ProductLinesTab.tsx:303-317`, `TestimonialsTab.tsx:302-316`, `GalleryTab.tsx:343-357`
**Issue:** `useRowAction` bumps its `generation` only in `onSuccess`. When a move fails with a network error or timeout (`mayHaveSaved`), `useSubmission` keeps the key (`lastRef` stays set). `reportFailure` then refetches the list, and the list shows the move did happen. If the Manager presses the same arrow again, the identity (`{id,direction}:generation`) is unchanged, so the same key is sent. The server replays the stored result, nothing moves, yet `run` sees `ok`, announces "moved to N" and shows no error. The key lives as long as the tab is mounted.
**Fix:** In each `reportFailure`, after the refetch decision, call `move.reset()` and `toggle.reset()` (both come back from `useSubmission`), so the next press is a new intent with a new key. Or bump `generation` on any outcome after the list was read again. Add a test: failing move with a network error, refetch, press again, expect a new key.

#### WR-C-02: Replace Photo can reuse a stale answer and overwrite the version Load Latest just loaded

**File:** `web/src/modules/admin/hooks/useGalleryItemQueries.ts:106` and `web/src/modules/admin/components/GalleryPhotoModal.tsx:462-472, 497-502`
**Issue:** `useReplaceGalleryPhoto` identity is `id:name:size` with no generation (the share picture and line photo hooks do add one). Steps: edit an upload, pick a photo, the photo goes up (success cached, answer holds version v2), the form save then fails with 409. Load Latest runs, sets `picked` and `uploaded` to null and loads version v3. The Manager picks the same photo again (same name and size after the redraw). `replacing.submit` finds the same identity with a cached success and sends nothing. It returns the old answer, and line 470 does `setOpened({ ...opened, version: v2 })`, putting the stale version back. The next save sends v2 and gets 409 again. The loop repeats for every attempt with that file until the window closes.
**Fix:** Add the same `generation` ref to this hook (bump in `onSuccess`, include in `identity`), or call `replacing.reset()` inside `loadLatest`. Also do not take the version from an answer the hook did not just fetch.

#### WR-C-03: The link preview picture can leave the Business Info form on a stale version after an upload that overlaps a save

**File:** `web/src/modules/admin/components/BusinessInfoTab.tsx:208, 314-318, 472`
**Issue:** `takePictureVersion` compares the fresh settings to `baseline` from the render in which the upload started. `useSubmission.run` calls `options.onSuccess` from the closure of the render where `submit` ran, so `onSettingsChange` is that render's `takePictureVersion` with that render's `baseline`. Uploads may take up to 120 s on a slow connection (`UPLOAD_TIMEOUT_MS`), and nothing locks the form while the picture slot saves. If the Manager saves the form during the upload, `baseline` and `version` move to v2. The upload then finishes at v3, the old `baseline` no longer equals the fresh values, and `setVersion` is skipped. The next form save sends v2 and gets a stale banner although nobody else edited.
**Fix:** Read the baseline and version through refs (`baselineRef.current`) inside `takePictureVersion`, or compare the fresh values with the current form baseline at call time. Add a test with a save that completes before the upload answer.

### Info

#### IN-C-01: The same list-action and Load Latest machinery is copied many times

**File:** `components/ProductLinesTab.tsx`, `TestimonialsTab.tsx`, `GalleryTab.tsx` (Acting, isDone, run, press, reportFailure, confirmDelete); `hooks/useProductLineQueries.ts`, `useTestimonialQueries.ts`, `useGalleryItemQueries.ts` (three `useRowAction`, three `MoveDirection` types); `BusinessInfoTab.tsx` and `ProductLinePage.tsx` (`TextField`, `formPathOf`, 400 mapping loop); `GalleryPhotoModal.tsx:PhotoPicker` against `PhotoSlot.tsx:run` (same prepare and check sequence); `refusalOf` is a one-line wrapper of `pickFailureMessage`.
**Issue:** WR-C-01 already exists in three places because the code was copied. Each future fix must be made three times.
**Fix:** Move `useRowAction`, `MoveDirection` and the row-action state machine to shared code under `lib/` or `modules/admin/hooks`, and reuse one prepare-and-check helper for both photo pickers.

#### IN-C-02: A pasted Google embed code is cut down only when the field loses focus

**File:** `web/src/modules/admin/components/BusinessInfoTab.tsx:142-151` (`onLeave`), `siteContentSchemas.ts:150-159`
**Issue:** `reduceEmbedCode` runs in `onBlur`. Pressing Enter (or Go on a phone keyboard) in the Map link field submits the form without a blur, so validation sees the whole iframe code and refuses it with "Paste the embed code or link...", which invites the same paste again. Pasting the embed code is the stated use.
**Fix:** Also run `reduceEmbedCode` on `mapEmbedUrl` inside `onValid` before `toSiteSettingsRequest`, or in a `transform` ahead of the rule.

#### IN-C-03: Load Latest on a gallery upload looks only at the current page

**File:** `web/src/modules/admin/components/GalleryTab.tsx:601`
**Issue:** `readLatest` finds the item in `readAgain().rows`, which is one page of the filtered list. If the item has moved to another page since, `GalleryPhotoModal.loadLatest` (line ~487) shows "gone" although the upload exists, and the Manager cannot recover the edit.
**Fix:** Read the item on its own (a get by id) or fall back to a fresh list read without the page limit before reporting it gone.

---

_Reviewed: 2026-11-13T12:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice D: Web public module and shared web code (141 files)
## Phase 11: Code Review Report, slice D (web public module and shared web code)

**Reviewed:** 2026-11-13
**Depth:** standard
**Files reviewed:** 141 (the generated `api.generated.ts` was only skimmed; large fixture files were checked for real data, not line by line)
**Status:** issues_found

### Summary

I read every non-test source file in the slice in full and sampled the tests. I traced the public data store, the lightbox history hook, the gallery category hook, the gallery filter bar and masonry, the hours helpers, the footer and the Contact parts.

The code is careful. Allow-lists for line keys (`isLineKey`) guard every href built from server data. The map frame is limited to the Google embed path. Contact links use `rel="noopener noreferrer"`. There are no `dangerouslySetInnerHTML`, `eval` or `innerHTML` uses. I found no em or en dashes in the slice, and the fixtures hold only made-up phones, emails and URLs.

No Critical issues. Three Warnings: a cache-invalidation race in the public data store, a misleading accessible name on the phone lightbox tap zones, and two tests that can pass without testing anything. Six small Info items follow.

I did not run any test or tool for this report. Every finding comes from reading the source.

### Warnings

#### WR-D-01: `invalidate()` loses to a load that is already in flight, and the old answer counts as fresh

**File:** `web/src/lib/public-data/publicResource.ts:96-100` (`invalidate`), `:56-58` (`setData`), `:68-75` (load result handler)
**Issue:** `invalidate()` sets `fetchedAt = 0` and calls `start()` only when the state is `success`. `start()` returns at once when `inFlight` is set. So when a load is already running (first load, or a stale refresh), the invalidation is dropped. When that load finishes, `setData` sets `fetchedAt = Date.now()`, so data that was requested before the admin write is held as fresh for the full `staleMs` (5 minutes for site, home, product lines and gallery).

Failure scenario: a resource is loading or refreshing, `invalidatePublicContent()` runs (called from `useOpenings`, `useProductLineQueries`, `useGalleryItemQueries` and `useShopClosuresQuery` after a write), then the request that was sent before the write answers. The public page now shows pre-edit content for up to 5 minutes, and the `invalidate` call that was meant to prevent that had no effect. The trigger window is narrow, but cache invalidation order is the exact thing this store exists to get right, and `publicResource.test.tsx` has no test for it.
**Fix:** Keep a generation counter. `invalidate()` increments it and aborts or ignores the running load. In the result handler, apply the data only when the generation still matches, and otherwise leave `fetchedAt = 0`. For example:

```ts
let generation = 0;
function start(): void {
  if (inFlight !== undefined) return;
  const startedAt = generation;
  ...
  (data) => {
    if (inFlight !== controller) return;
    inFlight = undefined;
    state = { status: 'success', data };      // show it
    fetchedAt = startedAt === generation ? Date.now() : 0; // but stay stale if invalidated meanwhile
    notify();
    if (startedAt !== generation && listeners.size > 0) start();
  }
}
function invalidate(): void {
  generation += 1;
  fetchedAt = 0;
  if (listeners.size > 0 && state.status === 'success') start();
}
```

Add a test: `invalidate()` while a load is pending, then resolve the load with old data, and expect a second load call.

#### WR-D-02: Phone tap zones are named "Previous photo" and "Next photo" but move between items

**File:** `web/src/modules/public/components/GalleryLightbox.tsx:243-262`, copy at `web/src/modules/public/copy.ts:207-208`
**Issue:** The two full-height tap zones (shown at 767px and below) call `step(-1)` and `step(1)`, which change the shown gallery item and reset the chosen photo (`GalleryLightbox.tsx:88-100`). Their accessible names are "Previous photo" and "Next photo". The real photo selector for an item with several photos is the thumbnail row, named "Show photo 2 of 3". A screen reader or voice-control user on a phone hears "Next photo" on an item that has three photos, activates it, and lands on a different team's item instead of the second photo. The 56px desktop buttons name the same action "Previous image" and "Next image", so the two controls for the same action disagree.
**Fix:** Name the zones like the buttons they replace. Reuse `COPY.previousImage` and `COPY.nextImage` for the zones and delete the `previousPhoto` and `nextPhoto` copy keys. Update `GalleryLightbox.test.tsx` where it queries the zones by the old names.

#### WR-D-03: Two tests wait a fixed 50 ms and then assert that something is absent, so they pass if the part never loads

**File:** `web/src/modules/public/components/SiteFooter.test.tsx:168-181` ("is not rendered when no day is open"), `web/src/modules/public/components/contact.test.tsx:97-104` ("leaves the second line out of the Call button when no day is open")
**Issue:** `FooterHours` and `CallHoursNote` are lazy chunks. Each test sleeps 50 ms and then asserts the clock row (or the second line) is not there. If the lazy chunk is slower than 50 ms, or fails to load, the assertion still holds, so the test cannot tell "correctly renders nothing" from "has not rendered yet". A regression that renders the row for a fully closed week would pass on a fast run too only by luck of timing, and would fail only by luck on a slow one. The same sleep pattern is used in `ProductsPage.test.tsx:234` (that one is fine because it asserts a spy and then proves the call later) and in `useGalleryCategory.test.tsx:16` (a settle helper).
**Fix:** Make the lazy chunk load first and then assert. For example, `await import('./FooterHours')` (and `./CallHoursNote`) before rendering, or wait for something that appears only after the chunk resolves (the Visit column's address row is rendered by the parent, so use a lazy-only marker such as `data-testid` on the `Suspense` child in a positive-case twin test, then run the closed-week case against the same preloaded module). Then assert absence with no sleep.

### Info

#### IN-D-01: `readBootData` re-reads the document every time when there is no usable block

**File:** `web/src/lib/public-data/bootData.ts:25-26`
**Issue:** The comment says `block` is `null` "when it held no usable block", so the document should be read once. But `block ??= parseBlock()` treats `null` as unset, so a page with no block, or a damaged one, runs `getElementById` and `JSON.parse` again on every read. The test "reads the document only once" covers only the success case, so the gap is not caught. The cost is tiny (three keyed resources), but the code and its comment disagree.
**Fix:** `if (block === undefined) { block = parseBlock(); }` and add a "no block" case to the once-only test.

#### IN-D-02: `ProductArticle` puts the line key in an element id without the allow-list check

**File:** `web/src/modules/public/components/ProductArticle.tsx:44-45`
**Issue:** `lineKey.ts` says a key reaches "an href or an element id only when" it matches the allow-list (T-11-44). `AnchorPills`, `CategoryGrid`, `RecentWorkStrip` and the "See work" link all check `isLineKey`. `ProductArticle` uses `id={line.key}` and `aria-labelledby={`${line.key}-title`}` for every line without the check. A key with a space would split the `aria-labelledby` list into two ids. The server validates keys, so this is defense in depth only.
**Fix:** Skip the id when the key fails `isLineKey` (`id={isLineKey(line.key) ? line.key : undefined}`) and derive the title id from the index when it does.

#### IN-D-03: "CSPS Shop" and the social link names are fixed text while the business name is editable

**File:** `web/src/modules/public/copy.ts` (`contact.map.shopName`, `footer.socials.*.name`), used at `web/src/modules/public/components/MapCard.tsx:59`
**Issue:** Phase 11 makes the business name a Manager setting (`site.businessName`, used in the footer copyright and the map frame title). The map label still shows the fixed "CSPS Shop", and the social links are always named "FB, CSPS on Facebook". After a rename the page shows two names. If the owner already ruled that these stay fixed, ignore this item.
**Fix:** Pass `site.businessName` into the map label, or record the ruling that the brand text stays fixed.

#### IN-D-04: `useSwipe` can drop a quick tap after a swipe that produced no click

**File:** `web/src/modules/public/hooks/useSwipe.ts:36-44`
**Issue:** After every qualifying swipe, `swallowClick` adds a one-shot capture click handler that lives for 100 ms. A touch swipe usually sends no click, so the handler stays armed for the full 100 ms and eats the next real click in that window (for example a fast tap on Close). The window is short, so this is a rare annoyance and not a defect that blocks use.
**Fix:** Arm the handler only when the up event came from a mouse or pen (`event.pointerType !== 'touch'`), or remove it on the next `pointerdown`.

#### IN-D-05: `Checkbox` `ariaDisabled` only works when the caller controls the box

**File:** `web/src/components/entry/Checkbox.tsx:66-85`
**Issue:** With `ariaDisabled`, the change handler skips `onChange`, but the native input still toggles. For a controlled box React puts the state back; for an uncontrolled one (`defaultChecked`), the box changes and a named input still submits its value. The prop comment says the box must be controlled, but nothing enforces it.
**Fix:** Add `onClick={(e) => { if (ariaDisabled) e.preventDefault(); }}` on the input, which stops the native toggle in both modes.

#### IN-D-06: Keys built from text can collide

**File:** `web/src/modules/public/components/HoursCard.tsx:65` (`key={text}`), `web/src/modules/public/components/TestimonialRow.tsx:63` (`key={`${name}|${quote}`}`)
**Issue:** Two closures with the same dates and note, or two testimonials with the same name and quote, give duplicate React keys. React warns, and the test console guard turns a warning into a failure; in the browser one row can be dropped or misplaced on update. The server may prevent such duplicates, but nothing in this slice relies on that.
**Fix:** Add the index to the key (`${String(index)}-${text}`), as `RecentWorkStrip` already does.

---

_Reviewed: 2026-11-13_
_Reviewer: Claude (gsd-code-reviewer), slice D_
_Depth: standard_

## Slice E: .NET tests (153 files)
## Phase 11 Slice E: Code Review Report (.NET tests, Csps.Testing, fixtures)

**Depth:** standard. I read the Csps.Testing helpers, the Testing seeder and its controller, the lock and cache tests, the authorization matrix changes, the privacy, shell head, rate limit, seeder and migration tests, and sampled the handler and domain tests. I did not read every one of the 153 files line by line.

### Summary

The suite is thorough. Authorization, ETag and cache invalidation, privacy, audit and concurrency cases are covered, and I found no test that cannot fail in a way that hides a production bug. I found no production defect that the tests reveal.

Testing-only reachability: I checked that the Testing seeder route cannot be reached in production. `CSPS_TESTING` is defined only for the Debug configuration in both `Csps.Server.csproj` and `Csps.Infrastructure.csproj`. Inside a Debug build, `TestingControllersFeatureProvider` removes the controllers outside the Testing environment, and `AddTestingFeatures` refuses to start as Production unless `Csps:Testing:AllowProductionEnvironment` is set (only the test factory sets it). `ReleaseHasNoEmailSinkTests` builds Release and scans the assemblies for `Testing*` type names and `api/testing` strings. The CI package step publishes with `-c Release`. `Csps.Testing` itself is a test project that no `src` project references. No gap found.

The three warnings are about test strength, not wrong behaviour.

### Warnings

#### WR-E-01: Two "racing delete" tests start the two requests without a gate, so they rarely hit the real interleaving

**File:** `tests/Csps.Server.IntegrationTests/Content/GalleryAdminTests.cs:428-462` and `tests/Csps.Server.IntegrationTests/Content/ProductLinePhotoEndpointTests.cs:215-236`
**Issue:** Both tests start the upload (or edit) and the line delete with two plain `Task.Run` calls (GalleryAdminTests lines 436-437 and 450-451, ProductLinePhotoEndpointTests lines 227-228). Nothing holds them at a gate. The upload decodes a multipart image first, and the delete is a tiny request, so in most runs the two happen one after the other. The accepted outcomes are exactly the two serial orders: (Created, 422) or (400, 204) in the gallery test, (200, 422) or (404, 204) in the photo test. So if the lock or recheck that closes the race were removed, the test would still pass in nearly every run. It proves "never 500" in the serial case only. The suite already has `ConcurrentRequests.SendTogetherAsync` (used in `ProductLineMoveTests.cs:106` and `TestimonialEndpointTests.cs:316`) for exactly this.
**Fix:** Use the shared gate so both requests are released together, and run more rounds:
```csharp
var (uploaded, deleted) = await ConcurrentRequests.SendTogetherAsync(
    () => rig.UploadAsync(UploadForm.Riders with { LineId = lineId }, Photo),
    () => rig.DeleteLineAsync(lineId));
```
Keep the same set of allowed pairs. Also assert the end state (no upload row left pointing at a deleted line) so a (Created, 204) outcome is caught by the database check, not only by the status pair.

#### WR-E-02: The script-breakout test only covers the Home shell and the site JSON; the product lines and Home boot data have no hostile-value test

**File:** `tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs:719-738`
**Issue:** `ScriptBreakoutInTheTaglineAndTheNameStaysInert...` puts `</script><script>alert(1)</script>` into the business name, tagline and about text, and loads only `/`. The boot block is built by `PublicHeadWriter.BootData` (`src/Csps.Server/Endpoints/PublicHeadWriter.cs:165-178`), which pastes three raw JSON strings into one `<script>` element: the site JSON, the product lines JSON and the Home JSON. The product line titles and card text, testimonial names and quotes, and gallery data come from staff-typed fields too. The only barrier is the default System.Text.Json encoder in `PublicContentReader.JsonOptions` (`src/Csps.Infrastructure/Content/PublicContentReader.cs:41`). If someone later switches that to relaxed escaping, the only test would still pass because it never sends a hostile value through the lines or Home paths. This is the single XSS barrier for server-written head HTML, so it needs its own negative case.
**Fix:** Add a theory over `/products`, `/` (Home) and `/gallery` with `</script><script>alert(1)</script>` in a product line title, a testimonial name and quote, and a gallery team name (seed them through the real readers or through `StubPublicContentReader`). For each page assert the same three things as the current test: `Split("</script>").Length` is the expected count, the boot block holds no `<`, and `</script>` is present.

#### WR-E-03: Cleanup of shared-database rows is not in `finally`, so one failure cascades through the rest of the class

**File:** `tests/Csps.Infrastructure.IntegrationTests/Persistence/ProductLinesMigrationTests.cs:70-76` and `:88-90`; `tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs:111-123`
**Issue:** `CspsDatabase.ResetAsync` never resets `SiteSettings`, `OpeningHours` or `ProductLines` (`CspsDatabase.cs:27-30`), so these tests clean up after themselves. In `PriceCheckRejects...` and `MinimumCheckRejects...`, the lowest row is inserted, then the highest, then both are deleted at the end, with no `try/finally`. If the second insert throws, the first row stays. `SeedMatchesTheSeedListFieldByField` (same class) then fails on `rows.Count.ShouldBe(6)`, and the real cause is buried. In `ShellHeadTests.AClosureInFortyFiveDays...`, `SaveClosuresAsync(database, [])` runs after `GetBodyAsync` (which asserts the status and can throw), so a failed request leaves two closures that change every later closure test in the class. The other tests in these classes already use `try/finally` (for example `PublicCacheInvalidationTests.cs:150-167`), so this is an inconsistency, not a design choice.
**Fix:** Wrap the insert and assert part in `try { ... } finally { await DeleteLinesAsync(lowest, highest); }` and move the closure clearing in `ShellHeadTests` into a `finally`. For the closure case, a small `IAsyncDisposable` helper in `PublicContentSeeding` that clears closures on dispose would remove the repetition.

### Info

#### IN-E-01: The same deadlock scenario is written three times

**File:** `tests/Csps.Infrastructure.IntegrationTests/Content/SiteContentLockTests.cs:92-146`, `tests/Csps.Infrastructure.IntegrationTests/Persistence/LockDeadlockScenario.cs:27-84`
**Issue:** `ADeadlockOnTheLockInsideAnOuterTransactionIsALostRace...` in `SiteContentLockTests` repeats `LockDeadlockScenario.RunAsync` almost line for line (the category rows, the 20 filler rows, both unit-of-work transactions, `CaptureAsync`, `SaveCategoryAsync`). The only differences are the 30 second lock wait and the `SiteContentLock` call. `PublicGalleryProjectionTests.cs:253-278` has a third, smaller copy. A fix to the scenario (for example a different victim choice) has to be made in three places.
**Fix:** Let `LockDeadlockScenario.RunAsync` take the lock timeout, or build the lock inside the `takeLock` delegate, and call it from `SiteContentLockTests`. Delete the local `CaptureAsync` and `SaveCategoryAsync`.

#### IN-E-02: `LastManagerGuardTests` now accepts a 409 busy for the loser, which weakens the "refused as last Manager" check

**File:** `tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs:312-323`
**Issue:** `AssertOneWinsAsync` accepts either 422 `users.last-active-manager` or 409 `auth.session-busy` for the loser (D-120, deadlock under load). One request still must win and the database keeps one active Manager, so the safety property holds. But the test no longer proves that the common path (two clean requests, second one refused as last Manager) still gives the 422. If a regression made every loser answer 409, the test would pass.
**Fix:** Keep the relaxed helper for the deadlock case, but add one deterministic test where the two requests are serialised by the lock (no deadlock) and assert the 422 exactly.

#### IN-E-03: The authorization matrix row for `DELETE /share-picture` accepts two Manager statuses that depend on run order

**File:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:~100` (the `ManagerAlso: 204` row) and `AuthorizationMatrixTests.cs:66-69, 105-108`
**Issue:** The Manager answer is 404 or 204 depending on whether the Testing seed route (a different matrix row) ran first. In the concurrent matrix test both can run at the same moment, so the Manager call may really delete a demo share picture. This is documented and does not hide an authorization bug (anonymous 401 and Admin 403 are still exact), but a row that accepts two answers is a weaker contract, and the failure message in the helper only reports the first expected status.
**Fix:** Run the share-picture DELETE row after clearing the picture (`SharePictureRig.ClearAsync`) in the matrix setup, or order the rows so the Testing seed route is never in the same pass, and drop `ManagerAlso`.

#### IN-E-04: The Testing site-content route is anonymous and destructive and has no database-name guard

**File:** `src/Csps.Server/Controllers/TestingSiteContentController.cs:17-34`, `src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs:93-130`
**Issue:** Not reachable in Release or Production (see Summary). In a Debug build in the Testing environment, an anonymous POST replaces the business info, hours, closures, product line text and prices, and deletes demo orders, E2E-prefixed lines, testimonials and uploads, on whatever database the connection string names. The project rule for the dev seed is "refuses any DB except CSPS_Dev/CSPS_E2E"; `BootstrapTargetGuard` and `DevSeedTargetGuard` already exist for that, but the Testing controllers do not call them. The earlier Testing controllers follow the same pattern, so this is consistent, not new. The risk is a Debug host started in the Testing environment by mistake against a real dev database.
**Fix:** If the owner wants it, have `TestingSiteContentSeeder.ResetAsync` check the connection's database name with the existing guard and refuse anything but `CSPS_E2E` or `CSPS_Test_<guid>`. This is an owner decision (security posture), so I did not treat it as a defect.

#### IN-E-05: `AuditActionsTests` hard-codes the whole catalog tail and the count

**File:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs:12-14` and `:331-335`
**Issue:** `AuditActions.All.Count.ShouldBe(132)` and a 49-item literal list for the order of the Phase 11 codes must be edited by hand for every new audit action. The individual `...AreInTheCatalog` theories already prove each code exists, and `EveryCodeIsAcceptedByAuditEntry` proves the shape. The order and count assertions add churn but no extra safety unless the order is stored somewhere.
**Fix:** Keep the count check but drop the literal tail list, or assert only that the codes are unique and appended (not reordered) by comparing against the previous phase's list, which does not change.

---

_Reviewed: 2026-11-13T10:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice F: Web e2e, scripts and build (40 files)
## Phase 11, slice F: Code Review Report

**Reviewed:** 2026-11-13
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

### Summary

I read every file in the slice. I did not run Playwright, Vite or the API (a separate agent owns the e2e host). The build plugins (Brotli, font preload, Barlow peso), `vite.config.ts`, `budget.ts` and `lighthouse.mjs` are sound: I found no bug in the shipped build code. The problems are in the e2e specs. The biggest one is shared-state pollution between specs: the order specs leave real orders shown in the shared public gallery, and the Home and Site Content specs assert exact counts and order of that gallery. I could not run the suite to prove the failure, so it is stated as a code-reading result. There are no security findings: the specs use fake data, no secrets, and the Testing routes are compiled out of Release.

### Warnings

#### WR-F-01: order-public-website specs leave shown orders in the shared gallery, outside the site content lock

**File:** `web/e2e/order-public-website.spec.ts:77-104` (also 247-258 and 285-300, 318-345)
**Issue:** Four tests end with an order in the "shown" state: "an Admin ticks the customer OK, shows an order" (line 77), "an Admin creates an order with the customer OK and Show ticked" (line 285), "a Manager edits a shown order" (line 318), and the first `showFromWindow` use. Showing an order creates a gallery entry (`OrderPublicWebsiteWriter.ApplyGalleryAsync`, `src/Csps.Application/Orders/OrderPublicWebsiteWriter.cs:123-129`). Nothing deletes the order or the entry afterwards. `TestingSiteContentSeeder.ResetDemoOrdersAsync` only removes orders numbered `DEMO-GALLERY-*` (`src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs:150-156`) and the upload reset only removes `E2E-` or demo teams, so these real orders survive every `seedDemoSiteContent`. The show action itself also runs outside `withSiteContentLock` (only the later gallery read is under it).
Two failure paths:
1. After these tests have run in the same E2E database, `home.spec.ts:50` (`Recent work` `toHaveCount(4)`, `nth(0)` is "Brgy. Sample Ballers"), `site-content-gallery.spec.ts:84,92,119,177` (`toHaveCount(6)` and `(7)`, "place 2 of 7") and `site-content-products` style counts of the admin gallery list will see extra shown orders. Home takes the six newest shown orders by shown date (`PublicContentReader.cs:226-232`), so a real order shown a few seconds before the reset outranks the demo ones.
2. While another worker holds the lock and asserts those counts, one of these tests can show an order in the middle of it, because it does not take the lock for the show step.
`site-content-sweep.spec.ts:300-303` already knows this: it deletes its order in `finally` ("so no shown demo is left behind"). The order-public-website specs do not.
**Fix:** In each test that shows an order, delete the order in a `finally` with `deleteOrderThroughApi(page, order.id)` (it removes the gallery entry), and run the whole body from sign-in to delete under `withSiteContentLock`, as the sweep spec does. Alternatively make `ResetDemoOrdersAsync` also drop gallery entries and orders whose number starts with `ORD-208`, but the per-test cleanup is clearer.

#### WR-F-02: the site content lock gives up after 4 minutes, shorter than the queue and shorter than the test budget

**File:** `web/e2e/site-content-lock.ts:11-12` (with `web/e2e/photo-host-lock.ts:96-104`)
**Issue:** `waitLimitMs` is 4 minutes, while every spec that uses the lock sets a test timeout of 8 minutes (`480_000`) because "each test waits its turn". About 25 test files take this one lock across five projects with several workers (`playwright.config.ts` sets no `workers` and no `fullyParallel`, so files run in parallel). The long holders are the sweep tests: each one seeds, walks five tabs or four windows at eight widths and runs axe at four widths, and holds the lock the whole time (`site-content-sweep.spec.ts:108-205`). A waiter queued behind two of those exceeds 4 minutes and throws `The photo host lock was not free in time.` The lock is also unfair (waiters poll and race for `mkdir`), so a waiter can be starved. The error text names the photo host even for this lock, which sends a reader to the wrong place.
**Fix:** Set `waitLimitMs` for this lock to at least the test timeout (for example `7 * 60 * 1000`), or lower the hold time by not holding the lock across the width sweeps. Pass a lock name into `createPhotoHostLock` so the message says which lock timed out.

#### WR-F-03: a "pending" branch lets two order tests pass when the public gallery route is missing

**File:** `web/e2e/order-public-website.spec.ts:50-58, 101-110, 169-178`
**Issue:** `publicGalleryTeams` returns `null` on a 404 or non-JSON answer, and the first two tests then add a `pending` annotation and return without asserting. This was written for plan 11-26, which is now merged (the 11-27 summary says the check "starts asserting by itself once 11-26 is merged"). `GET /api/v1/public/gallery` exists and other specs require 200 (`gallery.spec.ts`, `site-content-gallery.spec.ts:50-55`), and the third caller (line 360) already asserts `not.toBeNull()`. If the route were removed or broke into a 404, the "the public gallery lists it" and "the gallery drops it" tests would still pass. They can no longer fail on the thing they claim to prove.
**Fix:** Remove the `null` branch. Let `publicGalleryTeams` assert `status === 200` and return `string[]`, and delete the two `pending` blocks.

#### WR-F-04: an assertion that is always true in the Products layout test

**File:** `web/e2e/site-content-products.spec.ts:171-177`
**Issue:** The 768 px check evaluates `element.scrollWidth >= element.clientWidth` on the frame and expects `true`. By definition of the DOM, `scrollWidth` is never smaller than `clientWidth`, so this can never fail. The comment above it says the frame "scrolls on its own", but the test does not prove that the frame is wider inside than it shows.
**Fix:** Assert a strict overflow when the columns do not fit, for example `element.scrollWidth > element.clientWidth`, or drop the line and keep the `tabindex` and `NO_SIDEWAYS_SCROLL` checks. If the table can fit at 768 px, change the viewport to one where it cannot.

### Info

#### IN-F-01: error message in `boxOf` has lost its label

**File:** `web/e2e/site-content-products.spec.ts:260`
**Issue:** `throw new Error(\` is not on the page\`)` starts with a space and names nothing. The label parameter was meant to be in the text.
**Fix:** `throw new Error(\`${label} is not on the page\`)`.

#### IN-F-02: Barlow peso plugin can write an empty `unicode-range`

**File:** `web/scripts/vite-preload-font-plugin.ts:97-117`, test at `web/scripts/vite-preload-font-plugin.test.ts` ("a range that is only U+20B1")
**Issue:** If a face listed only `U+20B1`, `withoutPeso` returns `''` and the output is `unicode-range: ;`. That declaration is invalid CSS and is ignored, so the face would then apply to every character, the opposite of the intent. The test locks this result in (`expected ''`). No real Barlow face lists only the peso, so nothing is wrong today.
**Fix:** When every token is removed, drop the whole `unicode-range` declaration only if that is the intended result, or throw (`this.error`) so a future Fontsource change fails the build. Change the test to match.

#### IN-F-03: layout-only specs read shared content without the lock

**File:** `web/e2e/site-content-testimonials.spec.ts:166-188`, `web/e2e/site-content-products.spec.ts:128-163`, `web/e2e/site-content-business.spec.ts:78-98`, `web/e2e/site-content-hours.spec.ts:129-156`
**Issue:** These tests skip the lock ("any saved settings give the same layout") but then use `.first()` on cells or read a fixed Monday row. While another test resets the content (the reset deletes and re-adds the testimonials, lines and phone rows), the rows can briefly be absent, so a `toHaveCSS` or `all()` read sees nothing. `.all()` in the business test (line 91) does not wait at all.
**Fix:** Either take the lock for these (they are short), or make them wait for the rows first with `await expect(locator.first()).toBeVisible()` before measuring.

#### IN-F-04: sweep test leaves its Cancelled order behind and can skip the demo reset

**File:** `web/e2e/site-content-sweep.spec.ts:249-261, 292-302` and `web/e2e/site-content-products.spec.ts:327-336, 383-392`
**Issue:** The order sweep seeds a Cancelled order and a plain one but only deletes the plain one in `finally`. In the same `finally` blocks, `deleteOrderThroughApi` (or `page.goto` plus `clearLinePhotos`) comes before `seedDemoSiteContent`; if the delete or the DELETE photo call throws, the demo reset is skipped and the rest of the run starts from a changed shop.
**Fix:** Delete both orders, and wrap the cleanup so the demo reset always runs (nested `try`/`finally`, or `await Promise.allSettled([...])` then rethrow).

#### IN-F-05: stale comment in `lighthouse.mjs`

**File:** `web/scripts/lighthouse.mjs:48-51`
**Issue:** The comment says "20 seconds always worked, 4 never did" while `PAGE_PAUSE_MS` is 15 seconds and the test pins 15 seconds.
**Fix:** Change the comment to the real value or the value to match the comment.

#### IN-F-06: owner review tool covers only Home among the new public pages

**File:** `web/scripts/owner-review.mjs:113-119`
**Issue:** The change only retitled the one public target. Products, Gallery, Contact, the 404 page and the Site Content admin tabs, which are the substance of this phase, are not in `REVIEW_TARGETS`, so the owner's screenshot review (D-23) does not show them. If that was a deliberate choice it is not recorded in the file; the doc comment above the list still describes the public side as "the public shell".
**Fix:** Add targets for `/products`, `/gallery`, `/contact` (Blush only) and `/admin/site-content` (both themes, signed in), or note in the comment that they are covered elsewhere. This is the owner's call on scope.

---

_Reviewed: 2026-11-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
