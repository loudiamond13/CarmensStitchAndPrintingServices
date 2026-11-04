# Phase 9: Order Images & Maintenance Jobs - Context
*Created: 2026-10-31T12:30:00-05:00 · Updated: 2026-11-03T22:05:00-06:00*

**Gathered:** 2026-10-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff (Admin and Manager) can attach, arrange, view and delete order photos, on the new-order form and on the order page, including straight from a phone camera. Photos upload through the server to Cloudinary and load fast at the right size. A secret-protected maintenance endpoint, called on a GitHub Actions schedule, removes deleted photos from Cloudinary, purges expired tokens, 2FA codes and idempotency keys, and sweeps stray files.

Requirements: ORD-04, IMG-01 to IMG-05, JOB-01, JOB-02, plus the JOB-01 idempotency-key purge left over from SEC-06.

Out of scope:
- The public gallery, and showing orders on the public site (Phase 11; see Deferred).
- Analytics aggregation and inquiry retention jobs (Phases 12 and 13 add them to this endpoint).
- The audit-log retention purge (hardening phase, `docs/operations/audit-log.md`).
- Legacy images (MIG-05, Phases 15 and 16).

The owner decisions the roadmap lists for this phase are closed here: OD-9 and C-26 (D-01), C-2 (D-08) and C-16 (D-13 to D-15). OD-14 carries forward (see Carried forward).

</domain>

<decisions>
## Implementation Decisions

### Photo privacy and delivery (OD-9, C-26)
- **D-01:** Order photos use **public Cloudinary delivery with random, unguessable public ids** under `csps/orders/{orderId}/` (owner, 2026-10-31). This goes against the PRD's recommendation of authenticated delivery. The owner chose it knowing that anyone who has an address can open the photo. Addresses appear only in staff API responses and staff pages, never on the public site. — **Reversibility:** costly — moving to authenticated delivery later means re-uploading or retyping every stored asset and rebuilding every delivery URL.
- **D-02:** **GPS and camera data are stripped before the file reaches Cloudinary** (server side, at upload). Delivery also strips it, so the stored copy is clean even if an address leaks (owner, 2026-10-31).
- **D-03:** **Strict transformations are on** in Cloudinary: only the named sizes the app uses can be loaded. No raw original and no ad-hoc sizes, so free credits can't be burned (owner, 2026-10-31). The owner turns the setting on (owner checklist item). Research picks the named sizes (list thumb, grid, viewer, full size).
- **D-04:** Staff get an **"Open full size"** action. It loads one large allowed size (about 2000 px long side, metadata stripped), never the raw upload (owner, 2026-10-31).
- **D-05:** **Deleting a photo from Cloudinary also clears its cached copies** (invalidate), so the old address stops loading within minutes of the job running (owner, 2026-10-31).
- **D-06:** **Cloudinary account: the owner has a free-plan account** and supplies the cloud name, key and secret as host secrets and dev user-secrets, never in git (owner, 2026-10-31). Every design must fit the free plan (no paid features, such as expiring signed URLs).
- **D-07:** **Development and live share the one account, in separate folders:** `csps-dev/orders/` for development and `csps/orders/` for live, each from configuration. A job or sweep touches only its own environment's folder. **Automated tests never call Cloudinary.** They use a fake `IImageStorage` (owner, 2026-10-31).

### Photo limit and new orders (C-2)
- **D-08:** **Maximum 5 photos per order**, as in the PRD and the domain rule (`MaxImagesPerOrder = 5`, Domain plus DB-level guard). The uploader is passed `max = 5` (owner, 2026-10-31).
- **D-09:** **On the new-order form, staff pick photos like any other field.** Save creates the order first, then the photos upload one by one with progress (owner, 2026-10-31).
- **D-10:** **If a photo fails after the order is saved, the order stays saved.** Staff land on the order page, a message says how many photos didn't upload, and those photos wait there with "Try again" and "Remove". They are lost only if staff leave the page (owner, 2026-10-31).
- **D-11:** **Closed orders follow the Phase 8 lock** (08 D-15, 07 D-05): photos can't be added, moved or deleted on a Completed or Cancelled order until it is reopened (owner, 2026-10-31).
- **D-12:** **Alt text is optional, with a default** of "Order {number} photo {n}", which staff can edit. An upload is never blocked on typing (owner, 2026-10-31).

