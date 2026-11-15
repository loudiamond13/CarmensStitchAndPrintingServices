---
created: 2026-11-13T01:45:00-06:00
updated: 2026-11-13T01:45:00-06:00
---

# Go-live checklist: the public site (Phase 11)

This is your list for the day the real public pages replace the holding page. You do every step. Claude never deploys, never touches the live database and never runs the Cloudinary setup command on your account (D-08, D-44).

Do the steps in order. Tick each one as you go. The first deploy of the app itself is in [deploy.md](deploy.md) and the older cutover day is in [cutover-runbook.md](cutover-runbook.md). This page is only about what Phase 11 adds.

## What to expect

- The holding page shows the shop phone and the Facebook link today. After the deploy, those facts live only in Business Info. Business Info starts empty (D-39 keeps old placeholders out), and no data is copied in for you (D-123, option A, "fill in right after").
- So **steps 4 and 5 come first after the deploy**. Until you save them, the Contact page shows no phone number and says "Closed now". This lasts only a few minutes if you sign in straight after the deploy.
- The six product lines go live **shown**, with the approved text and "Message us for a price" on each one (D-06, D-40). You review the text and add prices (step 9).
- The demo content from the dev seed never reaches the live site. The dev seed refuses every database except `CSPS_Dev` and `CSPS_E2E`.

## Before the deploy

### 1. Take a fresh backup

In the host's control panel, make a fresh database backup (`.bak`) and download it. Keep it outside the repository and never upload it anywhere. The Phase 11 migrations go forward only. They have no undo, so this backup is your way back.

### 2. Review and apply the migration script

1. Take the reviewed, idempotent script `csps-migrations.sql` from the package of the build you are about to deploy.
2. Read it. Phase 11 adds new tables for phone numbers, opening hours, closures, product lines, testimonials and gallery entries, and it adds columns to the settings and order tables. It also puts the six product lines in place, shown, with no price.
3. Apply it to the live database. It is safe to run twice.

The steps are the same as "Migrations before a deploy" in [deploy.md](deploy.md).

### 3. Deploy

Press Run on the Deploy workflow, as [deploy.md](deploy.md) says. Wait for the green smoke test.

## Right after the deploy (option A: these two come first)

Sign in as a Manager and open **Site Content** in the sidebar.

### 4. Business Info

On the **Business Info** tab, fill in and press **Save Business Info**:

- the business name and the tagline (check the words),
- the phone numbers (one is the main number that the Call buttons dial; use the number the holding page shows today as the main one),
- the Messenger link,
- the address: street, town or city, province, postal code,
- the Facebook page link (the one the holding page shows today) and the other links you use: Instagram, TikTok, directions and the map embed.

The link preview picture comes later, in step 7, because it needs the Cloudinary sizes.

### 5. Opening hours

On the **Hours & Closures** tab, set the opening and closing time for each day, or mark the day closed. Save. After this, the Contact page shows the real open or closed status.

## Then, in this order

### 6. Run the Cloudinary setup command once (D-44, P11-BL-21)

Phase 11 needs 21 more named picture sizes in your Cloudinary account. Run the setup command once, after the deploy and before you add the first public photo:

1. Make sure your three Cloudinary keys are in the place you run it from (see [cloudinary-setup.md](cloudinary-setup.md)).
2. Look first. This changes nothing: `dotnet run --project tools/Csps.CloudinarySetup -- --check`. It should say `13 exist, 21 missing`.
3. Create the missing sizes: `dotnet run --project tools/Csps.CloudinarySetup`. It only adds sizes that are missing.
4. Run `--check` again. The last line must say `34 exist`. If it does not, stop and tell Claude.
5. Check a photo: add or open one public photo, then load the public page that shows it and see that the picture loads.

The full steps and the list of sizes are in "Phase 11 sizes" in [cloudinary-setup.md](cloudinary-setup.md). The parked item is P11-BL-21 in [the Phase 11 owner backlog](../../.planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md).

### 7. The link preview picture

On the **Business Info** tab, in the **Link preview picture** card, add the picture that shows when someone shares a link to the site. It is a JPEG, and 1200 by 630 pixels is the size it is shown at.

### 8. Closures

On the **Hours & Closures** tab, add any holiday or closure that is already planned with **Add Closure**. The Contact page lists the ones in the next 30 days.

### 9. Review the six product lines and add prices (D-06, D-40)

On the **Products** tab, open each of the six lines. Read the title, the descriptions and the five "what you can customize" texts. Fix any words you want to change. Add the starting price and the minimum order where you have them. A line with no price shows "Message us for a price" on the site, which is fine until you are ready.

Add product photos to each line here too.

### 10. Gallery photos and testimonials

On the **Gallery** tab, add the work photos you want visitors to see. On the **Testimonials** tab, add real customer quotes if you have them. An order only appears in the gallery when the customer has said yes, staff marked it to show on the website and it has a photo.

## Manual checks on the live site

These need the live site and Meta's tool, so only you can do them.

### 11. Facebook Sharing Debugger

Open the Sharing Debugger at `https://developers.facebook.com/tools/debug/`. Paste each public address in turn and press Debug. Press **Scrape Again** if it shows an old answer. For each address, check that the title, the description and the picture are the right ones:

- the home page,
- `/products`,
- `/gallery`,
- `/contact`.

This also covers the default link preview picture (P11-BL-40, item 4 in [the Phase 11 owner backlog](../../.planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md)): when you share one link, the picture from step 7 must show.

### 12. robots.txt and sitemap.xml

Open `/robots.txt` and `/sitemap.xml` on the live address. Check that:

- `robots.txt` blocks `/admin` and `/api` and names the sitemap,
- `sitemap.xml` lists the four public pages, and every address in both files starts with the live address.

### 13. App:PublicBaseUrl holds the live origin

Every address in the page heads, `robots.txt` and `sitemap.xml` comes from the host setting `App__PublicBaseUrl`. It must be the live origin: `https://` plus the live host. If step 12 or step 11 shows a wrong address, fix this setting in the host's app pool settings, restart the app pool, and run the checks again.

## When you are done

Tell Claude which steps you finished and what you saw in steps 6, 11, 12 and 13. Claude records the result in the phase notes.
