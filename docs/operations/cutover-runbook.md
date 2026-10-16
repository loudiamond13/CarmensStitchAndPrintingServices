# Runbook: switch the live site from the legacy app to CSPS

*Created: 2026-10-16T08:20:00-05:00 · Updated: 2026-10-16T17:00:00-05:00*

This is the numbered plan for the day CSPS replaces the legacy site on the live host (D-01, D-18, OPS-04). You do every control-panel step. Claude checks each result before the next step starts. The legacy data is kept byte for byte in a verified backup (`.bak`) first (D-03, D-04), and the legacy site's files are kept as a rollback kit (D-05).

Every step has the same five lines:

- **Who:** who does it.
- **What to do:** the actions.
- **Paste back:** what you send to Claude. It is never a secret: no password, key, certificate text or full connection string.
- **Claude checks:** how Claude verifies it, and where Claude records it (the cutover log, `.planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md`).
- **Stop if:** the case where you stop and tell Claude, instead of going on.

Go one step at a time. Do not start step N+1 until Claude has said step N is verified.

## Rules for the whole day

- A secret goes only into the place this runbook names for it (a host settings page, a GitHub secret prompt, a password manager). It never goes into chat, an issue, a file in the project folder or an email.
- Claude never contacts the live site, the host or its database unless you say so in so many words. Claude never creates or changes GitHub secrets. You do.
- The legacy database and the legacy files are never changed before Step 3. Until then the live legacy site keeps working.
- Names in this file are masked. A host name written `sql####.site4now.net` or `win####.site4now.net`, or a site name written `csptailoring-###-site1`, has the real digits in your control panel. The real database name is written `db_…_csptailoringdb`.

## Before you start

1. The pipeline pull request is merged, and `main` has a green CI run that stored a package (`csps-package-<sha>`, which holds the reviewed migration script `csps-migrations.sql`). Claude names the sha. See [deploy.md](deploy.md).
2. You have space for the rollback kit: about the size of the legacy site's files, plus the `.bak`, in this project's `_local` folder (it is git-ignored and never uploaded), and two more places off the host for the `.bak`.
3. SQL Server Management Studio (SSMS) is installed on your PC (you confirmed this).
4. A folder outside the project for secrets, for example `E:\CSPS-secrets\` (see [data-protection-rotation.md](data-protection-rotation.md)), and a password manager.
5. `gh` is signed in on your PC (`gh auth status`).
6. You know that from Step 3 on, visitors and staff see CSPS, and staff lose the legacy order screens until the order phases ship (D-01).

## What the control panel showed (you, 2026-10-16)

| Question | Answer |
|---|---|
| Remote access to the database | Yes, with SSMS. Server name format `sql####.site4now.net`. The port was not stated: the default (1433) is assumed and is not verified. Claude checks it in Step 6. |
| A second, lower-rights database user | Yes, on the "Create SQL User / Extra DB User" page. Such a user cannot connect with SSMS (apps and scripts only). The name is at most 32 characters. The password is 8 to 20 characters. Selectable roles include `db_datareader`, `db_datawriter`, `db_ddladmin`, `db_owner`, `db_backupoperator`, `db_securityadmin`, `db_accessadmin`. |
| Web Deploy address | `https://win####.site4now.net:8172/MsDeploy.axd?site=csptailoring-###-site1`. The server is the `win####.site4now.net` part and the site is the `site=` part. |
| App-pool settings | The pool menu has Configuration, then Environment Variables. The length limit of a value was not checked: Step 4 proves it. |
| App pool today | ASP.NET 4.x Integrated, 32-bit, Load User Profile Disabled, 256 MB, one pool and one site (the legacy site runs in it). The pool menu also offers Change to .Net Core, Change to ASP.NET 4.X Integrated or Classic, Change to 32-bit or 64-bit, Enable or Disable Load User Profile, Restart, Stop, Start, View Pool Log and Edit RAM Quota. |
| SSL | The certificate is valid and expires in 2027 (the exact date was not given; Step 7 reads it). |
| Addresses | The site must answer both `cspstailoring.com` and `www.cspstailoring.com`. |
| SSMS | Installed on your PC. |
| File manager | It cannot upload or unzip a `.zip`. You can use Web Deploy from VS Code. So the rollback kit is a plain folder that Web Deploy can put back, not a zip. |