### Reorder, cover and viewing (C-16)
- **D-13:** **Reorder by buttons, with drag as a bonus:** each photo has "Move left" and "Move right" buttons (44 px, named per photo). Mouse drag stays. A live region announces "Moved to position {n} of {total}" (owner, 2026-10-31; WCAG 2.5.7).
- **D-14:** **"Make cover" is an always-visible button** on every photo except the cover, with no hover gate. The cover keeps its "Cover" tag. This replaces the Phase 2 hover star for this action (owner, 2026-10-31). The cover is the lazy thumbnail in the order list, with the existing placeholder when there's none.
- **D-15:** **Photo changes save immediately** (move, cover, alt text, delete), each with a small "Saved" message. Delete asks to confirm. A conflict (rowversion 409) reloads the latest photos (owner, 2026-10-31).
- **D-16:** **Tapping a photo opens a viewer** with Previous and Next buttons, arrow keys, Esc to close, the alt text and "Open full size". Focus goes back to the photo on close (owner, 2026-10-31).
- **D-17:** **On phones, two buttons: "Take Photo"** (opens the camera, `capture`) **and "Choose Photos"** (gallery). A computer shows the drop zone and browse only (owner, 2026-10-31).
- **D-18:** **Every upload is downscaled in the browser to a 2000 px long side**, camera and gallery alike. A file already within that size is left as it is. The server still enforces 10 MB (configurable), magic bytes (JPEG/PNG/WebP/HEIC), max dimensions and no SVG (owner, 2026-10-31).
- **D-19:** **Admins and Managers both** add, arrange and delete photos, like other order parts (07 D-25). Every photo change goes in the audit log (07 D-31) (owner, 2026-10-31).

