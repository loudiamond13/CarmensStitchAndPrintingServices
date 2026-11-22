---
created: 2026-11-03T20:30:00-06:00
updated: 2026-11-22T16:10:00-06:00
---

# Cloudinary setup: where the photo keys go

Order photos are stored in your own free Cloudinary account. The server sends each photo to Cloudinary with a signed call. The signing key stays on the server and is never sent to a browser. This page says where the three values go and what never goes into git. It follows decisions D-05, D-06, D-07 and D-37 of Phase 9.

You do these steps. Claude never types your real keys. Nothing here costs money: it uses the free plan you already have.

## What you need from Cloudinary

Sign in to the Cloudinary console and copy three values:

| Value | Where it is | Setting name |
|-------|-------------|--------------|
| Cloud name | Dashboard | `Cloudinary__CloudName` |
| API key | Settings, then API Keys | `Cloudinary__ApiKey` |
| API secret | Settings, then API Keys | `Cloudinary__ApiSecret` |

The API secret is the password for your account's API. Treat it like a bank PIN: keep it in your password manager and never paste it in a chat, an issue, a commit or a document.

## Where each value goes

| Where | How | Name |
|-------|-----|------|
| This computer (development) | `dotnet user-secrets` | `Cloudinary:CloudName`, `Cloudinary:ApiKey`, `Cloudinary:ApiSecret` |
| The live host | App pool environment variables | `Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret` |

On this computer, run these from the repository folder in a normal PowerShell window. Replace each `<...>` with your own value as you type it. The values go into your private user-secrets store, not into git.

```powershell
dotnet user-secrets set "Cloudinary:CloudName" "<cloud name>" --project src/Csps.Server
dotnet user-secrets set "Cloudinary:ApiKey" "<api key>" --project src/Csps.Server
dotnet user-secrets set "Cloudinary:ApiSecret" "<api secret>" --project src/Csps.Server
```

On the host, add the three `Cloudinary__...` names as app pool environment variables in the SmarterASP.NET control panel, then restart the app pool if the site does not pick them up by itself.

## Two folders in one account

Development and the live site share your one Cloudinary account, each in its own root folder (D-07):

| Environment | Root folder | Set in |
|-------------|-------------|--------|
| Live | `csps` | `appsettings.json` |
| Development and any other | `csps-dev` | `appsettings.Development.json` |

Photos sit under `{root}/orders/{order id}/`. A cleanup or a stray-file check only touches its own environment's folder. The server refuses to start if a non-live host is set to `csps` or the live host is set to anything else, so a test run can never reach live photos.

## If the keys are missing

The site still starts and `/health` stays green. Uploading a photo answers "Photo uploads aren't set up yet." (HTTP 503). All three values must be present: with only one or two, the server behaves as if none were set.

## What never goes into git

The repository is public. Never commit, paste or write down in any tracked file:

- the cloud name, the API key or the API secret
- a connection string or any address that contains them
- a screenshot of the Cloudinary console that shows them

The automated tests use clearly fake values and never call Cloudinary. If a real value is ever committed by mistake, tell Claude straight away: the API secret must then be reset in the Cloudinary console, because git history cannot be recalled.

## Set up the photo sizes, then turn on strict mode

Do these steps in this order. The order matters.

Photos are only ever shown in 13 fixed sizes, called named sizes. Strict transformations is a Cloudinary setting that refuses every size except the named ones. That protects your free credits. But if you turn it on before the 13 sizes exist, Cloudinary refuses all of them and every photo on the site breaks. So the sizes come first and strict mode comes last (D-03, D-06, D-07).

1. **Put the three keys in your dev user-secrets.** Use the commands in "Where each value goes" above. The setup command reads the same store.
2. **Look first.** Run this from the repository folder. It changes nothing. It prints one line per size and a count:

   ```powershell
   dotnet run --project tools/Csps.CloudinarySetup -- --check
   ```

3. **Create the missing sizes.** Run the same command without `--check`:

   ```powershell
   dotnet run --project tools/Csps.CloudinarySetup
   ```

   It creates only the sizes that are missing. It is safe to run again: a size that already exists is left alone.
4. **Confirm "13 exist".** Run the `--check` command once more. The last line must say `13 exist`. If it does not, do not go on.
5. **Only now, turn on strict transformations.** In the Cloudinary console, go to Settings, then Security, and tick strict transformations. Do not turn it on any earlier.
6. **Add the three `Cloudinary__...` variables to the live host** (see "Where each value goes") before the deploy.

