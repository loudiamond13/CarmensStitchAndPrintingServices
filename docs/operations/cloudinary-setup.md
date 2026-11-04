---
created: 2026-11-03T20:30:00-06:00
updated: 2026-11-03T20:30:00-06:00
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

## Later steps

Plan 09-25 adds the one-time command that creates the named photo sizes, and the step where you turn on strict transformations in the Cloudinary console. Do not turn strict mode on before that command has run.