### Deletes and maintenance jobs (JOB-01, JOB-02)
- **D-20:** **Photos leave Cloudinary only on a permanent delete:** deleting one photo, or a Manager's "Delete permanently" of an order. A soft-deleted order keeps its photos, so a restore brings them back (07 D-26 to D-28). The removal is queued in the **same transaction** as the business change (owner, 2026-10-31).
- **D-21:** **The scheduled maintenance call runs once a month**, and it does everything in one run: the Cloudinary removal queue, the token, 2FA code and idempotency-key purges, the stray-file check and the usage report. The owner chose this knowing that a deleted photo stays reachable at its old address for up to a month and that expired rows build up between runs (owner, 2026-10-31). The workflow also has a manual **"Run now"** (`workflow_dispatch`). This overrides the roadmap's "weekly orphan sweep": the sweep is monthly. — **Reversibility:** reversible — one cron line in the workflow.
- **D-22:** **Failures:** each removal is retried with leases and growing waits within a run, and failures are logged. A removal still failing at the end of a run makes the endpoint report failure, so the GitHub run turns red and GitHub emails the owner. No new screen (owner, 2026-10-31).
- **D-23:** **Stray files:** the sweep deletes Cloudinary files under its own environment's `…/orders/` folder that match no photo row and are **older than 2 days**. Each removal is logged, with a count in the run summary (owner, 2026-10-31).
- **D-24:** **Usage report:** each run reports Cloudinary storage and monthly credits used in the run summary. **Above 80% of the free plan, the run turns red** (owner, 2026-10-31).
- **D-39:** **Monthly database backup inside the maintenance run** (STATE D-102; owner, 2026-10-31). The hosting plan has no scheduled backups, so one more maintenance job has the SQL server write a `.bak` into the host's `db` folder. Only the trigger comes from GitHub; the file never goes through GitHub. The owner accepted that up to a month of orders could be lost between runs. Covers CUT-01's scheduled-backup item early. **Reversibility:** reversible.
- **D-40:** **One approved SQL statement** (owner, 2026-10-31): `BACKUP DATABASE ... TO DISK` is a named exception to the no-inline-SQL rule, limited to the backup job's one file. It is built only from settings (database name and folder path), never from request input, and a test fails if raw SQL appears anywhere else in application code. **Reversibility:** reversible.
- **D-41:** **Keep 3 monthly backups** (owner, 2026-10-31): after a successful backup, the job deletes the oldest of its own `.bak` files so at most 3 remain. It never touches files it did not write (for example the control panel's own backups). **Reversibility:** reversible, one setting.
- **D-42:** **Probe the host first** (owner, 2026-10-31): the plan starts with a one-time check the owner runs on the host (HostProbe pattern) to prove the login can back up and the SQL server can write to the `db` folder path. If the host blocks it, the plan stops before the job is built. **Reversibility:** reversible.
- **D-43:** **A failed backup turns the run red** (owner, 2026-10-31): it adds a failed line to the run summary, the other jobs still run, and GitHub sends its failure email. **Reversibility:** reversible.
- **D-44:** **The site's login makes the backup** (BQ-2; owner, 2026-10-31): add `db_backupoperator` to the site's existing lower-rights login in the control panel. It can already read every row, so it only gains the right to make backups. The cutover runbook's "exactly `db_datareader` and `db_datawriter`" checks change to include `db_backupoperator`. **Reversibility:** reversible, untick the role.
- **D-45:** **The host check runs from the owner's PC** (BQ-1; owner, 2026-10-31) against the host's SQL server with the site's login, like the bootstrap command. No site outage. **Reversibility:** reversible.
- **D-46:** **At least 20 days between backups** (BQ-3; owner, 2026-10-31): repeat calls in one run and extra Run now presses do not write another backup inside 20 days, so the 3 kept files cover about 3 months. **Reversibility:** reversible, one setting.
- **D-47:** **Two more red-run causes** (BQ-4; owner, 2026-10-31): old backups that could not be deleted, and the backup not yet set up on the host, both turn the run red. **Reversibility:** reversible.
- **D-48:** **Split the backup work in two plans** (BQ-5; owner, 2026-10-31): 09-31 is only the host check and runs early, so the owner learns first whether the host allows backups; 09-32 builds the job later in the phase. **Reversibility:** reversible.
- **D-49:** **One read-only question for the host probe** (owner, 2026-11-03): after two backup checks answered SQL error 3201, the probe may ask the SQL server for its own default backup folder with `SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(260))`. It is the second named exception to the no-inline-SQL rule, in the same approved file as the D-40 statement, and runs only from the probe's `POST /probe/backup-folder`. The answer holds a path, so the owner keeps it out of chat. **Reversibility:** reversible, remove the endpoint and the statement.

### UI contract rulings (UI-SPEC OQ-1 to OQ-7)
- **D-25:** **Photos show as one compact photo list** on the order page and the order form: each photo is a small card with an 88px thumbnail, its description, "Make Cover" and four 44px buttons; 2 columns on wide screens, 1 on phones. No mosaic gallery (OQ-1 A; owner, 2026-10-31).
- **D-26:** **"Take Photo" uses lucide's `camera` icon**, added to `icons.ts` from the already installed package (OQ-2 A; owner, 2026-10-31).
- **D-27:** **"Open Full Size" opens the large photo in a new browser tab** (OQ-3 A; owner, 2026-10-31).
- **D-28:** **New-order photos upload on the order page:** after Save, staff go to the new order's page at once and the photos upload there with progress (OQ-4 A; owner, 2026-10-31).
- **D-29:** **Leaving the order page while photos wait or failed asks first:** "Leave this page?" with "Stay on Page" / "Leave Page", plus the browser prompt on reload or close (OQ-5 A; owner, 2026-10-31).
- **D-30:** **The default description is not stored:** "Order {number} photo {n}" is shown from the photo's current position, so the number follows moves (OQ-6 A; owner, 2026-10-31).
- **D-31:** **Upload progress is count-based** ("Uploading photo 2 of 4") with a spinner. No percent bar, so `core/api/http` is unchanged (OQ-7 A; owner, 2026-10-31).
- **D-32:** **Photos are stored as Cloudinary's "private" type:** the allowed sizes stay public (D-01), and the untouched original needs a signed link, so no raw original is openable by a plain address (D-03) (RQ-1 A; owner, 2026-10-31).
- **D-33:** **Named sizes are WebP; "Open Full Size" is JPEG.** No `f_auto` inside named sizes, because Cloudinary does not allow it; this replaces the `f_auto` wording in IMG-04 (RQ-2 A; owner, 2026-10-31).
- **D-34:** **Largest photo: at most 25 megapixels and at most 10,000 px on a side.** Message: "{file name} is too big. Photos can be at most 25 megapixels." This replaces the UI-SPEC's "N pixels wide or tall" wording (RQ-3 A; owner, 2026-10-31).
- **D-35:** **The monthly run also deletes closed email-outbox rows 30 days after they close**, as `docs/operations/mail-setup.md` already states (RQ-4 A; owner, 2026-10-31).
- **D-36:** **The public run summary shows counts only:** "Cloudinary storage used: {n} GB" and "Cloudinary credits this month: {used} of {limit} ({p}%)", with nothing that identifies the account (RQ-5 A; owner, 2026-10-31).
- **D-37:** **CloudinaryDotNet 1.29.3 is approved** (MIT, pinned to that exact version; its dependency Newtonsoft.Json 13.0.4 is already locked) (owner, 2026-10-31).
- **D-38:** **Plan size exception:** 09-01 (the upload tracer, 36 files) and 09-20 (move and describe, 22 files) may exceed the checker's soft limit of about 15 files per plan. Each is one end-to-end slice, and splitting it would leave gates red between plans or drop the tracer. The plan checker treats these two as accepted (owner, 2026-10-31).

### Carried forward (already decided, not re-asked)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/ROADMAP.md` §Phase 9 (around line 968) — goal, success criteria, research flag
- `.planning/REQUIREMENTS.md` — ORD-04, IMG-01 to IMG-05, JOB-01, JOB-02, SEC-06 (idempotency-key purge)
- `.planning/PROJECT.md` — OD-9, OD-14, C-2, C-16 rows (closed by D-01, D-08, D-13 to D-15)

### Behavior, security and UI
- `CSPS-PRD.md` §10 Images (Cloudinary), §21 delete semantics, CWE-434 and CWE-918 rows, the CSP header, the test matrix (5-image limit, 100% Domain)
- `docs/CSPS-UI-SPEC.md` §6.3 ImageUploader (App. D.3), LazyImage, the order screens §8.5 to §8.7
- `.planning/design/` — local-only visual reference (git-ignored, never commit)

### Prior phase decisions
- `.planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md` — D-10 (no host scheduler, Actions cron), D-25/D-32 (audit retention)
- `.planning/phases/07-order-domain-api/07-CONTEXT.md` — D-05 (locked orders), D-25, D-26 to D-28 (soft delete, restore, permanent delete), D-31 (audit every order change)
- `.planning/phases/08-order-screens/08-CONTEXT.md` — D-15 and D-39 (locked order banner and hidden actions), D-27 (images placeholder card)
- `.planning/HOSTING-RECORD.md` — Basic plan limits (256 MB pool, secrets as app-pool env vars)
- `docs/operations/audit-log.md` §Retention purge — the later audit purge uses the same endpoint pattern
- `docs/operations/ci.md` — workflow rules (actions pinned by SHA, `ApprovedActions` list)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/components/media/ImageUploader.tsx`: drop zone, thumbnail grid, cover tag, native drag, "Make cover image" and "Remove". The header says uploads and keyboard reorder arrive in Phase 9. The hover gate (D-05 of Phase 2) changes for "Make cover" per D-14.
- `web/src/components/states/LazyImage` and `MediaPlaceholder`: lazy image with placeholder, already used by `OrderCard`.
- `web/src/utils/csps.ts`: the client `OrderImage` type.
- `web/src/modules/admin/pages/OrderFormPage.tsx`, `OrderPage.tsx`, `DeletedOrderPage.tsx`: where the uploader and gallery go.
- `.github/workflows/weekly.yml`: a model for a scheduled workflow with empty default permissions.

### Established Patterns
- One `[ApiController]` per resource, thin actions, one handler per use case, `Result<T>` to ProblemDetails; default-deny with explicit policy; authorization-matrix test discovers every action.
- Idempotency-Key on every state-changing POST (SEC-06); a multipart upload POST needs it too, or an allow-list entry with a reason.
- rowversion per aggregate (409), soft delete with Manager restore, audit on every change.
- `Testing*Controllers` and fakes for test-only seams; no real external calls in tests.

### Integration Points
- Order aggregate (Phase 7): new `OrderImage` child plus a removal-queue table in the same transaction (EF migration, no JSON columns, no triggers, OR-7).
- `IImageStorage` port in Application, Cloudinary adapter in Infrastructure (CloudinaryDotNet, already in the approved stack; exact version needs the package check).
- Existing token tables: `RefreshToken`, `TwoFactorChallenge`, `TwoFactorCode`, account links, and the idempotency-key table, for the purges.
- `SecurityHeadersMiddleware.cs`: CSP already lists Cloudinary.

</code_context>

<specifics>
## Specific Ideas

- Default alt text: "Order {number} photo {n}".
- Live region text on move: "Moved to position {n} of {total}".
- Phone buttons: "Take Photo" and "Choose Photos". Failed upload actions: "Try again" and "Remove".
- Owner checklist items: turn on strict transformations in Cloudinary; add the Cloudinary keys and the maintenance secret as host and GitHub secrets.

</specifics>

<deferred>
## Deferred Ideas

- **Featured orders on the public site (Phase 11, input to C-12):** order photos show on the public site **by default**, and a Manager can turn it off per order so it doesn't show. Raised by the owner on 2026-10-31. Open for the Phase 11 discussion: showing customer orders publicly by default may need customer consent under the Philippine Data Privacy Act, or a "Customer said OK to show" box, and it affects the Privacy Policy (LEGAL-01). Phase 9's public delivery (D-01) and strict sizes (D-03) can serve it.

</deferred>

---

*Phase: 09-order-images-maintenance-jobs*
*Context gathered: 2026-10-31*