## Step 1. A fresh backup and the legacy site's files

**Who:** You.

**What to do:**

1. In the control panel, make a fresh backup (`.bak`) of the legacy database and download it.
2. Keep two copies off the host (for example your password manager's file storage and an encrypted USB drive), and put one copy in this project's `_local` folder, named like `legacy-20261020.bak`. Never commit it, upload it to GitHub or send it to anyone.
3. Download the legacy site's files as a plain folder into `_local\legacy-site-files\` (the file manager's download or any free FTP client; FTP is offered). This folder is the D-05 rollback kit. Keep it as a folder, not a zip: the file manager cannot unzip, and Web Deploy restores a folder.
4. Open the legacy site's `web.config` in that folder only to check that it is there. Do not paste it anywhere: it holds the legacy connection string.

**Paste back:** the `.bak` file name and size, the name of the kit folder, and where the two off-host copies are (no contents, no passwords).

**Claude checks:** the `.bak` is in `_local` and git-ignored (`git check-ignore`), the kit folder holds a `web.config` and a `bin` folder, and nothing from `_local` is tracked. Claude then goes on to Step 2.

**Stop if:** the `.bak` download is incomplete or smaller than before, only one copy exists, or the file manager cannot download the site's files. The legacy site stays as it is.

## Step 2. Prove the backup, then confirm the receipt

**Who:** Claude restores it on this PC; you confirm the receipt.

**What to do:**

1. Claude runs the shared-machine preflight, then [`tools/scripts/Restore-LegacyReceipt.ps1`](../../tools/scripts/Restore-LegacyReceipt.ps1) with the `.bak` in `_local`. It restores only into `CSPS_Legacy_Restore` on `(localdb)\MSSQLLocalDB`, and writes `_local/legacy-receipt.md`: the `.bak` file name, size and SHA-256, the table count, the total rows and each table's name with its row count. No data value is read or written. The receipt lists production table names and volumes, so it stays in the git-ignored `_local` folder and is never committed; the script refuses a receipt path inside the repository but outside `_local`. With `-Replace`, the script checks the new `.bak` (`RESTORE VERIFYONLY`) before it drops the restore already there.
2. Claude pastes the receipt's table list into the chat.
3. In the control panel's query tool (look only), you run this on the live legacy database and compare:

   ```sql
   SELECT s.name + '.' + t.name AS [Schema.Table], SUM(p.rows) AS [Rows]
   FROM sys.tables AS t
   JOIN sys.schemas AS s ON s.schema_id = t.schema_id
   JOIN sys.partitions AS p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
   GROUP BY s.name, t.name
   ORDER BY s.name, t.name;
   ```

**Paste back:** "matches", or the names of the tables whose counts differ.

**Claude checks:** the receipt lists every table that your query lists. A table that has fewer rows in the receipt than on the host means the live site was used after the backup: repeat Step 1 with a new `.bak`. A few extra rows on the host are expected if staff used the site since the backup, but the final `.bak` must be taken after the last legacy use. Claude records the receipt's SHA-256 and the counts in the cutover log.

**Stop if:** the restore fails (a backup from a newer SQL Server version cannot be restored on an older LocalDB), a table is missing from the receipt, or the counts do not match. Nothing on the host has changed yet, so there is no harm.

## Step 3. Replace the legacy database with an empty SQL Server 2025 database

This is the point of no return (D-03). Deleting the host database removes the live copy. From here, legacy data lives only in the `.bak` until the Phase 16 import. The legacy site stops working at this moment.

**Who:** You, only after Claude says "Step 2 is confirmed, go ahead".

**What to do:**

1. Check once more that the two off-host copies and the `_local` copy of the `.bak`, and the kit folder, exist.
2. In the control panel, delete the legacy database. The Basic plan allows one database, so the old one goes first.
3. Create a new database and choose SQL Server 2025. If the panel shows a price for it, stop: only free options are allowed.
4. Create the lower-rights user for the site: open "Create SQL User / Extra DB User", pick the new database, and select only `db_datareader` and `db_datawriter`. The user name is at most 32 characters. The password is 8 to 20 characters: use only letters and digits, so it needs no escaping in a connection string. Keep both in your password manager. SSMS cannot connect as this user: the site and the bootstrap tool use it, and you use the database's main login (the one the panel shows for the database) for SSMS.
5. In the control panel's query tool (or SSMS, if you can connect), run:

   ```sql
   SELECT name, compatibility_level, collation_name FROM sys.databases WHERE name = DB_NAME();
   ```

