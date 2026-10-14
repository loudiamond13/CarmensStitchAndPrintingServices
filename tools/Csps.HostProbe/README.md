# Csps.HostProbe: one-time host check (FND-13)

This is a tiny, throwaway web app. It reports the facts about the SmarterASP.NET server that only the server itself
can show: the exact .NET version, whether the site runs inside IIS ("in-process"), how visitor addresses reach the
site, whether the Philippine time zone and peso format work, whether a certificate can be loaded, and how much
memory the app gets.

It is **never** part of the CSPS website deploy. It goes on a **separate, temporary site**, is opened once, and is then
deleted. This follows the owner's D-28 decision (option-a, 2026-10-07).

## Safety rules (read first)

- **Never put the probe on the live site.** Do not upload it into the live site's folder, do not replace any live
  file, and do not restart the live site. It always gets its own new site or sub-address.
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
