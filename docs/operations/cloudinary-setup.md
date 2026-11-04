---
created: 2026-11-03T20:30:00-06:00
updated: 2026-11-04T09:30:00-06:00
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

### What the monthly run tells you

Every monthly maintenance run now prints two lines: the storage used in GB and the credits used this month, for example `5.2 of 25 (20.8%)`. The run turns red in three cases:

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

1. Apply the deploy package's `csps-migrations.sql` to the live database. It adds the `OrderImages` and `ImageDeletions` tables. It only adds; nothing is dropped or changed.
2. Set these as app pool environment variables on the host: `Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret` and `Maintenance__Key` (32 or more characters). Never paste the values into a chat or into a tracked file.
3. Only when the database backup (plan 09-32) is built, also set `Maintenance__Backup__SqlServerFolder` and `Maintenance__Backup__AppFolder`. Keep both paths out of the repository and out of chat. Plan 09-32 waits for the hosting company's answer, so skip this item until it is built.
4. Add the GitHub repository secret `MAINTENANCE_KEY` with the same value as `Maintenance__Key`. Check that the variable `SITE_ORIGIN` is the live https address.
5. Deploy. Then take one photo with a phone camera on an Android phone and one on an iPhone, add each to a test order on the live site, and check that both show upright.
6. Press "Run now" on the Maintenance workflow once. The summary must be green and show counts only. When the backup is built it must also show `Database backups written: 1`. A line saying the backup "did not show up in the app folder" means the app-side folder path is wrong; see `docs/operations/maintenance.md`.

The steps for the key, the schedule and a red run are in `docs/operations/maintenance.md`.