**Paste back:** the result of that query with the database name replaced by `db_…_csptailoringdb`, and the line `SELECT @@VERSION` returns if you run it too. No user name, no password.

**Claude checks:** the version says SQL Server 2025. If the compatibility level is 170, Claude changes `SqlCompatibility.Level` from 160 to 170, re-runs `MigrationScriptTests`, and lands that change on `main` through a pull request with green CI. Steps 6 and 7 then use the new sha and its package. If it is 160, nothing changes. Claude records the version, level and collation in `.planning/HOSTING-RECORD.md` and the cutover log.

**Stop if:** SQL Server 2025 is not offered or costs money, the new database cannot be created, or the extra user cannot be created with only those two roles. Then the legacy site is already down: tell Claude at once. The way back is "If something goes wrong" below.

## Step 4. App pool: switch it to .NET Core, then add the settings

Do this step only now, after Step 3. The legacy site runs on the pool as it is today, and the switch would stop it. CSPS needs the pool to be a .NET Core one (it ships as a 64-bit in-process site), and the host probe in Step 5 needs it too.

**Who:** You.

**What to do:**

1. Switch the pool. In the control panel open the site's app pool (the pool is named like `csptailoring-###`) and use its menu:
   1. Change to .Net Core. The pool then runs with No Managed Code.
   2. Change to 64-bit.
   3. Enable Load User Profile.
   4. Restart the pool, then open View Pool Log if the panel shows a problem.
2. Add the host settings. Open the pool menu, Configuration, Environment Variables, and add each name below with its value. Type each value straight into the host page. A name written with two underscores is the same setting as the one with a colon.

   | Setting | Value |
   |---|---|
   | `ConnectionStrings__Csps` | The connection string of the new database for the lower-rights user, with encryption on. Build it from five parts in this order, as `Key=value;` pairs: `Server` (the `sql####.site4now.net` name), `Database` (the new database name), the user key `User Id` (the extra user's name), the password key (the extra user's password) and `Encrypt` (`True`). |
   | `Jwt__SigningKey` | A random value, base64 text of at least 32 bytes (made below). |
   | `Auth__CodeMacKey` | A different random value of the same kind (made below). |
   | `DataProtection__CertificateBase64` | The production certificate as base64 text (about 5,000 characters; made below). |
   | `DataProtection__CertificatePassword` | The certificate's password (made below). |
   | `Smtp__Host` | The SMTP server name from the control panel's mail settings for `no-reply@cspstailoring.com` ([mail-setup.md](mail-setup.md)). |
   | `Smtp__Port` | `587` (or what the panel shows). |
   | `Smtp__Security` | `StartTls` (or `SslOnConnect` for port 465). |
   | `Smtp__UserName` | `no-reply@cspstailoring.com` |
   | `Smtp__Password` | The mailbox password. |
   | `App__PublicBaseUrl` | `https://cspstailoring.com` (invite and reset links point here) |
   | `AllowedHosts` | `cspstailoring.com;www.cspstailoring.com` |

   Do not set `ASPNETCORE_ENVIRONMENT`: the host's default is Production. The issuer, the audience and the sender name are not secrets and ship in `appsettings.json`.
3. Make the random values on your PC, in a folder outside the project, and never show them:

   ```powershell
   # Two different keys, each 32 random bytes as base64. They are saved to files, never printed.
   $out = 'E:\CSPS-secrets\host-keys-2026'
   New-Item -ItemType Directory -Force -Path $out | Out-Null
   foreach ($name in 'JwtSigningKey', 'AuthCodeMacKey') {
       $bytes = New-Object byte[] 32
       [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
       [IO.File]::WriteAllText((Join-Path $out "$name.txt"), [Convert]::ToBase64String($bytes))
   }
   ```

   Make the production certificate with the steps in [data-protection-rotation.md](data-protection-rotation.md) ("Creating the production certificate") into a folder outside the project, and back it up in two places the same day. Copy the text of each file into the matching host setting.
