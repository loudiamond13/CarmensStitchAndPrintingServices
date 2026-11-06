# Phase 9: Order Images & Maintenance Jobs - Discussion Log
*Created: 2026-10-31T12:30:00-05:00 · Updated: 2026-10-31T12:30:00-05:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives considered.

**Date:** 2026-10-31
**Phase:** 9-order-images-maintenance-jobs
**Areas discussed:** Photo privacy (OD-9), Photo limit and new orders (C-2), Reorder and cover (C-16), Deletes and job timing, plus roles, dev photos and usage

---

## Photo privacy (OD-9, C-26)

| Question | Options (R = recommended) | Selected |
|----------|---------------------------|----------|
| How are photos served? | Private signed links (R) · Public random address · Through our server | Public random address |
| Cloudinary account | Free plan, I have it · Not yet · Paid plan | Free plan, I have it |
| Strip GPS from the stored file? | Strip on upload too (R) · On display only | Strip on upload too |
| Strict transformations? | Yes, lock the sizes (R) · No | Yes |
| Full-size view for staff? | Yes, "Open full size" (R) · No | Yes |
| Clear cached copies on delete? | Yes (R) · No | Yes |

**Notes:** The owner chose public delivery over the PRD's recommendation, after being told anyone with an address can open the photo. Strict sizes and stripping on upload were added to narrow the gap.

## Photo limit and new orders (C-2)

| Question | Options | Selected |
|----------|---------|----------|
| Photos per order | 5 (R) · 12 · 10 | 5 |
| New order upload timing | Right after Save (R) · Save first, then add | Right after Save |
| Failed upload after save | On the order page (R) · Stay on the form | On the order page |
| Closed orders | Same as other edits (R) · Always allowed | Same as other edits |
| Alt text | Optional with default (R) · Required | Optional with default |

## Reorder, cover and viewing (C-16)

| Question | Options | Selected |
|----------|---------|----------|
| Move a photo | Buttons, drag as a bonus (R) · Buttons only · Position menu | Buttons, drag as a bonus |
| Pick the cover | Always-visible button (R) · Cover is photo 1 | Always-visible button |
| When changes save | Right away (R) · With the order Save | Right away |
| Tap a photo | Opens a viewer (R) · New tab | Opens a viewer |
| Phone camera | Two buttons (R) · One button | Two buttons |
| Downscale size | 2000 px (R) · 3000 px · 1600 px | 2000 px |
| Which files shrink | Every upload (R) · Camera only | Every upload |

## Deletes and job timing

| Question | Options | Selected |
|----------|---------|----------|
| When photos leave Cloudinary | Only on permanent delete (R) · Also on soft delete | Only on permanent delete |
| Schedule | Every hour (R) · Every 15 minutes · Once a day | Free text: "once a month" |
| Failure alerts | Red run and GitHub email (R) · Logs only | Red run and GitHub email |
| Stray files | Delete if older than 2 days (R) · Report only | Delete if older than 2 days |

**Notes:** Claude listed the consequences of a monthly run (deleted photos reachable up to a month, rows build up, retries only monthly) and offered a split (photos daily, rest monthly) or weekly. The owner asked what the purges and the stray-file check are, got a plain explanation, and confirmed "Yes, all once a month". A manual "Run now" was added.

## Extra gray areas

| Question | Options | Selected |
|----------|---------|----------|
| Who edits photos | Admins and Managers (R) · Only Managers delete | Admins and Managers |
| Dev photos | Same account, own folder (R) · Second free account | Same account, own folder |
| Usage report | Yes, warn at 80% (R) · No | Yes, warn at 80% |

## Claude's Discretion

Named sizes and srcset set, lease and retry numbers, purge batch sizes, the maintenance secret check, upload concurrency, HEIC preview handling, and the job-runner layout for later jobs.

## Deferred Ideas

- Featured orders on the public site: shown by default, with a Manager able to hide any order. Recorded for Phase 11 (C-12), with the customer-consent question flagged. The owner chose "Note it for Phase 11" over building it in Phase 9.