The command never prints your keys or your cloud name. It prints size names and counts only. It never asks a question. If the keys are missing it says so and stops.

### What the lines mean

| Line | Meaning |
|------|---------|
| `exists` | The size is there and matches what the site expects. |
| `missing` | The size is not there yet. The run without `--check` creates it. |
| `created` | The run just created it and allowed it under strict mode. |
| `different` | A size with that name exists but it is not the same as the site expects, or it is not allowed under strict mode. |

A size that is `different` is never changed by the command. Live photos already use it, and changing it would redraw them and spend credits. Stop and ask before you change it by hand. The command then ends with exit code 1.

### Development and live share these names

Development and the live site use one Cloudinary account, so they share the same 13 names. You run the setup once for the account. Both environments then use the same sizes. Their photos stay apart because each uses its own root folder.

### What the usage check tells you

The maintenance run prints two lines once a month (on its first run of each business month): the storage used in GB and the credits used this month, for example `5.2 of 25 (20.8%)`. The run turns red in three cases:

- Over 80% of the free plan is used (credits or storage).
- The plan's photo size limit is below `Images:MaxBytes`. Lower `Images:MaxBytes` in that case.
- Cloudinary usage could not be read, for example because the keys are wrong.

If photo storage is not set up, the run prints a plain line saying so and does not fail.

## Your one-time checks on the dev account (plan 09-30)

Claude cannot do these: they use your real account and your real photos. Do them after the three keys are in your dev user-secrets. Nothing here is committed, and the photos you use stay on your computer.

1. Run `dotnet run --project tools/Csps.CloudinarySetup -- --check`. It changes nothing. Note the last line (the count).
2. Run the same command without `--check`. Then run `--check` again. The last line must say `13 exist`.
3. In the Cloudinary console, Settings, Security, tick strict transformations.
4. Start the dev site (Claude can start it after the shared-machine check). Sign in and open a test order.
5. Add one real JPEG that has a location (a normal phone photo). Check that it shows upright and sharp. Click the photo, then "Open Full Size".
6. Add one real iPhone photo in the HEIC format. Check that it shows upright.
7. Open each full-size photo in any photo-info viewer. It must show no GPS location.
8. Tell Claude: the count line from step 2, whether strict mode is on, and what you saw for both photos (upright or not, GPS or not).

If the HEIC photo fails at Cloudinary, or a GPS location is still there, Claude opens a fix plan for the metadata stripper (plan 09-15) and does not ship.

## Release day: the list for the live site (plan 09-30)

Do these in order when Phase 9 goes live. The list is also copied into the plan 09-30 summary for `/gsd-verify-work`.

1. Apply the deploy package's `csps-migrations.sql` to the live database. It adds the `OrderImages`, `ImageDeletions` and `MaintenanceCursors` tables. It only adds; nothing is dropped or changed.
2. Set these as app pool environment variables on the host: `Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret` and `Maintenance__Key` (32 or more characters). Never paste the values into a chat or into a tracked file.
3. Database backups are deferred (D-51). The host's SQL server cannot write a backup file, so nothing in the app makes one and there are no backup settings to add. Take backups by hand in the hosting control panel until the owner decides on a backup plan.
4. Add the GitHub repository secret `MAINTENANCE_KEY` with the same value as `Maintenance__Key`. Check that the variable `SITE_ORIGIN` is the live https address.
5. Deploy. Then take one photo with a phone camera on an Android phone and one on an iPhone, add each to a test order on the live site, and check that both show upright.
6. Press "Run now" on the Maintenance workflow once, from `main`. The summary must be green and show counts only. It shows no database backup line, because backups are deferred (D-51).

The steps for the key, the schedule and a red run are in `docs/operations/maintenance.md`.

## Phase 11 sizes: run the setup command once after the Phase 11 deploy (D-44)

Phase 11 puts real photos on the public pages: the product lines, the gallery and the link preview picture. They need 21 more named
sizes. The numbers earlier on this page (13 sizes, "13 exist") are the Phase 9 count. With Phase 11 and the centre-cut sizes of D-130
(next section) the account holds 49 sizes, so the last line of the setup command reads `49 exist` once all of them are in.

