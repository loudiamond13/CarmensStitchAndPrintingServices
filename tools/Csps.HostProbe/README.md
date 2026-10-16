# Csps.HostProbe: one-time host check (FND-13)
*Created: 2026-10-07T11:15:24-05:00 · Updated: 2026-10-16T16:50:00-05:00*

This is a tiny, throwaway web app. It reports the facts about the SmarterASP.NET server that only the server itself
can show: the exact .NET version, whether the site runs inside IIS ("in-process"), how visitor addresses reach the
site, whether the Philippine time zone and peso format work, whether a certificate can be loaded, and how much
memory the app gets.

It is **never** part of the regular CSPS website deploy. By default it goes on a **separate, temporary site**, is opened
once, and is then deleted (the owner's D-28 decision, option-a, 2026-10-07). The owner made one exception on
2026-10-15 (see the first safety rule).

## Safety rules (read first)

- **Only once on the CSPS site root.** Put the probe on the site root only after the legacy site is retired (D-01) and
  before the first CSPS deploy, through the deploy workflow's `hostprobe` action (see below). The next CSPS deploy
  removes the probe's files. The action refuses to run once any `deploy-*` release exists. Never do this while the legacy site is in use: then the probe always gets its own new
  site or sub-address, as in the steps below. Owner decision: 2026-10-15T22:05-05:00 (plan 03-06, `allow-probe`).
- **Never touch the live database.** The probe does not connect to any database.
- **Keep the probe key secret.** Do not paste it into chat, email, the hosting record or git. Make a new key every
  time you run the probe, and throw it away afterwards.
- **Delete the probe site as soon as you have the result.**

## What the probe will and will not show

It shows runtime, folder, network and certificate facts only. It never shows passwords, connection strings,
settings values or environment variables. Without the right key it answers `401` with an empty page. If no key is
set (or the key is shorter than 32 characters) it answers `503` and stays closed.

## Steps

### 1. Build the probe package (on the development computer)

```powershell
dotnet publish tools/Csps.HostProbe -c Release -o artifacts/hostprobe
```

The `artifacts/` folder is never committed to git.

### 2. Make a fresh key (32 or more random characters)

In PowerShell on your computer:

```powershell
$b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
```

This prints a 48-character key. Keep it in a safe place (for example, your password manager) only until step 7.

### 3. Put the key in the published copy only

Open `artifacts/hostprobe/appsettings.json` (the **published** copy, not the one under `tools/`) and set:

```json
"HostProbe": { "Key": "<your-probe-key>" }
```

Never edit `tools/Csps.HostProbe/appsettings.json`. That copy stays empty so no key ever reaches git.

### 4. Create a new, separate site in the SmarterASP.NET control panel

- Add a **new** site or sub-address (for example a temporary address the control panel offers, or a new
  subdomain). It must not share a folder with the live site.
- If the control panel asks for a .NET version, choose the newest .NET (10) option.

### 5. Upload the probe

Upload **everything inside** `artifacts/hostprobe` to the new site's folder (Web Deploy or the file manager). Do not
upload anything to the live site.

### 6. Open the probe once

In PowerShell (use `curl.exe`, not `curl`, because in Windows PowerShell `curl` means something else):

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -H "X-Probe-Key: <your-probe-key>" https://<probe-site>/probe
```

The last line shows the answer code (`HTTP 200`, `HTTP 401` or `HTTP 503`).

Use `https://` if the new address supports it. If only `http://` works, that is acceptable for this one-time check
because the key is thrown away right after.

What the answer means:

- `HTTP 200` after a block of text starting with `{` and containing `"frameworkDescription"`: it worked.
- `HTTP 401`: the key in the command does not match the key in `appsettings.json`.
- `HTTP 503`: no key (or a key shorter than 32 characters) is set in the uploaded `appsettings.json`.

### 7. Paste the result back

Copy the whole `{ ... }` answer into the chat. Before you paste it:

- In `"remoteIpAddress"` and `"xForwardedFor"`, replace the **last number of your own IP address** with `x`
  (for example `203.0.113.x`).
- Make sure the key is **not** in what you paste.

### 8. Delete the probe site

Delete the new site (and its folder) in the control panel. Then run the command from step 6 again: it should fail
or show "not found". Throw the key away.

## Running the probe through the deploy workflow (the `hostprobe` action)

This is the one-time exception from the first safety rule. It uses the same Web Deploy path as a normal deploy
(`web/scripts/deploy.mjs`, run by `.github/workflows/deploy.yml`), so no steps 1 to 8 above are needed.

1. Make a fresh key (step 2 above) and save it as the repository secret `HOSTPROBE_KEY`. It must be 32 or more
   characters. The workflow never prints it and passes it to the reader through the environment only.
2. Run the deploy workflow with the action `hostprobe`. Set `probe_rewrite` to `true` to also test whether the host has
   the URL Rewrite module (it adds one HTTP-to-HTTPS rule to the probe's `web.config`).
3. The script publishes the probe into the runner's temp folder, writes the key into that published copy only, sets
   `<urlCompression doStaticCompression="false" doDynamicCompression="false" />` in its `web.config` (the setting CSPS
   ships, so a locked section shows up as a 500.19), puts the branded offline page up, syncs the probe, takes the page
   down, and reads `/probe` with `smoke.mjs probe`. There is no release and no rollback. If any step fails, the offline
   page is put back and the run fails.
4. Paste the facts the run printed into the chat (step 7 above, with the last number of your own IP replaced by `x`).
5. **Delete the `HOSTPROBE_KEY` secret.** The probe keeps answering until the first CSPS deploy replaces it, and it
   answers `401` without the key.