4. Prove the long certificate value was saved whole. Save, then open the page again, select the whole `DataProtection__CertificateBase64` value, copy it, and run (with your own folder):

   ```powershell
   $file = (Get-Content 'E:\CSPS-secrets\data-protection-2026\CertificateBase64.txt' -Raw).Trim()
   $saved = (Get-Clipboard -Raw).Trim()
   "Same: $($file -ceq $saved). Length in the file: $($file.Length). Length saved: $($saved.Length)."
   ```

**Paste back:** the pool settings you now see (managed code: none, 64-bit, Load User Profile: enabled), the list of setting names that exist (names only, never values), the non-secret values you typed (`Smtp__Host`, `Smtp__Port`, `Smtp__Security`, `Smtp__UserName`, `App__PublicBaseUrl`, `AllowedHosts`), and the one line the check above printed.

**Claude checks:** every name in the table is present, the non-secret values are exactly as written, the pool settings are as listed, and the printed line says `Same: True`. A missing or wrong secret shows up at the first start as a message that names the setting and never shows the value. Claude records the result, and that the value-length question is answered, in the cutover log.

**Stop if:** `Same` is `False` or the lengths differ: the host cuts the long value. Do not go on. Either make a shorter certificate (change `Create(3072)` to `Create(2048)` in the certificate steps, which gives a value of about 2,700 characters, and repeat the check) or ask the developer to add a way to read the certificate from a file outside the site folder, which is a separate change that needs your approval. Also stop if the host will not save the pool change or a name.

## Step 5. Web Deploy credentials, the dry run and the one-time host check

**Who:** You set the secrets. Claude starts the dry run and the host check only when you say so.

**What to do:**

1. Add the repository secrets from your PC, inside the project folder. Each command asks for the value, hidden. Never paste a value into chat or a file:

   ```powershell
   gh secret set WEBDEPLOY_SERVER
   gh secret set WEBDEPLOY_SITE
   gh secret set WEBDEPLOY_USERNAME
   gh secret set WEBDEPLOY_PASSWORD
   gh variable set SITE_ORIGIN --body https://cspstailoring.com
   ```

   `WEBDEPLOY_SERVER` is the `win####.site4now.net` part of the Web Deploy address (no `https://`, no port). `WEBDEPLOY_SITE` is the `site=` part. The password must not contain a comma, a quote, a semicolon, a space or a control character; if the host gave you one with such a character, ask the host for a new one ([deploy.md](deploy.md), "Secrets and variables").
2. Run the read-only dry run: Claude asks you "may I start the dry run?" and starts it with `-f action=deploy -f sha=<sha> -f dry_run=true`. It changes nothing on the site.
3. If the dry run says the host certificate is not trusted, pin it. Read the fingerprint from your PC and store it as a secret (the fingerprint is a public value, but it is stored the same hidden way):

   ```powershell
   $server = 'win####.site4now.net'   # your real Web Deploy server
   $client = New-Object System.Net.Sockets.TcpClient($server, 8172)
   $ssl = New-Object System.Net.Security.SslStream($client.GetStream(), $false, { $true })
   $ssl.AuthenticateAsClient($server)
   $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
   $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($cert.RawData)
   ($hash | ForEach-Object { $_.ToString('x2') }) -join '' | gh secret set WEBDEPLOY_CERT_SHA256
   $ssl.Dispose(); $client.Dispose()
   ```

   Then Claude runs the dry run again.

   **The pin is a stop-gap, not full protection.** The workflow checks the fingerprint on one separate connection and then lets Web Deploy skip its own certificate check (`-allowUntrusted`) and send the deploy password. Someone who sits on the network path could pass that check and then read the later connections. Use the pin only while the host's certificate is untrusted, and prefer a certificate Windows already trusts for the Web Deploy address if the host can provide one (ask the host; this is not yet verified). A proper fix needs those host facts, so it is not built yet.