Do this once, after the Phase 11 deploy and before you add the first public photo. The public photos need these sizes: without them a
public photo does not load, because strict mode refuses any size that is not named.

1. Make sure the three keys are in the environment you run it from (your dev user-secrets, as in "Set up the photo sizes" above).
2. Look first. This changes nothing and prints one line per size:

   ```powershell
   dotnet run --project tools/Csps.CloudinarySetup -- --check
   ```

   You should see `13 exist, 36 missing`: the 21 Phase 11 sizes plus the 15 centre-cut sizes.
3. Create the missing sizes. Run the same command without `--check`:

   ```powershell
   dotnet run --project tools/Csps.CloudinarySetup
   ```

   It creates only the sizes that are missing and allows them under strict mode. It never changes or deletes one of the 13 that live
   order photos already use. It is safe to run again.
4. Run `--check` once more. The last line must say `49 exist`. If it does not, do not go on.

The 21 new sizes, by use:

| Use | Names |
|---|---|
| Category cards on Home (4:5) | `csps_cat_320`, `csps_cat_480`, `csps_cat_640`, `csps_cat_800`, `csps_cat_960` |
| Recent work strip (4:5) | `csps_strip_240`, `csps_strip_480`, `csps_strip_720`, `csps_strip_1060` |
| Product large cell and gallery tiles (width limited) | `csps_w_280`, `csps_w_400`, `csps_w_560`, `csps_w_640`, `csps_w_800`, `csps_w_1280` |
| Product small cells (1:1) | `csps_sq_200`, `csps_sq_400`, `csps_sq_720` |
| Link preview picture (1200 x 630, JPEG) | `csps_share_1200` |
| Link preview previews in the admin screen (1.91:1) | `csps_share_320`, `csps_share_640` |

Since D-130 the site no longer uses the 15 smart-crop sizes in this table: the category card, strip, product small cell and both link
preview rows. It uses their centre-cut twins in the next section. The old ones stay in the account so addresses already handed out
keep working. Only the width-limited row is still in use.

This costs nothing beyond the free plan's normal use: a named size is a saved recipe, and Cloudinary only makes a copy when a photo is
first asked for in that size. The command never prints your keys or your cloud name.

Photos that Managers add to product lines are kept in their own folder, `{root}/content/`, apart from the order photos in
`{root}/orders/`. The monthly cleanup looks at both folders and queues any old file that no photo row names.

## Centre-cut public sizes (D-130)

The owner chose centred crops for the public site. The smart crop picks what it thinks is the main subject, and on a wide promo poster
it moved the Home category card window onto the shirts, which cut off the logo and the phone number. A centre cut always shows the
middle of the photo, the same way every time.

A size that live photos use is never changed, so the centre cut comes as 15 new names. Each is a `c_fill,g_center` fill of the same
box and format as its smart-crop twin above.

| Use | Names |
|---|---|
| Category cards on Home (4:5) | `csps_catc_320`, `csps_catc_480`, `csps_catc_640`, `csps_catc_800`, `csps_catc_960` |
| Recent work strip (4:5) | `csps_stripc_240`, `csps_stripc_480`, `csps_stripc_720`, `csps_stripc_1060` |
| Product small cells (1:1) | `csps_psqc_200`, `csps_psqc_400`, `csps_psqc_720` |
| Link preview picture (1200 x 630, JPEG) | `csps_sharec_1200` |
| Link preview previews in the admin screen (1.91:1) | `csps_sharec_320`, `csps_sharec_640` |

**Run the setup command before you deploy this change.** Until the sizes exist, strict mode refuses the new names and the public
photos do not load.

Your account already holds 34 sizes. Then:

1. Make sure the three keys are in place, as in "Set up the photo sizes" above.
2. Look first: `dotnet run --project tools/Csps.CloudinarySetup -- --check`. It must say `34 exist, 15 missing`.
3. Create them: `dotnet run --project tools/Csps.CloudinarySetup`. It creates the 15 and says `34 exist, 15 created`.
4. Run `--check` again. The last line must say `49 exist`.
5. If any size says `different`, stop and tell Claude. Do not deploy.
6. Deploy.

Photos already uploaded need no re-upload: each address is the stored photo plus the size name, so after the deploy they show centre
cut. Admin order photos keep the smart crop. This costs nothing beyond the free plan, the same as the other sizes.