4. The one-time host check (allowed by you on 2026-10-15, plan 03-06): it puts the small probe app on the site root once, before the first CSPS deploy, and the next CSPS deploy removes it. It checks the .NET runtime patch, the compression setting, whether URL Rewrite exists, in-process hosting, the folders, the time zone and the certificate loading. Make a fresh key and store it, never printing it:

   ```powershell
   $bytes = New-Object byte[] 24
   [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   ($bytes | ForEach-Object { $_.ToString('x2') }) -join '' | gh secret set HOSTPROBE_KEY
   ```

   Claude asks "may I run the host check?" and runs the `hostprobe` action (rules in [the probe's README](../../tools/Csps.HostProbe/README.md)).
5. Delete the secret as soon as the probe has answered: `gh secret delete HOSTPROBE_KEY`.

**Paste back:** "secrets set" (names only), and the SITE_ORIGIN value. Claude reports the dry-run and probe results back to you.

**Claude checks:** `gh secret list` shows the secret names (not values), the dry run lists the files it would change and reached port 8172 with a good login, and the probe's facts (runtime patch, in-process, compression, URL Rewrite, certificate loading, time zone, memory) are recorded in `.planning/HOSTING-RECORD.md` as Verified with the evidence. If the runtime patch is too old, Claude plans a self-contained `win-x64` publish before Step 7.

**Stop if:** the dry run cannot log in or reach the host, the certificate does not match the pin, the probe finds the .NET runtime missing or the compression setting refused (Claude removes that setting through a change on `main` first), or `HOSTPROBE_KEY` is still set afterwards.

## Step 6. Apply the migration script to the new database

**Who:** Claude downloads the script. You run it in SSMS.

**What to do:**

1. Claude downloads `csps-migrations.sql` from the package of the sha to deploy into `artifacts\cutover`, checks it is the idempotent script (every migration guarded by its history check, no `DROP` of a table), and tells you the path.
2. In SSMS connect with: server name `sql####.site4now.net` (add `,1433` only if the connection fails), SQL Server Authentication, the database's main login. If SSMS shows a certificate warning, open Options, Connection Properties, and tick "Trust server certificate" for this connection. Do not use the lower-rights user: SSMS cannot connect as it.
3. Choose the new database in the toolbar, open `csps-migrations.sql`, and press Execute. It is safe to run more than once.
4. If SSMS cannot connect (the port may be closed on your network), use the control panel's query tool instead. It may not accept the `GO` lines: paste the script in pieces, one piece for each stretch between two `GO` lines, in order, and leave the `GO` lines out.
5. Run:

   ```sql
   SELECT MigrationId FROM dbo.__EFMigrationsHistory ORDER BY MigrationId;
   SELECT dp.name AS UserName, rp.name AS RoleName
   FROM sys.database_role_members AS m
   JOIN sys.database_principals AS dp ON dp.principal_id = m.member_principal_id
   JOIN sys.database_principals AS rp ON rp.principal_id = m.role_principal_id
   WHERE dp.name NOT IN ('dbo');
   ```

**Paste back:** the first result (migration ids), the second result with the lower-rights user's name replaced by `extra-user`, and which route worked (SSMS or the query tool, and whether the default port worked).

**Claude checks:** the migration ids equal the list in the package, the lower-rights user has exactly `db_datareader` and `db_datawriter`, and the script ran with no error. Claude records the route and the port answer in the cutover log and in the "Least-privilege SQL login" note below.

**Stop if:** the script reports an error part-way, or an id is missing. The script can be run again, but tell Claude first. Do not edit the database by hand.

## Step 7. The first deploy

**Who:** You press Run (or tell Claude, in so many words, to start it).

**What to do:**

1. Read [deploy.md](deploy.md), "The first deploy". The first deploy has no earlier release to go back to.
2. Run the Deploy workflow on `main`: action `deploy`, the 40-character sha Claude named, dry run off. Watch it to the end.
3. Open both `https://cspstailoring.com` and `https://www.cspstailoring.com` in a browser. Each must show the shop's holding page with no certificate warning. Click the padlock and read the certificate's expiry date.

**Paste back:** the workflow run's summary table (it holds no secret), the release name if it was created, and the certificate expiry date.

**Claude checks:** the smoke test passed, including the Host filtering check; both addresses answer on `/health`; and every "Verify on the first deploy (Phase 3)" row in `.planning/HOSTING-RECORD.md` is moved to Verified with its evidence, or left Unverified with the reason. The logs folder is writable and holds today's file.

**Stop if:** the run is red. On the first deploy the workflow does not roll back: it puts the "back in a minute" page back up and stops. Tell Claude. Fix the cause and run again, or use "If something goes wrong". Also stop if the app does not start: the log or the pool log names the setting that is wrong, never its value.

## Step 8. Create the first Manager and sign in

**Who:** You, with Claude beside you.

**What to do:**

1. Follow [bootstrap-manager.md](bootstrap-manager.md). Run the command on your PC, against the hosted database, as the lower-rights user, with the same certificate settings as the site (from your secrets folder). The connection string goes into the hidden prompt or this one terminal, never into chat. The `--confirm-database` value is the real database name, and `--public-base-url` is `https://cspstailoring.com`.
2. Open the invite email, set a password, and sign in with the 6-digit code that CSPS emails. Sign-in always ends with the emailed code ([mail-setup.md](mail-setup.md) if it does not arrive).
3. While signed in, open the browser's developer tools, Application, Cookies, and note the cookie names (never their values).

**Paste back:** the command's last line (exit code and the "Invite queued" line, nothing else), "invite arrived: yes or no", "signed in: yes or no", the cookie names, and any message the password step showed.

**Claude checks:** the Manager exists and signed in with the emailed code (AUTH-12, AUTH-13), the cookie names start with `__Secure-` on the HTTPS host, mail went out through port 587, and the breached-password check ran (the password step did not report the lookup as unreachable). Claude moves those HOSTING-RECORD rows to Verified with the evidence, and then the pool log and the logs folder are checked for warnings.

**Stop if:** the command exits with 2, 64 or 1 (read the table in [bootstrap-manager.md](bootstrap-manager.md)), the invite does not arrive, or sign-in fails. There is no way around the emailed code. If the site reports a database permission error for the lower-rights user, stop and tell Claude: see "Least-privilege SQL login".

## If something goes wrong

**Before you accept CSPS as live (the legacy kit, D-05).** CSPS will not start and cannot be fixed the same day:

1. Put the legacy files back with Web Deploy from the kit folder in `_local\legacy-site-files\`: publish that folder to the site from VS Code with "delete extra files on the host" on, so the CSPS files go. The file manager cannot unzip, so do not use a zip. If you prefer, Claude prepares the exact `msdeploy` command for you without any secret in it.
2. Switch the app pool back: Change to ASP.NET 4.X Integrated, Change to 32-bit, and Disable Load User Profile. Restart it.
3. Delete the new CSPS database (the plan allows one database), create a new database, and restore the `.bak` into it with the control panel's restore page. If the panel has no restore page, ask SmarterASP.NET support to restore it.
4. The legacy `web.config` in the kit holds its old connection string. If the new database has a new name or login, update that value in the control panel's way for the legacy site.
5. Check the legacy site works, and tell Claude. Nothing is lost: the `.bak` is the byte-for-byte copy.

**After you accept CSPS as live.** Rolling back means deploying an earlier CSPS version, not the legacy kit. See [deploy.md](deploy.md), "Roll back by hand". A rollback of the app alone works only when the database changes since then are backward compatible.

**If the site shows "back in a minute".** Run the Deploy workflow with action `online` ([deploy.md](deploy.md), "Recover with the online action").

## Least-privilege SQL login

The question (PRD 19.2) was whether the host allows a second, lower-rights database login. You answered yes on 2026-10-16.

- **The site and the bootstrap tool** use an extra database user with `db_datareader` and `db_datawriter` only. It cannot create, alter or drop anything, so it cannot switch off the audit log's append-only triggers (the old `db_owner` login could).
- **You** use the database's main login (`db_owner`) in SSMS to apply the migration script and for look-only checks.
- The extra user's password is 8 to 20 characters. Use only letters and digits, and keep it in your password manager. Rotate it by changing it in the control panel and in `ConnectionStrings__Csps`, then restarting the pool.
- The site uses one raw SQL call, `sp_getapplock`, for duplicate-request protection. It is allowed for a `db_datawriter` user. If a later phase needs more (a stored procedure, a sequence), a reviewed script gives that one right, and this note is updated.
- If the site reports a permission error with this user and it cannot be fixed with a reviewed script, the fallback is the main login in `ConnectionStrings__Csps`. That is an accepted risk and needs your explicit decision on record.
